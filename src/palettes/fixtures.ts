import type {
  MotionProfile,
  PaletteDefinition,
  PaletteRole,
  PlacementZone,
} from "./types";

const zones: Record<PaletteRole, PlacementZone> = {
  melody: "middle",
  harmony: "low",
  rhythm: "ground",
  ornament: "sky",
  resonance: "ground",
};

const motionFor = (
  idleMotion: MotionProfile["idleMotion"],
  birthMotion: MotionProfile["birthMotion"],
  reducedMotion: MotionProfile["reducedMotion"],
): MotionProfile => ({
  idleMotion,
  amplitude: 0.25,
  speed: 0.4,
  birthMotion,
  responseStrength: 0.75,
  reducedMotion,
});

const createRole = (
  paletteId: string,
  role: PaletteRole,
  motion: MotionProfile,
) => ({
  assets: [
    {
      id: `${paletteId}-${role}-a`,
      src: `/fixture/${paletteId}-${role}-a.webp`,
      format: "webp" as const,
      weight: 2,
      baseScale: 1,
    },
    {
      id: `${paletteId}-${role}-b`,
      src: `/fixture/${paletteId}-${role}-b.webp`,
      format: "webp" as const,
      weight: 1,
      baseScale: 0.9,
    },
  ],
  placement: {
    zone: zones[role],
    clustering: 0.5,
    minDistance: 8,
    scaleRange: [0.8, 1.2] as [number, number],
    rotationRange: [-10, 10] as [number, number],
  },
  motion,
});

export const fixtureGardenPalette: PaletteDefinition = {
  version: "picture-score:palette:v1",
  id: "fixture-garden",
  displayName: "Fixture Garden",
  author: { name: "Picture Score Tests" },
  roles: {
    melody: createRole(
      "fixture-garden",
      "melody",
      motionFor("sway", "grow", "fade-only"),
    ),
    harmony: createRole(
      "fixture-garden",
      "harmony",
      motionFor("sway", "grow", "fade-only"),
    ),
    rhythm: createRole(
      "fixture-garden",
      "rhythm",
      motionFor("pulse", "pop", "static"),
    ),
    ornament: createRole(
      "fixture-garden",
      "ornament",
      motionFor("twinkle", "fade", "fade-only"),
    ),
    resonance: createRole(
      "fixture-garden",
      "resonance",
      motionFor("sway", "grow", "static"),
    ),
  },
  environment: {
    initial: {
      energy: 0.3,
      brightness: 0.6,
      wind: 0.2,
      glow: 0.25,
      atmosphere: 0.5,
    },
    sectionResponse: {
      energy: 0.5,
      brightness: 0.25,
      wind: 0.15,
      glow: 0.2,
      atmosphere: 0.4,
    },
  },
  limits: {
    roles: {
      melody: 6,
      harmony: 6,
      rhythm: 6,
      ornament: 6,
      resonance: 6,
    },
    total: 20,
  },
};

export const fixtureCrystalPalette: PaletteDefinition = {
  ...fixtureGardenPalette,
  id: "fixture-crystal",
  displayName: "Fixture Crystal",
  roles: {
    melody: createRole(
      "fixture-crystal",
      "melody",
      motionFor("float", "rise", "fade-only"),
    ),
    harmony: createRole(
      "fixture-crystal",
      "harmony",
      motionFor("pulse", "pop", "static"),
    ),
    rhythm: createRole(
      "fixture-crystal",
      "rhythm",
      motionFor("none", "fade", "static"),
    ),
    ornament: createRole(
      "fixture-crystal",
      "ornament",
      motionFor("twinkle", "pop", "fade-only"),
    ),
    resonance: createRole(
      "fixture-crystal",
      "resonance",
      motionFor("float", "fade", "static"),
    ),
  },
  environment: {
    initial: {
      energy: 0.2,
      brightness: 0.35,
      wind: 0.05,
      glow: 0.65,
      atmosphere: 0.7,
    },
    sectionResponse: {
      energy: 0.2,
      brightness: 0.4,
      wind: 0.05,
      glow: 0.6,
      atmosphere: 0.3,
    },
  },
};
