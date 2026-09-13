import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MusicalEvent } from "../music/ir";
import type { WorldSnapshot } from "../world/runtime";
import { ScoreBloomDebugInspector, selectedDebugEntity } from "./ScoreBloomDebugInspector";

const snapshot: WorldSnapshot = {
  version: "picture-score:world:v1",
  trackId: "track",
  paletteId: "clearing",
  seed: 7,
  time: 1.5,
  cursor: 4,
  environment: { energy: .4, brightness: .6, wind: .2, glow: .3, atmosphere: .5 },
  entities: [{
    id: "entity:one",
    role: "melody",
    assetId: "clearing-melody-sprout",
    assetSrc: "/art/clearing-sprout.webp",
    createdAt: 1,
    positionHint: { x: .5, y: .7 },
    scale: 1,
    rotation: 0,
    intensity: .8,
    seed: 3,
    origin: {
      musicalEventId: "music:one",
      worldEventId: "world:one:birth",
      paletteCueId: "palette:clearing:world:one:birth:spawn",
    },
    motion: {
      idleMotion: "sway",
      amplitude: .2,
      speed: .3,
      birthMotion: "grow",
      responseStrength: .7,
      reducedMotion: "fade-only",
    },
    reaction: { amount: 0, revision: 0 },
  }],
};

const musicalEvents: MusicalEvent[] = [{
  id: "music:one",
  type: "melody",
  time: 1,
  strength: .8,
  pitch: 64,
  normalizedPitch: .6,
  duration: .5,
  direction: "up",
}];

describe("ScoreBloomDebugInspector", () => {
  it("renders the complete semantic lineage for a rendered entity", () => {
    const html = renderToStaticMarkup(<ScoreBloomDebugInspector
      snapshot={snapshot}
      selectedEntityId="entity:one"
      onSelectEntity={() => undefined}
      inspect={() => snapshot.entities[0].origin}
      musicalEvents={musicalEvents}
      paused={false}
      phraseDuration={8}
      onTogglePause={() => undefined}
      onSeek={() => undefined}
      onRestart={() => undefined}
    />);

    expect(html).toContain("MusicalEvent");
    expect(html).toContain("music:one");
    expect(html).toContain("melody @ 1.00s");
    expect(html).toContain("WorldEvent");
    expect(html).toContain("world:one:birth");
    expect(html).toContain("PaletteCue");
    expect(html).toContain("Entity");
    expect(html).toContain("clearing-melody-sprout");
  });

  it("falls back to the first entity when the selected id no longer exists", () => {
    expect(selectedDebugEntity(snapshot.entities, "missing")?.id).toBe("entity:one");
  });
});
