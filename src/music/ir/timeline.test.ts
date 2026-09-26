import { describe, expect, it } from "vitest";
import { canonicalMusicalTimelineFixture } from "./fixtures";
import {
  normalizeMusicalTimeline,
  parseMusicalTimeline,
  serializeMusicalTimeline,
} from "./timeline";

const cloneFixture = () => structuredClone(canonicalMusicalTimelineFixture);

describe("Musical IR contract", () => {
  it("round-trips a canonical fixture through JSON", () => {
    const fixture = cloneFixture();
    expect(parseMusicalTimeline(JSON.parse(JSON.stringify(fixture)))).toEqual(
      fixture,
    );
  });

  it("sorts frames and simultaneous events deterministically", () => {
    const fixture = cloneFixture();
    fixture.frames.reverse();
    fixture.events.reverse();

    const normalized = normalizeMusicalTimeline(fixture);
    expect(normalized.frames.map((frame) => frame.time)).toEqual([0, 2]);
    expect(normalized.events.map((event) => event.id)).toEqual([
      "section-0",
      "rhythm-1",
      "harmony-1",
      "melody-1",
      "ornament-1",
      "resonance-1",
    ]);
  });

  it("serializes identically for equivalent input orderings", () => {
    const a = cloneFixture();
    const b = cloneFixture();
    b.frames.reverse();
    b.events.reverse();

    expect(serializeMusicalTimeline(a)).toBe(serializeMusicalTimeline(b));
  });

  it("normalizes bounded semantic values but does not hide broken time values", () => {
    const fixture = cloneFixture();
    fixture.frames[0].energy = -0.5;
    fixture.frames[0].brightness = 1.5;
    fixture.events[1].strength = 2;

    const normalized = normalizeMusicalTimeline(fixture);
    expect(normalized.frames[0].energy).toBe(0);
    expect(normalized.frames[0].brightness).toBe(1);
    expect(normalized.events.find((event) => event.id === "rhythm-1")?.strength).toBe(1);

    const broken = cloneFixture();
    broken.events[0].time = 5;
    expect(() => normalizeMusicalTimeline(broken)).toThrow(/event\.time/);
  });

  it("rejects duplicate event ids and duplicate frame times", () => {
    const duplicateEvent = cloneFixture();
    duplicateEvent.events[1].id = duplicateEvent.events[0].id;
    expect(() => parseMusicalTimeline(duplicateEvent)).toThrow(/event ids/);

    const duplicateFrame = cloneFixture();
    duplicateFrame.frames[1].time = duplicateFrame.frames[0].time;
    expect(() => parseMusicalTimeline(duplicateFrame)).toThrow(/frame times/);
  });

  it("rejects unsupported versions and invalid event-specific values", () => {
    const wrongVersion = {
      ...cloneFixture(),
      version: "picture-score:musical-ir:v2",
    };
    expect(() => parseMusicalTimeline(wrongVersion)).toThrow(/version/);

    const invalidRoot = cloneFixture();
    const harmony = invalidRoot.events.find((event) => event.type === "harmony");
    if (!harmony || harmony.type !== "harmony") throw new Error("fixture broken");
    harmony.root = 12;
    expect(() => parseMusicalTimeline(invalidRoot)).toThrow(/root/);
  });

  it("contains every v0.9 core semantic event type", () => {
    const types = new Set(cloneFixture().events.map((event) => event.type));
    expect(types).toEqual(
      new Set([
        "section",
        "rhythm",
        "harmony",
        "melody",
        "ornament",
        "resonance",
      ]),
    );
  });
});
