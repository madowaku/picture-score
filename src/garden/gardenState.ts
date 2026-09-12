import { parseProject } from "../music/project";
import { clamp, createMusic, createVisualNotes } from "../music/score";
import type { MusicIR, Project, ScoreNote, Stroke } from "../music/types";

export type MusicalRole = "melody" | "harmony" | "drone" | "rhythm" | "decoration";
export type Position = { x: number; y: number };
export interface MusicalObject {
  id: string;
  title: string;
  project: Project;
  strokeIR: Stroke[];
  scoreIR: ScoreNote[];
  musicIR: MusicIR;
  world: Position & { scale: number; rotation: number };
  musicalRole: MusicalRole;
}
export interface GardenState {
  version: 1;
  bpm: number;
  key: "C";
  scale: "major-pentatonic";
  listener: Position;
  objects: MusicalObject[];
}
export const GARDEN_KEY = "picture-score:garden:v1";
export const MAX_OBJECTS = 12;
export const emptyGarden = (): GardenState => ({
  version: 1, bpm: 104, key: "C", scale: "major-pentatonic",
  listener: { x: 0.5, y: 0.65 }, objects: [],
});
export function classifyRole(strokes: Stroke[], music: MusicIR): MusicalRole {
  const notes = music.playNotes;
  if (!notes.length) return "decoration";
  const length = strokes.reduce((sum, s) => sum + s.points.reduce((n, p, i) =>
    n + (i ? Math.hypot(p.x - s.points[i - 1].x, p.y - s.points[i - 1].y) : 0), 0), 0);
  if (length < 40) return "decoration";
  if (notes.filter((n) => n.articulation === "chord").length / notes.length > 0.45) return "harmony";
  if (notes.reduce((sum, n) => sum + n.duration, 0) / notes.length > 2) return "drone";
  let sharp = 0, turns = 0;
  for (const s of strokes) for (let i = 1; i < s.points.length - 1; i++) {
    const a = s.points[i - 1], b = s.points[i], c = s.points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, ex = c.x - b.x, ey = c.y - b.y;
    const norm = Math.hypot(dx, dy) * Math.hypot(ex, ey);
    if (norm < 1) continue;
    turns++;
    if ((dx * ex + dy * ey) / norm < 0.15) sharp++;
  }
  return notes.length > 35 || (sharp >= 3 && sharp / turns > 0.15) ? "rhythm" : "melody";
}
export function makeObject(project: Project, position: Position, id: string = globalThis.crypto?.randomUUID?.() ??
  "seed-" + Date.now().toString(36) + Math.random().toString(36).slice(2)): MusicalObject {
  const snapshot = structuredClone(parseProject(project));
  const scoreIR = createVisualNotes(snapshot.strokes, snapshot.magnet);
  const musicIR = createMusic(scoreIR, snapshot.tempo, false, snapshot.magnet);
  return { id, title: snapshot.title, project: snapshot, strokeIR: snapshot.strokes, scoreIR, musicIR,
    world: { x: clamp(position.x, 0.06, 0.94), y: clamp(position.y, 0.08, 0.92), scale: 1, rotation: 0 },
    musicalRole: classifyRole(snapshot.strokes, musicIR) };
}
const validPosition = (p: Position) => p && [p.x, p.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1);
export function parseGarden(value: unknown): GardenState {
  const g = value as GardenState;
  if (!g || g.version !== 1 || g.key !== "C" || g.scale !== "major-pentatonic" ||
    !Number.isFinite(g.bpm) || g.bpm < 60 || g.bpm > 160 || !validPosition(g.listener) ||
    !Array.isArray(g.objects) || g.objects.length > MAX_OBJECTS) throw new Error("庭の保存データを読み込めません。");
  const ids = new Set<string>();
  const objects = g.objects.map((o) => {
    if (!o || typeof o.id !== "string" || ids.has(o.id) || !validPosition(o.world))
      throw new Error("庭の作品データが不正です。");
    ids.add(o.id);
    // Rebuild derived IR from validated immutable source. Never trust saved audio events.
    const object = makeObject(o.project, o.world, o.id);
    if (!object.musicIR.playNotes.length) throw new Error("空の作品です。");
    return object;
  });
  return { ...emptyGarden(), bpm: g.bpm, listener: { ...g.listener }, objects };
}
export function loadGarden(): { state: GardenState; error: string } {
  try {
    const raw = localStorage.getItem(GARDEN_KEY);
    return { state: raw ? parseGarden(JSON.parse(raw)) : emptyGarden(), error: "" };
  } catch { return { state: emptyGarden(), error: "庭の保存データを読み込めません。元データは上書きしていません。" }; }
}
