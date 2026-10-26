import { describe, expect, it, vi } from "vitest";
import { artworkBounds, puchiNoteMarks, videoSize } from "./painter";
import { supportedVideoType, videoExtension } from "./video";
import { emptyProject, parseProject } from "../music/project";
import { exampleStrokes } from "../music/examples";
import { projectMusic } from "../music/arrangement";
import { activeArtworkId, parseArtwork, rememberActiveArtwork } from "../library/store";
import { AudioEngine } from "../music/audio";
import { createMusic, createVisualNotes } from "../music/score";
import { applyDrawWonder } from "../wonder/drawMusic";
import { drawRelations } from "../wonder/drawRelations";

describe("share composition", () => {
  it("keeps every supported canvas aspect inside both video shapes without stretching", () => {
    for (const shape of ["square", "portrait"] as const) {
      const size = videoSize(shape);
      for (const aspect of [.35, .5625, 1, 1000 / 420, 5]) {
        const rect = artworkBounds(aspect, size.width, size.height);
        expect(rect.width / rect.height).toBeCloseTo(aspect);
        expect(rect.x).toBeGreaterThanOrEqual(48);
        expect(rect.x + rect.width).toBeLessThanOrEqual(size.width - 48);
        expect(rect.y).toBeGreaterThanOrEqual(150 - 1e-9);
        expect(rect.y + rect.height).toBeLessThanOrEqual(size.height - 150 + 1e-9);
      }
    }
  });
  it("prefers MP4, uses WebM when necessary, and reports no encoder honestly", () => {
    expect(supportedVideoType(type => ["video/mp4", "video/webm"].includes(type))).toBe("video/mp4");
    expect(supportedVideoType(type => type === "video/webm;codecs=vp8,opus")).toBe("video/webm;codecs=vp8,opus");
    expect(supportedVideoType(() => false)).toBeNull();
    expect(videoExtension("video/mp4;codecs=avc1.42E01E,mp4a.40.2")).toBe("mp4");
    expect(videoExtension("video/webm;codecs=vp8,opus")).toBe("webm");
  });
});

describe("puchi notes in the share video", () => {
  it("marks every visual note once, in its stroke's ink, and links the notes that are performed", () => {
    const strokes = exampleStrokes("cat").map((stroke, index) => index === 0 ? { ...stroke, color: "#2584ac" } : stroke);
    const project = { ...emptyProject(), strokes };
    const music = projectMusic(project);
    const marks = puchiNoteMarks(project, music);
    expect(marks.map(mark => mark.id)).toEqual(music.drawing.map(note => note.id));
    const anchors = new Set(music.playNotes.map(note => note.anchorId));
    for (const mark of marks) {
      const note = music.drawing.find(item => item.id === mark.id)!;
      expect(mark).toMatchObject({ x: note.visualPosition.x, y: note.visualPosition.y });
      expect(!!mark.performed).toBe(anchors.has(mark.id));
      if (note.sourceStroke === strokes[0].id) expect(mark.color).toBe("#2584ac");
    }
    expect(marks.some(mark => mark.performed)).toBe(true);
    expect(marks.every(mark => mark.x >= 0 && mark.x <= 1000 && mark.y >= 0 && mark.y <= 420)).toBe(true);
  });
});

describe("saved artwork contract", () => {
  it("retains every source point and sound setting, and round-trips the existing project format", () => {
    const project = { ...emptyProject(), strokes: exampleStrokes("cat"), title: "ねこのうた", tempo: 160, magnet: .85, instrument: "Bell" as const, canvasAspect: .6, accompaniment: false };
    const item = parseArtwork(JSON.parse(JSON.stringify({ id: "cat", project, createdAt: 1, updatedAt: 2 })));
    expect(item.project).toEqual(project);
    expect(parseProject(JSON.parse(JSON.stringify(item.project)))).toEqual(project);
  });
  it("rejects corrupt metadata and malformed drawings instead of showing a broken card", () => {
    const item = { id: "x", project: emptyProject(), createdAt: 1, updatedAt: 2 };
    expect(() => parseArtwork({ ...item, updatedAt: NaN })).toThrow();
    expect(() => parseArtwork({ ...item, project: { ...item.project, tempo: 0 } })).toThrow();
    expect(() => parseArtwork({ ...item, project: { ...item.project, strokes: [{ id: "bad", points: [] }] } })).toThrow();
  });
  it("plays and exports the full Studio arrangement, including WONDER, without modifying the source", () => {
    const project = { ...emptyProject(), strokes: exampleStrokes("heart"), magnet: .7 };
    const original = structuredClone(project);
    const expected = applyDrawWonder(createMusic(createVisualNotes(project.strokes, project.magnet), project.tempo, project.accompaniment, project.magnet), drawRelations(project.strokes));
    expect(projectMusic(project)).toEqual(expected);
    expect(project).toEqual(original);
  });
});


describe("draft identity and playback cancellation", () => {
  it("does not bind a different or partially persisted draft to a saved artwork", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    try {
      const project = { ...emptyProject(), strokes: exampleStrokes("heart") };
      rememberActiveArtwork("original", project);
      expect(activeArtworkId(structuredClone(project))).toBe("original");
      const other = { ...project, title: "A different draft" };
      expect(activeArtworkId(other)).toBeNull();
      vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
      rememberActiveArtwork("another-artwork", other);
      expect(activeArtworkId(other)).toBeNull();
      expect(activeArtworkId(project)).toBe("original");
    } finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); }
  });
  it("does not start a pending preview after the user stops or leaves the sketchbook", async () => {
    const engine = new AudioEngine();
    let resume!: () => void;
    vi.spyOn(engine, "unlock").mockImplementation(() => new Promise<void>(resolve => { resume = resolve; }));
    const pending = engine.play(projectMusic(emptyProject()), "Piano");
    engine.stop();
    resume();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    vi.restoreAllMocks();
  });
});
