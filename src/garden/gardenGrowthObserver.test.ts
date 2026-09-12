import { afterEach, expect, it, vi } from "vitest";
import { GardenTransport } from "./gardenTransport";
import { emptyGarden, makeObject } from "./gardenState";
import { emptyProject } from "../music/project";

afterEach(() => vi.unstubAllGlobals());
it("observes audible clock slices, never muted, hidden, suspended, or missed time", () => {
  vi.stubGlobal("document", { hidden:false });
  const object = makeObject(emptyProject(), {x:.5,y:.5}, "a");
  const engine = new GardenTransport();
  const ctx = {currentTime:1,state:"running"};
  const lane = {gain:{gain:{value:.3}},free:{gain:{value:1}},ensemble:{gain:{value:0}},
    activity:[{at:0,until:20,layer:"free"}]};
  // Scheduler seam: deterministic audio-clock/gain values, no real oscillator or wall timer.
  Object.assign(engine, {ctx,state:{...emptyGarden(),bpm:60,listener:{x:.5,y:.5},objects:[object]},
    startTime:0,lanes:new Map([["a",lane]]),heardTick:3,running:true});
  const heard = vi.fn();
  engine.onHeard = heard;
  const observe = () => (engine as unknown as {observeHeard:()=>void}).observeHeard();
  observe();
  expect(heard.mock.lastCall?.[0].audible).toEqual(["a"]);
  observe();
  expect(heard).toHaveBeenCalledTimes(1);
  ctx.currentTime=1.25; lane.gain.gain.value=.02; lane.free.gain.value=.03;
  observe();
  expect(heard.mock.lastCall?.[0].audible).toEqual([]);
  ctx.currentTime=1.5; vi.stubGlobal("document",{hidden:true}); observe();
  expect(heard.mock.lastCall).toEqual([null]);
  vi.stubGlobal("document",{hidden:false});
  ctx.currentTime=5; observe();
  expect(heard.mock.lastCall).toEqual([null]);
  ctx.currentTime=5.25; ctx.state="suspended"; observe();
  expect(heard.mock.lastCall).toEqual([null]);
});
