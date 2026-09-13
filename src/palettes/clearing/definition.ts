import type { PaletteDefinition, PaletteRole } from "../types";

const asset = (role: PaletteRole, name: string, baseScale = 1) => ({
  id: `clearing-${role}-${name}`,
  src: `/art/clearing-${name}.webp`,
  format: "webp" as const,
  weight: 1,
  baseScale,
  anchor: { x: 0.5, y: role === "ornament" ? 0.5 : 0.82 },
});

/**
 * Official Palette #1. Clearing keeps the existing watercolor vocabulary while
 * exposing only neutral semantic roles to the SCORE BLOOM runtime.
 */
export const clearingPalette: PaletteDefinition = {
  version: "picture-score:palette:v1",
  id: "clearing",
  displayName: "Clearing",
  author: { name: "Picture Score" },
  roles: {
    melody: {
      assets: [asset("melody", "sprout", 1)],
      placement: {
        zone: "ground",
        clustering: 0.72,
        minDistance: 12,
        scaleRange: [0.88, 1.14],
        rotationRange: [-8, 8],
      },
      motion: {
        idleMotion: "sway",
        amplitude: 0.2,
        speed: 0.35,
        birthMotion: "grow",
        responseStrength: 0.75,
        reducedMotion: "fade-only",
      },
    },
    harmony: {
      assets: [asset("harmony", "flower", 1)],
      placement: {
        zone: "low",
        clustering: 0.42,
        minDistance: 26,
        scaleRange: [0.9, 1.18],
        rotationRange: [-5, 5],
      },
      motion: {
        idleMotion: "sway",
        amplitude: 0.12,
        speed: 0.25,
        birthMotion: "grow",
        responseStrength: 0.82,
        reducedMotion: "fade-only",
      },
    },
    rhythm: {
      assets: [asset("rhythm", "seeds", 0.82)],
      placement: {
        zone: "ground",
        clustering: 0.55,
        minDistance: 8,
        scaleRange: [0.78, 1.02],
        rotationRange: [-28, 28],
      },
      motion: {
        idleMotion: "none",
        amplitude: 0,
        speed: 0,
        birthMotion: "pop",
        responseStrength: 0.65,
        reducedMotion: "static",
      },
    },
    ornament: {
      assets: [asset("ornament", "star", 0.82)],
      placement: {
        zone: "sky",
        clustering: 0.22,
        minDistance: 20,
        scaleRange: [0.72, 1.04],
        rotationRange: [-18, 18],
      },
      motion: {
        idleMotion: "twinkle",
        amplitude: 0.42,
        speed: 0.9,
        birthMotion: "fade",
        responseStrength: 1,
        reducedMotion: "fade-only",
      },
    },
    resonance: {
      assets: [asset("resonance", "grass", 1)],
      placement: {
        zone: "ground",
        clustering: 0.9,
        minDistance: 4,
        scaleRange: [0.84, 1.12],
        rotationRange: [-8, 8],
      },
      motion: {
        idleMotion: "sway",
        amplitude: 0.25,
        speed: 0.2,
        birthMotion: "grow",
        responseStrength: 0.55,
        reducedMotion: "static",
      },
    },
  },
  environment: {
    initial: {
      energy: 0.28,
      brightness: 0.62,
      wind: 0.18,
      glow: 0.2,
      atmosphere: 0.52,
    },
    sectionResponse: {
      energy: 0.32,
      brightness: 0.16,
      wind: 0.2,
      glow: 0.18,
      atmosphere: 0.28,
    },
  },
  limits: {
    roles: {
      melody: 160,
      harmony: 60,
      rhythm: 120,
      ornament: 80,
      resonance: 260,
    },
    total: 680,
  },
};
