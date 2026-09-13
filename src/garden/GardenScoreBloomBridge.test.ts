import { describe, expect, it } from "vitest";
import { canonicalMusicalTimelineFixture } from "../music/ir/fixtures";
import { clearingPalette } from "../palettes";
import { ScoreBloomSession } from "../world/runtime";
import { advanceGardenScoreBloom } from "./GardenScoreBloomBridge";

const session = () => new ScoreBloomSession({
  trackId: "garden-fixture",
  seed: 42,
  timeline: canonicalMusicalTimelineFixture,
  palette: clearingPalette,
  reducedMotion: false,
});

describe("GardenScoreBloomBridge clock seam", () => {
  it("returns no React frame when time advances without a visible semantic change", () => {
    const current = session();
    current.advanceTo(0);
    expect(advanceGardenScoreBloom(current, 0.5)).toBeNull();
    expect(current.time).toBe(0.5);
  });

  it("publishes one frame when a semantic event changes the world", () => {
    const current = session();
    current.advanceTo(0);
    const frame = advanceGardenScoreBloom(current, 1);
    expect(frame).not.toBeNull();
    expect(frame!.snapshot.time).toBe(1);
    expect(frame!.snapshot.entities.length).toBeGreaterThan(0);
  });

  it("uses deterministic seek reconstruction if the transport clock moves backward", () => {
    const current = session();
    current.advanceTo(3);
    const rewind = advanceGardenScoreBloom(current, 1);

    const fresh = session();
    fresh.seek(1);
    expect(current.snapshot()).toEqual(fresh.snapshot());
    expect(rewind?.snapshot).toEqual(fresh.snapshot());
  });

  it("publishes a rewind frame even when visible entities do not change", () => {
    const current = session();
    current.advanceTo(0.5);
    const rewind = advanceGardenScoreBloom(current, 0.25);
    expect(rewind).not.toBeNull();
    expect(rewind!.snapshot.time).toBe(0.25);
    expect(rewind!.snapshot.entities).toHaveLength(0);
  });
});
