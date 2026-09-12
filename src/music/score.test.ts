import { describe, expect, it } from "vitest";
import {
  createMusic,
  createScore,
  HEIGHT,
  nearestPitch,
  SCALE,
  touchesStroke,
  WIDTH,
} from "./score";
import { exampleStrokes } from "./examples";
import { emptyProject, parseProject } from "./project";
import { midiFile } from "./export";
import type { Stroke } from "./types";

const stroke = (points: number[][], id = "s"): Stroke => ({
  id,
  points: points.map(([x, y], i) => ({ x, y, pressure: 0.5, time: i * 20 })),
});

describe("spatial music contract", () => {
  it("a vertical line is a chord, not an arpeggio in drawing order", () => {
    const notes = createScore(
      [
        stroke([
          [500, 50],
          [500, 370],
        ]),
      ],
      0.5,
    );
    expect(new Set(notes.map((n) => n.beat)).size).toBe(1);
    expect(new Set(notes.map((n) => n.pitch)).size).toBeGreaterThan(8);
    expect(notes.every((n) => SCALE.includes(n.pitch))).toBe(true);
  });
  it("always reads left to right, including backwards strokes and reordered strokes", () => {
    const a = stroke(
      [
        [900, 100],
        [500, 200],
        [100, 300],
      ],
      "a",
    );
    const b = stroke(
      [
        [200, 50],
        [200, 380],
      ],
      "b",
    );
    const first = createScore([a, b], 0.5),
      second = createScore([b, a], 0.5);
    expect(first.map((n) => [n.beat, n.pitch])).toEqual(
      second.map((n) => [n.beat, n.pitch]),
    );
    expect(first.every((n, i) => !i || n.beat >= first[i - 1].beat)).toBe(true);
  });
  it("a horizontal line stays on one pitch and rising lines rise in pitch", () => {
    expect(
      new Set(
        createScore(
          [
            stroke([
              [0, 210],
              [1000, 210],
            ]),
          ],
          1,
        ).map((n) => n.pitch),
      ).size,
    ).toBe(1);
    const rising = createScore(
      [
        stroke([
          [0, 400],
          [1000, 20],
        ]),
      ],
      1,
    );
    expect(rising.every((n, i) => !i || n.pitch >= rising[i - 1].pitch)).toBe(
      true,
    );
    expect(nearestPitch(0)).toBeGreaterThan(nearestPitch(HEIGHT));
  });
  it("all slider positions preserve original geometry, bound movement and keep note IDs stable", () => {
    const strokes = exampleStrokes("cat"),
      original = structuredClone(strokes);
    const raw = createScore(strokes, 0);
    for (const strength of [0, 0.25, 0.5, 0.75, 1]) {
      const notes = createScore(strokes, strength);
      expect(strokes).toEqual(original);
      expect(new Set(notes.map((n) => n.id))).toEqual(
        new Set(raw.map((n) => n.id)),
      );
      notes.forEach((n) => {
        expect(
          Math.abs(n.visualPosition.x - n.sourcePosition.x),
        ).toBeLessThanOrEqual(8);
        expect(
          Math.abs(n.visualPosition.y - n.sourcePosition.y),
        ).toBeLessThanOrEqual(14);
        expect(n.beat + n.duration).toBeLessThanOrEqual(16);
        expect((n.visualPosition.x / WIDTH) * 16).toBeCloseTo(n.beat);
      });
    }
  });
  it("reversing the direction of a stroke preserves its spatial melody", () => {
    const original = stroke([
      [100, 300],
      [320, 40],
      [480, 230],
      [800, 120],
    ]);
    const reverse = { ...original, points: [...original.points].reverse() };
    const signature = (s: Stroke) =>
      createScore([s], 0.5).map((n) => [n.beat, n.pitch]);
    expect(signature(original)).toEqual(signature(reverse));
  });
  it("a tap is playable and edge notes end inside the score", () => {
    const notes = createScore([stroke([[1000, 420]])], 1);
    expect(notes).toHaveLength(1);
    expect(notes[0].beat + notes[0].duration).toBeLessThanOrEqual(16);
  });
  it("supports occupied bars without adding accompaniment to empty bars or changing drawing notes", () => {
    const notes = createScore(
        [
          stroke([
            [520, 180],
            [660, 200],
          ]),
        ],
        0.5,
      ),
      copy = structuredClone(notes);
    const music = createMusic(notes, 104, true, 0.5);
    expect(music.support.length).toBeGreaterThan(0);
    expect(music.support.every((n) => n.beat >= 8 && n.beat < 12)).toBe(true);
    expect(music.drawing).toEqual(copy);
    expect(createMusic(notes, 104, false, 0.5).support).toEqual([]);
    expect(createMusic([], 104, true, 0.5).support).toEqual([]);
  });
  it("erases a segment between sparse pointer events", () => {
    const s = stroke([
      [0, 200],
      [1000, 200],
    ]);
    expect(touchesStroke(s, { x: 500, y: 205 }, 10)).toBe(true);
    expect(touchesStroke(s, { x: 500, y: 250 }, 10)).toBe(false);
  });
});

describe("portable project and MIDI", () => {
  it("round-trips source geometry and rejects corrupt/unsupported projects", () => {
    const p = { ...emptyProject(), strokes: exampleStrokes("heart") };
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(() => parseProject({ ...p, version: 2 })).toThrow();
    expect(() => parseProject({ ...p, tempo: NaN })).toThrow();
    expect(() => parseProject({ ...p, canvasAspect: 0 })).toThrow();
    expect(parseProject({ ...p, canvasAspect: undefined }).canvasAspect).toBe(
      1000 / 420,
    );
    expect(() =>
      parseProject({ ...p, strokes: [stroke([[Infinity, 0]])] }),
    ).toThrow();
    expect(() =>
      parseProject({ ...p, strokes: [stroke([[0, 0]]), stroke([[0, 0]])] }),
    ).toThrow();
  });
  it("exports a type-1 MIDI with separate drawing/support tracks and the correct tempo", () => {
    const bytes = midiFile(
      createMusic(
        createScore(
          [
            stroke([
              [100, 100],
              [200, 200],
            ]),
          ],
          0.5,
        ),
        120,
        true,
        0.5,
      ),
    );
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.slice(0, 4)).toBe("MThd");
    expect(bytes[9]).toBe(1);
    expect(bytes[11]).toBe(2);
    expect(text.split("MTrk")).toHaveLength(3);
    expect(Array.from(bytes.slice(26, 29))).toEqual([0x07, 0xa1, 0x20]);
  });
});
