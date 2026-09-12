import type {
  MusicIR,
  ScoreNote,
  Stroke,
  StrokePoint,
  SupportNote,
} from "./types";
import { createPlayNotes } from "./interpret";

export const WIDTH = 1000;
export const HEIGHT = 420;
export const BEATS = 16;
export const clamp = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, n));
export const SCALE = Array.from({ length: 37 }, (_, i) => i + 48).filter((p) =>
  [0, 2, 4, 7, 9].includes(p % 12),
);
export const rawPitch = (y: number) => 84 - clamp(y / HEIGHT, 0, 1) * 36;
export const pitchY = (pitch: number) => ((84 - pitch) / 36) * HEIGHT;
export const nearestPitch = (y: number) =>
  SCALE.reduce(
    (best, p) =>
      Math.abs(p - rawPitch(y)) < Math.abs(best - rawPitch(y)) ? p : best,
    SCALE[0],
  );

/** Arc-length sampling handles vertical strokes, loops and backwards drawing alike. */
export function sampleStroke(stroke: Stroke, spacing = 14): StrokePoint[] {
  if (!stroke.points.length) return [];
  // Canonical orientation makes tracing the same geometry in reverse sound the same.
  let points = [...stroke.points];
  const compare = (a: StrokePoint, b: StrokePoint) => a.x - b.x || a.y - b.y;
  const first = points[0],
    lastPoint = points.at(-1)!;
  if (
    points.length > 2 &&
    Math.hypot(first.x - lastPoint.x, first.y - lastPoint.y) < 0.1
  ) {
    const ring = points.slice(0, -1);
    const start = ring.reduce(
      (best, p, i) => (compare(p, ring[best]) < 0 ? i : best),
      0,
    );
    const step =
      compare(
        ring[(start + 1) % ring.length],
        ring[(start - 1 + ring.length) % ring.length],
      ) <= 0
        ? 1
        : -1;
    points = Array.from(
      { length: ring.length + 1 },
      (_, i) => ring[(start + step * i + ring.length) % ring.length],
    );
  } else if (compare(first, lastPoint) > 0) points.reverse();
  const samples = [{ ...points[0] }];
  let remaining = spacing;
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1];
    const b = points[i];
    let distance = Math.hypot(b.x - a.x, b.y - a.y);
    while (distance >= remaining && distance > 0) {
      const t = remaining / distance;
      a = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        pressure: a.pressure + (b.pressure - a.pressure) * t,
        time: a.time + (b.time - a.time) * t,
      };
      samples.push(a);
      distance -= remaining;
      remaining = spacing;
    }
    remaining -= distance;
  }
  const last = points.at(-1)!;
  if (Math.hypot(last.x - samples.at(-1)!.x, last.y - samples.at(-1)!.y) > 6)
    samples.push({ ...last });
  return samples;
}

export function createVisualNotes(strokes: Stroke[], strength: number): ScoreNote[] {
  const magnet = clamp(strength, 0, 1);
  const notes: ScoreNote[] = [];
  for (const stroke of strokes) {
    const seen = new Set<string>();
    sampleStroke(stroke).forEach((p, index) => {
      const pitch = nearestPitch(p.y);
      const rawBeat = clamp((p.x / WIDTH) * BEATS, 0, BEATS - 0.125);
      const gridBeat = Math.round(rawBeat * 4) / 4;
      const beat = clamp(
        rawBeat + (gridBeat - rawBeat) * magnet,
        0,
        BEATS - 0.125,
      );
      const key = `${Math.round(rawBeat * 8)}:${pitch}`;
      if (seen.has(key)) return;
      seen.add(key);
      notes.push({
        id: `${stroke.id}-${index}`,
        sourceIndex: index,
        pitch,
        beat,
        duration: Math.min(0.24 + magnet * 0.23, BEATS - beat),
        velocity: clamp(0.38 + p.pressure * 0.24, 0.35, 0.7),
        sourceStroke: stroke.id,
        sourcePosition: { x: p.x, y: p.y },
        visualPosition: {
          x: (beat / BEATS) * WIDTH,
          y: p.y + clamp(pitchY(pitch) - p.y, -14, 14) * magnet,
        },
      });
    });
  }
  return notes.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}

// Compatibility name: this is the visual layer, never a playlist.
export const createScore = createVisualNotes;

/** Accompaniment follows occupied bars. It never alters the drawing notes. */
export function createMusic(
  drawing: ScoreNote[],
  tempo: number,
  accompaniment: boolean,
  magnet: number,
): MusicIR {
  const playNotes = createPlayNotes(drawing, magnet);
  const support: SupportNote[] = [];
  if (accompaniment && playNotes.length && magnet > 0) {
    const chords = [
      [48, 55, 64],
      [45, 52, 60],
      [41, 48, 57],
      [43, 50, 57],
    ];
    for (let bar = 0; bar < 4; bar++) {
      const inBar = playNotes.filter(
        (n) => n.beat < bar * 4 + 4 && n.beat + n.duration > bar * 4,
      );
      if (!inBar.length) continue;
      const chord = [...chords].sort((a, b) => {
        const fitness = (c: number[]) =>
          inBar.reduce(
            (sum, n) => sum + (c.some((p) => p % 12 === n.pitch % 12)
              ? Math.min(n.beat + n.duration, bar * 4 + 4) - Math.max(n.beat, bar * 4) : 0),
            0,
          );
        return fitness(b) - fitness(a);
      })[0];
      const start = Math.max(bar * 4, inBar[0].beat);
      chord.forEach((pitch, i) =>
        support.push({
          pitch,
          beat: start,
          duration: Math.min(3.7, BEATS - start),
          velocity: (i ? 0.1 : 0.15) * clamp(magnet, 0, 1),
        }),
      );
    }
  }
  return {
    key: "C",
    scale: "major-pentatonic",
    tempo,
    meter: [4, 4],
    lengthBeats: BEATS,
    drawing,
    playNotes,
    support,
  };
}

export function pointSegmentDistance(
  p: { x: number; y: number },
  a: StrokePoint,
  b: StrokePoint,
): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t =
    dx || dy
      ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1)
      : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function touchesStroke(
  stroke: Stroke,
  p: { x: number; y: number },
  radius: number,
): boolean {
  if (stroke.points.length === 1)
    return (
      Math.hypot(p.x - stroke.points[0].x, p.y - stroke.points[0].y) < radius
    );
  return stroke.points.some(
    (b, i) =>
      i > 0 && pointSegmentDistance(p, stroke.points[i - 1], b) < radius,
  );
}
