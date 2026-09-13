import { normalizeMusicalTimeline } from "../music/ir";
import type { MusicalEvent, MusicalFrame, MusicalTimeline } from "../music/ir";
import { deriveSeed } from "../world/events";
import type { GardenState, MusicalObject } from "./gardenState";

const CYCLE_BEATS = 16;
const ANALYSIS_VERSION = "garden-music-ir-adapter-v1";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const normalizedPitch = (pitch: number): number => clamp01((pitch - 48) / 36);
const pitchClass = (pitch: number): number => ((Math.round(pitch) % 12) + 12) % 12;
const cycleBeat = (beat: number): number => ((beat % CYCLE_BEATS) + CYCLE_BEATS) % CYCLE_BEATS;

const semanticObjectSignature = (object: MusicalObject): string => {
  const notes = object.musicIR.playNotes
    .map(note => [note.id, note.pitch, note.beat, note.duration, note.velocity, note.articulation, note.chordId ?? ""].join(":"))
    .join(",");
  return `${object.id}|${object.musicalRole}|${object.project.instrument}|${notes}`;
};

/** Musical identity deliberately excludes Garden positions, listener position and UI state. */
export function gardenScoreBloomIdentity(garden: GardenState): string {
  const parts = [...garden.objects]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(semanticObjectSignature);
  const value = deriveSeed(ANALYSIS_VERSION, garden.bpm, ...parts);
  return `garden:${value.toString(16).padStart(8, "0")}`;
}

const aggregateFrame = (garden: GardenState): MusicalFrame => {
  const notes = garden.objects.flatMap(object => object.musicIR.playNotes);
  const count = Math.max(1, notes.length);
  const meanVelocity = notes.reduce((sum, note) => sum + clamp01(note.velocity), 0) / count;
  const meanPitch = notes.reduce((sum, note) => sum + normalizedPitch(note.pitch), 0) / count;
  const roleCount = (role: MusicalObject["musicalRole"]) =>
    garden.objects.filter(object => object.musicalRole === role).length;
  const objectScale = Math.max(1, garden.objects.length);
  return {
    time: 0,
    energy: clamp01(meanVelocity),
    brightness: clamp01(meanPitch),
    density: clamp01(notes.length / Math.max(8, garden.objects.length * 12)),
    beatStrength: clamp01(roleCount("rhythm") / objectScale),
    melodyActivity: clamp01(roleCount("melody") / objectScale),
    ornamentActivity: clamp01(roleCount("decoration") / objectScale),
    sustainLevel: clamp01(roleCount("drone") / objectScale),
    lowEnergy: clamp01(1 - meanPitch),
    midEnergy: clamp01(1 - Math.abs(meanPitch - 0.5) * 2),
    highEnergy: clamp01(meanPitch),
  };
};

const eventsForObject = (object: MusicalObject, secondsPerBeat: number): MusicalEvent[] => {
  const notes = [...object.musicIR.playNotes].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch || a.id.localeCompare(b.id));
  let previousPitch: number | undefined;
  return notes.map((note, index): MusicalEvent => {
    const time = cycleBeat(note.beat) * secondsPerBeat;
    const strength = clamp01(note.velocity);
    const id = `garden:${object.id}:${object.musicalRole}:${index}:${note.id}`;
    const duration = Math.max(0, note.duration * secondsPerBeat);
    const np = normalizedPitch(note.pitch);
    const interval = previousPitch === undefined ? 0 : Math.abs(note.pitch - previousPitch);
    const direction = previousPitch === undefined || note.pitch === previousPitch
      ? "flat" as const
      : note.pitch > previousPitch ? "up" as const : "down" as const;
    previousPitch = note.pitch;

    switch (object.musicalRole) {
      case "melody":
        return { id, type: "melody", time, strength, pitch: note.pitch, normalizedPitch: np, duration, direction };
      case "harmony":
        return {
          id,
          type: "harmony",
          time,
          strength,
          tension: clamp01(interval / 12),
          changeAmount: clamp01(interval / 7),
          root: pitchClass(note.pitch),
          quality: note.articulation === "chord" ? "drawn-chord" : "drawn-harmony",
        };
      case "rhythm":
        return { id, type: "rhythm", time, strength, subdivision: 4 };
      case "decoration":
        return {
          id,
          type: "ornament",
          time,
          strength,
          brightness: np,
          complexity: clamp01(0.55 + strength * 0.45),
        };
      case "drone":
        return { id, type: "resonance", time, strength, duration, depth: clamp01(1 - np) };
    }
  });
};

export interface GardenScoreBloomSource {
  identity: string;
  trackId: string;
  seed: number;
  timeline: MusicalTimeline;
}

/**
 * Compatibility bridge from the existing drawing-derived MusicIR into Musical IR.
 * One 16-beat Garden phrase is semantic source truth; repeated playback re-hears the
 * same events instead of inventing duplicate world entities on every loop.
 */
export function gardenScoreBloomSource(garden: GardenState): GardenScoreBloomSource | null {
  if (!garden.objects.length) return null;
  const secondsPerBeat = 60 / garden.bpm;
  const duration = CYCLE_BEATS * secondsPerBeat;
  const identity = gardenScoreBloomIdentity(garden);
  const seed = deriveSeed(identity, "score-bloom");
  const events: MusicalEvent[] = [
    {
      id: `${identity}:section:0`,
      type: "section",
      time: 0,
      strength: 0.5,
      index: 0,
      confidence: 1,
      energyDelta: 0,
    },
    ...garden.objects.flatMap(object => eventsForObject(object, secondsPerBeat)),
  ];

  const timeline = normalizeMusicalTimeline({
    version: "picture-score:musical-ir:v1",
    duration,
    bpm: garden.bpm,
    frames: [aggregateFrame(garden)],
    events,
    metadata: { analysisVersion: ANALYSIS_VERSION },
  });

  return { identity, trackId: identity, seed, timeline };
}
