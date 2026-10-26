import { describe, expect, it } from "vitest";
import { backupFile, parseBackup, planRestore } from "./backup";
import { emptyProject } from "../music/project";
import { exampleStrokes } from "../music/examples";
const item = { id: "original", createdAt: 1, updatedAt: 2, project: { ...emptyProject(), title: "ひかり", strokes: exampleStrokes("heart") } };
const backup = { format: "picture-score-sketchbook", version: 1, exportedAt: 3, artworks: [item] };
describe("sketchbook backup", () => {
  it("round-trips complete artwork and sound settings", async () => {
    const restored = parseBackup(JSON.parse(await backupFile([item]).text()));
    expect(restored.artworks).toEqual([item]);
  });
  it("rejects malformed, duplicate and unrenderable records before any write", () => {
    for (const value of [null, {}, item.project, { ...backup, version: 2 }, { ...backup, artworks: [item, item] },
      { ...backup, artworks: [{ ...item, createdAt: 1e20 }] }, { ...backup, artworks: [{ ...item, project: { ...item.project, strokes: [] } }] }])
      expect(() => parseBackup(value)).toThrow();
  });
  it("keeps conflicts as separate works and does not duplicate on repeat import", () => {
    const current = { ...item, project: { ...item.project, title: "今の作品" } };
    const first = planRestore([current], [item], () => "copy");
    expect(first.additions).toEqual([{ ...item, id: "copy" }]);
    expect(current.project.title).toBe("今の作品");
    expect(planRestore([current, ...first.additions], [item], () => "new")).toEqual({ additions: [], skipped: 1 });
  });
  it("keeps intentional identical works with distinct IDs", () => {
    const copy = { ...item, id: "intentional-copy" };
    expect(planRestore([], [item, copy], () => "unused").additions).toEqual([item, copy]);
    expect(planRestore([item], [item], () => "unused")).toEqual({ additions: [], skipped: 1 });
  });
});
