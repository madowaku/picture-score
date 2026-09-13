import {
  normalizeMusicalTimeline,
  type MusicalTimeline,
} from "../../music/ir";
import {
  createPaletteRuntime,
  type EnvironmentState,
  type PaletteCue,
  type PaletteDefinition,
  type PaletteRuntime,
  type PaletteSpawnCue,
} from "../../palettes";
import { mapMusicalTimeline, type WorldEvent } from "../events";
import { EntityStore } from "./EntityStore";
import { EventScheduler } from "./EventScheduler";
import { LineageStore } from "./LineageStore";
import type { EntityOrigin, WorldEntity, WorldSnapshot } from "./types";

export interface ScoreBloomSessionOptions {
  trackId: string;
  seed: string | number;
  timeline: MusicalTimeline;
  palette: PaletteDefinition;
  reducedMotion: boolean;
}

const assertTime = (time: number): void => {
  if (!Number.isFinite(time) || time < 0) {
    throw new Error("score bloom time must be a finite non-negative number");
  }
};

const cloneEnvironment = (state: EnvironmentState): EnvironmentState => ({ ...state });

const sameEnvironment = (a: EnvironmentState, b: EnvironmentState): boolean =>
  a.energy === b.energy &&
  a.brightness === b.brightness &&
  a.wind === b.wind &&
  a.glow === b.glow &&
  a.atmosphere === b.atmosphere;

const sameVisibleEntities = (
  a: readonly WorldEntity[],
  b: readonly WorldEntity[],
): boolean => JSON.stringify(a) === JSON.stringify(b);

const originFromSpawnCue = (cue: PaletteSpawnCue): EntityOrigin => ({
  musicalEventId: cue.sourceEventId,
  worldEventId: cue.worldEventId,
  paletteCueId: cue.id,
});

export class ScoreBloomSession {
  private readonly trackId: string;
  private readonly seed: string | number;
  private readonly palette: PaletteDefinition;
  private readonly scheduler: EventScheduler;
  private readonly paletteRuntime: PaletteRuntime;
  private readonly entities: EntityStore;
  private readonly lineage = new LineageStore();
  private currentTime = 0;
  private revisionValue = 0;

  constructor(options: ScoreBloomSessionOptions) {
    if (!options.trackId.trim()) throw new Error("score bloom trackId is required");

    const timeline = normalizeMusicalTimeline(options.timeline);
    const worldEvents = mapMusicalTimeline(timeline, options.seed);

    this.trackId = options.trackId;
    this.seed = options.seed;
    this.palette = options.palette;
    this.scheduler = new EventScheduler(worldEvents);
    this.paletteRuntime = createPaletteRuntime(options.palette, {
      reducedMotion: options.reducedMotion,
    });
    this.entities = new EntityStore(options.palette.limits.total);
  }

  get revision(): number {
    return this.revisionValue;
  }

  get cursor(): number {
    return this.scheduler.cursor;
  }

  get totalEvents(): number {
    return this.scheduler.total;
  }

  get time(): number {
    return this.currentTime;
  }

  advanceTo(time: number): boolean {
    assertTime(time);
    if (time < this.currentTime) {
      throw new Error("advanceTo cannot move backward; use seek instead");
    }

    let changed = false;
    this.scheduler.flushUntil(time, (event) => {
      changed = this.applyEvent(event) || changed;
    });
    this.currentTime = time;

    if (changed) this.revisionValue += 1;
    return changed;
  }

  seek(time: number): boolean {
    assertTime(time);
    const beforeEntities = this.entities.snapshot();
    const beforeEnvironment = this.paletteRuntime.snapshot().environment;

    this.paletteRuntime.reset();
    this.entities.reset();
    this.lineage.reset();
    this.scheduler.replayTo(time, (event) => {
      this.applyEvent(event);
    });
    this.currentTime = time;

    const afterEntities = this.entities.snapshot();
    const afterEnvironment = this.paletteRuntime.snapshot().environment;
    const changed =
      !sameVisibleEntities(beforeEntities, afterEntities) ||
      !sameEnvironment(beforeEnvironment, afterEnvironment);

    if (changed) this.revisionValue += 1;
    return changed;
  }

  reset(): void {
    const hadEntities = this.entities.size > 0;
    const beforeEnvironment = this.paletteRuntime.snapshot().environment;

    this.paletteRuntime.reset();
    this.entities.reset();
    this.lineage.reset();
    this.scheduler.reset();
    this.currentTime = 0;

    const afterEnvironment = this.paletteRuntime.snapshot().environment;
    if (hadEntities || !sameEnvironment(beforeEnvironment, afterEnvironment)) {
      this.revisionValue += 1;
    }
  }

  snapshot(time = this.currentTime): WorldSnapshot {
    assertTime(time);
    if (Math.abs(time - this.currentTime) > 1e-9) {
      throw new Error("snapshot time must match the session time");
    }

    const paletteSnapshot = this.paletteRuntime.snapshot();
    return {
      version: "picture-score:world:v1",
      trackId: this.trackId,
      paletteId: this.palette.id,
      seed: this.seed,
      time,
      cursor: this.scheduler.cursor,
      entities: [...this.entities.snapshot()],
      environment: cloneEnvironment(paletteSnapshot.environment),
    };
  }

  inspect(entityId: string): EntityOrigin | undefined {
    return this.lineage.get(entityId);
  }

  private applyEvent(event: WorldEvent): boolean {
    const beforeEnvironment = this.paletteRuntime.snapshot().environment;
    const cues = this.paletteRuntime.apply(event);
    let changed = false;

    for (const cue of cues) {
      const entityChanged = this.applyCue(cue, event.time);
      changed = entityChanged || changed;
    }

    const afterEnvironment = this.paletteRuntime.snapshot().environment;
    return changed || !sameEnvironment(beforeEnvironment, afterEnvironment);
  }

  private applyCue(cue: PaletteCue, time: number): boolean {
    const changed = this.entities.apply(cue, time);
    if (cue.type === "spawn" && changed) {
      this.lineage.record(cue.id, originFromSpawnCue(cue));
    }
    return changed;
  }
}
