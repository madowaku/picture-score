import { describe, expect, it } from "vitest";
import { createEmptyCreatorPaletteDraft, CREATOR_PALETTE_ROLES } from "../palette";
import type { PaletteRole } from "../../palettes";
import {
  CREATOR_PALETTE_RECORD_VERSION,
  CreatorPaletteStorageError,
} from "./types";
import {
  buildStoredCreatorPalette,
  creatorPaletteSummary,
  isStoredCreatorPaletteRecord,
  materializeCreatorPalette,
} from "./records";

const completeDraft = () => {
  const draft = createEmptyCreatorPaletteDraft("saved", "Saved World");
  for (const role of CREATOR_PALETTE_ROLES) {
    draft.roles[role].asset = {
      role,
      fileName: `${role}.svg`,
      mimeType: "image/svg+xml",
      format: "svg",
      byteSize: 8,
      objectUrl: `blob:${role}`,
      width: 64,
      height: 64,
      anchor: { x: 0.5, y: 0.8 },
      baseScale: 1,
    };
  }
  return draft;
};

const blobs = (): Record<PaletteRole, Blob> => Object.fromEntries(
  CREATOR_PALETTE_ROLES.map(role => [role, new Blob(["12345678"], { type: "image/svg+xml" })]),
) as Record<PaletteRole, Blob>;

describe("Creator Palette persisted records", () => {
  it("stores versioned metadata separately from blobs", () => {
    const built = buildStoredCreatorPalette(completeDraft(), blobs(), 100, 200);
    expect(built.record.version).toBe(CREATOR_PALETTE_RECORD_VERSION);
    expect(built.record.totalBytes).toBe(40);
    expect(built.record.roles.melody.assetKey).toBe("saved:melody");
    expect(built.assets).toHaveLength(5);
    expect(built.assets.every(asset => asset.blob instanceof Blob)).toBe(true);
    expect(creatorPaletteSummary(built.record)).toEqual({
      id: "saved",
      name: "Saved World",
      authorName: "",
      updatedAt: 200,
      totalBytes: 40,
    });
  });

  it("materializes a fresh compile-ready draft after reload", () => {
    const built = buildStoredCreatorPalette(completeDraft(), blobs(), 100);
    const document = {
      record: built.record,
      assets: Object.fromEntries(built.assets.map(asset => [asset.role, asset.blob])) as Record<PaletteRole, Blob>,
    };
    const hydrated = materializeCreatorPalette(document, blob => `rehydrated:${blob.size}:${Math.random()}`);
    expect(hydrated.draft.id).toBe("saved");
    expect(hydrated.draft.name).toBe("Saved World");
    expect(hydrated.draft.roles.harmony.asset?.objectUrl).toContain("rehydrated:8:");
    expect(hydrated.draft.roles.resonance.placementPreset).toBe("low");
    expect(Object.keys(hydrated.objectUrls)).toHaveLength(5);
    expect(Object.keys(hydrated.blobs)).toHaveLength(5);
  });

  it("requires all five owned blobs when saving", () => {
    const missing = blobs();
    delete (missing as Partial<Record<PaletteRole, Blob>>).ornament;
    expect(() => buildStoredCreatorPalette(completeDraft(), missing, 100)).toThrowError(CreatorPaletteStorageError);
  });

  it("rejects corrupt persisted metadata instead of guessing a migration", () => {
    const built = buildStoredCreatorPalette(completeDraft(), blobs(), 100);
    expect(isStoredCreatorPaletteRecord(built.record)).toBe(true);
    expect(isStoredCreatorPaletteRecord({ ...built.record, version: "future:v9" })).toBe(false);
    expect(isStoredCreatorPaletteRecord({ ...built.record, roles: {} })).toBe(false);
  });

  it("rejects a damaged blob when materializing", () => {
    const built = buildStoredCreatorPalette(completeDraft(), blobs(), 100);
    const assets = Object.fromEntries(built.assets.map(asset => [asset.role, asset.blob])) as Record<PaletteRole, Blob>;
    assets.rhythm = new Blob(["bad"]);
    expect(() => materializeCreatorPalette({ record: built.record, assets }, () => "blob:x"))
      .toThrowError(/missing or damaged/);
  });
});
