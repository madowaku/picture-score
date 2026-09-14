import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ScoreBloomLayer } from "../garden/ScoreBloomLayer";
import type { Clearing, GardenLayout } from "../garden/clearing";
import { clearingPalette, prismProofPalette } from "../palettes";
import type { PaletteDefinition, PaletteRole } from "../palettes";
import { ScoreBloomSession } from "../world/runtime";
import type { WorldSnapshot } from "../world/runtime";
import { coreMeaningFixtures } from "./coreMeaningFixtures";
import "./creatorPaletteProof.css";

const clearings: Clearing[] = [
  { id: "creator-proof-source", x: 500, y: 510, rx: 150, ry: 132 },
];

const roles: PaletteRole[] = ["melody", "harmony", "rhythm", "ornament", "resonance"];
const initialLayout: GardenLayout = { width: 520, height: 420, artworkWidth: 120, artworkHeight: 96 };

const roleCounts = (snapshot: WorldSnapshot): Record<PaletteRole, number> => {
  const result = Object.fromEntries(roles.map(role => [role, 0])) as Record<PaletteRole, number>;
  for (const entity of snapshot.entities) result[entity.role] += 1;
  return result;
};

const lineageSignature = (snapshot: WorldSnapshot) => snapshot.entities
  .map(entity => `${entity.origin.musicalEventId}|${entity.origin.worldEventId}|${entity.role}`)
  .sort();

interface WorldPanelProps {
  label: string;
  palette: PaletteDefinition;
  snapshot: WorldSnapshot;
}

function WorldPanel({ label, palette, snapshot }: WorldPanelProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const [layout, setLayout] = useState<GardenLayout>(initialLayout);
  const counts = roleCounts(snapshot);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const publish = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      setLayout(previous => Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5
        ? previous
        : { ...previous, width, height });
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  return <article
    className="creator-palette-proof-world"
    data-proof-world
    data-proof-palette={palette.id}
    data-proof-role-counts={JSON.stringify(counts)}
    data-proof-world-events={JSON.stringify(snapshot.entities.map(entity => entity.origin.worldEventId))}
    data-proof-musical-events={JSON.stringify(snapshot.entities.map(entity => entity.origin.musicalEventId))}
  >
    <header>
      <span>{label}</span>
      <strong>{palette.displayName}</strong>
      <small>{snapshot.entities.length} semantic entities</small>
    </header>
    <section ref={stageRef} className="creator-palette-proof-stage" data-proof-stage>
      <ScoreBloomLayer snapshot={snapshot} palette={palette} clearings={clearings} layout={layout} />
      <svg className="creator-palette-proof-source" viewBox="0 0 1000 1000" aria-hidden="true">
        <g transform="translate(500 510)" fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -84 28 C -42 -72, 25 -92, 82 -24 C 50 -8, 22 15, 6 66" />
          <path d="M -68 48 C -24 16, 22 12, 70 42" opacity="0.68" />
          <circle cx="-18" cy="-18" r="5" fill="currentColor" stroke="none" />
        </g>
      </svg>
    </section>
  </article>;
}

