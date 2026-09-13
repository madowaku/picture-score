import { describe, expect, it } from "vitest";
import { canonicalMusicalTimelineFixture } from "../../music/ir/fixtures";
import { mapMusicalTimeline } from "../../world/events";
import { createPaletteRuntime } from "../runtime";
import { validatePaletteDefinition } from "../schema";
import { clearingPalette } from "./definition";
import { createOfficialPaletteRegistry } from "./index";

const roleAssets = {
  melody: "/art/clearing-sprout.webp",
  harmony: "/art/clearing-flower.webp",
  rhythm: "/art/clearing-seeds.webp",
  ornament: "/art/clearing-star.webp",
  resonance: "/art/clearing-grass.webp",
} as const;

describe("Clearing official palette", () => {
  it("is a valid Palette v1 and loads through the official registry", () => {
    expect(validatePaletteDefinition(clearingPalette)).toBe(clearingPalette);
    const registry = createOfficialPaletteRegistry();
    expect(registry.get("clearing")).toBe(clearingPalette);
    expect(registry.list().map((palette) => palette.id)).toEqual(["clearing"]);
  });

  it("owns the five existing watercolor assets through neutral semantic roles", () => {
    for (const [role, src] of Object.entries(roleAssets)) {
      const definition = clearingPalette.roles[role as keyof typeof roleAssets];
      expect(definition.assets).toHaveLength(1);
      expect(definition.assets[0].src).toBe(src);
      expect(definition.assets[0].format).toBe("webp");
    }
  });

  it("preserves the intended placement vocabulary and bounded entity budget", () => {
    expect(clearingPalette.roles.melody.placement.zone).toBe("ground");
    expect(clearingPalette.roles.harmony.placement.zone).toBe("low");
    expect(clearingPalette.roles.rhythm.placement.zone).toBe("ground");
    expect(clearingPalette.roles.ornament.placement.zone).toBe("sky");
    expect(clearingPalette.roles.resonance.placement.zone).toBe("ground");
    expect(clearingPalette.limits.total).toBe(680);
    expect(
      Object.values(clearingPalette.limits.roles).reduce((sum, value) => sum + value, 0),
    ).toBe(680);
  });

  it("renders a deterministic palette cue stream from the SCORE BLOOM world events", () => {
    const events = mapMusicalTimeline(
      structuredClone(canonicalMusicalTimelineFixture),
      "clearing-contract-track",
    );
    const run = () => {
      const runtime = createPaletteRuntime(clearingPalette);
      return events.flatMap((event) => runtime.apply(event));
    };
    const first = run();
    const second = run();
    expect(second).toEqual(first);
    expect(first.some((cue) => cue.type === "spawn" && cue.role === "melody")).toBe(true);
    expect(first.some((cue) => cue.type === "spawn" && cue.role === "harmony")).toBe(true);
    expect(first.some((cue) => cue.type === "spawn" && cue.role === "rhythm")).toBe(true);
    expect(first.some((cue) => cue.type === "spawn" && cue.role === "ornament")).toBe(true);
    expect(first.some((cue) => cue.type === "react" && cue.role === "resonance")).toBe(true);
  });

  it("has quiet reduced-motion fallbacks for every role", () => {
    expect(clearingPalette.roles.melody.motion.reducedMotion).toBe("fade-only");
    expect(clearingPalette.roles.harmony.motion.reducedMotion).toBe("fade-only");
    expect(clearingPalette.roles.rhythm.motion.reducedMotion).toBe("static");
    expect(clearingPalette.roles.ornament.motion.reducedMotion).toBe("fade-only");
    expect(clearingPalette.roles.resonance.motion.reducedMotion).toBe("static");
  });
});
