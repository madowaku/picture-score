import { describe, expect, it } from "vitest";
import { emptyProject } from "../music/project";
import { exampleStrokes } from "../music/examples";
import { emptyGarden, makeObject, parseGarden } from "./gardenState";
import { distanceGain, mixGarden } from "./gardenMixer";

const source = (points: number[][]) => ({ ...emptyProject(), strokes: [{ id: "line", points:
  points.map(([x, y], i) => ({ x, y, pressure: 0.5, time: i * 30 })) }] });
describe("Garden source and orchestration contracts", () => {
  it("stores a deep snapshot and regenerates trustworthy IR on reload", () => {
    const project = { ...emptyProject(), strokes: exampleStrokes("cat") };
    const object = makeObject(project, { x: 0.3, y: 0.4 }, "cat");
    const garden = { ...emptyGarden(), objects: [object] };
    const copy = structuredClone(object);
    project.strokes[0].points[0].y = 0;
    expect(object).toEqual(copy);
    expect(parseGarden(JSON.parse(JSON.stringify(garden)))).toEqual(garden);
    const corrupt = structuredClone(garden);
    corrupt.objects[0].musicIR.playNotes[0].pitch = 999;
    expect(parseGarden(corrupt).objects[0].musicIR).toEqual(object.musicIR);
    expect(object.scoreIR.length).toBeGreaterThan(0);
    expect(object.strokeIR).toEqual(object.project.strokes);
  });
  it("classifies contrasting marks without semantic recognition", () => {
    const role = (points: number[][]) => makeObject(source(points), { x: 0.5, y: 0.5 }, "s").musicalRole;
    expect(role([[20, 210], [950, 210]])).toBe("drone");
    expect(role([[500, 20], [500, 390]])).toBe("harmony");
    expect(role([[500, 200]])).toBe("decoration");
    expect(makeObject({ ...emptyProject(), strokes: exampleStrokes("wave") }, { x: 0.5, y: 0.5 }, "w").musicalRole).toBe("melody");
  });
  it("fades with distance continuously and produces separate regions", () => {
    let previous = 1;
    for (let i = 0; i <= 100; i++) {
      const gain = distanceGain({ x: 0, y: 0 }, { x: i / 100, y: 0 });
      expect(gain).toBeLessThanOrEqual(previous);
      expect(previous - gain).toBeLessThan(0.04);
      previous = gain;
    }
    expect(previous).toBe(0);
    const a = makeObject(source([[10, 210], [950, 210]]), { x: 0.1, y: 0.2 }, "a");
    const b = { ...a, id: "b", world: { ...a.world, x: 0.9 } };
    expect(mixGarden({ ...emptyGarden(), listener: a.world, objects: [a, b] }).get("b")).toBe(0);
    expect(mixGarden({ ...emptyGarden(), listener: b.world, objects: [a, b] }).get("a")).toBe(0);
    const c = { ...a, id: "c", world: { ...a.world, x: 0.5, y: 0.9 } };
    for (const region of [a, b, c]) {
      const mix = mixGarden({ ...emptyGarden(), listener: region.world, objects: [a, b, c] });
      expect(mix.get(region.id)).toBeGreaterThan(0.4);
      expect([...mix].filter(([, gain]) => gain > 0)).toHaveLength(1);
    }
  });
  it("bounds 12-object clusters to role caps and a fixed total gain budget", () => {
    const roles = ["melody", "melody", "melody", "harmony", "harmony", "drone", "drone", "rhythm", "decoration", "decoration", "rhythm", "melody"] as const;
    const objects = roles.map((musicalRole, i) => ({ ...makeObject(source([[500, 200]]), { x: 0.5, y: 0.5 }, String(i)), musicalRole }));
    const state = { ...emptyGarden(), listener: { x: 0.5, y: 0.5 }, objects };
    for (let cycle = 0; cycle < 12; cycle++) {
      const mix = mixGarden(state, cycle);
      const active = objects.filter((o) => mix.get(o.id)! > 0);
      expect(active.filter((o) => o.musicalRole === "melody").length).toBeLessThanOrEqual(2);
      expect(active.filter((o) => o.musicalRole === "harmony").length).toBeLessThanOrEqual(1);
      expect(active.filter((o) => o.musicalRole === "drone").length).toBeLessThanOrEqual(1);
      expect(active.filter((o) => ["rhythm", "decoration"].includes(o.musicalRole)).length).toBeLessThanOrEqual(2);
      expect([...mix.values()].reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(0.75000001);
      expect(mixGarden(state, cycle)).toEqual(mix);
    }
    expect(mixGarden(state, 0)).not.toEqual(mixGarden(state, 4));
  });
  it("rejects corrupt, oversized and duplicate worlds without replacing source data", () => {
    const o = makeObject(source([[400, 200]]), { x: 0.5, y: 0.5 }, "s");
    expect(() => parseGarden({ ...emptyGarden(), bpm: NaN })).toThrow();
    expect(() => parseGarden({ ...emptyGarden(), listener: { x: Infinity, y: 0 } })).toThrow();
    expect(() => parseGarden({ ...emptyGarden(), objects: [o, o] })).toThrow();
    expect(() => parseGarden({ ...emptyGarden(), objects: Array.from({ length: 13 }, (_, i) => ({ ...o, id: String(i) })) })).toThrow();
  });
});
