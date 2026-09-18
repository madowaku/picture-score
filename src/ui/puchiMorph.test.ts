import { describe, expect, it } from "vitest";
import {
  drawingPresence,
  MORPH_NOTE_MAX,
  selectedIndexes,
  visualNoteCap,
  visualNoteRatio,
} from "./puchiMorph";

describe("puchi morph polish", () => {
  it("reveals notes monotonically without saturating the middle", () => {
    const strengths = [0, 0.1, 0.25, 0.5, 0.7, 0.85, 1];
    const counts = strengths.map((strength) =>
      selectedIndexes(120, strength).length,
    );
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts[0]).toBe(0);
    expect(counts[3]).toBe(10);
    expect(counts.at(-1)).toBe(MORPH_NOTE_MAX);
  });

  it("keeps the drawing edge pure and the early blend sparse", () => {
    expect(selectedIndexes(120, 0)).toEqual([]);
    expect(selectedIndexes(120, 0.01)).toEqual([]);
    expect(selectedIndexes(120, 0.1).length).toBeLessThanOrEqual(2);
    expect(visualNoteCap(0.25)).toBeLessThan(visualNoteCap(0.5));
  });

  it("keeps selected notes stable and evenly spread", () => {
    const first = selectedIndexes(50, 0.7);
    const second = selectedIndexes(50, 0.7);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first[0]).toBe(0);
    expect(first.at(-1)).toBe(49);
  });

  it("lets notes arrive before the ink fades", () => {
    expect(drawingPresence(0)).toBe(1);
    expect(drawingPresence(0.5)).toBe(1);
    expect(drawingPresence(0.6)).toBe(1);
    expect(drawingPresence(0.7)).toBeGreaterThan(0.85);
    expect(drawingPresence(0.78)).toBeCloseTo(0.85);
    expect(drawingPresence(0.85)).toBeGreaterThan(0);
    expect(drawingPresence(0.9)).toBeLessThan(0.1);
    expect(drawingPresence(0.93)).toBe(0);
    expect(drawingPresence(1)).toBe(0);
  });

  it("uses a staged and bounded note density", () => {
    expect(visualNoteRatio(0)).toBe(0);
    expect(visualNoteRatio(0.1)).toBeCloseTo(0.012);
    expect(visualNoteRatio(0.7)).toBeCloseTo(0.2);
    expect(visualNoteRatio(1)).toBeCloseTo(0.34);
    expect(visualNoteCap(0)).toBe(0);
    expect(visualNoteCap(0.5)).toBe(10);
    expect(visualNoteCap(0.7)).toBe(13);
    expect(visualNoteCap(0.85)).toBe(16);
    expect(visualNoteCap(1)).toBe(MORPH_NOTE_MAX);
  });
});
