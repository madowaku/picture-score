import { describe, expect, it } from "vitest";
import type { PulseEvent, WorldEvent } from "../events";
import { EventScheduler } from "./EventScheduler";

const pulse = (id: string, time: number): PulseEvent => ({
  id,
  type: "pulse",
  role: "rhythm",
  time,
  sourceEventId: `source:${id}`,
  seed: time * 1000 + id.length,
  intensity: 0.6,
  positionHint: { x: 0.5, y: 0.5 },
});

const fixture = (): WorldEvent[] => [
  pulse("a", 0),
  pulse("b", 0.5),
  pulse("c", 1),
  pulse("d", 2),
];

describe("EventScheduler", () => {
  it("emits the expected prefix once and only once", () => {
    const scheduler = new EventScheduler(fixture());
    const ids: string[] = [];

    expect(scheduler.flushUntil(1, (event) => ids.push(event.id))).toBe(3);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(scheduler.cursor).toBe(3);

    expect(scheduler.flushUntil(1, (event) => ids.push(event.id))).toBe(0);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(scheduler.cursor).toBe(3);
  });

  it("later flush emits only the delta", () => {
    const scheduler = new EventScheduler(fixture());
    const ids: string[] = [];

    scheduler.flushUntil(0.5, (event) => ids.push(event.id));
    expect(scheduler.flushUntil(2, (event) => ids.push(event.id))).toBe(2);
    expect(ids).toEqual(["a", "b", "c", "d"]);
    expect(scheduler.cursor).toBe(scheduler.total);
  });

  it("reset plus replay reconstructs the same canonical prefix", () => {
    const scheduler = new EventScheduler(fixture());
    const first: string[] = [];
    const second: string[] = [];

    scheduler.flushUntil(1, (event) => first.push(event.id));
    scheduler.reset();
    scheduler.flushUntil(1, (event) => second.push(event.id));

    expect(second).toEqual(first);
    expect(scheduler.cursor).toBe(3);
  });

  it("replayTo supports a backward seek followed by a forward seek without duplicates", () => {
    const scheduler = new EventScheduler(fixture());
    const first: string[] = [];
    const backward: string[] = [];
    const forward: string[] = [];

    scheduler.flushUntil(2, (event) => first.push(event.id));
    expect(scheduler.replayTo(0.5, (event) => backward.push(event.id))).toBe(2);
    expect(scheduler.replayTo(2, (event) => forward.push(event.id))).toBe(4);

    expect(first).toEqual(["a", "b", "c", "d"]);
    expect(backward).toEqual(["a", "b"]);
    expect(forward).toEqual(first);
  });

  it("isolates stored events from consumer mutation across replay", () => {
    const scheduler = new EventScheduler(fixture());
    scheduler.flushUntil(0, (event) => {
      if (event.type === "pulse") event.positionHint.x = 0.99;
    });

    let replayed: WorldEvent | undefined;
    scheduler.replayTo(0, (event) => {
      replayed = event;
    });

    expect(replayed?.type).toBe("pulse");
    if (replayed?.type === "pulse") expect(replayed.positionHint.x).toBe(0.5);
  });

  it("rejects invalid targets, unsorted input and duplicate event ids", () => {
    const scheduler = new EventScheduler(fixture());
    expect(() => scheduler.flushUntil(-1, () => undefined)).toThrow(/target time/);
    expect(() => scheduler.flushUntil(Number.NaN, () => undefined)).toThrow(/target time/);

    expect(() => new EventScheduler([pulse("late", 2), pulse("early", 1)])).toThrow(
      /sorted/,
    );
    expect(() => new EventScheduler([pulse("same", 0), pulse("same", 1)])).toThrow(
      /duplicate WorldEvent id/,
    );
  });
});
