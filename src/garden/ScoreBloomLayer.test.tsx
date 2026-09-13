import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { canonicalMusicalTimelineFixture } from "../music/ir/fixtures";
import { clearingPalette } from "../palettes";
import { ScoreBloomSession } from "../world/runtime";
import { ScoreBloomLayer } from "./ScoreBloomLayer";
import type { GardenLayout } from "./clearing";

const layout: GardenLayout = {
  width: 1000,
  height: 600,
  artworkWidth: 120,
  artworkHeight: 100,
};

const snapshot = () => {
  const session = new ScoreBloomSession({
    trackId: "layer-fixture",
    seed: "layer-seed",
    timeline: canonicalMusicalTimelineFixture,
    palette: clearingPalette,
    reducedMotion: false,
  });
  session.advanceTo(2);
  return session.snapshot();
};

describe("ScoreBloomLayer", () => {
  it("renders official Clearing assets and lineage metadata from a WorldSnapshot", () => {
    const world = snapshot();
    const html = renderToStaticMarkup(
      <ScoreBloomLayer
        snapshot={world}
        palette={clearingPalette}
        clearings={[]}
        layout={layout}
      />,
    );

    expect(html).toContain('data-testid="score-bloom-layer"');
    expect(html).toContain('data-score-bloom-palette="clearing"');
    expect(html).toContain('data-score-bloom-world-event=');
    expect(html).toContain('data-score-bloom-source-event=');
    expect(html).toContain('/art/clearing-');
    expect(html).toContain('mask="url(#');
  });

  it("renders only the requested debug selection ring", () => {
    const world = snapshot();
    const selected = world.entities[0];
    expect(selected).toBeDefined();

    const html = renderToStaticMarkup(
      <ScoreBloomLayer
        snapshot={world}
        palette={clearingPalette}
        clearings={[]}
        layout={layout}
        debugEntityId={selected!.id}
      />,
    );

    expect(html).toContain('data-score-bloom-debug="selected"');
    expect((html.match(/score-bloom-debug-ring/g) ?? []).length).toBe(1);
  });

  it("suppresses semantic pigment when a clearing covers every safe candidate", () => {
    const world = snapshot();
    const html = renderToStaticMarkup(
      <ScoreBloomLayer
        snapshot={world}
        palette={clearingPalette}
        clearings={[{ id: "source-art", x: 500, y: 500, rx: 2000, ry: 2000 }]}
        layout={layout}
      />,
    );

    expect(html).toContain('data-score-bloom-entities="0"');
    expect(html).not.toContain('data-score-bloom-entity=');
  });
});
