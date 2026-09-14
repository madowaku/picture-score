import type { MotionProfile, PlacementRule } from "../../palettes";
import type {
  CreatorMotionPresetId,
  CreatorPlacementPresetId,
} from "./types";

/**
 * Creator-facing placement choices. `minDistance` is screen-space pixels in the
 * current ScoreBloom renderer, so these values intentionally use pixel-scale
 * numbers rather than normalized fractions.
 */
export const creatorPlacementPresets = {
  ground: {
    zone: "ground",
    clustering: 0.28,
    minDistance: 10,
    scaleRange: [0.75, 1.05],
    rotationRange: [-8, 8],
  },
  low: {
    zone: "low",
    clustering: 0.34,
    minDistance: 12,
    scaleRange: [0.8, 1.12],
    rotationRange: [-10, 10],
  },
  middle: {
    zone: "middle",
    clustering: 0.42,
    minDistance: 14,
    scaleRange: [0.85, 1.15],
    rotationRange: [-12, 12],
  },
  upper: {
    zone: "upper",
    clustering: 0.36,
    minDistance: 14,
    scaleRange: [0.8, 1.1],
    rotationRange: [-15, 15],
  },
  sky: {
    zone: "sky",
    clustering: 0.25,
    minDistance: 16,
    scaleRange: [0.7, 1],
    rotationRange: [-18, 18],
  },
  free: {
    zone: "any",
    clustering: 0.3,
    minDistance: 14,
    scaleRange: [0.75, 1.1],
    rotationRange: [-20, 20],
  },
} satisfies Record<CreatorPlacementPresetId, PlacementRule>;

export const creatorMotionPresets = {
  still: {
    idleMotion: "none",
    amplitude: 0,
    speed: 0,
    birthMotion: "fade",
    responseStrength: 0.55,
    reducedMotion: "fade-only",
  },
  "gentle-sway": {
    idleMotion: "sway",
    amplitude: 0.2,
    speed: 0.35,
    birthMotion: "grow",
    responseStrength: 0.7,
    reducedMotion: "fade-only",
  },
  float: {
    idleMotion: "float",
    amplitude: 0.18,
    speed: 0.3,
    birthMotion: "rise",
    responseStrength: 0.65,
    reducedMotion: "fade-only",
  },
  pulse: {
    idleMotion: "pulse",
    amplitude: 0.22,
    speed: 0.6,
    birthMotion: "pop",
    responseStrength: 0.8,
    reducedMotion: "fade-only",
  },
  twinkle: {
    idleMotion: "twinkle",
    amplitude: 0.4,
    speed: 0.9,
    birthMotion: "fade",
    responseStrength: 1,
    reducedMotion: "fade-only",
  },
} satisfies Record<CreatorMotionPresetId, MotionProfile>;
