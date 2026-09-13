import { normalizeMusicalTimeline } from "../music/ir";
import type { MusicalEvent, MusicalFrame, MusicalTimeline } from "../music/ir";
import type { PaletteRole } from "../palettes";

export type CoreMeaningFixtureId =
  | "quiet-piano"
  | "steady-beat"
  | "dense-electronic"
  | "ambient-long-tail"
  | "ornament-heavy";

export interface CoreMeaningFixture {
  id: CoreMeaningFixtureId;
  blindLabel: "A" | "B" | "C" | "D" | "E";
  title: string;
  description: string;
  expectedPrimaryRole?: PaletteRole;
  timeline: MusicalTimeline;
}

const frame = (
  time: number,
  overrides: Partial<Omit<MusicalFrame, "time">> = {},
): MusicalFrame => ({
  time,
  energy: 0.35,
  brightness: 0.5,
  density: 0.3,
  beatStrength: 0.2,
  melodyActivity: 0.25,
  ornamentActivity: 0.1,
  sustainLevel: 0.2,
  lowEnergy: 0.3,
  midEnergy: 0.5,
  highEnergy: 0.2,
  ...overrides,
});

const section = (
  id: string,
  time: number,
  energyDelta = 0,
): Extract<MusicalEvent, { type: "section" }> => ({
  id,
  type: "section",
  time,
  strength: 0.5,
  index: Math.round(time),
  confidence: 1,
  energyDelta,
});

const melody = (
  id: string,
  time: number,
  pitch: number,
  strength: number,
  duration = 0.8,
  direction: "up" | "down" | "flat" = "flat",
): Extract<MusicalEvent, { type: "melody" }> => ({
  id,
  type: "melody",
  time,
  strength,
  pitch,
  normalizedPitch: Math.max(0, Math.min(1, (pitch - 48) / 36)),
  duration,
  direction,
});

const harmony = (
  id: string,
  time: number,
  root: number,
  strength: number,
  changeAmount: number,
  tension = 0.2,
): Extract<MusicalEvent, { type: "harmony" }> => ({
  id,
  type: "harmony",
  time,
  strength,
  tension,
  changeAmount,
  root,
  quality: "qa-harmony",
});

const rhythm = (
  id: string,
  time: number,
  strength: number,
): Extract<MusicalEvent, { type: "rhythm" }> => ({
  id,
  type: "rhythm",
  time,
  strength,
  subdivision: 4,
});

const ornament = (
  id: string,
  time: number,
  strength: number,
  brightness: number,
): Extract<MusicalEvent, { type: "ornament" }> => ({
  id,
  type: "ornament",
  time,
  strength,
  brightness,
  complexity: Math.min(1, 0.7 + strength * 0.3),
});

const resonance = (
  id: string,
  time: number,
  strength: number,
  duration: number,
  depth: number,
): Extract<MusicalEvent, { type: "resonance" }> => ({
  id,
  type: "resonance",
  time,
  strength,
  duration,
  depth,
});

const timeline = (
  duration: number,
  bpm: number,
  frames: MusicalFrame[],
  events: MusicalEvent[],
): MusicalTimeline => normalizeMusicalTimeline({
  version: "picture-score:musical-ir:v1",
  duration,
  bpm,
  frames,
  events,
  metadata: { analysisVersion: "core-meaning-qa-v1" },
});

const quietPiano: CoreMeaningFixture = {
  id: "quiet-piano",
  blindLabel: "A",
  title: "Quiet piano",
  description: "Sparse melody and restrained harmony. Visual silence is part of the meaning.",
  expectedPrimaryRole: "melody",
  timeline: timeline(
    8,
    72,
    [
      frame(0, { energy: 0.16, density: 0.08, melodyActivity: 0.32, beatStrength: 0.04 }),
      frame(4, { energy: 0.13, density: 0.06, melodyActivity: 0.24, beatStrength: 0.03 }),
    ],
    [
      section("quiet-section", 0, -0.28),
      harmony("quiet-harmony-1", 0.45, 0, 0.3, 0.28, 0.08),
      melody("quiet-melody-1", 0.8, 64, 0.34, 1.2, "up"),
      melody("quiet-melody-2", 3.1, 67, 0.38, 1.0, "down"),
      harmony("quiet-harmony-2", 4.7, 5, 0.28, 0.34, 0.12),
      melody("quiet-melody-3", 6.1, 62, 0.31, 1.4, "flat"),
    ],
  ),
};

