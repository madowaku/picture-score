import type { PaletteRole } from "../../palettes";
import {
  CREATOR_PALETTE_ROLES,
  type CreatorAssetDraft,
  type CreatorPaletteDraft,
  type CreatorPaletteValidationError,
} from "./types";

export const CREATOR_ASSET_MAX_BYTES = 2 * 1024 * 1024;
export const CREATOR_PALETTE_MAX_BYTES = 10 * 1024 * 1024;
export const CREATOR_ASSET_MAX_DIMENSION = 4096;
export const CREATOR_ASSET_MAX_PIXELS = 16_777_216;

const ROLE_LABELS: Record<PaletteRole, string> = {
  melody: "Melody",
  harmony: "Harmony",
  rhythm: "Rhythm",
  ornament: "Ornament",
  resonance: "Resonance",
};

const EXTENSIONS = {
  png: ".png",
  webp: ".webp",
  svg: ".svg",
} as const;

const MIME_TYPES = {
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
} as const;

const error = (
  code: CreatorPaletteValidationError["code"],
  message: string,
  role?: PaletteRole,
): CreatorPaletteValidationError => ({ code, message, ...(role ? { role } : {}) });

const isUnit = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

const validateAsset = (
  asset: CreatorAssetDraft,
  role: PaletteRole,
): CreatorPaletteValidationError[] => {
  const errors: CreatorPaletteValidationError[] = [];
  const label = ROLE_LABELS[role];
  const lowerName = asset.fileName.trim().toLowerCase();
  const expectedExtension = EXTENSIONS[asset.format];
  const expectedMime = MIME_TYPES[asset.format];

  if (asset.role !== role) {
    errors.push(error("asset-role-mismatch", `${label} image is assigned to the wrong role`, role));
  }

  if (!lowerName.endsWith(expectedExtension)) {
    errors.push(error("unsupported-format", `${label}: SVG, PNG, or WebP only`, role));
  }

  if (asset.mimeType && asset.mimeType.toLowerCase() !== expectedMime) {
    errors.push(error("mime-mismatch", `${label}: file type does not match its extension`, role));
  }

  if (!Number.isFinite(asset.byteSize) || asset.byteSize <= 0) {
    errors.push(error("empty-file", `${label}: this image is empty`, role));
  } else if (asset.byteSize > CREATOR_ASSET_MAX_BYTES) {
    errors.push(error("file-too-large", `${label}: this file is larger than 2 MB`, role));
  }

  if (!asset.objectUrl.trim()) {
    errors.push(error("invalid-source", `${label}: could not read this image`, role));
  }

  if (
    asset.width !== undefined ||
    asset.height !== undefined
  ) {
    const width = asset.width ?? 0;
    const height = asset.height ?? 0;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      width > CREATOR_ASSET_MAX_DIMENSION ||
      height > CREATOR_ASSET_MAX_DIMENSION ||
      width * height > CREATOR_ASSET_MAX_PIXELS
    ) {
      errors.push(error("invalid-dimensions", `${label}: image dimensions are too large or invalid`, role));
    }
  }

  if (!isUnit(asset.anchor.x) || !isUnit(asset.anchor.y)) {
    errors.push(error("invalid-anchor", `${label}: image anchor is invalid`, role));
  }

  if (!Number.isFinite(asset.baseScale) || asset.baseScale <= 0) {
    errors.push(error("invalid-scale", `${label}: image scale is invalid`, role));
  }

  return errors;
};

export function validateCreatorPaletteDraft(
  draft: CreatorPaletteDraft,
): CreatorPaletteValidationError[] {
  const errors: CreatorPaletteValidationError[] = [];

  if (!draft.id.trim()) errors.push(error("id-required", "Palette id is required"));
  if (!draft.name.trim()) errors.push(error("name-required", "Give your palette a name"));

  let totalBytes = 0;
  for (const role of CREATOR_PALETTE_ROLES) {
    const roleDraft = draft.roles[role];
    if (!roleDraft || roleDraft.role !== role) {
      errors.push(error("role-missing", `${ROLE_LABELS[role]} role is missing`, role));
      continue;
    }
    if (!roleDraft.asset) {
      errors.push(error("asset-missing", `Add an image for ${ROLE_LABELS[role]}`, role));
      continue;
    }

    totalBytes += Math.max(0, roleDraft.asset.byteSize);
    errors.push(...validateAsset(roleDraft.asset, role));
  }

  if (totalBytes > CREATOR_PALETTE_MAX_BYTES) {
    errors.push(error("total-too-large", "These five images are larger than 10 MB in total"));
  }

  return errors;
}
