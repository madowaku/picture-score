import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ScoreBloomLayer } from "../garden/ScoreBloomLayer";
import type { Clearing, GardenLayout } from "../garden/clearing";
import { clearingPalette } from "../palettes";
import type { PaletteRole } from "../palettes";
import { ScoreBloomSession } from "../world/runtime";
import type { WorldSnapshot } from "../world/runtime";
import { CoreMeaningQaAudio } from "./coreMeaningQaAudio";
import { coreMeaningFixtures } from "./coreMeaningFixtures";
import "./coreMeaningQa.css";

const layout: GardenLayout = {
  width: 1000,
  height: 620,
  artworkWidth: 120,
  artworkHeight: 96,
};

const clearings: Clearing[] = [
  { id: "qa-source-art", x: 500, y: 510, rx: 150, ry: 132 },
];

const roles: PaletteRole[] = ["melody", "harmony", "rhythm", "ornament", "resonance"];

const roleCounts = (snapshot: WorldSnapshot): Record<PaletteRole, number> => {
  const counts = Object.fromEntries(roles.map(role => [role, 0])) as Record<PaletteRole, number>;
  for (const entity of snapshot.entities) counts[entity.role] += 1;
  return counts;
};

export function CoreMeaningQaView() {
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<CoreMeaningQaAudio | null>(null);
  if (!audioRef.current) audioRef.current = new CoreMeaningQaAudio();
  const fixture = coreMeaningFixtures[fixtureIndex];

  const session = useMemo(() => {
    const next = new ScoreBloomSession({
      trackId: `core-meaning:${fixture.id}`,
      seed: `core-meaning:${fixture.id}`,
      timeline: structuredClone(fixture.timeline),
      palette: clearingPalette,
      reducedMotion,
    });
    next.seek(0);
    return next;
  }, [fixture, reducedMotion]);

  const [time, setTime] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldSnapshot>(() => session.snapshot());

  useEffect(() => () => audioRef.current?.dispose(), []);

  useEffect(() => {
    audioRef.current?.stop();
    setPlaying(false);
    setTime(0);
    setSnapshot(session.snapshot());
  }, [session]);

  useEffect(() => {
    if (!playing) return;

    const startedAt = performance.now();
    const startTime = session.time;
    let animationFrame = 0;
    let lastPublished = startTime - 1;

    const tick = (now: number) => {
      const nextTime = Math.min(
        fixture.timeline.duration,
        startTime + (now - startedAt) / 1000,
      );
      session.advanceTo(nextTime);

      if (nextTime - lastPublished >= 1 / 12 || nextTime >= fixture.timeline.duration) {
        setTime(nextTime);
        setSnapshot(session.snapshot());
        lastPublished = nextTime;
      }

      if (nextTime >= fixture.timeline.duration) {
        audioRef.current?.stop();
        setPlaying(false);
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [fixture.timeline.duration, playing, session]);

  const chooseFixture = (index: number) => {
    audioRef.current?.stop();
    setFixtureIndex(index);
    setRevealed(false);
  };

  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.currentTarget.value);
    audioRef.current?.stop();
    setPlaying(false);
    session.seek(nextTime);
    setTime(nextTime);
    setSnapshot(session.snapshot());
  };

  const restart = () => {
    audioRef.current?.stop();
    setPlaying(false);
    session.seek(0);
    setTime(0);
    setSnapshot(session.snapshot());
  };

  const togglePlay = () => {
    if (playing) {
      audioRef.current?.stop();
      setPlaying(false);
      return;
    }

    let startTime = session.time;
    if (startTime >= fixture.timeline.duration) {
      session.seek(0);
      startTime = 0;
      setTime(0);
      setSnapshot(session.snapshot());
    }

    void audioRef.current?.play(fixture.timeline, startTime).catch(() => undefined);
    setPlaying(true);
  };

  const counts = roleCounts(snapshot);

  return <main
    className="core-meaning-qa"
    data-qa-fixture={fixture.id}
    data-qa-entities={snapshot.entities.length}
    data-qa-role-counts={JSON.stringify(counts)}
  >
    <header className="core-meaning-qa-header">
      <div>
        <p className="core-meaning-qa-kicker">PICTURE SCORE • CORE MEANING QA</p>
        <h1>Can you hear what the world means?</h1>
        <p>Listen and watch first. Reveal the intended meaning only after you have made a guess.</p>
      </div>
      <label className="core-meaning-qa-reduced">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={event => setReducedMotion(event.currentTarget.checked)}
          aria-label="Reduced motion"
        />
        Reduced motion
      </label>
    </header>

    <nav className="core-meaning-qa-scenes" aria-label="Blind review scenes">
      {coreMeaningFixtures.map((item, index) => <button
        key={item.id}
        type="button"
        className={index === fixtureIndex ? "is-active" : ""}
        onClick={() => chooseFixture(index)}
        data-qa-fixture-id={item.id}
        aria-label={`Scene ${item.blindLabel}`}
      >
        {item.blindLabel}
      </button>)}
    </nav>

    <section className="core-meaning-qa-stage" aria-label={`Scene ${fixture.blindLabel} visual world`}>
      <ScoreBloomLayer
        snapshot={snapshot}
        palette={clearingPalette}
        clearings={clearings}
        layout={layout}
      />
      <svg className="core-meaning-qa-source" viewBox="0 0 1000 1000" aria-hidden="true">
        <g transform="translate(500 510)" fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -84 28 C -42 -72, 25 -92, 82 -24 C 50 -8, 22 15, 6 66" />
          <path d="M -68 48 C -24 16, 22 12, 70 42" opacity="0.68" />
          <circle cx="-18" cy="-18" r="5" fill="currentColor" stroke="none" />
        </g>
      </svg>
      <div className="core-meaning-qa-scene-label" aria-hidden="true">{fixture.blindLabel}</div>
    </section>

    <section className="core-meaning-qa-transport" aria-label="Core Meaning QA transport">
      <div className="core-meaning-qa-buttons">
        <button type="button" onClick={togglePlay}>
          {playing ? "Pause" : time >= fixture.timeline.duration ? "Replay" : "Play"}
        </button>
        <button type="button" onClick={restart}>Restart</button>
      </div>
      <input
        type="range"
        min="0"
        max={fixture.timeline.duration}
        step="0.05"
        value={time}
        onChange={seek}
        aria-label="Core Meaning QA time"
      />
      <output>{time.toFixed(1)} / {fixture.timeline.duration.toFixed(1)}s</output>
    </section>

    <section className="core-meaning-qa-answer">
      <button type="button" onClick={() => setRevealed(value => !value)} aria-expanded={revealed}>
        {revealed ? "Hide answer" : "Reveal answer"}
      </button>
      {revealed ? <div data-qa-answer>
        <strong>{fixture.title}</strong>
        <span>{fixture.description}</span>
        <small>Primary role: {fixture.expectedPrimaryRole ?? "mixed / all roles"}</small>
      </div> : <p>Before revealing: name the visual that feels like melody, harmony, beat, ornament, and resonance.</p>}
    </section>
  </main>;
}