export function CreatorPaletteProofView() {
  const [fixtureIndex, setFixtureIndex] = useState(2);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);
  const fixture = coreMeaningFixtures[fixtureIndex];

  const sessions = useMemo(() => ({
    clearing: new ScoreBloomSession({
      trackId: `creator-proof:${fixture.id}`,
      seed: `creator-proof:${fixture.id}`,
      timeline: structuredClone(fixture.timeline),
      palette: clearingPalette,
      reducedMotion,
    }),
    prism: new ScoreBloomSession({
      trackId: `creator-proof:${fixture.id}`,
      seed: `creator-proof:${fixture.id}`,
      timeline: structuredClone(fixture.timeline),
      palette: prismProofPalette,
      reducedMotion,
    }),
  }), [fixture, reducedMotion]);

  const [time, setTime] = useState(0);
  const [snapshots, setSnapshots] = useState(() => ({
    clearing: sessions.clearing.snapshot(),
    prism: sessions.prism.snapshot(),
  }));

  const publish = (nextTime: number) => {
    setTime(nextTime);
    setSnapshots({
      clearing: sessions.clearing.snapshot(),
      prism: sessions.prism.snapshot(),
    });
  };

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setSnapshots({
      clearing: sessions.clearing.snapshot(),
      prism: sessions.prism.snapshot(),
    });
  }, [sessions]);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    const startTime = sessions.clearing.time;
    let frame = 0;
    let lastPublished = startTime - 1;

    const tick = (now: number) => {
      const nextTime = Math.min(fixture.timeline.duration, startTime + (now - startedAt) / 1000);
      sessions.clearing.advanceTo(nextTime);
      sessions.prism.advanceTo(nextTime);
      if (nextTime - lastPublished >= 1 / 12 || nextTime >= fixture.timeline.duration) {
        publish(nextTime);
        lastPublished = nextTime;
      }
      if (nextTime >= fixture.timeline.duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fixture.timeline.duration, playing, sessions]);

  const seekTo = (nextTime: number) => {
    setPlaying(false);
    sessions.clearing.seek(nextTime);
    sessions.prism.seek(nextTime);
    publish(nextTime);
  };

  const seek = (event: ChangeEvent<HTMLInputElement>) => seekTo(Number(event.currentTarget.value));

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (sessions.clearing.time >= fixture.timeline.duration) seekTo(0);
    setPlaying(true);
  };

  const lineageMatch = JSON.stringify(lineageSignature(snapshots.clearing)) === JSON.stringify(lineageSignature(snapshots.prism));

  return <main
    className="creator-palette-proof"
    data-proof-fixture={fixture.id}
    data-proof-time={time.toFixed(3)}
    data-proof-lineage-match={lineageMatch ? "true" : "false"}
  >
    <header className="creator-palette-proof-header">
      <div>
        <p>PICTURE SCORE • CREATOR PALETTE PROOF</p>
        <h1>Same semantic music. Different world.</h1>
        <span>Nothing upstream changes. Only the PaletteDefinition changes.</span>
      </div>
      <label>
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={event => setReducedMotion(event.currentTarget.checked)}
          aria-label="Creator proof reduced motion"
        />
        Reduced motion
      </label>
    </header>

    <nav className="creator-palette-proof-scenes" aria-label="Creator proof fixtures">
      {coreMeaningFixtures.map((item, index) => <button
        key={item.id}
        type="button"
        className={index === fixtureIndex ? "is-active" : ""}
        data-proof-fixture-id={item.id}
        onClick={() => setFixtureIndex(index)}
      >
        {item.blindLabel} <small>{item.title}</small>
      </button>)}
    </nav>

    <section className="creator-palette-proof-grid">
      <WorldPanel label="OFFICIAL PALETTE" palette={clearingPalette} snapshot={snapshots.clearing} />
      <WorldPanel label="CREATOR PROOF" palette={prismProofPalette} snapshot={snapshots.prism} />
    </section>

    <section className="creator-palette-proof-transport" aria-label="Creator Palette proof transport">
      <button type="button" onClick={togglePlay}>{playing ? "Pause" : time >= fixture.timeline.duration ? "Replay" : "Play"}</button>
      <button type="button" onClick={() => seekTo(0)}>Restart</button>
      <input
        type="range"
        min="0"
        max={fixture.timeline.duration}
        step="0.05"
        value={time}
        onChange={seek}
        aria-label="Creator Palette proof time"
      />
      <output>{time.toFixed(1)} / {fixture.timeline.duration.toFixed(1)}s</output>
    </section>

    <footer className="creator-palette-proof-contract">
      <strong>{lineageMatch ? "✓ shared MusicalEvent → WorldEvent lineage" : "⚠ lineage mismatch"}</strong>
      <span>Clearing cursor {snapshots.clearing.cursor} · Prism cursor {snapshots.prism.cursor}</span>
      <span>Palette-specific differences begin only after WorldEvent mapping.</span>
    </footer>
  </main>;
}
