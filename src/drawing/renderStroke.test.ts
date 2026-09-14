import { describe, expect, it } from "vitest";
import { createMusic, createVisualNotes, touchesStroke } from "../music/score";
import type { Stroke } from "../music/types";
import { drawRelations } from "../wonder/drawRelations";
import { renderStroke, type StrokeRenderMode } from "./renderStroke";

const modes: StrokeRenderMode[] = ["current", "streamlined", "freehand"];

function stroke(
  points: Array<[number, number, number?]>,
  id = "ink-fixture",
): Stroke {
  return {
    id,
    points: points.map(([x, y, pressure = 0.5], index) => ({
      x,
      y,
      pressure,
      time: index * 16,
    })),
  };
}

const fixtures: Stroke[] = [
  stroke([[120, 120]], "dot"),
  stroke([[80, 210], [920, 210]], "horizontal"),
  stroke([[500, 50], [500, 370]], "vertical"),
  stroke([[80, 310], [260, 220], [520, 180], [760, 90], [920, 130]], "curve"),
  stroke([[90, 300], [240, 80], [390, 310], [540, 80], [690, 310], [860, 100]], "zigzag"),
  stroke([[300, 210], [340, 120], [430, 80], [520, 120], [560, 210], [520, 300], [430, 340], [340, 300], [300, 210]], "loop"),
  stroke([[250, 210], [350, 100], [500, 210], [650, 320], [750, 210], [650, 100], [500, 210], [350, 320], [250, 210]], "eight"),
  stroke([[500, 210], [540, 210], [560, 245], [530, 285], [470, 290], [420, 245], [425, 170], [490, 120], [580, 135], [640, 215], [620, 315]], "spiral"),
  stroke(Array.from({ length: 180 }, (_, index) => [
    80 + index * 4.5,
    210 + Math.sin(index * 0.55) * 120,
    0.5,
  ] as [number, number, number]), "scribble"),
  stroke([[100, 260, 0.1], [300, 180, 0.3], [500, 120, 0.9], [700, 180, 0.6], [900, 260, 0.2]], "pressure"),
];

describe("INK LAB display renderer", () => {
  it("is deterministic and never mutates source geometry", () => {
    for (const fixture of fixtures) {
      for (const mode of modes) {
        const before = structuredClone(fixture);
        const first = renderStroke(fixture, mode);
        const second = renderStroke(fixture, mode);
        expect(first).toEqual(second);
        expect(first.d.length).toBeGreaterThan(0);
        expect(fixture).toEqual(before);
      }
    }
  });

  it("keeps current mode byte-compatible with the existing polyline path", () => {
    const fixture = stroke([[10, 20], [30.125, 40.5]]);
    expect(renderStroke(fixture, "current")).toEqual({
      kind: "centerline",
      d: "M10.00,20.00 L30.13,40.50",
    });
    expect(renderStroke(stroke([[10, 20]]), "current").d).toBe(
      "M10.00,20.00l0.1,0",
    );
  });

  it("keeps music, WONDER and eraser semantics unchanged across visual modes", () => {
    const source = fixtures.slice(3, 8);
    const sourceBefore = structuredClone(source);
    const notesBefore = createVisualNotes(source, 0.5);
    const musicBefore = createMusic(notesBefore, 104, true, 0.5);
    const wonderBefore = drawRelations(source);
    const eraseBefore = source.map((item) =>
      touchesStroke(item, { x: 500, y: 210 }, 12),
    );

    for (const mode of modes) {
      source.forEach((item) => renderStroke(item, mode));
      expect(source).toEqual(sourceBefore);
      expect(createVisualNotes(source, 0.5)).toEqual(notesBefore);
      expect(createMusic(createVisualNotes(source, 0.5), 104, true, 0.5)).toEqual(
        musicBefore,
      );
      expect(drawRelations(source)).toEqual(wonderBefore);
      expect(
        source.map((item) =>
          touchesStroke(item, { x: 500, y: 210 }, 12),
        ),
      ).toEqual(eraseBefore);
    }
  });

  it("honors stored pressure only in freehand display geometry", () => {
    const low = stroke([[100, 200, 0.1], [500, 200, 0.1], [900, 200, 0.1]], "low");
    const high = stroke([[100, 200, 0.9], [500, 200, 0.9], [900, 200, 0.9]], "high");

    expect(renderStroke(low, "current").d).toBe(renderStroke(high, "current").d);
    expect(renderStroke(low, "freehand").d).not.toBe(
      renderStroke(high, "freehand").d,
    );
  });
});
