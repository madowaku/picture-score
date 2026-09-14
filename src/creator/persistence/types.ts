import type { PaletteRole } from "../../palettes";
import type {
  CreatorAssetDraft,
  CreatorMotionPresetId,
  CreatorPaletteDraft,
  CreatorPlacementPresetId,
} from "../palette";

export const CREATOR_PALETTE_RECORD_VERSION = "picture-score:creator-palette-record:v1" as const;
export const CREATOR_PALETTE_LIBRARY_MAX_BYTES = 40 * 1024 * 1024;
export const CREATOR_PALETTE_LIBRARY_MAX_COUNT = 12;

export type CreatorPaletteAssetBlobs = Partial<Record<PaletteRole, Blob>>;

export type StoredCreatorAssetMeta = Omit<CreatorAssetDraft, "objectUrl">;

export interface StoredCreatorRole {
  role: PaletteRole;
  assetKey: string;
  asset: StoredCreatorAssetMeta;
  placementPreset: CreatorPlacementPresetId;
  motionPreset: CreatorMotionPresetId;
}

export interface StoredCreatorPaletteRecord {
  version: typeof CREATOR_PALETTE_RECORD_VERSION;
  id: string;
  name: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  totalBytes: number;
  roles: Record<PaletteRole, StoredCreatorRole>;
}

export interface StoredCreatorAssetRecord {
  key: string;
  paletteId: string;
  role: PaletteRole;
  byteSize: number;
  blob: Blob;
}

export interface StoredCreatorPaletteDocument {
  record: StoredCreatorPaletteRecord;
  assets: Record<PaletteRole, Blob>;
}

export interface CreatorPaletteSummary {
  id: string;
  name: string;
  authorName: string;
  updatedAt: number;
  totalBytes: number;
}

export interface MaterializedCreatorPalette {
  draft: CreatorPaletteDraft;
  blobs: Record<PaletteRole, Blob>;
  objectUrls: Record<PaletteRole, string>;
}

export type CreatorPaletteStorageErrorCode =
  | "storage-unavailable"
  | "invalid-palette"
  | "asset-missing"
  | "palette-limit"
  | "library-too-large"
  | "not-found"
  | "duplicate-id"
  | "corrupt-record"
  | "write-failed";

export class CreatorPaletteStorageError extends Error {
  constructor(
    readonly code: CreatorPaletteStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CreatorPaletteStorageError";
  }
}

export interface CreatorPaletteRepository {
  list(): Promise<CreatorPaletteSummary[]>;
  load(id: string): Promise<StoredCreatorPaletteDocument | null>;
  save(draft: CreatorPaletteDraft, blobs: CreatorPaletteAssetBlobs): Promise<CreatorPaletteSummary>;
  rename(id: string, name: string): Promise<CreatorPaletteSummary>;
  duplicate(id: string, newId: string, newName: string): Promise<CreatorPaletteSummary>;
  delete(id: string): Promise<void>;
}
