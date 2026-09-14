import type { PaletteDefinition, PaletteRole } from "../types";

const asset = (
  role: PaletteRole,
  name: string,
  baseScale: number,
  anchor = { x: 0.5, y: 0.5 },
) => ({
  id: `prism-${role}-${name}`,
  src: `/art/prism-${name}.svg`,
  format: "svg" as const,
  weight: 1,
  baseScale,
  anchor,
});

/**
 * Internal Creator Palette proof. Prism deliberately uses only ordinary SVG
 * assets plus the existing neutral role/placement/motion vocabulary.
 */
export const prismProofPalette: PaletteDefinition = {
  version: "picture-score:palette:v1",
  id: "prism-proof",
  displayName: "Prism (Creator proof)",
  author: { name: "Picture Score QA" },
  roles: {
    melody: {
      assets: [asset("melody", "melody", 1.08)],
      placement: {
        zone: "middle",
        clustering: 0.28,
        minDistance: 22,
        scaleRange: [0.88, 1.28],
        rotationRange: [-24, 24],
      },
      motion: {
        idleMotion: "float",
        amplitude: 0.34,
        speed: 0.42,
        birthMotion: "rise",
        responseStrength: 0.82,
        reducedMotion: "fade-only",
      },
    },
    harmony: {
      assets: [asset("harmony", "harmony", 1.18)],
      placement: {
        zone: "upper",
        clustering: 0.18,
        minDistance: 34,
        scaleRange: [0.96, 1.34],
        rotationRange: [-10, 10],
      },
      motion: {
        idleMotion: "pulse",
        amplitude: 0.2,
        speed: 0.3,
        birthMotion: "grow",
        responseStrength: 0.9,
        reducedMotion: "static",
      },
    },
    rhythm: {
      assets: [asset("rhythm", "rhythm", 0.82, { x: 0.5, y: 0.82 })],
      placement: {
        zone: "low",
        clustering: 0.74,
        minDistance: 10,
        scaleRange: [0.68, 0.98],
        rotationRange: [-8, 8],
      },
      motion: {
        idleMotion: "none",
        amplitude: 0,
        speed: 0,
        birthMotion: "pop",
        responseStrength: 0.68,
        reducedMotion: "static",
      },
    },
    ornament: {
      assets: [asset("ornament", "ornament", 0.72)],
      placement: {
        zone: "sky",
        clustering: 0.08,
        minDistance: 28,
        scaleRange: [0.58, 0.92],
        rotationRange: [-45, 45],
      },
      motion: {
        idleMotion: "twinkle",
        amplitude: 0.5,
        speed: 1.12,
        birthMotion: "fade",
        responseStrength: 1,
        reducedMotion: "fade-only",
      },
    },
    resonance: {
      assets: [asset("resonance", "resonance", 1.3)],
      placement: {
        zone: "middle",
        clustering: 0.82,
        minDistance: 12,
        scaleRange: [1.0, 1.46],
        rotationRange: [-5, 5],
      },
      motion: {
        idleMotion: "float",
        amplitude: 0.16,
        speed: 0.16,
        birthMotion: "fade",
        responseStrength: 0.5,
        reducedMotion: "static",
      },
    },
  },
  environment: {
    initial: {
      energy: 0.18,
      brightness: 0.78,
      wind: 0.05,
      glow: 0.72,
      atmosphere: 0.32,
    },
    sectionResponse: {
      energy: 0.18,
      brightness: 0.38,
      wind: 0.08,
      glow: 0.52,
      atmosphere: 0.18,
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
