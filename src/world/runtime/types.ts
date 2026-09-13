import type {
  EnvironmentState,
  PaletteRole,
  ResolvedMotionProfile,
} from "../../palettes";

export interface EntityOrigin {
  musicalEventId: string;
  worldEventId: string;
  paletteCueId: string;
}

export interface WorldEntity {
  id: string;
  role: PaletteRole;
  assetId: string;
  assetSrc: string;
  createdAt: number;
  positionHint: { x: number; y: number };
  scale: number;
  rotation: number;
  intensity: number;
  seed: number;
  origin: EntityOrigin;
  motion: ResolvedMotionProfile;
  reaction: {
    amount: number;
    direction?: number;
    duration?: number;
    revision: number;
  };
}

export interface WorldSnapshot {
  version: "picture-score:world:v1";
  trackId: string;
  paletteId: string;
  seed: string | number;
  time: number;
  cursor: number;
  entities: WorldEntity[];
  environment: EnvironmentState;
}

export interface ScoreBloomFrame {
  revision: number;
  snapshot: WorldSnapshot;
}
