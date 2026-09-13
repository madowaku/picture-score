export type MusicalEventType =
  | "section"
  | "rhythm"
  | "harmony"
  | "melody"
  | "ornament"
  | "resonance";

export interface MusicalFrame {
  time: number;
  energy: number;
  brightness: number;
  density: number;
  beatStrength: number;
  melodyActivity: number;
  ornamentActivity: number;
  sustainLevel: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
}

interface BaseMusicalEvent {
  id: string;
  type: MusicalEventType;
  time: number;
  strength: number;
}

export interface RhythmEvent extends BaseMusicalEvent {
  type: "rhythm";
  subdivision?: 1 | 2 | 4 | 8 | 16;
}

export interface MelodyEvent extends BaseMusicalEvent {
  type: "melody";
  pitch: number;
  normalizedPitch: number;
  duration: number;
  direction?: "up" | "down" | "flat";
}

export interface HarmonyEvent extends BaseMusicalEvent {
  type: "harmony";
  tension: number;
  changeAmount: number;
  root?: number;
  quality?: string;
}

export interface OrnamentEvent extends BaseMusicalEvent {
  type: "ornament";
  brightness: number;
  complexity: number;
}

export interface ResonanceEvent extends BaseMusicalEvent {
  type: "resonance";
  duration: number;
  depth: number;
}

export interface SectionEvent extends BaseMusicalEvent {
  type: "section";
  index: number;
  confidence: number;
  energyDelta: number;
}

export type MusicalEvent =
  | RhythmEvent
  | MelodyEvent
  | HarmonyEvent
  | OrnamentEvent
  | ResonanceEvent
  | SectionEvent;

export interface MusicalTimeline {
  version: "picture-score:musical-ir:v1";
  duration: number;
  bpm?: number;
  frames: MusicalFrame[];
  events: MusicalEvent[];
  metadata: {
    analysisVersion: string;
  };
}
