import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyGarden, makeObject } from "./gardenState";
import { emptyProject } from "../music/project";
import { emptyGrowth, GrowthAccumulator, growthStage, loadGrowth, pairKey, parseGrowth, pruneGrowth } from "./growth";
import type { HeardSlice } from "./growth";

const slice = (beat: number, audible = ["a", "b"]): HeardSlice => ({
  beat, delta: .25, audible, eligible: ["a", "b"],
  relations: [{ a: "a", b: "b", kind: "call-response", strength: 1 }],
});
afterEach(() => vi.unstubAllGlobals());
describe("Musical memory", () => {
  it("counts audible beats only and caps growth", () => {
    const accumulator = new GrowthAccumulator();
    let state = emptyGrowth();
    for (let i = 0; i < 400; i++) state = accumulator.advance(state, slice(i / 4, ["a"]));
    expect(state.objects.a).toBe(64);
    expect(state.objects.b).toBeUndefined();
    expect(state.relations).toEqual({});
    expect([0, 3.75, 4, 16, 32, 64].map((n) => growthStage(n))).toEqual([0, 0, 1, 2, 3, 3]);
  });
  it("credits both sides of a real call/response, not a permanently silent partner", () => {
    const accumulator = new GrowthAccumulator(); let state = emptyGrowth();
    for (let i = 0; i < 64; i++) state = accumulator.advance(state, slice(i / 4, [i < 32 ? "a" : "b"]));
    expect(state.relations[pairKey("a", "b")].sharedBeats).toBe(8);
    expect(state.objects).toEqual({ a: 8, b: 8 });
    expect(growthStage(8, true)).toBe(1);
  });
  it("does not carry unfinished call evidence across STOP or phrase boundaries", () => {
    const accumulator = new GrowthAccumulator(); let state = emptyGrowth();
    for (let i = 0; i < 32; i++) state = accumulator.advance(state, slice(i / 4, ["a"]));
    accumulator.reset();
    for (let i = 0; i < 32; i++) state = accumulator.advance(state, slice(i / 4, ["b"]));
    expect(state.relations).toEqual({});
    for (let i = 64; i < 96; i++) state = accumulator.advance(state, slice(i / 4, ["a"]));
    expect(state.relations).toEqual({});
  });
  it("stops relation credit on separation, weak relation, and role resting", () => {
    const accumulator = new GrowthAccumulator(); let state = emptyGrowth();
    for (let i = 0; i < 40; i++) state = accumulator.advance(state, slice(i / 4));
    const earned = structuredClone(state.relations);
    for (let i = 40; i < 50; i++) state = accumulator.advance(state, { ...slice(i / 4), relations: [] });
    for (let i = 50; i < 60; i++) state = accumulator.advance(state, { ...slice(i / 4), eligible: ["a"] });
    for (let i = 60; i < 70; i++) state = accumulator.advance(state, { ...slice(i / 4),
      relations: [{ ...slice(i / 4).relations[0], strength: .2 }] });
    expect(state.relations).toEqual(earned);
  });
  it("bounds a delayed slice and never mutates previous state", () => {
    const state = emptyGrowth(), before = structuredClone(state);
    const next = new GrowthAccumulator().advance(state, { ...slice(10000), delta: 5000 });
    expect(next.objects.a).toBe(.25);
    expect(state).toEqual(before);
    expect(pairKey("a::b", "c")).not.toBe(pairKey("a", "b::c"));
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });
  it("loads old worlds with zero growth and isolates corrupt growth", () => {
    const garden = emptyGarden();
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(loadGrowth(garden)).toEqual({ state: emptyGrowth(), protected: false });
    vi.stubGlobal("localStorage", { getItem: () => "{broken" });
    expect(loadGrowth(garden).protected).toBe(true);
    expect(garden).toEqual(emptyGarden());
    for (const value of [null, [], { ...emptyGrowth(), objects: { a: Infinity } },
      { ...emptyGrowth(), relations: { wrong: { a: "a", b: "b", sharedBeats: 5 } } }])
      expect(() => parseGrowth(value, garden)).toThrow();
  });
  it("preserves counters across movement and prunes only removed artworks", () => {
    const project = { ...emptyProject(), strokes: [{ id: "p", points: [{ x: 50, y: 50, time: 0, pressure: .5 }] }] };
    const a = makeObject(project, { x: .3, y: .4 }, "a"), b = makeObject(project, { x: .5, y: .4 }, "b");
    const garden = { ...emptyGarden(), objects: [a, b] };
    const state = { ...emptyGrowth(), objects: { a: 16, b: 32 }, relations: {
      [pairKey("a", "b")]: { a: "a", b: "b", sharedBeats: 24 },
    } };
    expect(parseGrowth(JSON.parse(JSON.stringify(state)), garden)).toEqual(state);
    expect(pruneGrowth(state, { ...garden, objects: [a, { ...b, world: { ...b.world, x: .8 } }] })).toEqual(state);
    expect(pruneGrowth(state, { ...garden, objects: [a] })).toEqual({ ...state, objects: { a: 16 }, relations: {} });
  });
});
