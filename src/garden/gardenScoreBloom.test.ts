import { describe, expect, it } from "vitest";
import type { MusicIR, Project } from "../music/types";
import type { GardenState, MusicalObject, MusicalRole } from "./gardenState";
import { gardenScoreBloomIdentity, gardenScoreBloomSource } from "./gardenScoreBloom";

const project: Project = {
  version: 1,
  title: "fixture",
  strokes: [],
  canvasAspect: 1,
  magnet: 0.5,
  instrument: "Piano",
  tempo: 104,
  accompaniment: false,
};

const object = (id: string, role: MusicalRole, pitch: number, beat: number): MusicalObject => {
  const musicIR: MusicIR = {
    key: "C",
    scale: "major-pentatonic",
    tempo: 104,
    meter: [4, 4],
    lengthBeats: 16,
    drawing: [],
    playNotes: [{
      id: `${id}-note`,
      pitch,
      beat,
      duration: role === "drone" ? 3 : 0.5,
      velocity: 0.72,
      sourceIds: [],
      anchorId: "fixture-anchor",
      articulation: role === "harmony" ? "chord" : role === "drone" ? "sustain" : "melody",
    }],
    support: [],
  };
  return {
    id,
    title: id,
    project: { ...project, title: id },
    strokeIR: [],
    scoreIR: [],
    musicIR,
    world: { x: 0.2, y: 0.3, scale: 1, rotation: 0 },
    musicalRole: role,
  };
};

const garden = (): GardenState => ({
  version: 1,
  bpm: 104,
  key: "C",
  scale: "major-pentatonic",
  listener: { x: 0.5, y: 0.65 },
  objects: [
    object("melody", "melody", 67, 1),
    object("harmony", "harmony", 60, 2),
    object("rhythm", "rhythm", 48, 3),
    object("ornament", "decoration", 76, 4),
    object("resonance", "drone", 43, 5),
  ],
});

describe("garden SCORE BLOOM semantic adapter", () => {
  it("ignores Garden placement and listener movement in semantic identity", () => {
    const first = garden();
    const moved: GardenState = {
      ...first,
      listener: { x: 0.1, y: 0.9 },
      objects: first.objects.map((entry, index) => ({
        ...entry,
        world: { ...entry.world, x: 0.9 - index * 0.1, y: 0.1 + index * 0.1 },
      })),
    };

    expect(gardenScoreBloomIdentity(moved)).toBe(gardenScoreBloomIdentity(first));
  });

  it("changes identity when BPM or source music changes", () => {
    const first = garden();
    const bpmChanged = { ...first, bpm: 120 };
    const musicChanged: GardenState = {
      ...first,
      objects: first.objects.map((entry, index) => index ? entry : {
        ...entry,
        musicIR: {
          ...entry.musicIR,
          playNotes: entry.musicIR.playNotes.map(note => ({ ...note, pitch: note.pitch + 2 })),
        },
      }),
    };

    expect(gardenScoreBloomIdentity(bpmChanged)).not.toBe(gardenScoreBloomIdentity(first));
    expect(gardenScoreBloomIdentity(musicChanged)).not.toBe(gardenScoreBloomIdentity(first));
  });

  it("bridges all five Garden roles into the six-event Musical IR vocabulary", () => {
    const source = gardenScoreBloomSource(garden());
    expect(source).not.toBeNull();
    const types = source!.timeline.events.map(event => event.type);
    expect(types).toContain("section");
    expect(types).toContain("melody");
    expect(types).toContain("harmony");
    expect(types).toContain("rhythm");
    expect(types).toContain("ornament");
    expect(types).toContain("resonance");
    expect(source!.timeline.events.every(event => event.time >= 0 && event.time <= source!.timeline.duration)).toBe(true);
  });

  it("is deterministic and emits one semantic occurrence per source play note", () => {
    const first = gardenScoreBloomSource(garden());
    const second = gardenScoreBloomSource(garden());
    expect(second).toEqual(first);
    expect(first!.timeline.events).toHaveLength(6);
    expect(new Set(first!.timeline.events.map(event => event.id)).size).toBe(first!.timeline.events.length);
  });

  it("returns no semantic source for an empty Garden", () => {
    expect(gardenScoreBloomSource({ ...garden(), objects: [] })).toBeNull();
  });
});
