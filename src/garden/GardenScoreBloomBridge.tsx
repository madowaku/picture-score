import { useEffect, useMemo, useRef, useState } from "react";
import { compileCreatorPalette } from "../creator/palette";
import { creatorPaletteRepository, materializeCreatorPalette } from "../creator/persistence";
import { clearingPalette } from "../palettes";
import type { PaletteDefinition } from "../palettes";
import { ScoreBloomSession } from "../world/runtime";
import type { ScoreBloomFrame } from "../world/runtime";
import type { Clearing, GardenLayout } from "./clearing";
import type { GardenState } from "./gardenState";
import { gardenScoreBloomIdentity, gardenScoreBloomSource } from "./gardenScoreBloom";
import type { GardenTransport } from "./gardenTransport";
import { ScoreBloomDebugInspector, selectedDebugEntity } from "./ScoreBloomDebugInspector";
import { ScoreBloomLayer } from "./ScoreBloomLayer";
import "./scoreBloomPalette.css";

const SELECTED_PALETTE_KEY = "picture-score:creator-palette:selected:v1";

interface LoadedCreatorPalette {
  id: string;
  name: string;
  palette: PaletteDefinition;
}

const frameOf = (session: ScoreBloomSession): ScoreBloomFrame => ({
  revision: session.revision,
  snapshot: session.snapshot(),
});

/** Advance normally; a rewind always publishes one reconstructed frame. */
export function advanceGardenScoreBloom(
  session: ScoreBloomSession,
  time: number,
): ScoreBloomFrame | null {
  if (time + 1e-9 < session.time) {
    session.seek(time);
    return frameOf(session);
  }
  return session.advanceTo(time) ? frameOf(session) : null;
}

/** One synchronization path for every explicit Garden seek, including paused seeks. */
export function seekGardenScoreBloom(
  session: ScoreBloomSession,
  transport: Pick<GardenTransport, "seek" | "time">,
  time: number,
): ScoreBloomFrame {
  transport.seek(time);
  session.seek(transport.time);
  return frameOf(session);
}

const localDebugAvailable = (): boolean =>
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const initialSelectedPalette = (): string => {
  try { return localStorage.getItem(SELECTED_PALETTE_KEY) || "clearing"; }
  catch { return "clearing"; }
};

