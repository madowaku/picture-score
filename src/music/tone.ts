import type { Instrument } from "./types";

type VoiceTone = { type: OscillatorType; harmonics: number[]; gains: number[]; attack: number; decay: number; sustain: number; tail: number };
export const voiceTones: Record<Instrument, VoiceTone> = {
  Piano: { type: "sine", harmonics: [1, 2, 3], gains: [.78, .16, .06], attack: .009, decay: .16, sustain: .28, tail: .5 },
  Bell: { type: "sine", harmonics: [1, 2.756, 5.404], gains: [.82, .14, .04], attack: .008, decay: .2, sustain: .24, tail: .78 },
  Pluck: { type: "triangle", harmonics: [1, 2], gains: [.91, .09], attack: .007, decay: .09, sustain: .19, tail: .23 },
  Toy: { type: "sine", harmonics: [1, 3, 7], gains: [.88, .1, .02], attack: .01, decay: .08, sustain: .22, tail: .28 },
  "Soft Synth": { type: "triangle", harmonics: [1, 1.003], gains: [.5, .5], attack: .055, decay: .18, sustain: .64, tail: .5 },
};
export type EnvelopePoint = { time: number; value: number; curve: "linear" | "exponential" };

/** Quiet upper partials decay first; the fundamental carries long drawn lines. */
export function partialEnvelope(instrument: Instrument, pitch: number, velocity: number, duration: number, partial: number) {
  const tone = voiceTones[instrument];
  const fundamental = 440 * 2 ** ((pitch - 69) / 12);
  const frequency = fundamental * tone.harmonics[partial];
  const register = Math.min(1, (880 / fundamental) ** .3);
  const brightness = 1 / (1 + (frequency / 3600) ** 2);
  const peak = Math.max(.00001, Math.min(1, Math.max(0, velocity)) * tone.gains[partial] * .19 * register * brightness);
  const attack = Math.min(tone.attack, Math.max(.004, duration * .25));
  const end = Math.max(attack + .012, duration);
  const body = Math.min(attack + tone.decay, attack + (end - attack) * .65);
  // The two detuned synth oscillators are one fundamental, not upper harmonics.
  const overtone = instrument === "Soft Synth" ? 1 : 1 / (1 + partial * 1.7);
  const held = Math.max(.000001, peak * tone.sustain * overtone);
  const tail = tone.tail * (instrument === "Soft Synth" ? 1 : 1 / (1 + partial * .65));
  const points: EnvelopePoint[] = [
    { time: 0, value: 0, curve: "linear" },
    { time: attack, value: peak, curve: "linear" },
    { time: body, value: Math.max(held, peak * .55 * overtone), curve: "exponential" },
    { time: end, value: held, curve: "exponential" },
    { time: end + tail, value: .000001, curve: "exponential" },
    { time: end + tail + .012, value: 0, curve: "linear" },
  ];
  return { frequency, points, end: points.at(-1)!.time };
}

/** Interpolate scheduled ramps so interruption starts at the actual envelope level. */
export function envelopeValue(points: EnvelopePoint[], time: number) {
  if (time <= 0 || time >= points.at(-1)!.time) return 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (time > b.time) continue;
    const t = (time - a.time) / (b.time - a.time);
    return b.curve === "exponential" && a.value > 0
      ? a.value * (b.value / a.value) ** t
      : a.value + (b.value - a.value) * t;
  }
  return 0;
}
