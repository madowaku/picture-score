import { getStroke, getStrokePoints } from "perfect-freehand";
import type { Stroke } from "../music/types";

export type StrokeRenderMode = "current" | "streamlined" | "freehand";
export type StrokeRenderKind = "centerline" | "outline";

export interface RenderStrokeResult {
  kind: StrokeRenderKind;
  d: string;
}

type Point = readonly [number, number];
type InputPoint = [number, number, number];

const number = (value: number) => value.toFixed(2);

function centerlinePath(points: readonly Point[], dotFallback = false) {
  if (!points.length) return "";
  const d = points
    .map((point, index) =>
      `${index ? "L" : "M"}${number(point[0])},${number(point[1])}`,
    )
    .join(" ");
  return d + (dotFallback && points.length === 1 ? "l0.1,0" : "");
}

function outlinePath(points: readonly Point[]) {
  if (!points.length) return "";
  if (points.length < 4) return centerlinePath(points) + " Z";

  const midpoint = (a: Point, b: Point): Point => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];

  const first = points[0];
  const second = points[1];
  const third = points[2];
  const firstMid = midpoint(second, third);
  const parts = [
    `M${number(first[0])},${number(first[1])}`,
    `Q${number(second[0])},${number(second[1])} ${number(firstMid[0])},${number(firstMid[1])}`,
    "T",
  ];

  for (let index = 2; index < points.length - 1; index++) {
    const mid = midpoint(points[index], points[index + 1]);
    parts.push(`${number(mid[0])},${number(mid[1])}`);
  }

  parts.push("Z");
  return parts.join(" ");
}

function inputPoints(stroke: Stroke): InputPoint[] {
  return stroke.points.map((point) => [point.x, point.y, point.pressure]);
}

/**
 * Display-only stroke rendering.
 *
 * Stroke.points remains the source of truth for music, persistence,
 * hit-testing, WONDER and exports. This function never mutates it.
 */
export function renderStroke(
  stroke: Stroke,
  mode: StrokeRenderMode = "current",
): RenderStrokeResult {
  if (mode === "current") {
    return {
      kind: "centerline",
      d: centerlinePath(
        stroke.points.map((point) => [point.x, point.y] as Point),
        true,
      ),
    };
  }

  const source = inputPoints(stroke);

  if (mode === "streamlined") {
    const points = getStrokePoints(source, {
      size: 2.2,
      streamline: 0.45,
      last: true,
    }).map(({ point }) => point as Point);

    return { kind: "centerline", d: centerlinePath(points, true) };
  }

  const outline = getStroke(source, {
    size: 5.2,
    thinning: 0.28,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: false,
    start: { cap: true },
    end: { cap: true },
    last: true,
  }) as Point[];

  return { kind: "outline", d: outlinePath(outline) };
}