const steadyBeat: CoreMeaningFixture = {
  id: "steady-beat",
  blindLabel: "B",
  title: "Steady beat",
  description: "A regular pulse should read locally as seeds/pops, not as a whole-scene bounce.",
  expectedPrimaryRole: "rhythm",
  timeline: timeline(
    8,
    120,
    [
      frame(0, { energy: 0.56, density: 0.5, beatStrength: 0.96, melodyActivity: 0.08 }),
      frame(4, { energy: 0.58, density: 0.52, beatStrength: 0.98, melodyActivity: 0.06 }),
    ],
    [
      section("beat-section", 0, 0.02),
      ...Array.from({ length: 16 }, (_, index) =>
        rhythm(`beat-rhythm-${index}`, 0.25 + index * 0.5, index % 4 === 0 ? 0.88 : 0.72)),
      melody("beat-melody-1", 1.5, 60, 0.24, 0.45, "up"),
      melody("beat-melody-2", 5.5, 64, 0.22, 0.45, "down"),
    ],
  ),
};

const denseElectronic: CoreMeaningFixture = {
  id: "dense-electronic",
  blindLabel: "C",
  title: "Dense electronic",
  description: "All five roles are active, but the world must remain bounded and legible.",
  timeline: timeline(
    8,
    132,
    [
      frame(0, {
        energy: 0.9,
        brightness: 0.74,
        density: 0.94,
        beatStrength: 0.86,
        melodyActivity: 0.72,
        ornamentActivity: 0.7,
        sustainLevel: 0.42,
        lowEnergy: 0.52,
        midEnergy: 0.82,
        highEnergy: 0.76,
      }),
      frame(4, {
        energy: 0.94,
        brightness: 0.79,
        density: 0.98,
        beatStrength: 0.9,
        melodyActivity: 0.78,
        ornamentActivity: 0.76,
        sustainLevel: 0.46,
        lowEnergy: 0.48,
        midEnergy: 0.86,
        highEnergy: 0.84,
      }),
    ],
    [
      section("dense-section", 0, 0.22),
      ...Array.from({ length: 24 }, (_, index) =>
        rhythm(`dense-rhythm-${index}`, 0.18 + index * 0.32, index % 4 === 0 ? 0.94 : 0.7)),
      ...Array.from({ length: 8 }, (_, index) =>
        melody(
          `dense-melody-${index}`,
          0.45 + index * 0.92,
          58 + (index % 5) * 4,
          0.62 + (index % 3) * 0.08,
          0.48,
          index % 2 ? "down" : "up",
        )),
      harmony("dense-harmony-1", 0.7, 0, 0.68, 0.72, 0.24),
      harmony("dense-harmony-2", 2.7, 5, 0.74, 0.84, 0.36),
      harmony("dense-harmony-3", 4.7, 9, 0.7, 0.76, 0.42),
      harmony("dense-harmony-4", 6.7, 2, 0.78, 0.9, 0.5),
      ...Array.from({ length: 8 }, (_, index) =>
        ornament(`dense-ornament-${index}`, 0.34 + index * 0.94, 0.68 + (index % 2) * 0.16, 0.72 + (index % 3) * 0.1)),
      resonance("dense-resonance-1", 1.2, 0.58, 2.8, 0.7),
      resonance("dense-resonance-2", 5.2, 0.64, 2.4, 0.62),
    ],
  ),
};

