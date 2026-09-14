import type { PaletteRole } from "../../palettes";
import {
  CREATOR_ASSET_MAX_BYTES,
  CREATOR_PALETTE_MAX_BYTES,
  CREATOR_PALETTE_ROLES,
  validateCreatorPaletteDraft,
  type CreatorPaletteDraft,
} from "../palette";
import {
  CREATOR_PALETTE_RECORD_VERSION,
  CreatorPaletteStorageError,
  type CreatorPaletteAssetBlobs,
  type CreatorPaletteSummary,
  type MaterializedCreatorPalette,
  type StoredCreatorAssetRecord,
  type StoredCreatorPaletteDocument,
  type StoredCreatorPaletteRecord,
} from "./types";

const assetKey = (paletteId: string, role: PaletteRole): string => `${paletteId}:${role}`;

export function creatorPaletteSummary(record: StoredCreatorPaletteRecord): CreatorPaletteSummary {
  return {
    id: record.id,
    name: record.name,
    authorName: record.authorName,
    updatedAt: record.updatedAt,
    totalBytes: record.totalBytes,
  };
}

export function buildStoredCreatorPalette(
  draft: CreatorPaletteDraft,
  blobs: CreatorPaletteAssetBlobs,
  createdAt: number,
  updatedAt = createdAt,
): { record: StoredCreatorPaletteRecord; assets: StoredCreatorAssetRecord[] } {
  const validation = validateCreatorPaletteDraft(draft);
  if (validation.length) {
    throw new CreatorPaletteStorageError(
      "invalid-palette",
      validation[0]?.message ?? "This Creator Palette is not valid",
    );
  }

  const assets: StoredCreatorAssetRecord[] = [];
  let totalBytes = 0;
  const roles = Object.fromEntries(CREATOR_PALETTE_ROLES.map(role => {
    const roleDraft = draft.roles[role];
    const source = roleDraft.asset!;
    const blob = blobs[role];
    if (!blob) {
      throw new CreatorPaletteStorageError("asset-missing", `Missing saved image for ${role}`);
    }
    if (blob.size <= 0 || blob.size > CREATOR_ASSET_MAX_BYTES) {
      throw new CreatorPaletteStorageError("invalid-palette", `${role} image is empty or larger than 2 MB`);
    }
    totalBytes += blob.size;
    const key = assetKey(draft.id, role);
    assets.push({ key, paletteId: draft.id, role, byteSize: blob.size, blob });
    return [role, {
      role,
      assetKey: key,
      asset: {
        role,
        fileName: source.fileName,
        mimeType: source.mimeType,
        format: source.format,
        byteSize: blob.size,
        ...(source.width === undefined ? {} : { width: source.width }),
        ...(source.height === undefined ? {} : { height: source.height }),
        anchor: { ...source.anchor },
        baseScale: source.baseScale,
      },
      placementPreset: roleDraft.placementPreset,
      motionPreset: roleDraft.motionPreset,
    }];
  })) as StoredCreatorPaletteRecord["roles"];

  if (totalBytes > CREATOR_PALETTE_MAX_BYTES) {
    throw new CreatorPaletteStorageError("invalid-palette", "These five images are larger than 10 MB in total");
  }

  return {
    record: {
      version: CREATOR_PALETTE_RECORD_VERSION,
      id: draft.id.trim(),
      name: draft.name.trim(),
      authorName: draft.authorName.trim(),
      createdAt,
      updatedAt,
      totalBytes,
      roles,
    },
    assets,
  };
}

export function isStoredCreatorPaletteRecord(value: unknown): value is StoredCreatorPaletteRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredCreatorPaletteRecord>;
  if (
    record.version !== CREATOR_PALETTE_RECORD_VERSION ||
    typeof record.id !== "string" || !record.id.trim() ||
    typeof record.name !== "string" || !record.name.trim() ||
    typeof record.authorName !== "string" ||
    typeof record.createdAt !== "number" || !Number.isFinite(record.createdAt) ||
    typeof record.updatedAt !== "number" || !Number.isFinite(record.updatedAt) ||
    typeof record.totalBytes !== "number" || !Number.isFinite(record.totalBytes) || record.totalBytes < 0 ||
    !record.roles || typeof record.roles !== "object"
  ) return false;

  return CREATOR_PALETTE_ROLES.every(role => {
    const item = record.roles?.[role];
    return !!item &&
      item.role === role &&
      typeof item.assetKey === "string" && !!item.assetKey &&
      !!item.asset && item.asset.role === role &&
      typeof item.asset.fileName === "string" &&
      typeof item.asset.byteSize === "number" &&
      typeof item.asset.baseScale === "number" &&
      !!item.asset.anchor &&
      typeof item.asset.anchor.x === "number" &&
      typeof item.asset.anchor.y === "number" &&
      typeof item.placementPreset === "string" &&
      typeof item.motionPreset === "string";
  });
}

export function materializeCreatorPalette(
  document: StoredCreatorPaletteDocument,
  createObjectUrl: (blob: Blob) => string = blob => URL.createObjectURL(blob),
): MaterializedCreatorPalette {
  if (!isStoredCreatorPaletteRecord(document.record)) {
    throw new CreatorPaletteStorageError("corrupt-record", "This saved Creator Palette cannot be read");
  }

  const objectUrls = {} as Record<PaletteRole, string>;
  const roles = Object.fromEntries(CREATOR_PALETTE_ROLES.map(role => {
    const storedRole = document.record.roles[role];
    const blob = document.assets[role];
    if (!(blob instanceof Blob) || blob.size !== storedRole.asset.byteSize) {
      throw new CreatorPaletteStorageError("corrupt-record", `Saved ${role} image is missing or damaged`);
    }
    const objectUrl = createObjectUrl(blob);
    objectUrls[role] = objectUrl;
    return [role, {
      role,
      asset: {
        ...storedRole.asset,
        anchor: { ...storedRole.asset.anchor },
        objectUrl,
      },
      placementPreset: storedRole.placementPreset,
      motionPreset: storedRole.motionPreset,
    }];
  })) as CreatorPaletteDraft["roles"];

  return {
    draft: {
      version: "picture-score:creator-palette-draft:v1",
      id: document.record.id,
      name: document.record.name,
      authorName: document.record.authorName,
      roles,
    },
    blobs: { ...document.assets },
    objectUrls,
  };
}
