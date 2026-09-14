import type { PaletteRole } from "../../palettes";

export const CREATOR_PALETTE_ROLES: readonly PaletteRole[] = [
  "melody",
  "harmony",
  "rhythm",
  "ornament",
  "resonance",
];

export type CreatorAssetFormat = "png" | "webp" | "svg";

export interface CreatorAssetDraft {
  role: PaletteRole;
  fileName: string;
  mimeType: string;
  format: CreatorAssetFormat;
  byteSize: number;
  objectUrl: string;
  width?: number;
  height?: number;
  anchor: { x: number; y: number };
  baseScale: number;
}

export type CreatorPlacementPresetId =
  | "ground"
  | "low"
  | "middle"
  | "upper"
  | "sky"
  | "free";

export type CreatorMotionPresetId =
  | "still"
  | "gentle-sway"
  | "float"
  | "pulse"
  | "twinkle";

export interface CreatorRoleDraft {
  role: PaletteRole;
  asset: CreatorAssetDraft | null;
  placementPreset: CreatorPlacementPresetId;
  motionPreset: CreatorMotionPresetId;
}

export interface CreatorPaletteDraft {
  version: "picture-score:creator-palette-draft:v1";
  id: string;
  name: string;
  authorName: string;
  roles: Record<PaletteRole, CreatorRoleDraft>;
}

export type CreatorPaletteValidationCode =
  | "unsupported-version"
  | "name-required"
  | "id-required"
  | "role-missing"
  | "asset-missing"
  | "asset-role-mismatch"
  | "unsupported-format"
  | "mime-mismatch"
  | "empty-file"
  | "file-too-large"
  | "total-too-large"
  | "invalid-source"
  | "invalid-dimensions"
  | "invalid-anchor"
  | "invalid-scale"
  | "unknown-placement-preset"
  | "unknown-motion-preset";

export interface CreatorPaletteValidationError {
  code: CreatorPaletteValidationCode;
  message: string;
  role?: PaletteRole;
}

const DEFAULT_ROLE_DRAFTS: Record<
  PaletteRole,
  Pick<CreatorRoleDraft, "placementPreset" | "motionPreset">
> = {
  melody: { placementPreset: "middle", motionPreset: "gentle-sway" },
  harmony: { placementPreset: "upper", motionPreset: "float" },
  rhythm: { placementPreset: "ground", motionPreset: "still" },
  ornament: { placementPreset: "sky", motionPreset: "twinkle" },
  resonance: { placementPreset: "low", motionPreset: "gentle-sway" },
};

export function createEmptyCreatorPaletteDraft(
  id = "untitled",
  name = "My Palette",
): CreatorPaletteDraft {
  const roles = Object.fromEntries(
    CREATOR_PALETTE_ROLES.map(role => [
      role,
      {
        role,
        asset: null,
        ...DEFAULT_ROLE_DRAFTS[role],
      } satisfies CreatorRoleDraft,
    ]),
  ) as Record<PaletteRole, CreatorRoleDraft>;

  return {
    version: "picture-score:creator-palette-draft:v1",
    id,
    name,
    authorName: "",
    roles,
  };
}
