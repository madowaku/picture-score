import { describe, expect, it } from "vitest";
import { clearingPalette } from "../clearing";
import { validatePaletteDefinition } from "../schema";
import type { PaletteDefinition, PaletteRole } from "../types";
import { coreMeaningFixtures } from "../../qa/coreMeaningFixtures";
import { ScoreBloomSession } from "../../world/runtime";
import { prismProofPalette } from "./definition";

const roles: PaletteRole[] = ["melody", "harmony", "rhythm", "ornament", "resonance"];

const run = (palette: PaletteDefinition, fixtureIndex: number, seed = "creator-proof") => {
  const fixture = coreMeaningFixtures[fixtureIndex];
  const session = new ScoreBloomSession({
    trackId: `creator-proof:${fixture.id}`,
    seed,
    timeline: structuredClone(fixture.timeline),
    palette,
    reducedMotion: false,
  });
  session.seek(fixture.timeline.duration);
  return session.snapshot();
};

const counts = (palette: PaletteDefinition, fixtureIndex: number) => {
  const snapshot = run(palette, fixtureIndex);
  return Object.fromEntries(roles.map(role => [
    role,
    snapshot.entities.filter(entity => entity.role === role).length,
  ])) as Record<PaletteRole, number>;
};

describe("Prism Creator Palette proof", () => {
  it("is a valid palette made from ordinary transparent SVG role assets", () => {
    expect(() => validatePaletteDefinition(prismProofPalette)).not.toThrow();
    for (const role of roles) {
      const definition = prismProofPalette.roles[role];
      expect(definition.assets).toHaveLength(1);
      expect(definition.assets[0].src).toMatch(/^\/art\/prism-.*\.svg$/);
      expect(definition.assets[0].format).toBe("svg");
    }
  });

  it("preserves semantic identity while producing a different visual vocabulary", () => {
    const clearing = run(clearingPalette, 2);
    const prism = run(prismProofPalette, 2);

    expect(prism.cursor).toBe(clearing.cursor);
    expect(prism.entities.map(entity => entity.origin.worldEventId)).toEqual(
      clearing.entities.map(entity => entity.origin.worldEventId),
    );
    expect(prism.entities.map(entity => entity.origin.musicalEventId)).toEqual(
      clearing.entities.map(entity => entity.origin.musicalEventId),
    );
    expect(prism.entities.every(entity => entity.assetSrc.startsWith("/art/prism-"))).toBe(true);
    expect(clearing.entities.every(entity => entity.assetSrc.startsWith("/art/clearing-"))).toBe(true);
    expect(prism).not.toEqual(clearing);
  });

  it("reproduces each palette deterministically with the same seed", () => {
    expect(run(clearingPalette, 2, "same-seed")).toEqual(run(clearingPalette, 2, "same-seed"));
    expect(run(prismProofPalette, 2, "same-seed")).toEqual(run(prismProofPalette, 2, "same-seed"));
  });

  it("keeps the five Core Meaning profiles recognizable", () => {
    const quiet = counts(prismProofPalette, 0);
    expect(quiet.melody).toBeGreaterThan(quiet.harmony - 1);
    expect(quiet.rhythm + quiet.ornament + quiet.resonance).toBe(0);

    const beat = counts(prismProofPalette, 1);
    expect(beat.rhythm).toBeGreaterThan((beat.melody + beat.harmony + beat.ornament + beat.resonance) * 2);

    const dense = counts(prismProofPalette, 2);
    expect(roles.every(role => dense[role] > 0)).toBe(true);

    const ambient = counts(prismProofPalette, 3);
    expect(ambient.resonance).toBeGreaterThanOrEqual(ambient.melody);
    expect(ambient.resonance).toBeGreaterThanOrEqual(ambient.harmony);

    const ornament = counts(prismProofPalette, 4);
    expect(ornament.ornament).toBeGreaterThanOrEqual(
      ornament.melody + ornament.harmony + ornament.rhythm + ornament.resonance,
    );
  });
});
