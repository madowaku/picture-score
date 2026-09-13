import { describe, expect, it, vi } from "vitest";
import { canonicalMusicalTimelineFixture } from "../../music/ir/fixtures";
import { mapMusicalEvent, mapMusicalTimeline } from "./mapper";
import { createSeededRandom, deriveSeed } from "./random";

const cloneFixture = () => structuredClone(canonicalMusicalTimelineFixture);

describe("WorldEvent mapper", () => {
  it("maps the canonical musical roles into a stable neutral event stream", () => {
    const mapped = mapMusicalTimeline(cloneFixture(), "track-a");

    expect(mapped.map((event) => event.type)).toEqual([
      "atmosphere",
      "pulse",
      "bloom",
      "birth",
      "growth",
      "spark",
      "sway",
    ]);
    expect(mapped.map((event) => event.role)).toEqual([
      "section",
      "rhythm",
      "harmony",
      "melody",
      "melody",
      "ornament",
      "resonance",
    ]);
  });

  it("is exactly repeatable for the same timeline and track seed", () => {
    const first = mapMusicalTimeline(cloneFixture(), "track-a");
    const second = mapMusicalTimeline(cloneFixture(), "track-a");
    expect(second).toEqual(first);
  });

  it("normalizes equivalent input ordering into the same world identity", () => {
    const canonical = cloneFixture();
    const shuffled = cloneFixture();
    shuffled.frames.reverse();
    shuffled.events.reverse();

    expect(mapMusicalTimeline(shuffled, "track-a")).toEqual(
      mapMusicalTimeline(canonical, "track-a"),
    );
  });

  it("changes world identity with a different track seed while preserving lineage", () => {
    const first = mapMusicalTimeline(cloneFixture(), "track-a");
    const second = mapMusicalTimeline(cloneFixture(), "track-b");

    expect(second.map((event) => event.sourceEventId)).toEqual(
      first.map((event) => event.sourceEventId),
    );
    expect(second.map((event) => event.seed)).not.toEqual(
      first.map((event) => event.seed),
    );
  });

  it("preserves source MusicalEvent ids for every generated event", () => {
    const fixture = cloneFixture();
    const sourceIds = new Set(fixture.events.map((event) => event.id));
    const mapped = mapMusicalTimeline(fixture, 42);

    expect(mapped.every((event) => sourceIds.has(event.sourceEventId))).toBe(true);
    expect(new Set(mapped.map((event) => event.id)).size).toBe(mapped.length);
  });

  it("keeps palette-independent position hints inside normalized bounds", () => {
    const mapped = mapMusicalTimeline(cloneFixture(), "position-test");
    for (const event of mapped) {
      if (!("positionHint" in event)) continue;
      expect(event.positionHint.x).toBeGreaterThanOrEqual(0);
      expect(event.positionHint.x).toBeLessThanOrEqual(1);
      expect(event.positionHint.y).toBeGreaterThanOrEqual(0);
      expect(event.positionHint.y).toBeLessThanOrEqual(1);
    }

    const birth = mapped.find((event) => event.type === "birth");
    expect(birth?.type).toBe("birth");
    if (birth?.type === "birth") expect(birth.positionHint.y).toBe(0.72);
  });

  it("links melody growth back to the birth event without requiring an entity id", () => {
    const melody = cloneFixture().events.find((event) => event.type === "melody");
    if (!melody || melody.type !== "melody") throw new Error("fixture broken");

    const mapped = mapMusicalEvent(melody, {
      trackSeed: "track-a",
      eventIndex: 3,
      sectionIndex: 0,
      worldDensity: 0.5,
    });

    expect(mapped).toHaveLength(2);
    expect(mapped[0].type).toBe("birth");
    expect(mapped[1].type).toBe("growth");
    if (mapped[1].type === "growth") expect(mapped[1].targetHint).toBe(mapped[0].id);
  });

  it("never depends on Math.random", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used");
    });
    expect(() => mapMusicalTimeline(cloneFixture(), "track-a")).not.toThrow();
    spy.mockRestore();
  });

  it("rejects duplicate source event ids before they can collide downstream", () => {
    const fixture = cloneFixture();
    fixture.events[1].id = fixture.events[0].id;
    expect(() => mapMusicalTimeline(fixture, "track-a")).toThrow(/event ids/);
  });
});

describe("deterministic random source", () => {
  it("derives stable seeds and repeatable random sequences", () => {
    const seed = deriveSeed("track-a", "event-a", 3);
    expect(seed).toBe(deriveSeed("track-a", "event-a", 3));
    expect(seed).not.toBe(deriveSeed("track-b", "event-a", 3));

    const a = createSeededRandom(seed);
    const b = createSeededRandom(seed);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
});