export function GardenScoreBloomBridge({
  active,
  playing,
  garden,
  transport,
  clearings,
  layout,
  palette,
}: {
  active: boolean;
  playing: boolean;
  garden: GardenState;
  transport: GardenTransport;
  clearings: readonly Clearing[];
  layout: GardenLayout;
  palette?: PaletteDefinition;
}) {
  const semanticIdentity = garden.objects.length ? gardenScoreBloomIdentity(garden) : "garden:empty";
  const source = useMemo(() => gardenScoreBloomSource(garden), [semanticIdentity]);
  const sessionRef = useRef<ScoreBloomSession | null>(null);
  const [frame, setFrame] = useState<ScoreBloomFrame | null>(null);
  const [clockRevision, setClockRevision] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugEntityId, setDebugEntityId] = useState<string | null>(null);
  const [creatorPalettes, setCreatorPalettes] = useState<LoadedCreatorPalette[]>([]);
  const [selectedPaletteId, setSelectedPaletteId] = useState(initialSelectedPalette);
  const libraryObjectUrls = useRef<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    if (palette || !active) return;
    let cancelled = false;
    const repository = creatorPaletteRepository();

    void (async () => {
      const next: LoadedCreatorPalette[] = [];
      const nextUrls: string[] = [];
      try {
        const summaries = await repository.list();
        for (const summary of summaries) {
          try {
            const document = await repository.load(summary.id);
            if (!document) continue;
            const materialized = materializeCreatorPalette(document);
            const result = compileCreatorPalette(materialized.draft);
            if (!result.ok) {
              Object.values(materialized.objectUrls).forEach(url => URL.revokeObjectURL(url));
              continue;
            }
            nextUrls.push(...Object.values(materialized.objectUrls));
            next.push({ id: summary.id, name: summary.name, palette: result.palette });
          } catch {
            // One damaged custom palette must never take Clearing or the Garden down.
          }
        }
      } catch {
        // IndexedDB can be disabled or unavailable; Clearing remains the product fallback.
      }

      if (cancelled) {
        nextUrls.forEach(url => URL.revokeObjectURL(url));
        return;
      }
      libraryObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
      libraryObjectUrls.current = nextUrls;
      setCreatorPalettes(next);
      setSelectedPaletteId(current =>
        current === "clearing" || next.some(item => item.id === current) ? current : "clearing",
      );
    })();

    return () => { cancelled = true; };
  }, [active, palette]);

  useEffect(() => () => {
    libraryObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
    libraryObjectUrls.current = [];
  }, []);

  const selectedCreator = creatorPalettes.find(item => item.id === selectedPaletteId);
  const activePalette = palette ?? selectedCreator?.palette ?? clearingPalette;

  useEffect(() => {
    if (!source) {
      sessionRef.current = null;
      setFrame(null);
      setDebugEntityId(null);
      return;
    }
    const session = new ScoreBloomSession({
      trackId: source.trackId,
      seed: source.seed,
      timeline: source.timeline,
      palette: activePalette,
      reducedMotion,
    });
    const targetTime = transport.running ? transport.time : 0;
    session.seek(targetTime);
    sessionRef.current = session;
    setFrame(frameOf(session));
    setDebugEntityId(null);
  }, [semanticIdentity, reducedMotion, transport, activePalette]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session || playing || transport.running) return;
    session.seek(0);
    setFrame(frameOf(session));
    setDebugEntityId(null);
  }, [playing, semanticIdentity, transport, activePalette]);

  useEffect(() => {
    if (!active || !playing || transport.paused) return;
    let raf = 0;
    const tick = () => {
      const session = sessionRef.current;
      if (!session || !transport.running || transport.paused) return;
      const next = advanceGardenScoreBloom(session, transport.time);
      if (next) setFrame(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, playing, semanticIdentity, reducedMotion, transport, clockRevision, activePalette]);

  const choosePalette = (id: string) => {
    setSelectedPaletteId(id);
    try { localStorage.setItem(SELECTED_PALETTE_KEY, id); }
    catch { /* preference is optional; palette assets stay in IndexedDB */ }
  };

  async function togglePause() {
    if (!transport.running) return;
    if (transport.paused) await transport.resume();
    else await transport.pause();
    setClockRevision(value => value + 1);
  }

  function explicitSeek(time: number) {
    const session = sessionRef.current;
    if (!session || !transport.running) return;
    setFrame(seekGardenScoreBloom(session, transport, time));
    setClockRevision(value => value + 1);
  }

  if (!frame || !source) return null;
  const debugEntity = selectedDebugEntity(frame.snapshot.entities, debugEntityId);
  const debugAvailable = localDebugAvailable();

  return <>
    {!palette && <label
      className="score-bloom-palette-picker"
      onPointerDown={event => event.stopPropagation()}
    >
      <span>WORLD</span>
      <select
        aria-label="SCORE BLOOM palette"
        value={selectedCreator ? selectedPaletteId : "clearing"}
        onChange={event => choosePalette(event.currentTarget.value)}
      >
        <option value="clearing">Clearing</option>
        {creatorPalettes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>}
    <ScoreBloomLayer
      snapshot={frame.snapshot}
      palette={activePalette}
      clearings={clearings}
      layout={layout}
      debugEntityId={debugOpen ? debugEntity?.id : undefined}
    />
    {debugAvailable && <button type="button" className="score-bloom-debug-toggle"
      aria-pressed={debugOpen} onPointerDown={event => event.stopPropagation()}
      onClick={() => setDebugOpen(value => !value)}>IR</button>}
    {debugAvailable && debugOpen && <ScoreBloomDebugInspector
      snapshot={frame.snapshot}
      selectedEntityId={debugEntity?.id ?? null}
      onSelectEntity={setDebugEntityId}
      inspect={entityId => sessionRef.current?.inspect(entityId)}
      musicalEvents={source.timeline.events}
      paused={transport.paused}
      phraseDuration={source.timeline.duration}
      onTogglePause={() => { void togglePause().catch(() => undefined); }}
      onSeek={explicitSeek}
      onRestart={() => explicitSeek(0)}
    />}
  </>;
}
