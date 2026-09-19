import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleHelp,
  Eraser,
  FileJson,
  FolderOpen,
  Heart,
  Image,
  LoaderCircle,
  Music2,
  Pencil,
  Play,
  Redo2,
  RotateCcw,
  Sparkles,
  Square,
  Undo2,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { AudioEngine, renderAudio } from "./music/audio";
import {
  BEATS,
  clamp,
  createMusic,
  createVisualNotes,
  HEIGHT,
  touchesStroke,
  WIDTH,
} from "./music/score";
import { download, midiFile, pictureFile } from "./music/export";
import { exampleStrokes } from "./music/examples";
import type { Example } from "./music/examples";
import {
  instruments,
  loadProject,
  parseProject,
  STORAGE_KEY,
} from "./music/project";
import type { Project, Stroke, StrokePoint } from "./music/types";
import { GardenView } from "./garden/GardenView";
import { LanguageSwitch, useLanguage } from "./i18n/LanguageContext";
import { tactileTick } from "./ui/feedback";
import { drawRelations } from "./wonder/drawRelations";
import { applyDrawWonder } from "./wonder/drawMusic";
import { rememberWonder } from "./wonder/wonderMemory";
import { WonderHint } from "./wonder/wonderHints";
import { WonderDrawLayer } from "./wonder/WonderDrawLayer";
import { strokeColor } from "./wonder/palette";
import { BrandSymbol } from "./brand/BrandLogo";

type HistoryFrame = Pick<Project, "title" | "strokes" | "canvasAspect">;
const IDEA_SETS = [
  ["♡ ハート", "〰 波", "★ 星"],
  ["ぐるぐる", "ギザギザ", "名前"],
  ["縦線", "横線", "顔"],
] as const;
const pathFor = (stroke: Stroke) =>
  stroke.points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ") + (stroke.points.length === 1 ? "l0.1,0" : "");
const formatTime = (seconds: number) =>
  `0:${Math.floor(seconds).toString().padStart(2, "0")}`;
type GestureKind = "dot" | "sustain" | "chord" | "legato" | "staccato" | "rich";
const GESTURE_LABELS: Record<GestureKind, string> = {
  dot: "点のピン", sustain: "横のロングトーン", chord: "縦のコード",
  legato: "なめらかな線", staccato: "跳ねる線", rich: "重なった線",
};
function gestureKind(stroke: Stroke): GestureKind {
  const points = stroke.points;
  if (points.length < 3) return "dot";
  const first = points[0], last = points.at(-1)!;
  const dx = Math.abs(last.x - first.x), dy = Math.abs(last.y - first.y);
  const length = points.reduce((sum, point, index) => sum + (index ? Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) : 0), 0);
  if (length < 28) return "dot";
  if (dy > dx * 1.65) return "chord";
  if (dx > dy * 2.3) return "sustain";
  let turns = 0, sharp = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const abx = b.x - a.x, aby = b.y - a.y, bcx = c.x - b.x, bcy = c.y - b.y;
    const norm = Math.hypot(abx, aby) * Math.hypot(bcx, bcy);
    if (norm < 1) continue;
    turns++;
    if ((abx * bcx + aby * bcy) / norm < .1) sharp++;
  }
  if (length > 850 || points.length > 180) return "rich";
  return turns > 2 && sharp / turns > .2 ? "staccato" : "legato";
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "logo-mark small" : "logo-mark"}
      viewBox="0 0 42 42"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 26C11 26 10 11 17 11S21 30 28 30 34 18 38 18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse
        cx="28"
        cy="30"
        rx="4.4"
        ry="3"
        transform="rotate(-25 28 30)"
        fill="currentColor"
      />
      <path d="M32 29V10" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function CatIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 13V4l5 4a10 10 0 0 1 6 0l5-4v9c0 5-4 7-8 7s-8-2-8-7Z" />
      <path d="M8 13h.01M16 13h.01m-5 3 1 1 1-1" />
    </svg>
  );
}

type AppSpace = "draw" | "garden";

type AppProps = {
  initialSpace?: AppSpace;
  onSpaceChange?: (space: AppSpace) => void;
};

