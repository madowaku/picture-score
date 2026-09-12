import { describe, expect, it } from "vitest";
import { emptyProject } from "../music/project";
import { exampleStrokes } from "../music/examples";
import { emptyGarden, makeObject, parseGarden } from "./gardenState";
import type { MusicalRole } from "./gardenState";
import { mixGarden } from "./gardenMixer";
import { buildEnsemblePlan, independentNotes, proximityStrength } from "./ensemble";

function object(id: string, role: MusicalRole = "melody", x = .45) {
  const item = makeObject({ ...emptyProject(), strokes: exampleStrokes("wave") }, { x, y: .5 }, id);
  return { ...item, musicalRole: role };
}
const world = (...objects: ReturnType<typeof object>[]) => ({ ...emptyGarden(), listener: { x: .5, y: .5 }, objects });
const plan = (state: ReturnType<typeof world>, phrase = 0) => buildEnsemblePlan(state, mixGarden(state, phrase), phrase);

describe("Ensemble derived arrangement", () => {
  it("smoothly maps distance into relation strength", () => {
    expect(proximityStrength({ x: 0, y: 0 }, { x: .34, y: 0 })).toBe(0);
    expect(proximityStrength({ x: 0, y: 0 }, { x: .22, y: 0 })).toBeCloseTo(.5);
    expect(proximityStrength({ x: 0, y: 0 }, { x: .1, y: 0 })).toBeCloseTo(1);
    let previous = 1;
    for (let x = 0; x < .5; x += .001) {
      const value = proximityStrength({ x: 0, y: 0 }, { x, y: 0 });
      expect(value).toBeLessThanOrEqual(previous);
      expect(previous - value).toBeLessThan(.007);
      previous = value;
    }
  });
  it("keeps far melodies independent and preserves all source data", () => {
    const state = world(object("a", "melody", .2), object("b", "melody", .8));
    const before = structuredClone(state);
    expect(plan(state).relations).toEqual([]);
    expect(plan(state).objectPlans.get("a")!.notes).toEqual(independentNotes(state.objects[0]));
    expect(state).toEqual(before);
  });
  it("gives close melodies separate eight-beat answers with the same pitch contour", () => {
    const state = world(object("a"), object("b", "melody", .51));
    const before = structuredClone(state);
    for (const phrase of [0, 1, 2, 10]) {
      const result = plan(state, phrase), a = result.objectPlans.get("a")!, b = result.objectPlans.get("b")!;
      expect(result.relations).toHaveLength(1);
      expect(a.strength).toBeCloseTo(1);
      expect(a.activeWindows.some((n) => b.activeWindows.includes(n))).toBe(false);
      for (const [id, lane] of result.objectPlans) {
        expect(lane.notes.map((n) => n.pitch)).toEqual(independentNotes(state.objects.find((o) => o.id === id)!).map((n) => n.pitch));
        expect(lane.notes.every((n) => lane.activeWindows.includes(Math.floor(n.beat / 4)))).toBe(true);
        expect(lane.notes.every((n) => n.beat + n.duration <= Math.max(...lane.activeWindows) * 4 + 4)).toBe(true);
      }
      expect(plan(state, phrase)).toEqual(result);
    }
    expect(plan(state, 0).objectPlans.get("a")!.activeWindows).not.toEqual(plan(state, 1).objectPlans.get("a")!.activeWindows);
    expect(state).toEqual(before);
  });
  it("has partial overlap at weak proximity and no relation to an inaudible partner", () => {
    const state = world(object("a", "melody", .35), object("b", "melody", .63));
    const weak = plan(state).objectPlans.get("a")!;
    expect(weak.strength).toBeGreaterThan(0);
    expect(weak.strength).toBeLessThan(.5);
    expect(buildEnsemblePlan(state, new Map([["a", .5], ["b", 0]]), 0).relations).toEqual([]);
  });
  it("places bounded harmony on strong beats and sustains one drone bed", () => {
    const state = world(object("melody"), object("harmony", "harmony", .5), object("drone", "drone", .48));
    const result = plan(state);
    const harmony = result.objectPlans.get("harmony")!, drone = result.objectPlans.get("drone")!;
    expect(harmony.notes.length).toBeGreaterThan(0);
    expect(harmony.notes.every((n) => n.beat % 4 === 0)).toBe(true);
    expect(drone.notes).toHaveLength(1);
    expect(drone.notes[0].duration).toBeGreaterThan(15);
    expect(drone.roleWeight).toBeLessThan(1);
    const distant = structuredClone(state); distant.objects[2].world.x = .9;
    expect(plan(distant).objectPlans.get("drone")!.strength).toBe(0);
  });
  it("uses offbeat/phrase-end gaps for rhythm and decoration without duplicating melodic onsets", () => {
    const state = world(object("a"), object("r", "rhythm", .5), object("d", "decoration", .48));
    const result = plan(state), melody = result.objectPlans.get("a")!.notes;
    for (const id of ["r", "d"]) {
      const notes = result.objectPlans.get(id)!.notes;
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.length).toBeLessThanOrEqual(id === "r" ? 12 : 4);
      expect(notes.every((n) => n.beat % 1 === .5)).toBe(true);
      expect(notes.every((n) => !melody.some((m) => Math.abs(m.beat - n.beat) < .26))).toBe(true);
    }
  });
  it("bounds dense clusters and uses stable IDs for matching", () => {
    const roles = ["melody", "melody", "melody", "harmony", "drone", "rhythm", "decoration"] as const;
    const state = world(...Array.from({ length: 12 }, (_, i) => object(String(i), roles[i % roles.length])));
    for (let phrase = 0; phrase < 12; phrase++) {
      const result = plan(state, phrase);
      for (const lane of result.objectPlans.values()) {
        expect(lane.strength).toBeGreaterThanOrEqual(0); expect(lane.strength).toBeLessThanOrEqual(1);
        expect(lane.roleWeight).toBeLessThanOrEqual(1);
        expect(lane.notes.every((n) => Number.isFinite(n.pitch + n.beat + n.duration + n.velocity) && n.beat < 16 && n.duration > 0)).toBe(true);
        const ticks = new Map<number, number>();
        for (const n of lane.notes) ticks.set(n.beat, (ticks.get(n.beat) ?? 0) + 1);
        expect(Math.max(0, ...ticks.values())).toBeLessThanOrEqual(6);
      }
      const mix = mixGarden(state, phrase);
      expect(buildEnsemblePlan({ ...state, objects: [...state.objects].reverse() }, mix, phrase)).toEqual(result);
    }
  });
  it("keeps separated regions independent and loads v0.1 without migration", () => {
    const state = world(object("a", "melody", .1), object("b", "melody", .15), object("c", "melody", .85));
    const restored = parseGarden(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
    expect(plan({ ...state, listener: { x: .1, y: .5 } }).relations.map((r) => [r.a, r.b])).toEqual([["a", "b"]]);
    expect(plan({ ...state, listener: { x: .9, y: .5 } }).relations).toEqual([]);
    expect(JSON.stringify(state)).not.toContain("relations");
  });
});
