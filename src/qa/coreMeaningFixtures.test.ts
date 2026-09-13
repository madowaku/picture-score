import { describe, expect, it } from "vitest";
import { clearingPalette } from "../palettes";
import type { PaletteRole } from "../palettes";
import { ScoreBloomSession } from "../world/runtime";
import { coreMeaningFixture, coreMeaningFixtures } from "./coreMeaningFixtures";

const roles: PaletteRole[] = ["melody", "harmony", "rhythm", "ornament", "resonance"];

const snapshotFor = (id: Parameters<typeof coreMeaningFixture>[0], reducedMotion = false) => {
  const fixture = coreMeaningFixture(id);
  const session = new ScoreBloomSession({
    trackId: `core-meaning:${id}`,
    seed: `core-meaning:${id}`,
    timeline: structuredClone(fixture.timeline),
    palette: clearingPalette,
    reducedMotion,
  });
  session.seek(fixture.timeline.duration);
  return session.snapshot();
};

const roleCounts = (id: Parameters<typeof coreMeaningFixture>[0], reducedMotion = false) => {
  const counts = Object.fromEntries(roles.map(role => [role, 0])) as Record<PaletteRole, number>;
  for (const entity of snapshotFor(id, reducedMotion).entities) counts[entity.role] += 1;
  return counts;
};

describe("Core Meaning QA fixtures", () => {
  it("keeps the five required listening fixtures stable", () => {
    expect(coreMeaningFixtures.map(fixture => fixture.id)).toEqual([
      "quiet-piano",
      "steady-beat",
      "dense-electronic",
      "ambient-long-tail",
      "ornament-heavy",
    ]);
    expect(coreMeaningFixtures.map(fixture => fixture.blindLabel)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("keeps quiet piano sparse and free of unrelated visual roles", () => {
    const snapshot = snapshotFor("quiet-piano");
    const counts = roleCounts("quiet-piano");
    expect(snapshot.entities.length).toBeLessThanOrEqual(6);
    expect(counts.melody).toBe(3);
    expect(counts.harmony).toBe(2);
    expect(counts.rhythm + counts.ornament + counts.resonance).toBe(0);
    expect(Math.max(...snapshot.entities.map(entity => entity.intensity))).toBeLessThan(0.5);
  });

  it("makes the steady beat overwhelmingly rhythm-led without global motion", () => {
    const snapshot = snapshotFor("steady-beat");
    const counts = roleCounts("steady-beat");
    expect(counts.rhythm).toBe(16);
    expect(counts.rhythm).toBeGreaterThan((snapshot.entities.length - counts.rhythm) * 4);
    expect(snapshot.entities.filter(entity => entity.role === "rhythm").every(entity => entity.motion.idleMotion === "none")).toBe(true);
  });

  it("keeps dense electronic multi-role but bounded", () => {
    const snapshot = snapshotFor("dense-electronic");
    const counts = roleCounts("dense-electronic");
    expect(snapshot.entities.length).toBeLessThanOrEqual(48);
    expect(roles.every(role => counts[role] > 0)).toBe(true);
    expect(counts.rhythm).toBeGreaterThan(counts.harmony);
    expect(counts.ornament).toBeGreaterThan(counts.resonance);
  });

  it("makes ambient resonance visible as grass and lets later resonance sway existing grass", () => {
    const snapshot = snapshotFor("ambient-long-tail");
    const counts = roleCounts("ambient-long-tail");
    expect(counts.resonance).toBe(3);
    expect(counts.resonance).toBeGreaterThan(counts.melody);
    expect(counts.resonance).toBeGreaterThan(counts.harmony);
    const grass = snapshot.entities.filter(entity => entity.role === "resonance");
    expect(grass.every(entity => entity.assetSrc === "/art/clearing-grass.webp")).toBe(true);
    expect(grass.every(entity => entity.motion.idleMotion === "sway")).toBe(true);
    expect(grass.some(entity => entity.reaction.revision > 1)).toBe(true);
  });

  it("makes ornament-heavy material visually ornament-led", () => {
    const snapshot = snapshotFor("ornament-heavy");
    const counts = roleCounts("ornament-heavy");
    expect(counts.ornament).toBe(12);
    expect(counts.ornament).toBeGreaterThan(snapshot.entities.length - counts.ornament);
    expect(snapshot.entities.filter(entity => entity.role === "ornament").every(entity => entity.assetSrc === "/art/clearing-star.webp")).toBe(true);
  });

  it("preserves semantic identity under reduced motion", () => {
    for (const fixture of coreMeaningFixtures) {
      const full = snapshotFor(fixture.id, false);
      const reduced = snapshotFor(fixture.id, true);
      expect(reduced.entities.map(entity => [entity.id, entity.role, entity.assetId])).toEqual(
        full.entities.map(entity => [entity.id, entity.role, entity.assetId]),
      );
      expect(reduced.entities.every(entity => entity.motion.idleMotion === "none")).toBe(true);
    }
  });
});
