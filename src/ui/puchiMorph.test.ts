import { describe, expect, it } from "vitest";
import {
  drawingPresence,
  selectedIndexes,
  visualNoteRatio,
} from "./puchiMorph";

describe("puchi morph", () => {
  it("reveals more notes as the slider moves from drawing to music", () => {
    const strengths = [0, 0.1, 0.25, 0.5, 0.7, 0.85, 1];
    const counts = strengths.map((strength) =>
      selectedIndexes(120, strength).length,
    );
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts[0]).toBe(0);
    expect(counts.at(-1)).toBeGreaterThan(counts[1]);
    expect(counts.at(-1)).toBeLessThanOrEqual(18);
  });

  it("keeps the far drawing edge almost pure ink", () => {
    expect(selectedIndexes(120, 0)).toEqual([]);
    expect(selectedIndexes(120, 0.01)).toEqual([]);
    expect(selectedIndexes(120, 0.1).length).toBeLessThanOrEqual(2);
  });

  it("keeps selected notes stable and evenly spread", () => {
    const first = selectedIndexes(50, 0.7);
    const second = selectedIndexes(50, 0.7);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first[0]).toBe(0);
    expect(first.at(-1)).toBe(49);
  });

  it("holds ink through the blend, then fades quickly into note-only", () => {
    expect(drawingPresence(0)).toBe(1);
    expect(drawingPresence(0.5)).toBe(1);
    expect(drawingPresence(0.68)).toBe(1);
    expect(drawingPresence(0.8)).toBeGreaterThan(0);
    expect(drawingPresence(0.9)).toBeLessThan(0.1);
    expect(drawingPresence(0.93)).toBe(0);
    expect(drawingPresence(1)).toBe(0);
  });

  it("uses a staged but bounded note density", () => {
    expect(visualNoteRatio(0)).toBe(0);
    expect(visualNoteRatio(0.1)).toBeCloseTo(0.012);
    expect(visualNoteRatio(0.7)).toBeCloseTo(0.2);
    expect(visualNoteRatio(1)).toBeCloseTo(0.34);
    expect(visualNoteRatio(-1)).toBe(0);
    expect(visualNoteRatio(2)).toBeCloseTo(0.34);
  });
});
