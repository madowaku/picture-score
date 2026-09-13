import { useEffect, useMemo, useRef, useState } from "react";
import { clearingPalette } from "../palettes";
import { ScoreBloomSession } from "../world/runtime";
import type { ScoreBloomFrame } from "../world/runtime";
import type { Clearing, GardenLayout } from "./clearing";
import type { GardenState } from "./gardenState";
import { gardenScoreBloomIdentity, gardenScoreBloomSource } from "./gardenScoreBloom";
import type { GardenTransport } from "./gardenTransport";
import { ScoreBloomLayer } from "./ScoreBloomLayer";

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

export function GardenScoreBloomBridge({
  active,
  playing,
  garden,
  transport,
  clearings,
  layout,
  debugEntityId,
}: {
  active: boolean;
  playing: boolean;
  garden: GardenState;
  transport: GardenTransport;
  clearings: readonly Clearing[];
  layout: GardenLayout;
  debugEntityId?: string;
}) {
  const semanticIdentity = garden.objects.length ? gardenScoreBloomIdentity(garden) : "garden:empty";
  const source = useMemo(() => gardenScoreBloomSource(garden), [semanticIdentity]);
  const sessionRef = useRef<ScoreBloomSession | null>(null);
  const [frame, setFrame] = useState<ScoreBloomFrame | null>(null);
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
    if (!source) {
      sessionRef.current = null;
      setFrame(null);
      return;
    }
    const session = new ScoreBloomSession({
      trackId: source.trackId,
      seed: source.seed,
      timeline: source.timeline,
      palette: clearingPalette,
      reducedMotion,
    });
    const targetTime = transport.running ? transport.time : 0;
    session.seek(targetTime);
    sessionRef.current = session;
    setFrame(frameOf(session));
  }, [semanticIdentity, reducedMotion, transport]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session || playing || transport.running) return;
    session.seek(0);
    setFrame(frameOf(session));
  }, [playing, semanticIdentity, transport]);

  useEffect(() => {
    if (!active || !playing) return;
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
  }, [active, playing, semanticIdentity, reducedMotion, transport]);

  if (!frame || !source) return null;
  return <ScoreBloomLayer
    snapshot={frame.snapshot}
    palette={clearingPalette}
    clearings={clearings}
    layout={layout}
    debugEntityId={debugEntityId}
  />;
}
