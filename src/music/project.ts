import type { Project } from "./types";
export const STORAGE_KEY = "picture-score:project:v1";
export const instruments = [
  "Piano",
  "Bell",
  "Pluck",
  "Toy",
  "Soft Synth",
] as const;
export const emptyProject = (): Project => ({
  version: 1,
  title: "Untitled no. 01",
  strokes: [],
  canvasAspect: 1000 / 420,
  magnet: 0.5,
  instrument: "Piano",
  tempo: 104,
  accompaniment: true,
});
export function parseProject(value: unknown): Project {
  if (!value || typeof value !== "object")
    throw new Error("Picture Scoreの作品ファイルを選んでください。");
  const p = value as Project;
  if (
    p.version !== 1 ||
    typeof p.title !== "string" ||
    p.title.length > 120 ||
    !Array.isArray(p.strokes) ||
    p.strokes.length > 500 ||
    !instruments.includes(p.instrument) ||
    !Number.isFinite(p.magnet) ||
    p.magnet < 0 ||
    p.magnet > 1 ||
    !Number.isFinite(p.tempo) ||
    p.tempo < 60 ||
    p.tempo > 160 ||
    typeof p.accompaniment !== "boolean"
  )
    throw new Error("作品ファイルの形式が正しくありません。");
  const canvasAspect = p.canvasAspect ?? 1000 / 420;
  if (!Number.isFinite(canvasAspect) || canvasAspect < 0.35 || canvasAspect > 5)
    throw new Error("キャンバスの縦横比が正しくありません。");
  const ids = new Set<string>();
  let points = 0;
  for (const s of p.strokes) {
    if (
      !s ||
      typeof s.id !== "string" ||
      ids.has(s.id) ||
      !Array.isArray(s.points) ||
      !s.points.length ||
      (points += s.points.length) > 60000
    )
      throw new Error("線のデータが正しくありません。");
    ids.add(s.id);
    for (const n of s.points)
      if (
        !n ||
        ![n.x, n.y, n.pressure, n.time].every(Number.isFinite) ||
        n.x < 0 ||
        n.x > 1000 ||
        n.y < 0 ||
        n.y > 420 ||
        n.pressure < 0 ||
        n.pressure > 1
      )
        throw new Error("描画座標が正しくありません。");
  }
  return {
    version: 1,
    title: p.title,
    strokes: p.strokes,
    canvasAspect,
    magnet: p.magnet,
    instrument: p.instrument,
    tempo: p.tempo,
    accompaniment: p.accompaniment,
  };
}
export function loadProject(): Project {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseProject(JSON.parse(saved)) : emptyProject();
  } catch {
    return emptyProject();
  }
}
