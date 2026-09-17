import { describe, expect, it } from "vitest";
import {
  drawingPresence,
  selectedIndexes,
  visualNoteRatio,
} from "./puchiMorph";

describe("puchi morph", () => {
  it("reveals more notes as the slider moves from drawing to music", () => {
    const strengths = [0, 0.25, 0.5, 0.75, 1];
    const counts = strengths.map((strength) =>
      selectedIndexes(120, strength).length,
    );
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts[0]).toBeLessThan(counts.at(-1)!);
    expect(counts.at(-1)).toBeLessThanOrEqual(18);
  });

  it("keeps selected notes stable and evenly spread", () => {
    const first = selectedIndexes(50, 0.7);
    const second = selectedIndexes(50, 0.7);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
    expect(first[0]).toBe(0);
    expect(first.at(-1)).toBe(49);
  });

  it("fades ink only after the drawing half and reaches note-only at the music edge", () => {
    expect(drawingPresence(0)).toBe(1);
    expect(drawingPresence(0.5)).toBe(1);
    expect(drawingPresence(0.75)).toBeGreaterThan(0);
    expect(drawingPresence(1)).toBe(0);
  });

  it("uses a bounded note density", () => {
    expect(visualNoteRatio(0)).toBeCloseTo(0.02);
    expect(visualNoteRatio(1)).toBeCloseTo(0.34);
    expect(visualNoteRatio(-1)).toBeCloseTo(0.02);
    expect(visualNoteRatio(2)).toBeCloseTo(0.34);
  });
});
