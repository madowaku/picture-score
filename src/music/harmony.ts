import type { PlayNote, ScoreNote, SupportNote } from "./types";

const BAR_BEATS = 4;
const SUPPORT_LOW = 43;
const SUPPORT_HIGH = 65;

export type HarmonyId = "C6" | "Am7" | "Fadd9" | "Gsus2" | "Dm7";

interface HarmonyCandidate {
  id: HarmonyId;
  root: number;
  pitchClasses: readonly number[];
}

export interface HarmonyPlanStep {
  bar: number;
  chord: HarmonyId;
  voicing: number[];
  density: number;
  start: number;
  duration: number;
  voiceCount: 2 | 3;
}

const HARMONIES: readonly HarmonyCandidate[] = [
  { id: "C6", root: 0, pitchClasses: [0, 4, 7, 9] },
  { id: "Am7", root: 9, pitchClasses: [9, 0, 4, 7] },
  { id: "Fadd9", root: 5, pitchClasses: [5, 9, 0, 7] },
  { id: "Gsus2", root: 7, pitchClasses: [7, 9, 2] },
  { id: "Dm7", root: 2, pitchClasses: [2, 5, 9, 0] },
];

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const mod12 = (value: number) => ((value % 12) + 12) % 12;
const circularDistance = (a: number, b: number) => {
  const distance = Math.abs(mod12(a) - mod12(b));
  return Math.min(distance, 12 - distance);
};

function overlap(note: Pick<PlayNote, "beat" | "duration">, start: number, end: number) {
  return Math.max(0, Math.min(note.beat + note.duration, end) - Math.max(note.beat, start));
}

function noteFit(pitch: number, chord: HarmonyCandidate) {
  const pc = mod12(pitch);
  if (chord.pitchClasses.includes(pc)) return 4;
  const bestInterval = chord.pitchClasses.reduce((best, chordPc) => {
    const interval = circularDistance(pc, chordPc);
    return Math.min(best, interval);
  }, 6);
  return [4, -1.8, 0.55, 1.35, 1.7, 1.35, -2.4][bestInterval];
}

function weightedFit(chord: HarmonyCandidate, notes: PlayNote[], start: number, end: number) {
  let weight = 0;
  let score = 0;
  for (const note of notes) {
    const amount = overlap(note, start, end);
    if (!amount) continue;
    weight += amount;
    score += noteFit(note.pitch, chord) * amount;
  }
  return weight ? score / weight : 0;
}

function harmonicScore(
  chord: HarmonyCandidate,
  notes: PlayNote[],
  start: number,
  end: number,
  previous?: HarmonyCandidate,
) {
  let score = 0;
  for (const note of notes) {
    const amount = overlap(note, start, end);
    if (amount) score += noteFit(note.pitch, chord) * amount;
  }
  if (previous) {
    const common = chord.pitchClasses.filter((pc) => previous.pitchClasses.includes(pc)).length;
    score += common * 0.55;
    score -= circularDistance(chord.root, previous.root) * 0.07;
  }
  return score;
}

function barDensity(
  drawing: ScoreNote[],
  playNotes: PlayNote[],
  start: number,
  end: number,
) {
  const played = playNotes.filter((note) => overlap(note, start, end) > 0);
  const visual = drawing.filter((note) => note.beat >= start && note.beat < end);
  const onsets = new Set(played.map((note) => Math.round(note.beat * 8))).size;
  const occupancy = played.reduce((sum, note) => sum + overlap(note, start, end), 0) / BAR_BEATS;
  const playedDensity = clamp(onsets / 8 * 0.65 + Math.min(1, occupancy / 2) * 0.35, 0, 1);
  const visualDensity = clamp(visual.length / 22, 0, 1);
  return clamp(playedDensity * 0.72 + visualDensity * 0.28, 0, 1);
}

function combinations<T>(values: readonly T[], count: number): T[][] {
  if (count === 0) return [[]];
  const result: T[][] = [];
  for (let index = 0; index <= values.length - count; index++) {
    for (const tail of combinations(values.slice(index + 1), count - 1))
      result.push([values[index], ...tail]);
  }
  return result;
}

function pitchesFor(pc: number) {
  const pitches: number[] = [];
  for (let pitch = SUPPORT_LOW; pitch <= SUPPORT_HIGH; pitch++)
    if (mod12(pitch) === pc) pitches.push(pitch);
  return pitches;
}

function candidateVoicings(chord: HarmonyCandidate) {
  const unique = new Map<string, number[]>();
  for (const pcs of combinations(chord.pitchClasses, 3)) {
    const choices = pcs.map(pitchesFor);
    for (const a of choices[0]) for (const b of choices[1]) for (const c of choices[2]) {
      const voicing = [a, b, c].sort((x, y) => x - y);
      if (new Set(voicing).size !== 3) continue;
      const gaps = [voicing[1] - voicing[0], voicing[2] - voicing[1]];
      if (Math.min(...gaps) < 3 || voicing[2] - voicing[0] > 20) continue;
      unique.set(voicing.join(":"), voicing);
    }
  }
  return [...unique.values()];
}

