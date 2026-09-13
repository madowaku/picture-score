import { describe, expect, it } from "vitest";
import { canonicalMusicalTimelineFixture } from "../../music/ir/fixtures";
import { clearingPalette } from "../../palettes";
import { ScoreBloomSession } from "./ScoreBloomSession";

const createSession = (seed: string | number = "score-bloom-test") =>
  new ScoreBloomSession({
    trackId: "fixture-track",
    seed,
    timeline: structuredClone(canonicalMusicalTimelineFixture),
    palette: clearingPalette,
    reducedMotion: false,
  });

describe("ScoreBloomSession", () => {
  it("is deterministic for the same timeline, seed, palette and target time", () => {
    const first = createSession();
    const second = createSession();

    first.advanceTo(3);
    second.advanceTo(3);

    expect(second.snapshot()).toEqual(first.snapshot());
    expect(second.cursor).toBe(first.cursor);
    expect(second.totalEvents).toBe(first.totalEvents);
  });

  it("changes deterministic visual identity when the track seed changes", () => {
    const first = createSession("seed-a");
    const second = createSession("seed-b");

    first.advanceTo(3);
    second.advanceTo(3);

    const firstEntities = first.snapshot().entities;
    const secondEntities = second.snapshot().entities;
    expect(secondEntities.map((entity) => entity.id)).toEqual(
      firstEntities.map((entity) => entity.id),
    );
    expect(secondEntities.map((entity) => entity.seed)).not.toEqual(
      firstEntities.map((entity) => entity.seed),
    );
  });

  it("does not revise or double-fire when advancing to the same time twice", () => {
    const session = createSession();

    expect(session.advanceTo(1)).toBe(true);
    const first = session.snapshot();
    const revision = session.revision;

    expect(session.advanceTo(1)).toBe(false);
    expect(session.revision).toBe(revision);
    expect(session.snapshot()).toEqual(first);
  });

  it("makes forward playback and fresh deterministic seek converge on the same world", () => {
    const played = createSession();
    const sought = createSession();

    played.advanceTo(1);
    played.advanceTo(1.5);
    played.advanceTo(3);
    sought.seek(3);

    expect(sought.snapshot()).toEqual(played.snapshot());
  });

  it("reconstructs the original target after seeking backward and forward again", () => {
    const session = createSession();
    session.advanceTo(3);
    const original = session.snapshot();

    expect(session.seek(0.5)).toBe(true);
    expect(session.snapshot().entities).toHaveLength(0);
    expect(session.seek(3)).toBe(true);
    expect(session.snapshot()).toEqual(original);
  });

  it("resets entities, lineage, cursor, time and environment without changing identity", () => {
    const session = createSession();
    session.advanceTo(3);
    const entityId = session.snapshot().entities[0]?.id;
    expect(entityId).toBeTruthy();
    expect(entityId && session.inspect(entityId)).toBeDefined();

    session.reset();
    const snapshot = session.snapshot();
    expect(snapshot.trackId).toBe("fixture-track");
    expect(snapshot.paletteId).toBe("clearing");
    expect(snapshot.seed).toBe("score-bloom-test");
    expect(snapshot.time).toBe(0);
    expect(snapshot.cursor).toBe(0);
    expect(snapshot.entities).toEqual([]);
    expect(snapshot.environment).toEqual(clearingPalette.environment.initial);
    expect(entityId && session.inspect(entityId)).toBeUndefined();
  });

  it("exposes complete entity lineage from MusicalEvent through WorldEvent and PaletteCue", () => {
    const session = createSession();
    session.advanceTo(3);

    for (const entity of session.snapshot().entities) {
      expect(session.inspect(entity.id)).toEqual(entity.origin);
      expect(entity.origin.musicalEventId).toBeTruthy();
      expect(entity.origin.worldEventId).toMatch(/^world:/);
      expect(entity.origin.paletteCueId).toBe(entity.id);
    }
  });

  it("advances zero-time context without inventing a visible revision", () => {
    const session = createSession();

    expect(session.advanceTo(0)).toBe(false);
    expect(session.cursor).toBe(1);
    expect(session.revision).toBe(0);
    expect(session.snapshot().entities).toEqual([]);
  });

  it("requires seek for backward time and refuses mislabeled snapshots", () => {
    const session = createSession();
    session.advanceTo(2);

    expect(() => session.advanceTo(1)).toThrow(/use seek/);
    expect(() => session.snapshot(1)).toThrow(/session time/);
    expect(() => session.seek(Number.NaN)).toThrow(/finite non-negative/);
  });
});
