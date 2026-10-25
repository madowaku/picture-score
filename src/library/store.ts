import { parseProject } from "../music/project";
import type { Project } from "../music/types";
import { parseBackup, planRestore, type SketchbookBackup } from "./backup";

export interface Artwork {
  id: string;
  project: Project;
  createdAt: number;
  updatedAt: number;
}

export const LIBRARY_DB = "picture-score:sketchbook";
const STORE = "artworks";
const ACTIVE_KEY = "picture-score:active-artwork:v1";

function projectStamp(project: Project): string {
  const text = JSON.stringify(project);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${hash >>> 0}`;
}

/** A partial localStorage write must never attach an old draft to another artwork. */
export function activeArtworkId(project: Project): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? "null");
    return value && typeof value.id === "string" && value.stamp === projectStamp(project) ? value.id : null;
  } catch { return null; }
}

export function rememberActiveArtwork(id: string | null, project: Project) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, JSON.stringify({ id, stamp: projectStamp(project) }));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* Studio reports draft saving errors. */ }
}

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LIBRARY_DB, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error("library-blocked")); };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

/** Writes resolve after commit: quota/transaction failures must never look saved. */
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
  const db = await openLibrary();
  return new Promise<T>((resolve, reject) => {
    let value: T;
    const tx = db.transaction(STORE, mode);
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("library-aborted")); };
    tx.onerror = () => { /* onabort handles failed requests. */ };
    try { run(tx.objectStore(STORE), result => { value = result; }); }
    catch (error) { tx.abort(); reject(error); }
  });
}

export function parseArtwork(value: unknown): Artwork {
  const item = value as Artwork;
  if (!item || typeof item.id !== "string" || !item.id ||
      !Number.isFinite(item.createdAt) || !Number.isFinite(item.updatedAt))
    throw new Error("invalid-artwork");
  return { id: item.id, createdAt: item.createdAt, updatedAt: item.updatedAt, project: parseProject(item.project) };
}

export async function listArtworks(): Promise<Artwork[]> {
  const rows = await transaction<unknown[]>("readonly", (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => done(request.result);
  });
  return rows.map(parseArtwork).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export function saveArtwork(project: Project, id: string | null = null): Promise<Artwork> {
  const snapshot = structuredClone(parseProject(project));
  if (!snapshot.strokes.length) return Promise.reject(new Error("empty-artwork"));
  return transaction("readwrite", (store, done) => {
    const key = id ?? crypto.randomUUID();
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        const now = Date.now();
        const item: Artwork = { id: key, project: snapshot, createdAt: request.result?.createdAt ?? now, updatedAt: now };
        store.put(item);
        done(item);
      } catch { store.transaction.abort(); }
    };
  });
}

export function renameArtwork(id: string, title: string): Promise<Artwork> {
  return transaction("readwrite", (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      try {
        if (!request.result) { store.transaction.abort(); return; }
        const item = parseArtwork(request.result);
        item.project = { ...item.project, title: title.trim().slice(0, 80) || item.project.title };
        item.updatedAt = Date.now();
        store.put(item);
        done(item);
      } catch { store.transaction.abort(); }
    };
  });
}

export function duplicateArtwork(item: Artwork, suffix: string): Promise<Artwork> {
  return saveArtwork({ ...item.project, title: item.project.title.slice(0, 80 - suffix.length) + suffix });
}

export function deleteArtwork(id: string): Promise<void> {
  return transaction("readwrite", (store, done) => { store.delete(id); done(undefined); });
}

export function restoreArtwork(item: Artwork): Promise<void> {
  return transaction("readwrite", (store, done) => { store.add(structuredClone(item)); done(undefined); });
}



/** Validate before opening the transaction; every addition commits or none do. */
export function importSketchbook(backup: SketchbookBackup): Promise<{ added: number; skipped: number }> {
  const incoming = structuredClone(parseBackup(backup).artworks);
  return transaction("readwrite", (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => {
      try {
        const plan = planRestore(request.result.map(parseArtwork), incoming, () => crypto.randomUUID());
        for (const item of plan.additions) store.add(item);
        done({ added: plan.additions.length, skipped: plan.skipped });
      } catch { store.transaction.abort(); }
    };
  });
}
