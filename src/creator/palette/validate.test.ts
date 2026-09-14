import { describe, expect, it } from "vitest";
import type { PaletteRole } from "../../palettes";
import {
  CREATOR_ASSET_MAX_BYTES,
  CREATOR_PALETTE_ROLES,
  createEmptyCreatorPaletteDraft,
  validateCreatorPaletteDraft,
  type CreatorAssetDraft,
} from "./index";

const asset = (role: PaletteRole): CreatorAssetDraft => ({
  role,
  fileName: `${role}.webp`,
  mimeType: "image/webp",
  format: "webp",
  byteSize: 4096,
  objectUrl: `blob:https://picture-score.test/${role}`,
  width: 512,
  height: 512,
  anchor: { x: 0.5, y: 0.8 },
  baseScale: 1,
});

const completeDraft = () => {
  const draft = createEmptyCreatorPaletteDraft("valid", "Valid Palette");
  for (const role of CREATOR_PALETTE_ROLES) draft.roles[role].asset = asset(role);
  return draft;
};

const codes = (draft: ReturnType<typeof completeDraft>) =>
  validateCreatorPaletteDraft(draft).map(item => item.code);

describe("validateCreatorPaletteDraft", () => {
  it("accepts one valid asset for all five semantic roles", () => {
    expect(validateCreatorPaletteDraft(completeDraft())).toEqual([]);
  });

  it("reports a missing asset on the role that needs it", () => {
    const draft = completeDraft();
    draft.roles.rhythm.asset = null;
    expect(validateCreatorPaletteDraft(draft)).toContainEqual({
      code: "asset-missing",
      message: "Add an image for Rhythm",
      role: "rhythm",
    });
  });

  it("rejects extension/MIME mismatch and oversized files", () => {
    const draft = completeDraft();
    draft.roles.ornament.asset = {
      ...asset("ornament"),
      fileName: "spark.png",
      mimeType: "image/webp",
      format: "png",
      byteSize: CREATOR_ASSET_MAX_BYTES + 1,
    };
    expect(codes(draft)).toEqual(
      expect.arrayContaining(["mime-mismatch", "file-too-large"]),
    );
  });

  it("rejects empty source data, invalid dimensions, anchors, and scale", () => {
    const draft = completeDraft();
    draft.roles.melody.asset = {
      ...asset("melody"),
      byteSize: 0,
      objectUrl: "",
      width: 9000,
      height: 1,
      anchor: { x: -0.1, y: 1.2 },
      baseScale: 0,
    };
    expect(codes(draft)).toEqual(
      expect.arrayContaining([
        "empty-file",
        "invalid-source",
        "invalid-dimensions",
        "invalid-anchor",
        "invalid-scale",
      ]),
    );
  });

  it("rejects an empty palette name and a role-mismatched asset", () => {
    const draft = completeDraft();
    draft.name = "   ";
    draft.roles.harmony.asset = { ...asset("melody"), fileName: "harmony.webp" };
    expect(codes(draft)).toEqual(
      expect.arrayContaining(["name-required", "asset-role-mismatch"]),
    );
  });

  it("turns unknown saved-draft versions and presets into validation errors", () => {
    const draft = completeDraft();
    (draft as unknown as { version: string }).version = "picture-score:creator-palette-draft:v0";
    (draft.roles.melody as unknown as { placementPreset: string }).placementPreset = "ceiling";
    (draft.roles.harmony as unknown as { motionPreset: string }).motionPreset = "spin";

    expect(codes(draft)).toEqual(expect.arrayContaining([
      "unsupported-version",
      "unknown-placement-preset",
      "unknown-motion-preset",
    ]));
  });
});
