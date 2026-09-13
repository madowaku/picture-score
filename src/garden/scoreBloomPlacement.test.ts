import { describe, expect, it, vi } from "vitest";
import { clearingPalette } from "../palettes";
import type { PaletteRole } from "../palettes";
import type { WorldEntity } from "../world/runtime";
import { intersectsClearing } from "./clearing";
import type { Clearing, GardenLayout } from "./clearing";
import { resolvePalettePlacement, resolvePalettePlacements } from "./scoreBloomPlacement";

const layout: GardenLayout = {
  width: 1000,
  height: 600,
  artworkWidth: 120,
  artworkHeight: 100,
};

const entity = (
  id: string,
  role: PaletteRole,
  seed = 1234,
  positionHint = { x: 0.5, y: 0.5 },
): WorldEntity => {
  const asset = clearingPalette.roles[role].assets[0];
  if (!asset) throw new Error(`missing fixture asset for ${role}`);
  return {
    id,
    role,
    assetId: asset.id,
    assetSrc: asset.src,
    createdAt: 1,
    positionHint,
    scale: 1,
    rotation: 0,
    intensity: 0.7,
    seed,
    origin: {
      musicalEventId: `music:${id}`,
      worldEventId: `world:${id}`,
      paletteCueId: id,
    },
    motion: {
      idleMotion: "none",
      amplitude: 0,
      speed: 0,
      birthMotion: "none",
      responseStrength: 0,
      reducedMotion: "static",
    },
    reaction: { amount: 0, revision: 0 },
  };
};

describe("score bloom placement", () => {
  it("resolves the same input to the same placement without Math.random", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used");
    });
    const source = entity("star-a", "ornament", 42, { x: 0.73, y: 0.91 });

    const first = resolvePalettePosition(source, clearingPalette, [], layout);
    const second = resolvePalettePosition(source, clearingPalette, [], layout);

    expect(second).toEqual(first);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("keeps role placements inside their palette zones", () => {
    const star = resolvePalettePosition(entity("star", "ornament"), clearingPalette, [], layout);
    const sprout = resolvePalettePosition(entity("sprout", "melody"), clearingPalette, [], layout);

    expect(star).not.toBeNull();
    expect(sprout).not.toBeNull();
    expect(star!.y).toBeGreaterThanOrEqual(60);
    expect(star!.y).toBeLessThanOrEqual(300);
    expect(sprout!.y).toBeGreaterThanOrEqual(700);
    expect(sprout!.y).toBeLessThanOrEqual(940);
  });

  it("nudges away from source-art clearings instead of painting over them", () => {
    const source = entity("star-clear", "ornament", 77, { x: 0.5, y: 0.5 });
    const base = resolvePalettePosition(source, clearingPalette, [], layout);
    expect(base).not.toBeNull();
    const blocking: Clearing = { id: "art", x: base!.x, y: base!.y, rx: 34, ry: 34 };

    const moved = resolvePalettePosition(source, clearingPalette, [blocking], layout);
    expect(moved).not.toBeNull();
    expect(moved).not.toEqual(base);
    expect(intersectsClearing({
      x: moved!.x,
      y: moved!.y,
      width: moved!.width,
      height: moved!.height,
    }, blocking)).toBe(false);
  });

  it("uses stable occupied order to keep crowded entities apart", () => {
    const first = entity("seed-a", "rhythm", 11, { x: 0.5, y: 0.5 });
    const second = { ...entity("seed-b", "rhythm", 11, { x: 0.5, y: 0.5 }), createdAt: 2 };

    const placements = resolvePalettePlacements([second, first], clearingPalette, [], layout);
    const a = placements.get(first.id);
    const b = placements.get(second.id);

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(b).not.toEqual(a);
    const dx = (a!.x - b!.x) * layout.width / 1000;
    const dy = (a!.y - b!.y) * layout.height / 1000;
    expect(Math.hypot(dx, dy)).toBeGreaterThan(clearingPalette.roles.rhythm.placement.minDistance);

    expect(resolvePalettePlacements([first, second], clearingPalette, [], layout)).toEqual(placements);
  });

  it("suppresses an entity when no safe candidate exists", () => {
    const blocked: Clearing = { id: "all", x: 500, y: 500, rx: 2000, ry: 2000 };
    const placement = resolvePalettePosition(
      entity("hidden", "harmony"),
      clearingPalette,
      [blocked],
      layout,
    );
    expect(placement).toBeNull();
  });
});
