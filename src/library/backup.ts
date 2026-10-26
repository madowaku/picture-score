import { parseArtwork, type Artwork } from "./store";
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export interface SketchbookBackup { format: "picture-score-sketchbook"; version: 1; exportedAt: number; artworks: Artwork[] }
const validDate = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 8.64e15;

export function parseBackup(value: unknown): SketchbookBackup {
  const data = value as SketchbookBackup;
  if (!data || data.format !== "picture-score-sketchbook" || data.version !== 1 || !validDate(data.exportedAt) ||
      !Array.isArray(data.artworks) || data.artworks.length > 1000) throw new Error("invalid-backup");
  const ids = new Set<string>();
  let points = 0;
  const artworks = data.artworks.map(value => {
    const item = parseArtwork(value);
    if (item.id.length > 160 || ids.has(item.id) || !validDate(item.createdAt) || !validDate(item.updatedAt) || !item.project.strokes.length)
      throw new Error("invalid-backup");
    ids.add(item.id);
    for (const stroke of item.project.strokes) points += stroke.points.length;
    if (points > 1_000_000) throw new Error("backup-too-large");
    return item;
  });
  return { format: "picture-score-sketchbook", version: 1, exportedAt: data.exportedAt, artworks };
}
export function backupFile(artworks: Artwork[]) {
  const data = parseBackup({ format: "picture-score-sketchbook", version: 1, exportedAt: Date.now(), artworks });
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  if (blob.size > MAX_BACKUP_BYTES) throw new Error("backup-too-large");
  return blob;
}

/** Conflicts become separate works; a repeated import also recognizes earlier copies. */
export function planRestore(current: Artwork[], incoming: Artwork[], newId: () => string) {
  const byId = new Map(current.map(item => [item.id, item]));
  const fingerprints = new Set(current.map(item => JSON.stringify(item.project)));
  const additions: Artwork[] = [];
  let skipped = 0;
  for (const item of incoming) {
    const fingerprint = JSON.stringify(item.project);
    if (byId.has(item.id) && fingerprints.has(fingerprint)) { skipped++; continue; }
    let id = item.id;
    if (byId.has(id)) { do { id = newId(); } while (byId.has(id)); }
    const next = { ...item, id };
    additions.push(next); byId.set(id, next); fingerprints.add(fingerprint);
  }
  return { additions, skipped };
}
