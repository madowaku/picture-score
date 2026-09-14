import { validatePaletteDefinition } from "../../palettes/schema";
import type {
  EnvironmentDefinition,
  PaletteDefinition,
  PaletteLimits,
  PaletteRole,
  PlacementRule,
  MotionProfile,
} from "../../palettes";
import { creatorMotionPresets, creatorPlacementPresets } from "./presets";
import {
  CREATOR_PALETTE_ROLES,
  type CreatorPaletteDraft,
  type CreatorPaletteValidationError,
} from "./types";
import { validateCreatorPaletteDraft } from "./validate";

export type CompileCreatorPaletteResult =
  | {
      ok: true;
      palette: PaletteDefinition;
      errors: [];
    }
  | {
      ok: false;
      errors: CreatorPaletteValidationError[];
      palette?: never;
    };

const CREATOR_ENVIRONMENT: EnvironmentDefinition = {
  initial: {
    energy: 0.22,
    brightness: 0.58,
    wind: 0.12,
    glow: 0.18,
    atmosphere: 0.46,
  },
  sectionResponse: {
    energy: 0.25,
    brightness: 0.12,
    wind: 0.16,
    glow: 0.14,
    atmosphere: 0.2,
  },
};

const CREATOR_LIMITS: PaletteLimits = {
  roles: {
    melody: 80,
    harmony: 40,
    rhythm: 80,
    ornament: 60,
    resonance: 120,
  },
  total: 300,
};

const clonePlacement = (value: PlacementRule): PlacementRule => ({
  ...value,
  scaleRange: [...value.scaleRange],
  rotationRange: [...value.rotationRange],
});

const cloneMotion = (value: MotionProfile): MotionProfile => ({ ...value });

const creatorPaletteId = (draftId: string): string => `creator:${draftId.trim()}`;
const creatorAssetId = (paletteId: string, role: PaletteRole): string =>
  `${paletteId}:${role}`;

/**
 * Pure boundary from creator-owned draft data to the existing neutral palette
 * runtime. It performs no file reads and has no React, Musical IR, or mapper
 * dependency.
 */
export function compileCreatorPalette(
  draft: CreatorPaletteDraft,
): CompileCreatorPaletteResult {
  const errors = validateCreatorPaletteDraft(draft);
  if (errors.length) return { ok: false, errors };

  const paletteId = creatorPaletteId(draft.id);
  const roles = Object.fromEntries(
    CREATOR_PALETTE_ROLES.map(role => {
      const roleDraft = draft.roles[role];
      const asset = roleDraft.asset!;
      return [
        role,
        {
          assets: [
            {
              id: creatorAssetId(paletteId, role),
              src: asset.objectUrl,
              format: asset.format,
              weight: 1,
              anchor: { ...asset.anchor },
              baseScale: asset.baseScale,
            },
          ],
          placement: clonePlacement(
            creatorPlacementPresets[roleDraft.placementPreset],
          ),
          motion: cloneMotion(creatorMotionPresets[roleDraft.motionPreset]),
        },
      ];
    }),
  ) as PaletteDefinition["roles"];

  const palette: PaletteDefinition = {
    version: "picture-score:palette:v1",
    id: paletteId,
    displayName: draft.name.trim(),
    author: { name: draft.authorName.trim() || "Local Creator" },
    roles,
    environment: {
      initial: { ...CREATOR_ENVIRONMENT.initial },
      sectionResponse: { ...CREATOR_ENVIRONMENT.sectionResponse },
    },
    limits: {
      roles: { ...CREATOR_LIMITS.roles },
      total: CREATOR_LIMITS.total,
    },
  };

  validatePaletteDefinition(palette);
  return { ok: true, palette, errors: [] };
}