function voicingCost(voicing: number[], previous?: number[]) {
  const spread = voicing[2] - voicing[0];
  if (!previous) {
    const center = (voicing[0] + voicing[1] + voicing[2]) / 3;
    return Math.abs(center - 54) * 0.35 + Math.abs(voicing[0] - 46) * 0.28 + Math.abs(spread - 14) * 0.12;
  }
  const motion = voicing.reduce((sum, pitch, index) => sum + Math.abs(pitch - previous[index]), 0);
  const bassMotion = Math.abs(voicing[0] - previous[0]);
  const held = voicing.filter((pitch) => previous.includes(pitch)).length;
  return motion + bassMotion * 0.55 - held * 0.7 + Math.abs(spread - 14) * 0.08;
}

function chooseVoicing(chord: HarmonyCandidate, previous?: number[]) {
  const voicings = candidateVoicings(chord);
  return voicings.reduce((best, current) => {
    const currentCost = voicingCost(current, previous);
    const bestCost = voicingCost(best, previous);
    if (currentCost !== bestCost) return currentCost < bestCost ? current : best;
    return current.join(":") < best.join(":") ? current : best;
  }, voicings[0] ?? [48, 55, 60]);
}

export function planHarmony(
  drawing: ScoreNote[],
  playNotes: PlayNote[],
  magnet: number,
  lengthBeats = 16,
): HarmonyPlanStep[] {
  if (!playNotes.length || magnet <= 0) return [];
  const barCount = Math.ceil(lengthBeats / BAR_BEATS);
  const occupiedBars = Array.from({ length: barCount }, (_, bar) => bar).filter((bar) => {
    const start = bar * BAR_BEATS;
    const end = Math.min(lengthBeats, start + BAR_BEATS);
    return playNotes.some((note) => overlap(note, start, end) > 0);
  });
  const finalBar = occupiedBars.at(-1);
  const result: HarmonyPlanStep[] = [];
  let previousChord: HarmonyCandidate | undefined;
  let previousVoicing: number[] | undefined;

  for (const bar of occupiedBars) {
    const barStart = bar * BAR_BEATS;
    const barEnd = Math.min(lengthBeats, barStart + BAR_BEATS);
    const inBar = playNotes.filter((note) => overlap(note, barStart, barEnd) > 0);
    const ranked = [...HARMONIES].sort((a, b) => {
      const delta = harmonicScore(b, inBar, barStart, barEnd, previousChord) -
        harmonicScore(a, inBar, barStart, barEnd, previousChord);
      return delta || HARMONIES.indexOf(a) - HARMONIES.indexOf(b);
    });
    let chosen = ranked[0];
    if (bar === finalBar) {
      const tonic = HARMONIES[0];
      const bestFit = weightedFit(ranked[0], inBar, barStart, barEnd);
      const tonicFit = weightedFit(tonic, inBar, barStart, barEnd);
      if (tonicFit >= bestFit - 0.65) chosen = tonic;
    }
    const voicing = chooseVoicing(chosen, previousVoicing);
    const density = barDensity(drawing, playNotes, barStart, barEnd);
    const firstBeat = Math.min(...inBar.map((note) => Math.max(barStart, note.beat)));
    const start = clamp(firstBeat, barStart, Math.max(barStart, barEnd - 0.125));
    const duration = Math.max(0.125, Math.min(3.7, barEnd - start, lengthBeats - start));
    result.push({ bar, chord: chosen.id, voicing, density, start, duration,
      voiceCount: density >= 0.68 ? 2 : 3 });
    previousChord = chosen;
    previousVoicing = voicing;
  }
  return result;
}

function supportPattern(step: HarmonyPlanStep, strength: number): SupportNote[] {
  const end = step.start + step.duration;
  const audibleStrength = Math.sqrt(clamp(strength, 0, 1));
  const baseVelocity = (0.24 - step.density * 0.07) * audibleStrength;
  const notes: SupportNote[] = [];
  const add = (pitch: number, beat: number, duration: number, velocity: number) => {
    if (beat >= end - 0.06) return;
    notes.push({ pitch, beat,
      duration: Math.max(0.08, Math.min(duration, end - beat)),
      velocity: clamp(velocity, 0.01, 0.28) });
  };
  const [bass, middle, top] = step.voicing;

  if (step.density < 0.38) {
    add(bass, step.start, 0.9, baseVelocity);
    add(middle, step.start + 0.36, 1.1, baseVelocity * 0.82);
    add(top, step.start + 0.36, 1.1, baseVelocity * 0.78);
    if (step.duration > 2.25) {
      add(bass, step.start + 2, 0.72, baseVelocity * 0.8);
      add(middle, step.start + 2.34, 0.92, baseVelocity * 0.68);
      add(top, step.start + 2.34, 0.92, baseVelocity * 0.64);
    }
    return notes;
  }

  if (step.density < 0.68) {
    for (const [index, pitch] of step.voicing.entries())
      add(pitch, step.start, 1.55, baseVelocity * (index === 0 ? 1 : 0.78));
    if (step.duration > 2.15) add(top, step.start + 2, 0.75, baseVelocity * 0.62);
    return notes;
  }

  add(bass, step.start, 1.25, baseVelocity * 0.88);
  add(top, step.start, 1.25, baseVelocity * 0.68);
  return notes;
}

export function createHarmonySupport(
  drawing: ScoreNote[],
  playNotes: PlayNote[],
  magnet: number,
  lengthBeats = 16,
): SupportNote[] {
  const strength = clamp(magnet, 0, 1);
  return planHarmony(drawing, playNotes, strength, lengthBeats)
    .flatMap((step) => supportPattern(step, strength))
    .sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
