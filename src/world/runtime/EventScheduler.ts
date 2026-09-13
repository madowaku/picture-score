import type { WorldEvent } from "../events";

const assertTargetTime = (time: number): void => {
  if (!Number.isFinite(time) || time < 0) {
    throw new Error("scheduler target time must be a finite non-negative number");
  }
};

const cloneEvent = (event: WorldEvent): WorldEvent => structuredClone(event);

export class EventScheduler {
  private readonly events: readonly WorldEvent[];
  private index = 0;

  constructor(input: readonly WorldEvent[]) {
    const events = input.map(cloneEvent);
    const ids = new Set<string>();
    let previousTime = -Infinity;

    for (const event of events) {
      if (!Number.isFinite(event.time) || event.time < 0) {
        throw new Error(`invalid WorldEvent time: ${event.id}`);
      }
      if (event.time < previousTime) {
        throw new Error("WorldEvents must be sorted by time");
      }
      if (ids.has(event.id)) {
        throw new Error(`duplicate WorldEvent id: ${event.id}`);
      }
      ids.add(event.id);
      previousTime = event.time;
    }

    this.events = Object.freeze(events);
  }

  get cursor(): number {
    return this.index;
  }

  get total(): number {
    return this.events.length;
  }

  reset(): void {
    this.index = 0;
  }

  flushUntil(time: number, emit: (event: WorldEvent) => void): number {
    assertTargetTime(time);
    let emitted = 0;

    while (this.index < this.events.length) {
      const event = this.events[this.index];
      if (event.time > time) break;
      this.index += 1;
      emit(cloneEvent(event));
      emitted += 1;
    }

    return emitted;
  }

  replayTo(time: number, emit: (event: WorldEvent) => void): number {
    this.reset();
    return this.flushUntil(time, emit);
  }
}
