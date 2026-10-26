import { describe, expect, it } from "vitest";
import { envelopeValue, partialEnvelope, voiceTones } from "./tone";
import type { Instrument } from "./types";

describe("rounded sound envelopes", () => {
  it("orders every ramp and finishes at zero, including very short notes", () => {
    for (const instrument of Object.keys(voiceTones) as Instrument[]) {
      for (const duration of [.001, .05, .25, 3, 10]) {
        voiceTones[instrument].harmonics.forEach((_, i) => {
          const envelope = partialEnvelope(instrument, 84, .65, duration, i);
          expect(envelope.points[0].value).toBe(0);
          expect(envelope.points.at(-1)!.value).toBe(0);
          envelope.points.slice(1).forEach((point, index) => {
            expect(point.time).toBeGreaterThan(envelope.points[index].time);
            expect(point.value).toBeGreaterThanOrEqual(0);
            if (point.curve === "exponential") expect(point.value).toBeGreaterThan(0);
          });
          expect(envelope.end).toBeLessThan(duration + 1);
        });
      }
    }
  });
  it("keeps the fundamental audible through a long drawn line", () => {
    for (const instrument of Object.keys(voiceTones) as Instrument[]) {
      const envelope = partialEnvelope(instrument, 60, .55, 6, 0);
      expect(envelopeValue(envelope.points, 5.9)).toBeGreaterThan(.005);
      expect(envelopeValue(envelope.points, envelope.end + 1)).toBe(0);
    }
  });
  it("tames high registers and lets the bell's upper partials fade first", () => {
    const low = partialEnvelope("Bell", 60, .6, 1, 0);
    const high = partialEnvelope("Bell", 96, .6, 1, 0);
    const partial = partialEnvelope("Bell", 60, .6, 1, 2);
    expect(high.points[1].value).toBeLessThan(low.points[1].value);
    expect(partial.end).toBeLessThan(low.end);
    expect(envelopeValue(partial.points, .8)).toBeLessThan(envelopeValue(low.points, .8) * .05);
  });
  it("interpolates the envelope continuously when playback is interrupted", () => {
    const { points } = partialEnvelope("Piano", 72, .6, .7, 0);
    for (const point of points.slice(1, -1)) {
      expect(envelopeValue(points, point.time)).toBeCloseTo(point.value, 8);
      expect(Math.abs(envelopeValue(points, point.time - .00001) - envelopeValue(points, point.time + .00001))).toBeLessThan(.0003);
    }
    expect(envelopeValue(points, -.1)).toBe(0);
  });
});
