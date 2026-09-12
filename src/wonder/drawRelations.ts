import type { Stroke } from '../music/types';
import type { WonderDrawEffect } from './wonderTypes';

type Point = { x: number; y: number };
export const DRAW_THRESHOLDS = { closure: .035, minLength: .22, minArea: .008, overlap: .012, mirror: .025 };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const cache = new WeakMap<Stroke, ReturnType<typeof geometry>>();
function geometry(stroke: Stroke) {
  const raw = stroke.points.map(p => ({ x: p.x / 1000, y: p.y / 420 }));
  const lengths = [0];
  for (let i = 1; i < raw.length; i++) lengths.push(lengths[i - 1] + distance(raw[i - 1], raw[i]));
  const length = lengths.at(-1) ?? 0;
  const points: Point[] = [];
  let segment = 1;
  for (let i = 0; raw.length && i < 33; i++) {
    const at = length * i / 32;
    while (segment < raw.length - 1 && lengths[segment] < at) segment++;
    const a = raw[Math.max(0, segment - 1)], b = raw[Math.min(segment, raw.length - 1)];
    const t = raw.length === 1 ? 0 : (at - lengths[Math.max(0, segment - 1)]) / Math.max(1e-9, lengths[segment] - lengths[segment - 1]);
    points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  const left = raw.reduce((n, p) => Math.min(n, p.x), 1), right = raw.reduce((n, p) => Math.max(n, p.x), 0);
  const top = raw.reduce((n, p) => Math.min(n, p.y), 1), bottom = raw.reduce((n, p) => Math.max(n, p.y), 0);
  return { id: stroke.id, points, length, left, right, top, bottom };
}
type Geometry = ReturnType<typeof geometry>;
function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
}
function overlap(a: Point[], b: Point[], radius: number) {
  return a.filter(p => b.some((q, i) => i > 0 && segmentDistance(p, b[i - 1], q) <= radius)).length / Math.max(1, a.length);
}
function meaningful(g: Geometry) { return g.length >= DRAW_THRESHOLDS.minLength && (g.right - g.left) * (g.bottom - g.top) >= DRAW_THRESHOLDS.minArea; }
function mirrored(a: Geometry, b: Geometry) {
  const left = Math.min(a.left, b.left), right = Math.max(a.right, b.right);
  if (right - left < .07 || Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top) < .09 || a.length < .18 || b.length < .18) return false;
  const reflected = a.points.map(p => ({ x: left + right - p.x, y: p.y }));
  return overlap(reflected, b.points, DRAW_THRESHOLDS.mirror) >= .86 && overlap(b.points, reflected, DRAW_THRESHOLDS.mirror) >= .86;
}
function intersection(a: Point, b: Point, c: Point, d: Point): Point | undefined {
  const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y;
  const denominator = dx * ey - dy * ex;
  if (Math.abs(denominator) < 1e-8) return;
  const u = ((c.x - a.x) * ey - (c.y - a.y) * ex) / denominator;
  const v = ((c.x - a.x) * dy - (c.y - a.y) * dx) / denominator;
  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return { x: a.x + u * dx, y: a.y + u * dy };
}

