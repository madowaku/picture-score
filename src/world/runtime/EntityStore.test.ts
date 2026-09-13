import { describe, expect, it } from "vitest";
import type {
  PaletteReactCue,
  PaletteSpawnCue,
  ResolvedMotionProfile,
} from "../../palettes";
import { EntityStore } from "./EntityStore";
import { LineageStore } from "./LineageStore";

const motion: ResolvedMotionProfile = {
  idleMotion: "sway",
  amplitude: 0.2,
  speed: 0.4,
  birthMotion: "grow",
  responseStrength: 0.7,
  reducedMotion: "fade-only",
};

const spawn = (
  id: string,
  role: PaletteSpawnCue["role"] = "melody",
): PaletteSpawnCue => ({
  id,
  type: "spawn",
  paletteId: "clearing",
  worldEventId: `world:${id}`,
  sourceEventId: `music:${id}`,
  role,
  seed: id.length * 41,
  asset: {
    id: `asset:${role}`,
    src: `/art/${role}.webp`,
    format: "webp",
    weight: 1,
  },
  positionHint: { x: 0.25, y: 0.75 },
  scale: 1.1,
  rotation: -3,
  intensity: 0.8,
  motion,
});

const react = (overrides: Partial<PaletteReactCue> = {}): PaletteReactCue => ({
  id: "react:1",
  type: "react",
  paletteId: "clearing",
  worldEventId: "world:react:1",
  sourceEventId: "music:react:1",
  role: "melody",
  seed: 123,
  targetRole: "melody",
  amount: 0.6,
  direction: 0.25,
  duration: 1.5,
  motion,
  ...overrides,
});

describe("EntityStore", () => {
  it("creates one entity and keeps duplicate spawn idempotent", () => {
    const store = new EntityStore(4);
    const cue = spawn("spawn:one");

    expect(store.apply(cue, 1.25)).toBe(true);
    expect(store.apply(cue, 1.25)).toBe(false);
    expect(store.size).toBe(1);

    const entity = store.get(cue.id)!;
    expect(entity.id).toBe(cue.id);
    expect(entity.createdAt).toBe(1.25);
    expect(entity.assetId).toBe(cue.asset.id);
    expect(entity.assetSrc).toBe(cue.asset.src);
    expect(entity.origin).toEqual({
      musicalEventId: cue.sourceEventId,
      worldEventId: cue.worldEventId,
      paletteCueId: cue.id,
    });
  });

  it("targeted reaction changes only its target", () => {
    const store = new EntityStore(4);
    const a = spawn("spawn:a");
    const b = spawn("spawn:b");
    store.apply(a, 0);
    store.apply(b, 0.1);

    expect(store.apply(react({ targetCueId: a.id }), 0.2)).toBe(true);
    expect(store.get(a.id)?.reaction).toMatchObject({ amount: 0.6, revision: 1 });
    expect(store.get(b.id)?.reaction).toMatchObject({ amount: 0, revision: 0 });
  });

  it("role-wide reaction updates every existing target role and no other role", () => {
    const store = new EntityStore(5);
    const melodyA = spawn("spawn:melody-a", "melody");
    const melodyB = spawn("spawn:melody-b", "melody");
    const harmony = spawn("spawn:harmony", "harmony");
    store.apply(melodyA, 0);
    store.apply(melodyB, 0.1);
    store.apply(harmony, 0.2);

    expect(store.apply(react({ targetCueId: undefined, targetRole: "melody" }), 0.3)).toBe(true);
    expect(store.get(melodyA.id)?.reaction.revision).toBe(1);
    expect(store.get(melodyB.id)?.reaction.revision).toBe(1);
    expect(store.get(harmony.id)?.reaction.revision).toBe(0);
  });

  it("enforces the defensive total limit", () => {
    const store = new EntityStore(2);
    expect(store.apply(spawn("spawn:a"), 0)).toBe(true);
    expect(store.apply(spawn("spawn:b"), 0.1)).toBe(true);
    expect(store.apply(spawn("spawn:c"), 0.2)).toBe(false);
    expect(store.size).toBe(2);
  });

  it("returns deterministic snapshots and defensive copies", () => {
    const store = new EntityStore(3);
    store.apply(spawn("spawn:z"), 2);
    store.apply(spawn("spawn:a"), 1);
    const snapshot = store.snapshot();

    expect(snapshot.map((entity) => entity.id)).toEqual(["spawn:a", "spawn:z"]);
    snapshot[0].reaction.amount = 99;
    expect(store.get("spawn:a")?.reaction.amount).toBe(0);
  });

  it("ignores environment cues and rejects invalid times", () => {
    const store = new EntityStore(2);
    expect(
      store.apply(
        {
          id: "environment:1",
          type: "environment",
          paletteId: "clearing",
          worldEventId: "world:section",
          sourceEventId: "music:section",
          role: "section",
          seed: 1,
          state: { energy: 0.5, brightness: 0.5, wind: 0.2, glow: 0.2, atmosphere: 0.5 },
        },
        0,
      ),
    ).toBe(false);
    expect(() => store.apply(spawn("spawn:x"), -1)).toThrow(/apply time/);
  });
});

describe("LineageStore", () => {
  it("records a full Musical -> World -> Cue chain and returns copies", () => {
    const store = new LineageStore();
    const origin = {
      musicalEventId: "music:1",
      worldEventId: "world:1",
      paletteCueId: "cue:1",
    };
    store.record("entity:1", origin);
    expect(store.get("entity:1")).toEqual(origin);

    const copy = store.get("entity:1")!;
    copy.worldEventId = "mutated";
    expect(store.get("entity:1")?.worldEventId).toBe("world:1");
  });

  it("is idempotent for identical lineage and rejects conflicting lineage", () => {
    const store = new LineageStore();
    const origin = {
      musicalEventId: "music:1",
      worldEventId: "world:1",
      paletteCueId: "cue:1",
    };
    store.record("entity:1", origin);
    expect(() => store.record("entity:1", origin)).not.toThrow();
    expect(() =>
      store.record("entity:1", { ...origin, worldEventId: "world:other" }),
    ).toThrow(/conflicting lineage/);
  });

  it("resets and snapshots in stable entity-id order", () => {
    const store = new LineageStore();
    store.record("entity:z", {
      musicalEventId: "music:z",
      worldEventId: "world:z",
      paletteCueId: "cue:z",
    });
    store.record("entity:a", {
      musicalEventId: "music:a",
      worldEventId: "world:a",
      paletteCueId: "cue:a",
    });

    expect(Object.keys(store.snapshot())).toEqual(["entity:a", "entity:z"]);
    store.reset();
    expect(store.get("entity:a")).toBeUndefined();
    expect(store.snapshot()).toEqual({});
  });
});
