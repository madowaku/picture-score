import { describe, expect, it, vi } from "vitest";
import { canonicalMusicalTimelineFixture } from "../music/ir/fixtures";
import {
  mapMusicalTimeline,
  type AtmosphereEvent,
} from "../world/events";
import {
  fixtureCrystalPalette,
  fixtureGardenPalette,
} from "./fixtures";
import { PaletteRegistry } from "./registry";
import { createPaletteRuntime } from "./runtime";
import { validatePaletteDefinition } from "./schema";
import type { PaletteCue, PaletteDefinition, PaletteRuntime } from "./types";

const worldEvents = () =>
  mapMusicalTimeline(
    structuredClone(canonicalMusicalTimelineFixture),
    "palette-runtime-fixture",
  );

const applyAll = (runtime: PaletteRuntime): PaletteCue[] =>
  worldEvents().flatMap((event) => runtime.apply(event));

describe("Palette registry", () => {
  it("registers, loads and lists validated palettes by id", () => {
    const registry = new PaletteRegistry();
    registry.register(fixtureGardenPalette);
    registry.register(fixtureCrystalPalette);

    expect(registry.has("fixture-garden")).toBe(true);
    expect(registry.get("fixture-crystal")).toBe(fixtureCrystalPalette);
    expect(registry.list().map((palette) => palette.id)).toEqual([
      "fixture-crystal",
      "fixture-garden",
    ]);
    expect(() => registry.register(fixtureGardenPalette)).toThrow(/already registered/);
  });

  it("rejects invalid palette data before registration", () => {
    const broken = structuredClone(fixtureGardenPalette);
    broken.roles.melody.assets[0].weight = 0;
    expect(() => validatePaletteDefinition(broken)).toThrow(/weight/);
  });
});

describe("Palette runtime", () => {
  it("lets two palettes consume the same WorldEvent stream without changing lineage", () => {
    const garden = applyAll(createPaletteRuntime(fixtureGardenPalette));
    const crystal = applyAll(createPaletteRuntime(fixtureCrystalPalette));

    expect(
      crystal.map((cue) => [cue.type, cue.worldEventId, cue.sourceEventId]),
    ).toEqual(garden.map((cue) => [cue.type, cue.worldEventId, cue.sourceEventId]));

    const gardenAssets = garden
      .filter((cue) => cue.type === "spawn")
      .map((cue) => cue.asset.id);
    const crystalAssets = crystal
      .filter((cue) => cue.type === "spawn")
      .map((cue) => cue.asset.id);
    expect(crystalAssets).not.toEqual(gardenAssets);
  });

  it("is deterministic across reset and replay", () => {
    const runtime = createPaletteRuntime(fixtureGardenPalette);
    const first = applyAll(runtime);
    const firstSnapshot = runtime.snapshot();

    runtime.reset();
    const second = applyAll(runtime);
    expect(second).toEqual(first);
    expect(runtime.snapshot()).toEqual(firstSnapshot);
  });

  it("resolves reduced motion to static or fade-only fallbacks", () => {
    const cues = applyAll(
      createPaletteRuntime(fixtureGardenPalette, { reducedMotion: true }),
    );
    const melody = cues.find(
      (cue) => cue.type === "spawn" && cue.role === "melody",
    );
    const rhythm = cues.find(
      (cue) => cue.type === "spawn" && cue.role === "rhythm",
    );

    expect(melody?.type).toBe("spawn");
    if (melody?.type === "spawn") {
      expect(melody.motion.idleMotion).toBe("none");
      expect(melody.motion.birthMotion).toBe("fade");
      expect(melody.motion.amplitude).toBe(0);
    }

    expect(rhythm?.type).toBe("spawn");
    if (rhythm?.type === "spawn") {
      expect(rhythm.motion.idleMotion).toBe("none");
      expect(rhythm.motion.birthMotion).toBe("none");
      expect(rhythm.motion.responseStrength).toBe(0);
    }
  });

  it("enforces palette role limits and suppresses growth for an unspawned target", () => {
    const limited: PaletteDefinition = {
      ...structuredClone(fixtureGardenPalette),
      id: "fixture-limited",
      limits: {
        roles: {
          ...fixtureGardenPalette.limits.roles,
          melody: 0,
        },
        total: 20,
      },
    };
    const cues = applyAll(createPaletteRuntime(limited));
    expect(cues.some((cue) => cue.role === "melody")).toBe(false);
  });

  it("enforces the total spawn budget independently of role budgets", () => {
    const limited: PaletteDefinition = {
      ...structuredClone(fixtureGardenPalette),
      id: "fixture-total-limited",
      limits: {
        roles: { ...fixtureGardenPalette.limits.roles },
        total: 1,
      },
    };
    const runtime = createPaletteRuntime(limited);
    const cues = applyAll(runtime);
    expect(cues.filter((cue) => cue.type === "spawn")).toHaveLength(1);
    expect(runtime.snapshot().totalSpawned).toBe(1);
  });

  it("updates environment only from WorldEvents and resets cleanly", () => {
    const runtime = createPaletteRuntime(fixtureGardenPalette);
    const before = runtime.snapshot();
    const event: AtmosphereEvent = {
      id: "world:section-test:atmosphere",
      type: "atmosphere",
      role: "section",
      time: 0,
      sourceEventId: "section-test",
      seed: 123,
      sectionIndex: 1,
      confidence: 1,
      energyDelta: 0.5,
    };

    const cues = runtime.apply(event);
    expect(cues).toHaveLength(1);
    expect(cues[0].type).toBe("environment");
    expect(runtime.snapshot().environment.energy).toBeGreaterThan(
      before.environment.energy,
    );

    runtime.reset();
    expect(runtime.snapshot().environment).toEqual(before.environment);
  });

  it("never depends on Math.random", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used by palette runtime");
    });
    expect(() => applyAll(createPaletteRuntime(fixtureGardenPalette))).not.toThrow();
    spy.mockRestore();
  });
});