export default function App({ initialSpace = "draw", onSpaceChange }: AppProps = {}) {
  const { language, t } = useLanguage();
  const [space, setSpace] = useState<AppSpace>(initialSpace);
  const [gardenSeed, setGardenSeed] = useState<Project | null>(null);
  const [project, setProject] = useState<Project>(loadProject);
  const projectRef = useRef(project);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [draft, setDraft] = useState<Stroke | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const draftPathRef = useRef<SVGPathElement>(null);
  const draftFrame = useRef(0);
  const draftPath = useRef("");
  const remainingPoints = useRef(0);
  const [arrivingStroke, setArrivingStroke] = useState<string | null>(null);
  const [answeringStroke, setAnsweringStroke] = useState<string | null>(null);
  const [gestureFeedback, setGestureFeedback] = useState<GestureKind | null>(null);
  const [wonderStroke, setWonderStroke] = useState<string | null>(null);
  const [drawingBusy, setDrawingBusy] = useState(false);
  const [nextIdeas, setNextIdeas] = useState<readonly string[]>([]);
  const pointer = useRef<number | null>(null);
  const gestureBefore = useRef<HistoryFrame | null>(null);
  const history = useRef<HistoryFrame[]>([]),
    future = useRef<HistoryFrame[]>([]);
  const [, refreshHistory] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | { key: string; format?: string; idea?: string }>("");
  const [saved, setSaved] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);
  const engine = useRef(new AudioEngine());
  const animation = useRef(0),
    playGeneration = useRef(0);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const answerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const answerClearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const answerGeneration = useRef(0);
  const ideaTurn = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaAspect, setAreaAspect] = useState(WIDTH / HEIGHT);
  const pointLimit = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);

  const update = useCallback((patch: Partial<Project>) => {
    const next = { ...projectRef.current, ...patch };
    projectRef.current = next;
    setProject(next);
    setSaved(false);
  }, []);
  const remember = useCallback((frame: HistoryFrame) => {
    history.current = [...history.current.slice(-39), frame];
    future.current = [];
    refreshHistory((n) => n + 1);
  }, []);
  const stop = useCallback(() => {
    playGeneration.current++;
    answerGeneration.current++;
    cancelAnimationFrame(animation.current);
    clearTimeout(answerTimer.current);
    clearTimeout(answerClearTimer.current);
    engine.current.stop();
    setPlaying(false);
    setStarting(false);
    setProgress(0);
    setFinished(false);
    setAnsweringStroke(null);
    clearTimeout(finishTimer.current);
  }, []);

  useEffect(() => {
    if (space === initialSpace) return;
    stop();
    setSpace(initialSpace);
    if (initialSpace === "draw") setGardenSeed(null);
  }, [initialSpace, space, stop]);

  useEffect(() => {
    onSpaceChange?.(space);
  }, [space, onSpaceChange]);

  useEffect(() => () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectRef.current));
    } catch {
      // Autosave errors are already surfaced while Studio is mounted.
    }
  }, []);
  const notes = useMemo(
    () => createVisualNotes(project.strokes, project.magnet),
    [project.strokes, project.magnet],
  );
  const noteColors = useMemo(() => new Map(project.strokes.map((stroke, index) => [stroke.id, strokeColor(index)])), [project.strokes]);
  const wonderEffects = useMemo(() => drawRelations(project.strokes), [project.strokes]);
  const music = useMemo(
    () =>
      applyDrawWonder(createMusic(notes, project.tempo, project.accompaniment, project.magnet), wonderEffects),
    [notes, project.tempo, project.accompaniment, project.magnet, wonderEffects],
  );
  const seconds = (BEATS * 60) / project.tempo;
  const playAnchors = useMemo(
    () => new Set(music.playNotes.map((n) => n.anchorId)),
    [music.playNotes],
  );
  const activeSources = useMemo(() => {
    const active = new Set<string>();
    if (playing) for (const note of music.playNotes) {
      if (progress * BEATS >= note.beat && progress * BEATS < note.beat + note.duration)
        note.sourceIds.forEach((id) => active.add(id));
    }
    return active;
  }, [music.playNotes, playing, progress]);
  const drawingAspect =
    project.strokes.length || draft ? project.canvasAspect : areaAspect;
  const fitX = Math.min(1, drawingAspect / areaAspect);
  const fitY = Math.min(1, areaAspect / drawingAspect);
  const canvasFit = {
    width: fitX * 100 + "%",
    height: fitY * 100 + "%",
    left: (1 - fitX) * 50 + "%",
    top: (1 - fitY) * 50 + "%",
  };
  useEffect(() => {
    const element = areaRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (height) setAreaAspect(width / height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const modeLabel =
    project.magnet < 0.3
      ? "DRAWING"
      : project.magnet > 0.72
        ? "SCORE"
        : "PICTURE + NOTES";
  const interpretationHint =
    project.magnet < 0.3
      ? "線の形を、そのまま。"
      : project.magnet > 0.72
        ? "絵が、楽譜になる。"
        : "絵の中に、音が見えてくる。";

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        setSaved(true);
        setSaveFailed(false);
      } catch {
        setSaveFailed(true);
        setSaved(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!arrivingStroke) return;
    const timer = setTimeout(() => setArrivingStroke(null), 430);
    return () => clearTimeout(timer);
  }, [arrivingStroke]);
  useEffect(() => {
    if (!wonderStroke) return;
    const timer = setTimeout(() => setWonderStroke(null), 850);
    return () => clearTimeout(timer);
  }, [wonderStroke]);
  useEffect(() => {
    if (!gestureFeedback) return;
    const timer = setTimeout(() => setGestureFeedback(null), 1800);
    return () => clearTimeout(timer);
  }, [gestureFeedback]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      cancelAnimationFrame(draftFrame.current);
      stop();
    };
  }, [stop]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!exportRef.current?.contains(event.target as Node))
        setExportOpen(false);
    };
    if (exportOpen) document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [exportOpen]);
  useEffect(() => {
    if (helpOpen) helpRef.current?.showModal();
    else helpRef.current?.close();
  }, [helpOpen]);

  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (!previous) return;
    stop();
    future.current.push({
      title: projectRef.current.title,
      strokes: projectRef.current.strokes,
      canvasAspect: projectRef.current.canvasAspect,
    });
    update(previous);
    engine.current.uiTone("remove");
    refreshHistory((n) => n + 1);
  }, [stop, update]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    stop();
    history.current.push({
      title: projectRef.current.title,
      strokes: projectRef.current.strokes,
      canvasAspect: projectRef.current.canvasAspect,
    });
    update(next);
    engine.current.uiTone("place");
    refreshHistory((n) => n + 1);
  }, [stop, update]);

  const play = useCallback(async () => {
    if (playing || starting) {
      stop();
      return;
    }
    if (!notes.length) return;
    const generation = ++playGeneration.current;
    answerGeneration.current++;
    clearTimeout(answerTimer.current);
    clearTimeout(answerClearTimer.current);
    setAnsweringStroke(null);
    setStarting(true);
    setFinished(false);
    try {
      const timing = await engine.current.play(music, project.instrument);
      if (generation !== playGeneration.current) {
        engine.current.stop();
        return;
      }
      setStarting(false);
      setPlaying(true);
      rememberWonder(wonderEffects.map(effect => effect.rule));
      let lastFrame = -1;
      const frame = () => {
        const elapsed = Math.max(0, engine.current.currentTime - timing.start);
        if (elapsed >= timing.seconds) {
          setPlaying(false);
          setProgress(0);
          setFinished(true);
          setNextIdeas(IDEA_SETS[ideaTurn.current++ % IDEA_SETS.length]);
          finishTimer.current = setTimeout(() => setFinished(false), 1400);
          return;
        }
        // Visuals follow the audio clock; audio is never scheduled by animation frames.
        if (elapsed - lastFrame > 1 / 40) {
          setProgress(elapsed / timing.seconds);
          lastFrame = elapsed;
        }
        animation.current = requestAnimationFrame(frame);
      };
      animation.current = requestAnimationFrame(frame);
    } catch {
      stop();
      setNotice("音を開始できませんでした。もう一度PLAYを押してください。");
    }
  }, [playing, starting, notes.length, stop, music, project.instrument, wonderEffects]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (space !== "draw") return;
      if (
        (event.target as HTMLElement).matches("input, select, textarea") ||
        helpOpen ||
        pointer.current !== null
      )
        return;
      if (
        event.code === "Space" &&
        !(event.target as HTMLElement).closest("button")
      ) {
        event.preventDefault();
        void play();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (event.key.toLowerCase() === "d" && !event.metaKey && !event.ctrlKey)
        setTool("draw");
      if (event.key.toLowerCase() === "e" && !event.metaKey && !event.ctrlKey)
        setTool("erase");
      if (event.key === "Escape") {
        stop();
        setExportOpen(false);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [play, stop, undo, redo, helpOpen, space]);

  function point(event: Pick<PointerEvent, "clientX" | "clientY" | "pressure" | "timeStamp">, rect: DOMRect): StrokePoint {
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * WIDTH, 0, WIDTH),
      y: clamp(((event.clientY - rect.top) / rect.height) * HEIGHT, 0, HEIGHT),
      pressure: event.pressure || 0.5,
      time: event.timeStamp,
    };
  }
  function erase(p: StrokePoint) {
    const rect = svgRef.current!.getBoundingClientRect();
    const strokes = projectRef.current.strokes.filter(
      (s) => !touchesStroke(s, p, (14 * WIDTH) / rect.width),
    );
    if (strokes.length !== projectRef.current.strokes.length)
      update({ strokes });
  }
  function beginStroke(event: ReactPointerEvent<SVGSVGElement>) {
    if (
      pointer.current !== null ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    if (
      (projectRef.current.strokes.length >= 500 ||
        projectRef.current.strokes.reduce(
          (count, s) => count + s.points.length,
          0,
        ) >= 59998) &&
      tool === "draw"
    ) {
      setNotice("線がいっぱいです。作品を保存して、新しい一枚を描きましょう。");
      return;
    }
    event.preventDefault();
    stop();
    setNextIdeas([]);
    setGestureFeedback(null);
    setWonderStroke(null);
    setDrawingBusy(true);
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureBefore.current = {
      title: projectRef.current.title,
      strokes: projectRef.current.strokes,
      canvasAspect: projectRef.current.canvasAspect,
    };
    const p = point(event, event.currentTarget.getBoundingClientRect());
    if (tool === "erase") {
      erase(p);
      return;
    }
    if (!projectRef.current.strokes.length)
      update({ canvasAspect: clamp(areaAspect, 0.35, 5) });
    pointLimit.current = false;
    remainingPoints.current = Math.min(6000, 60000 - projectRef.current.strokes.reduce(
      (total, s) => total + s.points.length, 0,
    ));
    // randomUUID is unavailable over plain LAN HTTP on many mobile browsers.
    const stroke = { id: globalThis.crypto?.randomUUID?.() ??
      "stroke-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2), points: [p] };
    draftRef.current = stroke;
    draftPath.current = pathFor(stroke);
    setDraft({ ...stroke, points: [...stroke.points] });
    void engine.current
      .unlock()
      .then(() => {
        if (draftRef.current?.id === stroke.id)
          engine.current.preview(p.y, 0, projectRef.current.instrument);
      })
      .catch(() => setNotice("音が使えません。描画はそのまま続けられます。"));
  }
  function moveStroke(event: ReactPointerEvent<SVGSVGElement>) {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    if (tool === "erase") {
      erase(point(event, rect));
      return;
    }
    const current = draftRef.current;
    if (!current) return;
    const previous = current.points.at(-1)!;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    // Append the delivered event too: engines differ on whether it is coalesced.
    for (const sample of [...samples, event.nativeEvent]) {
      const p = point(sample, rect), last = current.points.at(-1)!;
      const distancePx = Math.hypot(
        (p.x - last.x) * rect.width / WIDTH,
        (p.y - last.y) * rect.height / HEIGHT,
      );
      if (distancePx < 0.65) continue;
      // Reserve the last point for pointerup, even at the size limit.
      if (current.points.length >= remainingPoints.current - 1) {
        if (!pointLimit.current) {
          pointLimit.current = true;
          setNotice("長い線はここまで。指を離して続きを描けます。");
        }
        break;
      }
      current.points.push(p);
      draftPath.current += " L" + p.x.toFixed(2) + "," + p.y.toFixed(2);
    }
    if (!draftFrame.current) {
      // Ink updates once per display frame without reconciling every saved note.
      draftFrame.current = requestAnimationFrame(() => {
        draftPathRef.current?.setAttribute("d", draftPath.current);
        draftFrame.current = 0;
      });
    }
    const p = current.points.at(-1)!;
    engine.current.preview(
      p.y,
      Math.hypot(p.x - previous.x, p.y - previous.y) / Math.max(1, p.time - previous.time),
      projectRef.current.instrument,
    );
  }
  function endStroke(
    event: ReactPointerEvent<SVGSVGElement>,
    cancelled = false,
  ) {
    if (pointer.current !== event.pointerId) return;
    setDrawingBusy(false);
    if (!cancelled && draftRef.current) {
      const p = point(event, event.currentTarget.getBoundingClientRect()),
        last = draftRef.current.points.at(-1)!;
      if (!pointLimit.current && draftRef.current.points.length < remainingPoints.current &&
        Math.hypot(p.x - last.x, p.y - last.y) > 0.5)
        draftRef.current = {
          ...draftRef.current,
          points: [...draftRef.current.points, p],
        };
      const completed = draftRef.current;
      remember(gestureBefore.current!);
      setArrivingStroke(completed.id);
      const strokes = [...projectRef.current.strokes, completed];
      const discoveries = drawRelations(strokes).filter(effect => effect.strokeIds.includes(completed.id));
      update({ strokes });
      if (discoveries.length) {
        setWonderStroke(completed.id);
        rememberWonder(discoveries.map(effect => effect.rule));
        engine.current.uiTone(discoveries.some(effect => effect.rule === 'crossing-spark') ? 'relation' : 'place');
      }
      const reply = createMusic(
        createVisualNotes([completed], projectRef.current.magnet),
        projectRef.current.tempo,
        false,
        projectRef.current.magnet,
      );
      engine.current.settle(Math.min(3, reply.playNotes.length));
      tactileTick(5);
      setGestureFeedback(gestureKind(completed));
      const generation = ++answerGeneration.current;
      answerTimer.current = setTimeout(() => {
        if (generation !== answerGeneration.current) return;
        setAnsweringStroke(completed.id);
        void engine.current.answer(reply, projectRef.current.instrument)
          .then((duration) => {
            if (generation !== answerGeneration.current) return;
            answerClearTimer.current = setTimeout(() => {
              if (generation === answerGeneration.current) setAnsweringStroke(null);
            }, duration * 1000);
          })
          .catch(() => setAnsweringStroke(null));
      }, 220);
    } else if (cancelled && gestureBefore.current)
      update(gestureBefore.current);
    else if (
      gestureBefore.current &&
      gestureBefore.current.strokes !== projectRef.current.strokes
    )
      remember(gestureBefore.current);
    pointer.current = null;
    cancelAnimationFrame(draftFrame.current);
    draftFrame.current = 0;
    draftRef.current = null;
    gestureBefore.current = null;
    setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function loadExample(kind: Example) {
    stop();
    remember({
      title: project.title,
      strokes: project.strokes,
      canvasAspect: project.canvasAspect,
    });
    update({
      strokes: exampleStrokes(kind),
      canvasAspect: WIDTH / HEIGHT,
      title: {
        heart: "A little love",
        wave: "An ocean of sound",
        cat: "A curious little cat",
      }[kind],
    });
    engine.current.uiTone("place");
    setTool("draw");
  }
  function clearCanvas() {
    if (!project.strokes.length) return;
    stop();
    remember({
      title: project.title,
      strokes: project.strokes,
      canvasAspect: project.canvasAspect,
    });
    update({ strokes: [], title: "Untitled no. 01" });
    engine.current.uiTone("remove");
    setTool("draw");
    setNotice("新しい一枚。Undoで前の絵に戻せます。");
  }
  async function exportWork(kind: "png" | "wav" | "mid" | "json") {
    if (exporting) return;
    setExporting(true);
    stop();
    try {
      const blob =
        kind === "wav"
          ? await renderAudio(music, project.instrument)
          : kind === "png"
            ? await pictureFile(project, notes, language)
            : kind === "mid"
              ? new Blob([midiFile(music, project.instrument)], {
                  type: "audio/midi",
                })
              : new Blob([JSON.stringify(project, null, 2)], {
                  type: "application/json",
                });
      download(blob, project.title, kind);
      setExportOpen(false);
      setNotice({ key: "{format}を書き出しました。", format: kind.toUpperCase() });
    } catch {
      setNotice("書き出せませんでした。もう一度お試しください。");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label={t("Picture Score ホーム")}>
          <BrandSymbol compact />
          <span>
            picture score<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="project-name">
          <input
            aria-label={t("作品名")}
            value={project.title}
            maxLength={80}
            onChange={(e) => update({ title: e.target.value })}
            onBlur={() => {
              if (!projectRef.current.title.trim())
                update({ title: "Untitled no. 01" });
            }}
          />
          <span
            className={`saved-indicator ${saveFailed ? "failed" : ""}`}
            title={
              saveFailed
                ? t("保存できません。作品ファイルを書き出してください。")
                : saved
                  ? t("このブラウザに保存済み")
                  : t("保存中")
            }
          >
            {saved ? <Check size={12} /> : <span className="saving-dot" />}
          </span>
        </div>
        <div className="header-actions" hidden={space !== "draw"}>
          <button
            className="icon-button undo-button"
            aria-label={t("Undo — 元に戻す")}
            title="Undo (Ctrl/⌘ Z)"
            disabled={!history.current.length}
            onClick={undo}
          >
            <Undo2 size={18} />
            <span>Undo</span>
          </button>
          <button
            className="icon-button redo-button"
            aria-label={t("Redo — やり直す")}
            title="Redo (Ctrl/⌘ Shift Z)"
            disabled={!future.current.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <span className="header-divider" />
          <div ref={exportRef} className="export-wrap">
            <button
              className={`save-button ${exportOpen ? "open" : ""}`}
              aria-label={t("作品を書き出す")}
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((v) => !v)}
            >
              {exporting ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ArrowDownToLine size={16} />
              )}
              <span>Save</span>
            </button>
            {exportOpen && (
              <div className="export-menu">
                <div className="menu-eyebrow">{t("KEEP YOUR CREATION")}</div>
                <button
                  disabled={!notes.length || exporting}
                  onClick={() => void exportWork("png")}
                >
                  <Image size={17} />
                  <span>
                    {t("絵を保存")}<small>{t("PNG image")}</small>
                  </span>
                  <span className="file-extension">.png</span>
                </button>
                <button
                  disabled={!notes.length || exporting}
                  onClick={() => void exportWork("wav")}
                >
                  <AudioLines size={17} />
                  <span>
                    {t("音楽を保存")}<small>{t("WAV audio")}</small>
                  </span>
                  <span className="file-extension">.wav</span>
                </button>
                <button
                  disabled={!notes.length || exporting}
                  onClick={() => void exportWork("mid")}
                >
                  <Music2 size={17} />
                  <span>
                    {t("楽譜を保存")}<small>{t("Drawing + accompaniment")}</small>
                  </span>
                  <span className="file-extension">.mid</span>
                </button>
                <div className="menu-divider" />
                <button
                  disabled={exporting}
                  onClick={() => void exportWork("json")}
                >
                  <FileJson size={17} />
                  <span>
                    {t("作品を保存")}<small>{t("あとで続きを描く")}</small>
                  </span>
                  <span className="file-extension">.json</span>
                </button>
                <button
                  disabled={exporting}
                  onClick={() => {
                    fileRef.current?.click();
                    setExportOpen(false);
                  }}
                >
                  <FolderOpen size={17} />
                  <span>{t("作品を開く")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="workspace-toolbar">
        <nav className="space-nav" aria-label={t("制作スペース")}>
          <button aria-pressed={space === "draw"} onClick={() => { stop(); setSpace("draw"); setGardenSeed(null); }}><Pencil size={15} /> DRAW</button>
          <button aria-pressed={space === "garden"} onClick={() => { stop(); setSpace("garden"); }}>GARDEN <Music2 size={15} /></button>
        </nav>
        <LanguageSwitch />
      </div>
      <GardenView active={space === "garden"} seed={gardenSeed} onSeedPlaced={() => setGardenSeed(null)}
        onDraw={() => { setSpace("draw"); setGardenSeed(null); }} />
      <main hidden={space !== "draw"}>
        <section className="intro" aria-label="Picture Score">
          <div>
            <p className="eyebrow">
              <span className="tiny-star">✳</span> {t("A LITTLE DRAWING. A LITTLE MAGIC.")}
            </p>
            <h1>
              {t("Feel the ")}<em>{t("line.")}</em>
            </h1>
            <p className="intro-copy">{t("Every shape hides a musical secret.")}</p>
          </div>
          <div className="intro-note">
            <svg viewBox="0 0 75 40" aria-hidden="true">
              <path
                d="M2 8c20 28 33-7 45 4 6 5-2 14 16 10m-6-7 7 7-8 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              {t("No useless strokes.")}
              <br />
              {t("Just your imagination.")}
            </span>
          </div>
        </section>

        <ol className="creation-trail" aria-label={t("描いて、聴いて、庭へ") }>
          <li><span>01</span><p><strong>{t("線を描く")}</strong>{t("指を離すと、音が返事。")}</p></li>
          <li><span>02</span><p><strong>{t("PLAYで聴く")}</strong>{t("描いた絵が、ひとつの曲に。")}</p></li>
          <li><span>03</span><p><strong>{t("庭に置く")}</strong>{t("音を並べて、自分だけの庭へ。")}</p></li>
        </ol>

        <section
          className={`score-paper ${finished ? "finished" : ""} ${playing ? "is-playing" : ""} ${answeringStroke ? "is-answering" : ""}`}
          aria-label={t("楽譜キャンバス")}
        >
          <div className="paper-heading">
            <div className="paper-label">
              <span className={`status-dot ${playing ? "pulse" : ""}`} />
              <span>
                {playing
                  ? t("YOUR DRAWING IS PLAYING")
                  : draft
                    ? t("FOLLOW YOUR LINE")
                  : answeringStroke
                    ? t("PICTURE SCORE IS ANSWERING")
                    : t("YOUR LITTLE COMPOSITION")}
                {gestureFeedback && <span className="gesture-badge" data-testid="gesture-feedback">{t(GESTURE_LABELS[gestureFeedback])}</span>}
              </span>
            </div>
            <div className="paper-meta">
              <span>{t("C pentatonic")}</span>
              <span>4 / 4</span>
              <button
                className="icon-button new-page"
                aria-label={t("新しいキャンバス")}
                title={t("新しいキャンバス（Undoで復元できます）")}
                disabled={!project.strokes.length}
                onClick={clearCanvas}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          <div ref={areaRef} className={`drawing-area tool-${tool}`}>
            <div className="pitch-hint high">{t("HIGH")}</div>
            <div className="pitch-hint low">{t("LOW")}</div>
            <svg
              ref={svgRef}
              style={canvasFit}
              className="score-canvas"
              data-testid="score-canvas"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              aria-label={t("ここに絵を描く。右へ進むと時間が進み、上へ描くと高い音になります。")}
              role="img"
              onPointerDown={beginStroke}
              onPointerMove={moveStroke}
              onPointerUp={endStroke}
              onPointerCancel={(e) => endStroke(e, true)}
              onLostPointerCapture={(e) => {
                if (pointer.current === e.pointerId) endStroke(e, true);
              }}
            >
              <defs>
                <linearGradient id="play-glow">
                  <stop stopColor="#d7573b" stopOpacity="0" />
                  <stop offset="1" stopColor="#d7573b" stopOpacity="0.07" />
                </linearGradient>
              </defs>
              <g className="staff-lines">
                {Array.from({ length: 3 }, (_, group) =>
                  Array.from({ length: 5 }, (_, line) => (
                    <line
                      key={`${group}-${line}`}
                      x1="0"
                      x2={WIDTH}
                      y1={52 + group * 132 + line * 18}
                      y2={52 + group * 132 + line * 18}
                    />
                  )),
                )}
              </g>
              <g className="bar-lines">
                {[0.25, 0.5, 0.75].map((x) => (
                  <line
                    key={x}
                    x1={x * WIDTH}
                    x2={x * WIDTH}
                    y1="20"
                    y2="400"
                  />
                ))}
              </g>
              <g className="source-strokes">
                {project.strokes.map((s, index) => (
                  <path key={s.id} d={pathFor(s)} data-stroke={s.id} style={{ stroke: strokeColor(index) }} />
                ))}
              </g>
              <WonderDrawLayer effects={wonderEffects} strokes={project.strokes} recent={wonderStroke} beat={playing ? progress * BEATS : undefined} />
              {draft && <path ref={draftPathRef} className="draft-stroke" d={pathFor(draft)} />}
              <g className="score-notes">
                {notes.map((n) => {
                  const active = activeSources.has(n.id);
                  return (
                    <g
                      key={n.id}
                      className={`score-note ${active || n.sourceStroke === answeringStroke ? "note-active" : ""} ${playAnchors.has(n.id) ? "play-anchor" : "visual-only"}`}
                      data-note={n.id}
                      data-beat={n.beat.toFixed(3)}
                      data-pitch={n.pitch}
                      style={{
                        transform: `translate(${n.visualPosition.x}px, ${n.visualPosition.y}px)`,
                        "--note-color": noteColors.get(n.sourceStroke),
                      } as CSSProperties}
                    >
                      <g className={n.sourceStroke === arrivingStroke ? "note-arrival" : ""}
                        style={{ "--arrive-x": (n.sourcePosition.x - n.visualPosition.x) + "px",
                          "--arrive-y": (n.sourcePosition.y - n.visualPosition.y) + "px",
                          "--arrive-delay": Math.min(n.sourceIndex * 7, 120) + "ms" } as CSSProperties}>
                      <circle className="note-halo" r="11" />
                      <ellipse
                        className="note-head"
                        rx="4.2"
                        ry="2.8"
                        transform="rotate(-25)"
                      />
                      <path className="note-stem" d="M3.5,-1 L3.5,-14" />
                      </g>
                    </g>
                  );
                })}
              </g>
              {playing && (
                <g
                  className="playhead"
                  style={{ transform: `translateX(${progress * WIDTH}px)` }}
                >
                  <rect
                    x="-65"
                    y="0"
                    width="65"
                    height={HEIGHT}
                    fill="url(#play-glow)"
                  />
                  <line x1="0" x2="0" y1="0" y2={HEIGHT} />
                  <path d="M-4 0H4L0 6Z" />
                  <path d={`M-4 ${HEIGHT}H4L0 ${HEIGHT - 6}Z`} />
                </g>
              )}
            </svg>
            {!project.strokes.length && !draft && (
              <div className="empty-canvas" aria-hidden="true">
                <svg className="empty-doodle" viewBox="0 0 160 80">
                  <path d="M14 50c21 11 22-30 41-28 20 2 7 45 32 39 21-5 8-39 29-38 13 0 10 25 29 13" />
                  <path className="doodle-arrow" d="m137 30 9 6-6 8" />
                  <circle cx="55" cy="22" r="3" />
                  <path className="doodle-note" d="M118 22V8" />
                </svg>
                <p>{t("まずは、ひと筆。")}</p>
                <span>{t("ハートでも、猫でも、気の向くままに。")}</span>
                <span className="empty-small">
                  {t("指やマウスで、ここに描いてみよう")}
                </span>
                <WonderHint space="draw" busy={drawingBusy} enabled={space === "draw"} className="empty-gesture-hint" />
              </div>
            )}
          </div>
          <div className="timeline" aria-hidden="true">
            <span>01</span>
            <span>02</span>
            <span>03</span>
            <span>04</span>
            <span className="time-arrow">
              {t("TIME")} <ArrowRight size={13} />
            </span>
          </div>
          <div className="paper-footer">
            <div className={`inspiration ${nextIdeas.length ? "next-ideas" : ""}`}>
              <span className="inspiration-label">{nextIdeas.length ? t("次は何を鳴らす？") : t("きっかけに")}</span>
              {nextIdeas.length ? nextIdeas.map((idea) => (
                <button key={idea} onClick={() => {
                  setTool("draw");
                  setNotice({ key: "「{idea}」を自由に描いてみよう。", idea });
                }}>
                  <span>{t(idea)}</span>
                </button>
              )) : <>
              <button onClick={() => loadExample("heart")}>
                <Heart size={15} />
                <span>{t("Heart")}</span>
              </button>
              <button onClick={() => loadExample("wave")}>
                <Waves size={16} />
                <span>{t("Wave")}</span>
              </button>
              <button onClick={() => loadExample("cat")}>
                <CatIcon />
                <span>{t("Cat")}</span>
              </button>
              </>}
            </div>
            <span className="canvas-caption">
              {playing
                ? `${formatTime(progress * seconds)} / ${formatTime(seconds)}`
                : notes.length
                  ? `${music.playNotes.length} ${music.playNotes.length === 1 ? t("sound") : t("sounds")} · ${formatTime(seconds)}`
                  : t("Every line is a possibility.")}
            </span>
            {!!project.strokes.length && <WonderHint space="draw" busy={drawingBusy || playing} enabled={space === "draw"} className="gesture-hint" />}
          </div>
        </section>

        <section className="controls" aria-label={t("描画と再生の操作")}>
          <div className="tool-control">
            <div className="tool-switch">
              <button
                className={tool === "draw" ? "selected" : ""}
                aria-pressed={tool === "draw"}
                aria-label={t("DRAW — 描く")}
                onClick={() => setTool("draw")}
              >
                <Pencil size={17} />
                <span>DRAW</span>
              </button>
              <button
                className={tool === "erase" ? "selected" : ""}
                aria-pressed={tool === "erase"}
                aria-label={t("ERASE — 線を消す")}
                onClick={() => setTool("erase")}
              >
                <Eraser size={17} />
                <span>ERASE</span>
              </button>
            </div>
            <span className="control-hint">
              {tool === "draw"
                ? t("その線が、メロディになる")
                : t("消したい線にふれてみよう")}
            </span>
          </div>
          <div className="play-control">
            <button
              className={`play-button ${playing ? "playing" : ""}`}
              disabled={!notes.length || exporting}
              aria-label={
                playing || starting
                  ? t("STOP — 再生を止める")
                  : t("PLAY — 絵を演奏する")
              }
              onClick={() => void play()}
            >
              {starting ? (
                <LoaderCircle className="spin" size={18} />
              ) : playing ? (
                <Square size={15} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
              <span>{playing || starting ? "STOP" : "PLAY"}</span>
            </button>
            <span className="control-hint">
              {playing ? t("あなたの絵を、演奏中") : t("描いたら、聴いてみよう")}
            </span>
            <button className="place-garden" disabled={!notes.length || exporting || !!draft}
              onClick={() => { stop(); setGardenSeed(structuredClone(projectRef.current)); setSpace("garden"); }}>
              <Music2 size={14} /> {t("PLACE IN GARDEN")}
            </button>
          </div>
          <div className="magnet-control">
            <div className="magnet-title">
              <label htmlFor="magnet">
                {t("絵")} <span>↔</span> {t("音楽")}
              </label>
              <span>
                <Sparkles size={11} /> {t(modeLabel)}
              </span>
            </div>
            <div className="slider-row">
              <Pencil size={14} />
              <input
                id="magnet"
                type="range"
                min="0"
                max="100"
                value={Math.round(project.magnet * 100)}
                aria-label={t("絵と音楽のバランス")}
                aria-valuetext={t("{mode} {percent}%。絵の音符{visual}個を{play}音で演奏", { mode: t(modeLabel), percent: Math.round(project.magnet * 100), visual: notes.length, play: music.playNotes.length })}
                aria-describedby="interpretation-hint"
                style={
                  {
                    "--range-progress": `${project.magnet * 100}%`,
                  } as CSSProperties
                }
                onChange={(e) => {
                  stop();
                  update({ magnet: Number(e.target.value) / 100 });
                }}
              />
              <Music2 size={15} />
            </div>
            <div className="slider-labels">
              <span>{t("DRAWING")}</span>
              <span>{t("SCORE")}</span>
            </div>
            <div className="interpretation-count" data-testid="interpretation-count"
              data-visual-count={notes.length} data-play-count={music.playNotes.length}>
              <span><strong>{notes.length}</strong> {t("visual")}</span>
              <ArrowRight size={13} />
              <span><strong>{music.playNotes.length}</strong> {t("play")}</span>
              {music.support.length > 0 && <span className="support-count">{t("＋伴奏")}</span>}
            </div>
            <p id="interpretation-hint" className="interpretation-hint">
              {t(interpretationHint)}
            </p>
          </div>
        </section>

        <section className="sound-strip" aria-label={t("音色の設定")}>
          <div className="instrument-control">
            <span className="sound-label">
              <Volume2 size={15} /> SOUND
            </span>
            <div className="instrument-options">
              {instruments.map((instrument) => (
                <button
                  key={instrument}
                  className={project.instrument === instrument ? "active" : ""}
                  aria-pressed={project.instrument === instrument}
                  onClick={() => {
                    stop();
                    update({ instrument });
                    void engine.current
                      .unlock()
                      .then(() => engine.current.preview(220, 0, instrument))
                      .catch(() => setNotice("音を開始できませんでした。"));
                  }}
                >
                  {t(instrument)}
                </button>
              ))}
            </div>
          </div>
          <div className="secondary-sound">
            <label className="support-toggle">
              <input
                type="checkbox"
                checked={project.accompaniment}
                onChange={(e) => {
                  stop();
                  update({ accompaniment: e.target.checked });
                }}
              />
              <span className="toggle-track">
                <span />
              </span>
              <span>{t("そっと伴奏")}</span>
            </label>
            <div className="tempo-control">
              <select
                aria-label={t("テンポ")}
                value={project.tempo}
                onChange={(e) => {
                  stop();
                  update({ tempo: Number(e.target.value) });
                }}
              >
                {[
                  72,
                  88,
                  104,
                  120,
                  140,
                  ...(![72, 88, 104, 120, 140].includes(project.tempo)
                    ? [project.tempo]
                    : []),
                ]
                  .sort((a, b) => a - b)
                  .map((tempo) => (
                    <option key={tempo} value={tempo}>
                      {tempo} BPM
                    </option>
                  ))}
              </select>
              <ChevronDown size={12} />
            </div>
          </div>
        </section>
        {saveFailed && (
          <p className="save-error" role="alert">
            {t("ブラウザに保存できません。Saveから作品ファイルを書き出してください。")}
          </p>
        )}
      </main>

      <footer className="site-footer">
        <span>
          <Logo small /> {t("Made of lines. Full of life.")}
        </span>
        <button onClick={() => setHelpOpen(true)}>
          <CircleHelp size={14} /> {t("あそびかた")}
        </button>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {typeof notice === "string" ? t(notice) : t(notice.key, { format: notice.format ?? "", idea: t(notice.idea ?? "").replace(/^[^\p{L}\p{N}]+/u, "") })}
        </div>
      )}
      <input
        type="file"
        ref={fileRef}
        accept="application/json,.json"
        className="sr-only"
        aria-label={t("作品ファイルを開く")}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 8_000_000)
              throw new Error(
                "ファイルが大きすぎます。8MB以下の作品を選んでください。",
              );
            const next = parseProject(JSON.parse(await file.text()));
            stop();
            remember({
              title: projectRef.current.title,
              strokes: projectRef.current.strokes,
              canvasAspect: projectRef.current.canvasAspect,
            });
            update(next);
            setNotice("作品を開きました。");
          } catch (error) {
            setNotice(
              error instanceof Error && !(error instanceof SyntaxError)
                ? error.message
                : "作品ファイルを読み込めませんでした。",
            );
          }
        }}
      />
      <dialog
        ref={helpRef}
        className="help-dialog"
        onCancel={() => setHelpOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setHelpOpen(false);
        }}
      >
        <button
          className="icon-button close-help"
          aria-label={t("説明を閉じる")}
          onClick={() => setHelpOpen(false)}
        >
          <X size={20} />
        </button>
        <Logo />
        <p className="eyebrow">{t("YOUR FIRST LITTLE COMPOSITION")}</p>
        <h2>{t("うまく描かなくて、いい。")}</h2>
        <p className="help-lead">
          {t("好きな線を描いたら、PLAY。")}
          <br />
          {t("その絵のかたちが、そのまま音楽になります。")}
        </p>
        <div className="help-steps">
          <p>
            <span>01</span>
            <strong>{t("描く。")}</strong>{t("上は高い音、下は低い音。縦の線は和音に。")}
          </p>
          <p>
            <span>02</span>
            <strong>{t("聴く。")}</strong>{t("絵の左から右へ、音が見つかります。")}
          </p>
          <p>
            <span>03</span>
            <strong>{t("ちょっと変える。")}</strong>{t("「絵 ↔ 音楽」で、音の細かさを調整。右ほど音を選び、なめらかなフレーズに。")}
          </p>
        </div>
        <p className="help-small">
          {t("元の線は、ずっとそのまま。作品はこのブラウザに自動保存されます。Saveから絵・音・作品ファイルも持ち帰れます。")}
        </p>
        <button className="help-start" onClick={() => setHelpOpen(false)}>
          {t("さあ、描いてみよう")} <ArrowRight size={16} />
        </button>
      </dialog>
    </div>
  );
}
