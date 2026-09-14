import { CREATOR_PALETTE_ROLES } from "../palette";
import {
  buildStoredCreatorPalette,
  creatorPaletteSummary,
  isStoredCreatorPaletteRecord,
  materializeCreatorPalette,
} from "./records";
import {
  CREATOR_PALETTE_LIBRARY_MAX_BYTES,
  CREATOR_PALETTE_LIBRARY_MAX_COUNT,
  CreatorPaletteStorageError,
  type CreatorPaletteAssetBlobs,
  type CreatorPaletteRepository,
  type CreatorPaletteSummary,
  type StoredCreatorAssetRecord,
  type StoredCreatorPaletteDocument,
  type StoredCreatorPaletteRecord,
} from "./types";
import type { CreatorPaletteDraft } from "../palette";

const DB_NAME = "picture-score:creator-palettes";
const DB_VERSION = 1;
const PALETTE_STORE = "palettes";
const ASSET_STORE = "assets";

const request = <T>(value: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  value.onsuccess = () => resolve(value.result);
  value.onerror = () => reject(value.error ?? new Error("IndexedDB request failed"));
});

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });

const safeMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "Creator Palette storage failed";

export class IndexedDbCreatorPaletteRepository implements CreatorPaletteRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    const openingPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new CreatorPaletteStorageError(
          "storage-unavailable",
          "Creator Palette storage is not available in this browser",
        ));
        return;
      }

      const opening = indexedDB.open(DB_NAME, DB_VERSION);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        if (!db.objectStoreNames.contains(PALETTE_STORE)) {
          db.createObjectStore(PALETTE_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          db.createObjectStore(ASSET_STORE, { keyPath: "key" });
        }
      };
      opening.onsuccess = () => {
        const db = opening.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      opening.onerror = () => reject(new CreatorPaletteStorageError(
        "storage-unavailable",
        safeMessage(opening.error),
      ));
      opening.onblocked = () => reject(new CreatorPaletteStorageError(
        "storage-unavailable",
        "Creator Palette storage is blocked by another open tab",
      ));
    });
    const guarded = openingPromise.catch(error => {
      this.dbPromise = null;
      throw error;
    });
    this.dbPromise = guarded;
    return guarded;
  }

  async list(): Promise<CreatorPaletteSummary[]> {
    const db = await this.open();
    const transaction = db.transaction(PALETTE_STORE, "readonly");
    const values = await request(transaction.objectStore(PALETTE_STORE).getAll()) as unknown[];
    await transactionDone(transaction);
    return values
      .filter(isStoredCreatorPaletteRecord)
      .map(creatorPaletteSummary)
      .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  }

  async load(id: string): Promise<StoredCreatorPaletteDocument | null> {
    const db = await this.open();
    const transaction = db.transaction([PALETTE_STORE, ASSET_STORE], "readonly");
    const palettes = transaction.objectStore(PALETTE_STORE);
    const assets = transaction.objectStore(ASSET_STORE);
    const rawRecord = await request(palettes.get(id)) as unknown;
    if (rawRecord === undefined) {
      await transactionDone(transaction);
      return null;
    }
    if (!isStoredCreatorPaletteRecord(rawRecord)) {
      transaction.abort();
      throw new CreatorPaletteStorageError("corrupt-record", "This saved Creator Palette cannot be read");
    }

    const loaded = {} as StoredCreatorPaletteDocument["assets"];
    for (const role of CREATOR_PALETTE_ROLES) {
      const value = await request(assets.get(rawRecord.roles[role].assetKey)) as StoredCreatorAssetRecord | undefined;
      if (!value || value.paletteId !== id || value.role !== role || !(value.blob instanceof Blob)) {
        transaction.abort();
        throw new CreatorPaletteStorageError("corrupt-record", `Saved ${role} image is missing or damaged`);
      }
      loaded[role] = value.blob;
    }
    await transactionDone(transaction);
    return { record: rawRecord, assets: loaded };
  }

  async save(
    draft: CreatorPaletteDraft,
    blobs: CreatorPaletteAssetBlobs,
  ): Promise<CreatorPaletteSummary> {
    const db = await this.open();
    const transaction = db.transaction([PALETTE_STORE, ASSET_STORE], "readwrite");
    const palettes = transaction.objectStore(PALETTE_STORE);
    const assets = transaction.objectStore(ASSET_STORE);

    try {
      const existingValues = await request(palettes.getAll()) as unknown[];
      const existing = existingValues.filter(isStoredCreatorPaletteRecord);
      const previous = existing.find(item => item.id === draft.id);
      const now = Date.now();
      const built = buildStoredCreatorPalette(draft, blobs, previous?.createdAt ?? now, now);
      const nextCount = previous ? existing.length : existing.length + 1;
      if (nextCount > CREATOR_PALETTE_LIBRARY_MAX_COUNT) {
        transaction.abort();
        throw new CreatorPaletteStorageError(
          "palette-limit",
          `You can keep up to ${CREATOR_PALETTE_LIBRARY_MAX_COUNT} Creator Palettes on this device`,
        );
      }
      const currentBytes = existing.reduce((sum, item) => sum + item.totalBytes, 0) - (previous?.totalBytes ?? 0);
      if (currentBytes + built.record.totalBytes > CREATOR_PALETTE_LIBRARY_MAX_BYTES) {
        transaction.abort();
        throw new CreatorPaletteStorageError(
          "library-too-large",
          "Creator Palette storage is full. Delete a palette or use smaller images.",
        );
      }

      for (const asset of built.assets) assets.put(asset);
      palettes.put(built.record);
      await transactionDone(transaction);
      return creatorPaletteSummary(built.record);
    } catch (error) {
      if (error instanceof CreatorPaletteStorageError) throw error;
      try { transaction.abort(); } catch { /* already complete */ }
      throw new CreatorPaletteStorageError("write-failed", safeMessage(error));
    }
  }

  async rename(id: string, name: string): Promise<CreatorPaletteSummary> {
    const trimmed = name.trim();
    if (!trimmed) throw new CreatorPaletteStorageError("invalid-palette", "Give your palette a name");
    const db = await this.open();
    const transaction = db.transaction(PALETTE_STORE, "readwrite");
    const store = transaction.objectStore(PALETTE_STORE);
    const raw = await request(store.get(id)) as unknown;
    if (!isStoredCreatorPaletteRecord(raw)) {
      transaction.abort();
      throw new CreatorPaletteStorageError("not-found", "That Creator Palette is no longer saved");
    }
    const next: StoredCreatorPaletteRecord = { ...raw, name: trimmed, updatedAt: Date.now() };
    store.put(next);
    await transactionDone(transaction);
    return creatorPaletteSummary(next);
  }

  async duplicate(id: string, newId: string, newName: string): Promise<CreatorPaletteSummary> {
    const source = await this.load(id);
    if (!source) throw new CreatorPaletteStorageError("not-found", "That Creator Palette is no longer saved");
    if ((await this.list()).some(item => item.id === newId)) {
      throw new CreatorPaletteStorageError("duplicate-id", "That Creator Palette id is already in use");
    }
    const materialized = materializeCreatorPalette(source, blob => `indexeddb:${blob.size}`);
    const draft: CreatorPaletteDraft = {
      ...materialized.draft,
      id: newId,
      name: newName.trim() || `${source.record.name} copy`,
    };
    return this.save(draft, materialized.blobs);
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction([PALETTE_STORE, ASSET_STORE], "readwrite");
    const palettes = transaction.objectStore(PALETTE_STORE);
    const assets = transaction.objectStore(ASSET_STORE);
    const raw = await request(palettes.get(id)) as unknown;
    if (isStoredCreatorPaletteRecord(raw)) {
      for (const role of CREATOR_PALETTE_ROLES) assets.delete(raw.roles[role].assetKey);
    }
    palettes.delete(id);
    await transactionDone(transaction);
  }
}

let sharedRepository: IndexedDbCreatorPaletteRepository | null = null;

export function creatorPaletteRepository(): CreatorPaletteRepository {
  sharedRepository ??= new IndexedDbCreatorPaletteRepository();
  return sharedRepository;
}
