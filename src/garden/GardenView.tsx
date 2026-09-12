import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent, CSSProperties } from "react";
import { Ear, Pencil, Play, Square, Sprout, X } from "lucide-react";
import type { Project, Stroke } from "../music/types";
import { clamp } from "../music/score";
import { GARDEN_KEY, loadGarden, makeObject, MAX_OBJECTS } from "./gardenState";
import type { MusicalObject, Position } from "./gardenState";
import { mixGarden } from "./gardenMixer";
import { GardenTransport } from "./gardenTransport";
import type { RelationKind } from "./ensemble";
import { GrowthLayer } from "./GrowthLayer";
import { GROWTH_KEY, GrowthAccumulator, growthStage, loadGrowth, pairKey, pruneGrowth } from "./growth";
import "./garden.css";
import { useLanguage } from "../i18n/LanguageContext";
import { AudioEngine } from "../music/audio";
import { tactileTick } from "../ui/feedback";

const roleNames = { melody: "うた", harmony: "和音", drone: "余韻", rhythm: "リズム", decoration: "きらめき" };
const relationCopy: Record<RelationKind, string> = {
  "call-response": "{a}と{b}が、交代で歌っている。",
  "support": "{a}が、{b}をそっと支えている。",
  "pulse-fill": "{a}が、{b}の合間にリズムを添えている。",
  "sparkle-fill": "{a}が、{b}の合間にきらめいている。",
  "shared-bed": "{a}と{b}が、ひとつの余韻をつくっている。",
};
const path = (s: Stroke) => s.points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ") + (s.points.length === 1 ? "l0.1,0" : "");
function Artwork({ object }: { object: MusicalObject }) {
  return <svg viewBox="-18 -18 1036 456" preserveAspectRatio="none" aria-hidden="true"
    style={{ width: "100%", height: "100%" }}>
    {object.strokeIR.map((s) => <path key={s.id} d={path(s)} fill="none" stroke="currentColor"
      strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}
export function GardenView({ active, seed, onSeedPlaced, onDraw }: {
  active: boolean; seed: Project | null; onSeedPlaced: () => void; onDraw: () => void;
}) {
  const { t } = useLanguage();
  const [loaded] = useState(loadGarden);
  const [garden, setGarden] = useState(loaded.state);
  const [loadedGrowth] = useState(() => loadGrowth(loaded.state));
  const [growth, setGrowth] = useState(loadedGrowth.state);
  const growthRef = useRef(growth);
  const growthDirty = useRef(false);
  const [growthError, setGrowthError] = useState(loadedGrowth.protected);
  const [moments, setMoments] = useState(new Set<string>());
  const [discovery, setDiscovery] = useState("");
  const growthAccumulator = useRef(new GrowthAccumulator());
  const stateRef = useRef(garden);
  const changed = useRef(false);
  const [error, setError] = useState(loaded.error);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [beat, setBeat] = useState(0);
  const [ghost, setGhost] = useState<Position>({ x: 0.5, y: 0.42 });
  const [selected, setSelected] = useState<string | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointer: number; target: string; offset: Position; start: Position; moved: boolean; startedAt: number } | null>(null);
  const transport = useRef(new GardenTransport());
  const audition = useRef(new AudioEngine());
  const births = useRef(new Map<string, number | null>());
  const [pressedObject, setPressedObject] = useState<string | null>(null);
  const [pulseObjects, setPulseObjects] = useState(new Set<string>());
  const [relationMoments, setRelationMoments] = useState(new Set<string>());
  const [listenerTrail, setListenerTrail] = useState<Position[]>([]);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [placePulse, setPlacePulse] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const relationMomentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const spotlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listenerTrailTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seenRelations = useRef(new Set<string>());
  const pending = useMemo(() => seed ? makeObject(seed, { x: 0.5, y: 0.42 }, "pending") : null, [seed]);
  const mix = mixGarden(garden, Math.floor(beat / 16));
  const selectedObject = garden.objects.find((o) => o.id === selected);
  const curiosity = garden.objects.length === 1
    ? "もうひとつ描いたら、近くに置いてみよう。どんな返事がする？"
    : "ふたつの絵を近づけたら、どんな会話になる？";
  const allRelations = playing && !pending
    ? transport.current.plan?.relations.filter((r) => r.strength > .08).sort((a, b) => b.strength - a.strength) ?? []
    : [];
  // Keep the field legible when nothing is selected, while still letting a chosen work reveal its nearby conversation.
  const relations = selected
    ? allRelations.filter((r) => r.a === selected || r.b === selected).slice(0, 4)
    : allRelations.filter((r) => r.strength >= .4).slice(0, 3);
  const leadRelation = relations[0];
  const relationNames = leadRelation ? [leadRelation.a, leadRelation.b].map((id) => garden.objects.find((o) => o.id === id)) : [];
  const growthMoments = useMemo(() => new Set([...moments, ...relationMoments]), [moments, relationMoments]);
  if ((leadRelation?.kind === "support" && relationNames[0]?.musicalRole === "melody") ||
    (leadRelation?.kind === "pulse-fill" && relationNames[0]?.musicalRole !== "rhythm") ||
    (leadRelation?.kind === "sparkle-fill" && relationNames[0]?.musicalRole !== "decoration")) relationNames.reverse();
  function change(next: typeof garden) {
    const pruned = pruneGrowth(growthRef.current, next);
    if (JSON.stringify(pruned) !== JSON.stringify(growthRef.current)) {
      growthRef.current = pruned; growthDirty.current = true; setGrowth(pruned);
    }
    for (const id of births.current.keys()) if (!next.objects.some((o) => o.id === id)) births.current.delete(id);
    changed.current = true; stateRef.current = next; setGarden(next); transport.current.update(next);
  }
  function pulse(ids: string[]) {
    setPulseObjects(new Set(ids));
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulseObjects(new Set()), 520);
  }
  function pingArtwork(id: string) {
    const object = stateRef.current.objects.find((candidate) => candidate.id === id);
    if (!object) return;
    setSelected(id); pulse([id]); tactileTick(5);
    if (transport.current.running) transport.current.ping(id);
    else void audition.current.answer(object.musicIR, object.project.instrument).catch(() => undefined);
  }
  function gardenUiTone(kind: "remove" | "press") {
    void audition.current.unlock().then(() => audition.current.uiTone(kind)).catch(() => undefined);
  }
  function activateSpotlight() {
    if (!selected) return;
    const target = selected;
    setSpotlightId(target);
    if (playing) { transport.current.spotlight(target, 4); transport.current.ping(target); }
    else pingArtwork(target);
    tactileTick(8);
    clearTimeout(spotlightTimer.current);
    spotlightTimer.current = setTimeout(() => setSpotlightId(null), (4 * 60 / stateRef.current.bpm + .25) * 1000);
  }
  function resetListening() {
    transport.current.stop(); audition.current.stop();
    setPlaying(false); setStarting(false); setSpotlightId(null); setRelationMoments(new Set());
    clearTimeout(spotlightTimer.current); clearTimeout(listenerTrailTimer.current);
    setListenerTrail([]); seenRelations.current.clear();
  }
  useEffect(() => {
    const engine = transport.current;
    let momentTimer: ReturnType<typeof setTimeout>;
    let discoveryTimer: ReturnType<typeof setTimeout>;
    const flush = () => {
      if (!growthDirty.current || loadedGrowth.protected || loaded.error) return;
      try {
        localStorage.setItem(GROWTH_KEY, JSON.stringify(growthRef.current));
        growthDirty.current = false; setGrowthError(false);
      } catch { setGrowthError(true); }
    };
    engine.onHeard = (slice) => {
      if (!slice) { growthAccumulator.current.reset(); flush(); return; }
      const previous = growthRef.current;
      const next = growthAccumulator.current.advance(previous, slice);
      if (JSON.stringify(previous) === JSON.stringify(next)) return;
      const arrivals = new Set<string>();
      for (const [id, beats] of Object.entries(next.objects)) {
        if (growthStage(beats) > growthStage(previous.objects[id] ?? 0)) arrivals.add(id);
      }
      for (const [key, relation] of Object.entries(next.relations)) {
        if (growthStage(relation.sharedBeats, true) > growthStage(previous.relations[key]?.sharedBeats ?? 0, true)) arrivals.add(key);
      }
      if (arrivals.size) {
        setMoments(arrivals); clearTimeout(momentTimer);
        momentTimer = setTimeout(() => setMoments(new Set()), 650);
      }
      let copy = "";
      if (!next.discoveries.object && Object.values(next.objects).some((n) => growthStage(n))) {
        next.discoveries = { ...next.discoveries, object: true };
        copy = "聴いた音は、庭に少しずつ残ります。";
      } else if (!next.discoveries.relation && Object.values(next.relations).some((r) => growthStage(r.sharedBeats, true))) {
        next.discoveries = { ...next.discoveries, relation: true };
        copy = "一緒に歌った場所に、道ができました。";
      }
      growthRef.current = next; growthDirty.current = true; setGrowth(next);
      if (copy) {
        setDiscovery(copy); clearTimeout(discoveryTimer);
        discoveryTimer = setTimeout(() => setDiscovery(""), 7000);
        flush();
      }
    };
    // Storage cadence only; musical growth itself comes exclusively from the transport.
    const saveTimer = setInterval(flush, 2000);
    window.addEventListener("pagehide", flush);
    return () => {
      flush(); engine.onHeard = undefined;
      clearInterval(saveTimer); clearTimeout(momentTimer); clearTimeout(discoveryTimer);
      window.removeEventListener("pagehide", flush);
    };
  }, [loadedGrowth.protected, loaded.error]);
  useEffect(() => {
    if (!changed.current) return;
    // Save on pointer release as well as discrete edits; source data never changes during a drag.
    const timer = setTimeout(() => {
      try { localStorage.setItem(GARDEN_KEY, JSON.stringify(garden)); setError(""); }
      catch { setError("庭を保存できません。空き容量を確認してください。この画面を閉じるまで作品は残ります。"); }
    }, 250);
    return () => clearTimeout(timer);
  }, [garden]);
  useEffect(() => {
    const flush = () => {
      if (!changed.current) return;
      try { localStorage.setItem(GARDEN_KEY, JSON.stringify(stateRef.current)); }
      catch { /* the on-screen save error is handled by the debounced writer */ }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);
  useEffect(() => {
    if (!active) resetListening();
  }, [active]);
  useEffect(() => {
    const engine = transport.current;
    const visibility = () => { if (document.hidden) resetListening(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { engine.stop(); audition.current.stop(); clearTimeout(pulseTimer.current); clearTimeout(relationMomentTimer.current); clearTimeout(spotlightTimer.current); clearTimeout(listenerTrailTimer.current); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      for (const [id, born] of births.current) {
        if (born === null && transport.current.isSounding(id)) births.current.set(id, performance.now());
        else if (born !== null && performance.now() - born > 850) births.current.delete(id);
      }
      const strong = transport.current.plan?.relations.filter((relation) => relation.strength >= .7) ?? [];
      const newRelations = strong.filter((relation) => {
        const key = pairKey(relation.a, relation.b);
        if (seenRelations.current.has(key)) return false;
        seenRelations.current.add(key); return true;
      });
      if (newRelations.length) {
        const keys = newRelations.map((relation) => pairKey(relation.a, relation.b));
        setRelationMoments((current) => new Set([...current, ...keys]));
        transport.current.ping(newRelations.flatMap((relation) => [relation.a, relation.b]));
        tactileTick(6);
        clearTimeout(relationMomentTimer.current);
        relationMomentTimer.current = setTimeout(() => setRelationMoments(new Set()), 900);
        pulse([...new Set(newRelations.flatMap((relation) => [relation.a, relation.b]))]);
      }
      setBeat(transport.current.beat);
    }, 80);
    return () => clearInterval(timer);
  }, [playing]);
  async function listen() {
    if (transport.current.running) return;
    setStarting(true);
    try { await transport.current.start(stateRef.current); setPlaying(transport.current.running); }
    catch { setError("音を開始できませんでした。「庭を聴く」をもう一度押してください。"); }
    finally { setStarting(false); }
  }
  function position(event: ReactPointerEvent): Position {
    const rect = field.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0.06, 0.94),
      y: clamp((event.clientY - rect.top) / rect.height, 0.08, 0.92) };
  }
  function moveTarget(target: string, p: Position) {
    const g = stateRef.current;
    if (target === "listener") {
      setListenerTrail((trail) => [...trail.slice(-5), p]);
      clearTimeout(listenerTrailTimer.current);
      listenerTrailTimer.current = setTimeout(() => setListenerTrail([]), 680);
      change({ ...g, listener: p });
    }
    else change({ ...g, objects: g.objects.map((o) => o.id === target ? { ...o, world: { ...o.world, ...p } } : o) });
  }
  function down(event: ReactPointerEvent) {
    if (gesture.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    const p = position(event);
    const target = pending ? "pending" : (event.target as Element).closest<HTMLElement>("[data-object]")?.dataset.object ?? "listener";
    const current = target === "listener" ? stateRef.current.listener : stateRef.current.objects.find((o) => o.id === target)?.world;
    const isHandle = (event.target as Element).closest("[data-object]");
    gesture.current = { pointer: event.pointerId, target,
      offset: current && isHandle ? { x: current.x - p.x, y: current.y - p.y } : { x: 0, y: 0 },
      start: p, moved: false, startedAt: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressedObject(target !== "listener" && target !== "pending" ? target : null);
    if (pending) setGhost(p);
    else { setSelected(target === "listener" ? null : target); if (!isHandle) moveTarget(target, p); }
  }
  function move(event: ReactPointerEvent) {
    if (pending && !gesture.current && event.pointerType === "mouse") setGhost(position(event));
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const p = position(event);
    if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > .012) drag.moved = true;
    const dest = { x: clamp(p.x + drag.offset.x, 0.06, 0.94), y: clamp(p.y + drag.offset.y, 0.08, 0.92) };
    if (drag.target === "pending") setGhost(dest); else moveTarget(drag.target, dest);
  }
  function place(p: Position) {
    if (!seed || stateRef.current.objects.length >= MAX_OBJECTS) return;
    const object = makeObject(seed, p);
    births.current.set(object.id, null);
    change({ ...stateRef.current, objects: [...stateRef.current.objects, object] });
    setSelected(object.id); pulse([object.id]); setPlacePulse(true); clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => { setPulseObjects(new Set()); setPlacePulse(false); }, 850);
    tactileTick(9); onSeedPlaced(); void listen();
  }
  function up(event: ReactPointerEvent, cancelled = false) {
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!cancelled) {
      if (drag.target === "pending") place(position(event));
      else move(event);
      if (drag.target !== "pending" && drag.target !== "listener" && !drag.moved && performance.now() - drag.startedAt < 420)
        pingArtwork(drag.target);
    }
    gesture.current = null;
    setPressedObject(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event: KeyboardEvent, target: string, p: Position) {
    if ((event.key === "Enter" || event.key === " ") && target !== "listener") {
      event.preventDefault(); event.stopPropagation(); pingArtwork(target); return;
    }
    const delta: Record<string, Position> = { ArrowLeft: { x: -0.035, y: 0 }, ArrowRight: { x: 0.035, y: 0 },
      ArrowUp: { x: 0, y: -0.035 }, ArrowDown: { x: 0, y: 0.035 } };
    if (!delta[event.key]) return;
    event.preventDefault(); event.stopPropagation();
    moveTarget(target, { x: clamp(p.x + delta[event.key].x, 0.06, 0.94), y: clamp(p.y + delta[event.key].y, 0.08, 0.92) });
  }
  return <section className="garden-view" hidden={!active} aria-label={t("Garden 音の庭")}>
    <div className="garden-intro"><div><p className="eyebrow"><Sprout size={14} /> PICTURE SCORE GARDEN · GROW</p>
      <h1>{t("Give your song ")}<em>{t("a place.")}</em></h1><p className="intro-copy">{t("絵を置いて、音のあいだを歩こう。")}</p></div>
      <span className="garden-count">{garden.objects.length} / {MAX_OBJECTS}<small>{t("sounds growing")}</small></span></div>
    <div className="garden-toolbar">
      <button className="garden-listen" disabled={!garden.objects.length || starting} onClick={() => {
        if (playing || starting) resetListening(); else void listen();
      }}>{playing ? <Square size={14} /> : <Play size={14} />}{starting ? t("準備中…") : playing ? t("音を休める") : t("庭を聴く")}</button>
      <label className="garden-tempo">BPM <select aria-label={t("庭のテンポ")} value={garden.bpm}
        onChange={(e) => change({ ...stateRef.current, bpm: Number(e.target.value) })}>
        {[72, 88, 104, 120, 140, ...([72, 88, 104, 120, 140].includes(garden.bpm) ? [] : [garden.bpm])].map((bpm) => <option key={bpm}>{bpm}</option>)}
      </select></label><span className="garden-key">{t("C pentatonic")}</span>
      <span className="garden-clock" aria-label={t("共通の拍")} data-beat={beat.toFixed(2)}>{[0, 1, 2, 3].map((n) =>
        <i key={n} className={playing && Math.floor(beat) % 4 === n ? "lit" : ""} />)}</span>
    </div>
    <div ref={field} className={`garden-field ${pending ? "placing" : ""} ${placePulse ? "place-pulse" : ""}`} data-testid="garden-field"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={(e) => up(e, true)}
      onLostPointerCapture={(e) => up(e, true)}>
      <svg className="garden-landscape" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-30 590C140 620 110 370 325 350S470 140 660 220 740 480 1040 345" />
        <ellipse cx="805" cy="123" rx="84" ry="30" /><ellipse cx="155" cy="490" rx="65" ry="23" />
      </svg>
      <GrowthLayer garden={garden} growth={growth} moments={growthMoments} />
      <svg className="ensemble-links" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        {relations.map((relation) => {
          const a = garden.objects.find((o) => o.id === relation.a)?.world;
          const b = garden.objects.find((o) => o.id === relation.b)?.world;
          const key = pairKey(relation.a, relation.b);
          return a && b ? <path key={relation.a + ":" + relation.b} className={relationMoments.has(key) ? "relation-moment" : ""} data-relation={relation.kind}
            data-strength={relation.strength.toFixed(3)}
            d={`M${a.x * 1000},${a.y * 1000} Q${(a.x + b.x) * 500},${(a.y + b.y) * 500 - 45} ${b.x * 1000},${b.y * 1000}`}
            style={{ opacity: .2 + relation.strength * .38 }} /> : null;
        })}
      </svg>
      <span className="garden-landmark north">{t("THE QUIET CORNER")}</span><span className="garden-landmark south">{t("ROOM FOR ANOTHER SONG")}</span>
      {!garden.objects.length && !pending && <div className="garden-empty"><Sprout size={30} /><p>{t("まだ静かな、小さな庭。")}</p><span>{t("ひと筆描いて、最初の音を植えてみよう。")}</span>
        <button className="garden-empty-start" onPointerDown={(event) => event.stopPropagation()} onClick={onDraw}><Pencil size={15} />{t("最初の音を描く")}</button></div>}
      {garden.objects.map((object) => {
        const audible = playing && transport.current.isSounding(object.id);
        const nearby = (mix.get(object.id) ?? 0) > .015;
        const born = births.current.get(object.id);
        const bloom = playing && born != null && performance.now() - born < 850;
        const breath = audible ? 1 + .025 * (.5 + .5 * Math.cos(beat * Math.PI * 2)) : 1;
        const crowded = garden.objects.some((other) => other.id !== object.id &&
          Math.hypot(other.world.x - object.world.x, other.world.y - object.world.y) < .17);
        return <button key={object.id} data-object={object.id} data-gain={(mix.get(object.id) ?? 0).toFixed(3)}
          data-arrangement={transport.current.plan?.objectPlans.get(object.id)?.kind ?? "independent"}
          className={`garden-artwork ${audible ? "audible" : "resting"} ${nearby ? "near-listener" : ""} ${selected === object.id ? "chosen" : ""} ${pressedObject === object.id ? "pressed" : ""} ${pulseObjects.has(object.id) ? "answer-pulse" : ""} ${spotlightId && spotlightId !== object.id ? "spotlight-dim" : ""} ${spotlightId === object.id ? "spotlight-lead" : ""} ${bloom ? "placement-bloom" : ""} ${crowded ? "crowded" : ""}`}
          style={{ left: object.world.x * 100 + "%", top: object.world.y * 100 + "%", "--ensemble-breath": breath } as CSSProperties}
          aria-label={t("{title} — {role}。矢印キーで移動", { title: object.title, role: t(roleNames[object.musicalRole]) })}
          onFocus={() => setSelected(object.id)} onKeyDown={(e) => keyboard(e, object.id, object.world)}>
          <span className="artwork-drawing" style={{ aspectRatio: object.project.canvasAspect, width: `min(100%, ${object.project.canvasAspect * 90}px)` }}><Artwork object={object} /></span>
          <span className="artwork-title">{object.title}</span><small>{t(roleNames[object.musicalRole])} · {audible ? t("歌っている") : t("ひと休み")}</small>
        </button>;
      })}
      {pending && <div className="garden-artwork garden-ghost" style={{ left: ghost.x * 100 + "%", top: ghost.y * 100 + "%" }}>
        <span className="artwork-drawing" style={{ aspectRatio: pending.project.canvasAspect, width: `min(100%, ${pending.project.canvasAspect * 90}px)` }}><Artwork object={pending} /></span><small>{t("ここに、ひとつの音。")}</small></div>}
      <div className="listener-trail" aria-hidden="true">{listenerTrail.map((position, index) => <i key={index} style={{ left: position.x * 100 + "%", top: position.y * 100 + "%", opacity: (index + 1) / listenerTrail.length * .28 }} />)}</div>
      <button className={`garden-listener ${playing ? "listening" : ""} ${listenerTrail.length ? "sweeping" : ""}`} data-object="listener" aria-label={t("聴く位置。ドラッグまたは矢印キーで移動")}
        style={{ left: garden.listener.x * 100 + "%", top: garden.listener.y * 100 + "%" }}
        onKeyDown={(e) => keyboard(e, "listener", garden.listener)}><span className="listener-orb"><Ear size={20} /></span><span className="listener-label">{t("YOU")}</span></button>
    </div>
    <div className="garden-bottom"><p role="status">{pending ? garden.objects.length >= MAX_OBJECTS ? t("庭は12作品でいっぱいです。配置をキャンセルして作品を選ぶと取り除けます。") : t("好きなところにタップして、音を植えよう。") : t("耳を動かすと、聴こえる景色が変わる。絵もそのまま動かせます。")}</p>
      {pending ? <div className="garden-actions"><button disabled={garden.objects.length >= MAX_OBJECTS} onClick={() => place(ghost)}>{t("ここに置く")}</button><button onClick={onSeedPlaced}><X size={14} />{t("配置をやめる")}</button></div>
        : <button className="garden-draw" onClick={onDraw}><Pencil size={15} />{t("もうひとつ描く")}</button>}
    </div>
    {selectedObject && !pending && <div className="garden-selection"><span>{selectedObject.title} · {t(roleNames[selectedObject.musicalRole])}</span>
      <div className="garden-selection-actions"><button className="spotlight-button" onClick={activateSpotlight}>{t("Spotlight")}</button>
        <button onClick={() => { change({ ...stateRef.current, objects: stateRef.current.objects.filter((o) => o.id !== selected) }); setSelected(null); gardenUiTone("remove"); tactileTick(6); }}>{t("庭から取り除く")}</button></div></div>}
    {leadRelation && relationNames[0] && relationNames[1] && <p className="ensemble-status" role="status">
      {t(relationCopy[leadRelation.kind], { a: relationNames[0].title, b: relationNames[1].title })}
      <span>{t("少し離すと、それぞれの歌に戻る。")}</span>
    </p>}
    {!pending && garden.objects.length > 0 && !leadRelation && <p className="ensemble-status">{t(curiosity)}</p>}
    {error && <p className="save-error" role="alert">{t(error)}</p>}
    {discovery && <p className="growth-discovery ensemble-status" role="status">{t(discovery)}</p>}
    {growthError && <p className="save-error" role="status">{t(loadedGrowth.protected
      ? "庭の成長データを読み込めません。元データと作品はそのまま残しています。"
      : "庭の成長を保存できません。この画面では聴いた音が残ります。")}</p>}
  </section>;
}
