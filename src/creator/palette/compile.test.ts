import { describe, expect, it } from "vitest";
import { validatePaletteDefinition } from "../../palettes/schema";
import type { PaletteRole } from "../../palettes";
import {
  compileCreatorPalette,
  createEmptyCreatorPaletteDraft,
  CREATOR_PALETTE_ROLES,
  creatorMotionPresets,
  creatorPlacementPresets,
  type CreatorAssetDraft,
} from "./index";

const makeAsset = (role: PaletteRole): CreatorAssetDraft => ({
  role,
  fileName: `${role}.png`,
  mimeType: "image/png",
  format: "png",
  byteSize: 1024,
  objectUrl: `blob:https://picture-score.test/${role}`,
  width: 256,
  height: 256,
  anchor: { x: 0.5, y: 0.8 },
  baseScale: 1,
});

const completeDraft = () => {
  const draft = createEmptyCreatorPaletteDraft("my-world", "My World");
  draft.authorName = "Palette Artist";
  for (const role of CREATOR_PALETTE_ROLES) draft.roles[role].asset = makeAsset(role);
  return draft;
};

describe("compileCreatorPalette", () => {
  it("compiles a complete five-role draft into a valid PaletteDefinition v1", () => {
    const result = compileCreatorPalette(completeDraft());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(validatePaletteDefinition(result.palette)).toBe(result.palette);
    expect(result.palette.id).toBe("creator:my-world");
    expect(result.palette.displayName).toBe("My World");
    expect(result.palette.author.name).toBe("Palette Artist");
    expect(Object.keys(result.palette.roles)).toEqual([...CREATOR_PALETTE_ROLES]);
  });

  it("derives deterministic palette and asset ids without using file names", () => {
    const first = completeDraft();
    const second = completeDraft();
    second.roles.melody.asset!.fileName = "renamed-but-same-role.png";

    const a = compileCreatorPalette(first);
    const b = compileCreatorPalette(second);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    expect(a.palette.id).toBe(b.palette.id);
    for (const role of CREATOR_PALETTE_ROLES) {
      expect(a.palette.roles[role].assets[0].id).toBe(`creator:my-world:${role}`);
      expect(b.palette.roles[role].assets[0].id).toBe(a.palette.roles[role].assets[0].id);
    }
  });

  it("preserves object URLs and compiles named placement/motion presets exactly", () => {
    const draft = completeDraft();
    draft.roles.melody.placementPreset = "sky";
    draft.roles.melody.motionPreset = "twinkle";

    const result = compileCreatorPalette(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.palette.roles.melody.assets[0].src).toBe(
      "blob:https://picture-score.test/melody",
    );
    expect(result.palette.roles.melody.placement).toEqual(creatorPlacementPresets.sky);
    expect(result.palette.roles.melody.motion).toEqual(creatorMotionPresets.twinkle);
  });

  it("uses safe fixed budgets and a local author fallback", () => {
    const draft = completeDraft();
    draft.authorName = "";
    const result = compileCreatorPalette(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.palette.author.name).toBe("Local Creator");
    expect(result.palette.limits.total).toBe(300);
    expect(result.palette.limits.roles).toEqual({
      melody: 80,
      harmony: 40,
      rhythm: 80,
      ornament: 60,
      resonance: 120,
    });
  });

  it("is deterministic and does not mutate the draft or preset tables", () => {
    const draft = completeDraft();
    const before = structuredClone(draft);
    const first = compileCreatorPalette(draft);
    const second = compileCreatorPalette(draft);

    expect(second).toEqual(first);
    expect(draft).toEqual(before);
    expect(creatorPlacementPresets.middle.zone).toBe("middle");
    expect(creatorMotionPresets["gentle-sway"].idleMotion).toBe("sway");
  });

  it("returns validation errors instead of throwing for malformed persisted presets", () => {
    const draft = completeDraft();
    (draft.roles.rhythm as unknown as { placementPreset: string }).placementPreset = "underground";
    (draft.roles.rhythm as unknown as { motionPreset: string }).motionPreset = "explode";

    const result = compileCreatorPalette(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map(item => item.code)).toEqual(expect.arrayContaining([
      "unknown-placement-preset",
      "unknown-motion-preset",
    ]));
  });
});
