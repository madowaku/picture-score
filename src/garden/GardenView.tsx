import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from "react";
import { Ear, Pencil, Play, Square, Sprout, X } from "lucide-react";
import type { Project, Stroke } from "../music/types";
import { clamp } from "../music/score";
import { GARDEN_KEY, loadGarden, makeObject, MAX_OBJECTS } from "./gardenState";
import type { MusicalObject, Position } from "./gardenState";
import { mixGarden } from "./gardenMixer";
import { GardenTransport } from "./gardenTransport";
import "./garden.css";
import { useLanguage } from "../i18n/LanguageContext";

const roleNames = { melody: "うた", harmony: "和音", drone: "余韻", rhythm: "リズム", decoration: "きらめき" };
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
  const stateRef = useRef(garden);
  const changed = useRef(false);
  const [error, setError] = useState(loaded.error);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [beat, setBeat] = useState(0);
  const [ghost, setGhost] = useState<Position>({ x: 0.5, y: 0.42 });
  const [selected, setSelected] = useState<string | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointer: number; target: string; offset: Position } | null>(null);
  const transport = useRef(new GardenTransport());
  const pending = useMemo(() => seed ? makeObject(seed, { x: 0.5, y: 0.42 }, "pending") : null, [seed]);
  const mix = mixGarden(garden, Math.floor(beat / 16));
  const selectedObject = garden.objects.find((o) => o.id === selected);
  function change(next: typeof garden) {
    changed.current = true; stateRef.current = next; setGarden(next); transport.current.update(next);
  }
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
    if (!active) { transport.current.stop(); setPlaying(false); setStarting(false); }
  }, [active]);
  useEffect(() => {
    const engine = transport.current;
    const visibility = () => { if (document.hidden) { engine.stop(); setPlaying(false); setStarting(false); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { engine.stop(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setBeat(transport.current.beat), 80);
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
    if (target === "listener") change({ ...g, listener: p });
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
      offset: current && isHandle ? { x: current.x - p.x, y: current.y - p.y } : { x: 0, y: 0 } };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pending) setGhost(p);
    else { setSelected(target === "listener" ? null : target); if (!isHandle) moveTarget(target, p); }
  }
  function move(event: ReactPointerEvent) {
    if (pending && !gesture.current && event.pointerType === "mouse") setGhost(position(event));
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const p = position(event);
    const dest = { x: clamp(p.x + drag.offset.x, 0.06, 0.94), y: clamp(p.y + drag.offset.y, 0.08, 0.92) };
    if (drag.target === "pending") setGhost(dest); else moveTarget(drag.target, dest);
  }
  function place(p: Position) {
    if (!seed || stateRef.current.objects.length >= MAX_OBJECTS) return;
    const object = makeObject(seed, p);
    change({ ...stateRef.current, objects: [...stateRef.current.objects, object] });
    setSelected(object.id); onSeedPlaced(); void listen();
  }
  function up(event: ReactPointerEvent, cancelled = false) {
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!cancelled) {
      if (drag.target === "pending") place(position(event));
      else move(event);
    }
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event: KeyboardEvent, target: string, p: Position) {
    const delta: Record<string, Position> = { ArrowLeft: { x: -0.035, y: 0 }, ArrowRight: { x: 0.035, y: 0 },
      ArrowUp: { x: 0, y: -0.035 }, ArrowDown: { x: 0, y: 0.035 } };
    if (!delta[event.key]) return;
    event.preventDefault(); event.stopPropagation();
    moveTarget(target, { x: clamp(p.x + delta[event.key].x, 0.06, 0.94), y: clamp(p.y + delta[event.key].y, 0.08, 0.92) });
  }
  return <section className="garden-view" hidden={!active} aria-label={t("Garden 音の庭")}>
    <div className="garden-intro"><div><p className="eyebrow"><Sprout size={14} /> PICTURE SCORE GARDEN · 01</p>
      <h1>{t("Give your song ")}<em>{t("a place.")}</em></h1><p className="intro-copy">{t("絵を置いて、音のあいだを歩こう。")}</p></div>
      <span className="garden-count">{garden.objects.length} / {MAX_OBJECTS}<small>{t("sounds growing")}</small></span></div>
    <div className="garden-toolbar">
      <button className="garden-listen" disabled={!garden.objects.length || starting} onClick={() => {
        if (playing || starting) { transport.current.stop(); setPlaying(false); setStarting(false); } else void listen();
      }}>{playing ? <Square size={14} /> : <Play size={14} />}{starting ? t("準備中…") : playing ? t("音を休める") : t("庭を聴く")}</button>
      <label className="garden-tempo">BPM <select aria-label={t("庭のテンポ")} value={garden.bpm}
        onChange={(e) => change({ ...stateRef.current, bpm: Number(e.target.value) })}>
        {[72, 88, 104, 120, 140, ...([72, 88, 104, 120, 140].includes(garden.bpm) ? [] : [garden.bpm])].map((bpm) => <option key={bpm}>{bpm}</option>)}
      </select></label><span className="garden-key">{t("C pentatonic")}</span>
      <span className="garden-clock" aria-label={t("共通の拍")} data-beat={beat.toFixed(2)}>{[0, 1, 2, 3].map((n) =>
        <i key={n} className={playing && Math.floor(beat) % 4 === n ? "lit" : ""} />)}</span>
    </div>
    <div ref={field} className={`garden-field ${pending ? "placing" : ""}`} data-testid="garden-field"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={(e) => up(e, true)}
      onLostPointerCapture={(e) => up(e, true)}>
      <svg className="garden-landscape" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-30 590C140 620 110 370 325 350S470 140 660 220 740 480 1040 345" />
        <ellipse cx="805" cy="123" rx="84" ry="30" /><ellipse cx="155" cy="490" rx="65" ry="23" />
      </svg>
      <span className="garden-landmark north">{t("THE QUIET CORNER")}</span><span className="garden-landmark south">{t("ROOM FOR ANOTHER SONG")}</span>
      {!garden.objects.length && !pending && <div className="garden-empty"><Sprout size={30} /><p>{t("まだ静かな、小さな庭。")}</p><span>{t("ひと筆描いて、最初の音を植えてみよう。")}</span></div>}
      {garden.objects.map((object) => {
        const audible = playing && (mix.get(object.id) ?? 0) > 0.015;
        return <button key={object.id} data-object={object.id} data-gain={(mix.get(object.id) ?? 0).toFixed(3)}
          className={`garden-artwork ${audible ? "audible" : "resting"} ${selected === object.id ? "chosen" : ""}`}
          style={{ left: object.world.x * 100 + "%", top: object.world.y * 100 + "%" }}
          aria-label={t("{title} — {role}。矢印キーで移動", { title: object.title, role: t(roleNames[object.musicalRole]) })}
          onFocus={() => setSelected(object.id)} onKeyDown={(e) => keyboard(e, object.id, object.world)}>
          <span className="artwork-drawing" style={{ aspectRatio: object.project.canvasAspect, width: `min(100%, ${object.project.canvasAspect * 90}px)` }}><Artwork object={object} /></span>
          <span className="artwork-title">{object.title}</span><small>{t(roleNames[object.musicalRole])} · {audible ? t("歌っている") : t("ひと休み")}</small>
        </button>;
      })}
      {pending && <div className="garden-artwork garden-ghost" style={{ left: ghost.x * 100 + "%", top: ghost.y * 100 + "%" }}>
        <span className="artwork-drawing" style={{ aspectRatio: pending.project.canvasAspect, width: `min(100%, ${pending.project.canvasAspect * 90}px)` }}><Artwork object={pending} /></span><small>{t("ここに、ひとつの音。")}</small></div>}
      <button className="garden-listener" data-object="listener" aria-label={t("聴く位置。ドラッグまたは矢印キーで移動")}
        style={{ left: garden.listener.x * 100 + "%", top: garden.listener.y * 100 + "%" }}
        onKeyDown={(e) => keyboard(e, "listener", garden.listener)}><Ear size={22} /><span>{t("YOU")}</span></button>
    </div>
    <div className="garden-bottom"><p role="status">{pending ? garden.objects.length >= MAX_OBJECTS ? t("庭は12作品でいっぱいです。配置をキャンセルして作品を選ぶと取り除けます。") : t("好きなところにタップして、音を植えよう。") : t("耳を動かすと、聴こえる景色が変わる。絵もそのまま動かせます。")}</p>
      {pending ? <div className="garden-actions"><button disabled={garden.objects.length >= MAX_OBJECTS} onClick={() => place(ghost)}>{t("ここに置く")}</button><button onClick={onSeedPlaced}><X size={14} />{t("配置をやめる")}</button></div>
        : <button className="garden-draw" onClick={onDraw}><Pencil size={15} />{t("もうひとつ描く")}</button>}
    </div>
    {selectedObject && !pending && <div className="garden-selection"><span>{selectedObject.title} · {t(roleNames[selectedObject.musicalRole])}</span>
      <button onClick={() => { change({ ...stateRef.current, objects: stateRef.current.objects.filter((o) => o.id !== selected) }); setSelected(null); }}>{t("庭から取り除く")}</button></div>}
    {error && <p className="save-error" role="alert">{t(error)}</p>}
  </section>;
}