/** Geometry only. Bounded arc samples and cached immutable strokes keep pointer-up cheap. */
export function drawRelations(strokes: Stroke[], thresholds = DRAW_THRESHOLDS): WonderDrawEffect[] {
  const shapes = strokes.map(s => { let g = cache.get(s); if (!g) { g = geometry(s); cache.set(s, g); } return g; }).filter(g => g.points.length > 1 && g.length > .04);
  const effects: WonderDrawEffect[] = [], closed = new Set<string>(), retraces: Geometry[][] = [];
  const retraceGroup = new Map<string, Geometry[]>();
  const add = (rule: WonderDrawEffect['rule'], group: Geometry[], p: Point, stage?: number) => effects.push({ rule, strokeIds: group.map(g => g.id), position: { x: p.x * 1000, y: p.y * 420 }, ...(stage ? { stage } : {}) });
  for (const g of shapes) {
    if (meaningful(g) && distance(g.points[0], g.points.at(-1)!) <= thresholds.closure) {
      add('closed-loop', [g], g.points[0]); closed.add(g.id);
    }
    if (mirrored(g, g)) add('mirror-answer', [g], { x: (g.left + g.right) / 2, y: g.top });
  }
  // Connected endpoint chains close too; branch junctions are deliberately ambiguous.
  const visited = new Set<string>();
  for (const first of shapes.filter(g => !closed.has(g.id))) {
    if (visited.has(first.id)) continue;
    const group = [first]; let end = first.points.at(-1)!;
    visited.add(first.id);
    while (group.length < 12) {
      const next = shapes.filter(g => !closed.has(g.id) && !visited.has(g.id) && Math.min(distance(end, g.points[0]), distance(end, g.points.at(-1)!)) <= thresholds.closure && overlap(g.points, group.at(-1)!.points, thresholds.overlap) < .7);
      if (next.length !== 1) break;
      const g = next[0]; group.push(g); visited.add(g.id);
      end = distance(end, g.points[0]) < distance(end, g.points.at(-1)!) ? g.points.at(-1)! : g.points[0];
      if (group.length > 1 && distance(end, first.points[0]) <= thresholds.closure) {
        const combined = { ...first, length: group.reduce((s, g) => s + g.length, 0), left: Math.min(...group.map(g => g.left)), right: Math.max(...group.map(g => g.right)), top: Math.min(...group.map(g => g.top)), bottom: Math.max(...group.map(g => g.bottom)) };
        if (meaningful(combined)) { add('closed-loop', group, end); group.forEach(g => closed.add(g.id)); }
        break;
      }
    }
  }
  const sparks: Point[] = [], barCounts = [0, 0, 0, 0];
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i], b = shapes[j];
    if (retraceGroup.has(a.id) && retraceGroup.get(a.id) === retraceGroup.get(b.id)) continue;
    const intersectsBounds = !(a.right + .025 < b.left || b.right + .025 < a.left || a.bottom + .025 < b.top || b.bottom + .025 < a.top);
    if (intersectsBounds && overlap(a.points, b.points, thresholds.overlap) >= .78 && overlap(b.points, a.points, thresholds.overlap) >= .78) {
      const ga = retraceGroup.get(a.id), gb = retraceGroup.get(b.id);
      if (ga && gb && ga !== gb) { ga.push(...gb); retraces.splice(retraces.indexOf(gb), 1); }
      else if (ga) { if (!ga.includes(b)) ga.push(b); }
      else if (gb) gb.push(a);
      else retraces.push([a, b]);
      const group = ga ?? gb ?? retraces.at(-1)!;
      group.forEach(g => retraceGroup.set(g.id, group));
      continue;
    }
    if (Math.max(a.right, b.right) - Math.min(a.left, b.left) < .65 && mirrored(a, b)) add('mirror-answer', [a, b], { x: (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2, y: Math.min(a.top, b.top) });
    if (!intersectsBounds || sparks.length >= 8 || a.length < .1 || b.length < .1) continue;
    for (let u = 1; u < a.points.length; u++) for (let v = 1; v < b.points.length; v++) {
      const p = intersection(a.points[u - 1], a.points[u], b.points[v - 1], b.points[v]);
      if (!p) continue;
      const bar = Math.min(3, Math.floor(p.x * 4));
      if (barCounts[bar] >= 2 || sparks.some(q => Math.abs(q.x - p.x) < .035)) continue;
      // Shared endpoints are joins, not crossings.
      if ([a, b].some(g => Math.min(distance(p, g.points[0]), distance(p, g.points.at(-1)!)) < .018)) continue;
      sparks.push(p); barCounts[bar]++; add('crossing-spark', [a, b], p);
    }
  }
  for (const group of retraces) add('retrace-thicken', group, group.at(-1)!.points[16], Math.min(2, group.length - 1));
  return effects;
}
