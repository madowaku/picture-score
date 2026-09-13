export type WorldRole =
  | "melody"
  | "harmony"
  | "rhythm"
  | "ornament"
  | "resonance"
  | "section";

/**
 * Palette-independent spatial hint.
 * x: 0 = left, 1 = right.
 * y: 0 = musically low, 1 = musically high.
 * Palettes may reinterpret or constrain this hint to their own geometry.
 */
export interface PositionHint {
  x: number;
  y: number;
}

export interface MappingContext {
  trackSeed: string | number;
  eventIndex: number;
  sectionIndex: number;
  worldDensity: number;
}

interface WorldEventBase<TType extends string, TRole extends WorldRole> {
  id: string;
  type: TType;
  role: TRole;
  time: number;
  sourceEventId: string;
  seed: number;
}

export interface BirthEvent extends WorldEventBase<"birth", "melody"> {
  intensity: number;
  positionHint: PositionHint;
}

export interface GrowthEvent extends WorldEventBase<"growth", "melody"> {
  amount: number;
  targetHint: string;
}

export interface BloomEvent extends WorldEventBase<"bloom", "harmony"> {
  openness: number;
  tension: number;
  positionHint: PositionHint;
}

export interface PulseEvent extends WorldEventBase<"pulse", "rhythm"> {
  intensity: number;
  positionHint: PositionHint;
}

export interface SparkEvent extends WorldEventBase<"spark", "ornament"> {
  intensity: number;
  height: number;
  positionHint: PositionHint;
}

export interface SwayEvent extends WorldEventBase<"sway", "resonance"> {
  intensity: number;
  duration: number;
  direction: number;
  positionHint: PositionHint;
}

export interface AtmosphereEvent extends WorldEventBase<"atmosphere", "section"> {
  sectionIndex: number;
  confidence: number;
  energyDelta: number;
}

export type WorldEvent =
  | BirthEvent
  | GrowthEvent
  | BloomEvent
  | PulseEvent
  | SparkEvent
  | SwayEvent
  | AtmosphereEvent;
