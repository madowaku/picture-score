/** Stroke IR is immutable source geometry. Coordinates use a 1000 × 420 page. */
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  time: number;
}
export interface Stroke {
  id: string;
  points: StrokePoint[];
}
export interface ScoreNote {
  id: string;
  sourceIndex: number;
  pitch: number;
  beat: number;
  duration: number;
  velocity: number;
  sourceStroke: string;
  sourcePosition: { x: number; y: number };
  visualPosition: { x: number; y: number };
}
export interface SupportNote {
  pitch: number;
  beat: number;
  duration: number;
  velocity: number;
}
/** A performed gesture can own many visual notes. Source geometry stays intact. */
export interface PlayNote {
  id: string;
  pitch: number;
  beat: number;
  duration: number;
  velocity: number;
  sourceIds: string[];
  anchorId: string;
  articulation: "melody" | "sustain" | "chord";
  chordId?: string;
}
export interface MusicIR {
  key: "C";
  scale: "major-pentatonic";
  tempo: number;
  meter: [number, number];
  lengthBeats: number;
  drawing: ScoreNote[];
  playNotes: PlayNote[];
  support: SupportNote[];
}
export type Instrument = "Piano" | "Bell" | "Pluck" | "Toy" | "Soft Synth";
export interface Project {
  version: 1;
  title: string;
  strokes: Stroke[];
  canvasAspect: number;
  magnet: number;
  instrument: Instrument;
  tempo: number;
  accompaniment: boolean;
}
