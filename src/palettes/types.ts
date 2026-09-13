import type { PositionHint, WorldEvent } from "../world/events";

export type PaletteRole =
  | "melody"
  | "harmony"
  | "rhythm"
  | "ornament"
  | "resonance";

export type PlacementZone =
  | "ground"
  | "low"
  | "middle"
  | "upper"
  | "sky"
  | "any";

export type IdleMotion = "none" | "sway" | "float" | "pulse" | "twinkle";
export type BirthMotion = "none" | "fade" | "grow" | "rise" | "pop";
export type ReducedMotionMode = "static" | "fade-only";

export interface AssetVariant {
  id: string;
  src: string;
  format: "png" | "webp" | "svg";
  weight: number;
  anchor?: { x: number; y: number };
  baseScale?: number;
}

export interface PlacementRule {
  zone: PlacementZone;
  clustering: number;
  minDistance: number;
  scaleRange: [number, number];
  rotationRange: [number, number];
}

export interface MotionProfile {
  idleMotion: IdleMotion;
  amplitude: number;
  speed: number;
  birthMotion: BirthMotion;
  responseStrength: number;
  reducedMotion: ReducedMotionMode;
}

export interface RoleDefinition {
  assets: AssetVariant[];
  placement: PlacementRule;
  motion: MotionProfile;
}

export interface EnvironmentState {
  energy: number;
  brightness: number;
  wind: number;
  glow: number;
  atmosphere: number;
}

export interface EnvironmentDefinition {
  initial: EnvironmentState;
  sectionResponse: EnvironmentState;
}

export interface PaletteLimits {
  roles: Record<PaletteRole, number>;
  total: number;
}

export interface PaletteDefinition {
  version: "picture-score:palette:v1";
  id: string;
  displayName: string;
  author: {
    name: string;
    url?: string;
  };
  roles: Record<PaletteRole, RoleDefinition>;
  environment: EnvironmentDefinition;
  limits: PaletteLimits;
}

export interface ResolvedMotionProfile
  extends Omit<MotionProfile, "reducedMotion"> {
  reducedMotion: ReducedMotionMode;
}

interface PaletteCueBase {
  id: string;
  paletteId: string;
  worldEventId: string;
  sourceEventId: string;
  seed: number;
}

export interface PaletteSpawnCue extends PaletteCueBase {
  type: "spawn";
  role: PaletteRole;
  asset: AssetVariant;
  positionHint: PositionHint;
  scale: number;
  rotation: number;
  intensity: number;
  motion: ResolvedMotionProfile;
}

export interface PaletteReactCue extends PaletteCueBase {
  type: "react";
  role: PaletteRole;
  targetCueId?: string;
  targetRole: PaletteRole;
  amount: number;
  direction?: number;
  duration?: number;
  motion: ResolvedMotionProfile;
}

export interface PaletteEnvironmentCue extends PaletteCueBase {
  type: "environment";
  role: "section";
  state: EnvironmentState;
}

export type PaletteCue =
  | PaletteSpawnCue
  | PaletteReactCue
  | PaletteEnvironmentCue;

export interface PaletteRuntimeSnapshot {
  paletteId: string;
  reducedMotion: boolean;
  spawnCounts: Record<PaletteRole, number>;
  totalSpawned: number;
  environment: EnvironmentState;
}

export interface PaletteRuntime {
  readonly definition: PaletteDefinition;
  apply(event: WorldEvent): PaletteCue[];
  reset(): void;
  snapshot(): PaletteRuntimeSnapshot;
}