const ambientLongTail: CoreMeaningFixture = {
  id: "ambient-long-tail",
  blindLabel: "D",
  title: "Ambient long-tail",
  description: "Long resonance should live in the ground layer and change the scene's breathing without taking over.",
  expectedPrimaryRole: "resonance",
  timeline: timeline(
    10,
    64,
    [
      frame(0, {
        energy: 0.27,
        brightness: 0.34,
        density: 0.16,
        beatStrength: 0.02,
        melodyActivity: 0.14,
        ornamentActivity: 0.02,
        sustainLevel: 0.92,
        lowEnergy: 0.78,
        midEnergy: 0.38,
        highEnergy: 0.08,
      }),
      frame(5, {
        energy: 0.31,
        brightness: 0.38,
        density: 0.18,
        beatStrength: 0.02,
        melodyActivity: 0.12,
        ornamentActivity: 0.01,
        sustainLevel: 0.96,
        lowEnergy: 0.82,
        midEnergy: 0.42,
        highEnergy: 0.06,
      }),
    ],
    [
      section("ambient-section", 0, -0.1),
      resonance("ambient-resonance-1", 0.4, 0.62, 4.5, 0.82),
      harmony("ambient-harmony-1", 1.4, 0, 0.34, 0.3, 0.08),
      melody("ambient-melody-1", 2.2, 55, 0.28, 1.8, "up"),
      resonance("ambient-resonance-2", 3.5, 0.68, 5.0, 0.9),
      harmony("ambient-harmony-2", 6.0, 7, 0.31, 0.28, 0.12),
      resonance("ambient-resonance-3", 7.0, 0.58, 3.0, 0.76),
      melody("ambient-melody-2", 8.2, 59, 0.24, 1.4, "flat"),
    ],
  ),
};

const ornamentHeavy: CoreMeaningFixture = {
  id: "ornament-heavy",
  blindLabel: "E",
  title: "Ornament-heavy",
  description: "Brief high-information moments should flash in the upper field and disappear from attention quickly.",
  expectedPrimaryRole: "ornament",
  timeline: timeline(
    8,
    96,
    [
      frame(0, {
        energy: 0.46,
        brightness: 0.86,
        density: 0.42,
        beatStrength: 0.08,
        melodyActivity: 0.14,
        ornamentActivity: 0.94,
        sustainLevel: 0.08,
        lowEnergy: 0.08,
        midEnergy: 0.28,
        highEnergy: 0.92,
      }),
      frame(4, {
        energy: 0.5,
        brightness: 0.9,
        density: 0.46,
        beatStrength: 0.06,
        melodyActivity: 0.12,
        ornamentActivity: 0.98,
        sustainLevel: 0.06,
        lowEnergy: 0.06,
        midEnergy: 0.24,
        highEnergy: 0.96,
      }),
    ],
    [
      section("ornament-section", 0, 0.04),
      ...Array.from({ length: 12 }, (_, index) =>
        ornament(
          `ornament-star-${index}`,
          0.4 + index * 0.56,
          0.62 + (index % 4) * 0.09,
          Math.min(0.98, 0.76 + (index % 4) * 0.07),
        )),
      melody("ornament-melody-1", 1.2, 67, 0.28, 0.5, "up"),
      harmony("ornament-harmony-1", 3.0, 4, 0.3, 0.26, 0.1),
      melody("ornament-melody-2", 6.2, 71, 0.25, 0.45, "down"),
    ],
  ),
};

export const coreMeaningFixtures: readonly CoreMeaningFixture[] = [
  quietPiano,
  steadyBeat,
  denseElectronic,
  ambientLongTail,
  ornamentHeavy,
];

export const coreMeaningFixture = (id: CoreMeaningFixtureId): CoreMeaningFixture => {
  const fixture = coreMeaningFixtures.find(item => item.id === id);
  if (!fixture) throw new Error(`unknown core meaning fixture: ${id}`);
  return fixture;
};
