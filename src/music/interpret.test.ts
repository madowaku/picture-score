import { describe, expect, it } from "vitest";
import { createMusic, createVisualNotes, SCALE } from "./score";
import { createPlayNotes } from "./interpret";
import { exampleStrokes } from "./examples";
import { midiFile } from "./export";
import type { Stroke } from "./types";

const stroke = (points: number[][], id = "s"): Stroke => ({
  id, points: points.map(([x, y], i) => ({ x, y, pressure: 0.5, time: i * 20 })),
});
const interpret = (strokes: Stroke[], amount: number) =>
  createPlayNotes(createVisualNotes(strokes, amount), amount);

describe("MAKE IT SING", () => {
  it("retains the picture while reducing performed attacks through the slider", () => {
    for (const example of ["cat", "wave", "heart"] as const) {
      const source = exampleStrokes(example), original = structuredClone(source);
      const visual = createVisualNotes(source, 0.5);
      const counts = [0, 0.5, 1].map((s) => interpret(source, s).length);
      expect(counts[0]).toBeLessThan(visual.length);
      expect(counts[1]).toBeLessThan(counts[0]);
      expect(counts[2]).toBeLessThan(counts[1]);
      expect(source).toEqual(original);
      let previous = Infinity;
      for (let step = 0; step <= 100; step++) {
        const count = interpret(source, step / 100).length;
        expect(count, example + " slider " + step).toBeLessThanOrEqual(previous);
        previous = count;
      }
      expect(createVisualNotes(source, 1).map((n) => n.id).sort())
        .toEqual(visual.map((n) => n.id).sort());
    }
  });
  it("turns a long horizontal line into one held note at every setting", () => {
    for (const s of [0, 0.5, 1]) {
      const notes = interpret([stroke([[100, 210], [900, 210]])], s);
      expect(notes).toHaveLength(1);
      expect(notes[0].duration).toBeGreaterThan(12);
      expect(notes[0].articulation).toBe("sustain");
    }
  });
  it("links rising and falling contours into legato phrases and retains both endpoints", () => {
    for (const points of [[[50, 400], [950, 20]], [[50, 20], [950, 400]]]) {
      for (const s of [0, 0.5, 1]) {
        const notes = interpret([stroke(points)], s);
        const direction = Math.sign(points[0][1] - points[1][1]);
        expect(notes.length).toBeGreaterThan(3);
        for (let i = 1; i < notes.length; i++) {
          expect((notes[i].pitch - notes[i - 1].pitch) * direction).toBeGreaterThan(0);
          expect(notes[i - 1].beat + notes[i - 1].duration).toBeCloseTo(notes[i].beat);
        }
      }
    }
  });
  it("voices vertical strokes and same-X taps as bounded simultaneous chords", () => {
    const vertical = stroke([[500, 30], [500, 390]]);
    const taps = [40, 100, 170, 240, 310, 390].map((y, i) => stroke([[500, y]], "tap" + i));
    for (const source of [[vertical], taps]) {
      const notes = interpret(source, 1);
      expect(notes).toHaveLength(3);
      expect(new Set(notes.map((n) => n.beat)).size).toBe(1);
      expect(new Set(notes.map((n) => n.chordId)).size).toBe(1);
      expect(notes.every((n) => n.articulation === "chord")).toBe(true);
    }
  });
  it("keeps loops, reversed traces, input ordering and repeated calls deterministic", () => {
    const source = exampleStrokes("heart");
    const signature = (s: Stroke[]) => interpret(s, 0.5)
      .map((n) => [n.beat, n.pitch, n.duration]);
    expect(signature(source)).toEqual(signature(source.map((s) => ({
      ...s, points: [...s.points].reverse(),
    }))));
    const cat = exampleStrokes("cat");
    expect(signature(cat)).toEqual(signature([...cat].reverse()));
  });
  it("owns every visual sample, produces finite in-range notes and handles edges/empty input", () => {
    expect(interpret([], 0.5)).toEqual([]);
    const source = [...exampleStrokes("cat"), stroke([[1000, 420]], "edge")];
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const visual = createVisualNotes(source, s), original = structuredClone(visual);
      const notes = createPlayNotes(visual, s);
      expect(new Set(notes.map((n) => n.id)).size).toBe(notes.length);
      expect(visual).toEqual(original);
      expect(new Set(notes.flatMap((n) => n.sourceIds))).toEqual(new Set(visual.map((n) => n.id)));
      for (const n of notes) {
        expect(SCALE).toContain(n.pitch);
        expect(n.duration).toBeGreaterThan(0);
        expect(n.beat + n.duration).toBeLessThanOrEqual(16.00001);
        expect([n.beat, n.duration, n.velocity].every(Number.isFinite)).toBe(true);
      }
    }
  });
  it("supports the occupied span of a sustain and honours the accompaniment toggle", () => {
    const visual = createVisualNotes([stroke([[100, 210], [900, 210]])], 1);
    const music = createMusic(visual, 104, true, 1);
    expect(music.support.length).toBeGreaterThan(0);
    expect(new Set(music.support.map((note) => Math.floor(note.beat / 4))))
      .toEqual(new Set([0, 1, 2, 3]));
    expect(music.support.every((note) => note.beat >= music.playNotes[0].beat && note.beat < 16))
      .toBe(true);
    expect(createMusic(visual, 104, false, 1).support).toEqual([]);
    expect(createMusic(visual, 104, true, 0).support).toEqual([]);
  });
  it("exports the held performance rather than dozens of visual attacks to MIDI", () => {
    const visual = createVisualNotes([stroke([[100, 210], [900, 210]])], 0.5);
    const music = createMusic(visual, 104, false, 0.5);
    expect(visual.length).toBeGreaterThan(40);
    expect(music.playNotes).toHaveLength(1);
    const bytes = midiFile(music);
    const firstTrackSize = new DataView(bytes.buffer).getUint32(18);
    const track = bytes.slice(22, 22 + firstTrackSize);
    expect([...track].filter((b) => b === 0x90)).toHaveLength(1);
  });
});
