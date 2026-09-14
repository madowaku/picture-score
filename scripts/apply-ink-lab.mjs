import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0)
    throw new Error(`Ambiguous patch anchor: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const appPath = "src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");

app = replaceOnce(
  app,
  'import type { Project, Stroke, StrokePoint } from "./music/types";\nimport { GardenView } from "./garden/GardenView";',
  'import type { Project, Stroke, StrokePoint } from "./music/types";\nimport { renderStroke, type StrokeRenderMode } from "./drawing/renderStroke";\nimport { GardenView } from "./garden/GardenView";',
  "renderer import",
);

const oldPathFor = [
  'const pathFor = (stroke: Stroke) =>',
  '  stroke.points',
  '    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)',
  '    .join(" ") + (stroke.points.length === 1 ? "l0.1,0" : "");',
].join("\n");
app = replaceOnce(app, oldPathFor + "\n", "", "legacy pathFor");

app = replaceOnce(
  app,
  '  const [tool, setTool] = useState<"draw" | "erase">("draw");\n  const [draft, setDraft] = useState<Stroke | null>(null);',
  '  const [tool, setTool] = useState<"draw" | "erase">("draw");\n  const [inkMode, setInkMode] = useState<StrokeRenderMode>("current");\n  const [draft, setDraft] = useState<Stroke | null>(null);',
  "ink mode state",
);

app = replaceOnce(
  app,
  '  const noteColors = useMemo(() => new Map(project.strokes.map((stroke, index) => [stroke.id, strokeColor(index)])), [project.strokes]);\n  const wonderEffects = useMemo(() => drawRelations(project.strokes), [project.strokes]);',
  '  const noteColors = useMemo(() => new Map(project.strokes.map((stroke, index) => [stroke.id, strokeColor(index)])), [project.strokes]);\n  const renderedStrokes = useMemo(\n    () => project.strokes.map((stroke, index) => ({\n      stroke,\n      rendered: renderStroke(stroke, inkMode),\n      color: strokeColor(index),\n    })),\n    [project.strokes, inkMode],\n  );\n  const wonderEffects = useMemo(() => drawRelations(project.strokes), [project.strokes]);',
  "memoized rendered strokes",
);

app = replaceOnce(
  app,
  '    draftPath.current = pathFor(stroke);',
  '    draftPath.current = renderStroke(stroke, inkMode).d;',
  "draft begin path",
);

app = replaceOnce(
  app,
  '      draftPath.current += " L" + p.x.toFixed(2) + "," + p.y.toFixed(2);',
  '      if (inkMode === "current")\n        draftPath.current += " L" + p.x.toFixed(2) + "," + p.y.toFixed(2);',
  "draft current fast path",
);

app = replaceOnce(
  app,
  '        draftPathRef.current?.setAttribute("d", draftPath.current);\n        draftFrame.current = 0;',
  '        const liveDraft = draftRef.current;\n        const path = draftPathRef.current;\n        if (liveDraft && path) {\n          const rendered = inkMode === "current"\n            ? { kind: "centerline" as const, d: draftPath.current }\n            : renderStroke(liveDraft, inkMode);\n          path.setAttribute("d", rendered.d);\n          path.dataset.inkKind = rendered.kind;\n        }\n        draftFrame.current = 0;',
  "draft frame renderer",
);

app = replaceOnce(
  app,
  '          <div ref={areaRef} className={`drawing-area tool-${tool}`}>\n            <div className="pitch-hint high">{t("HIGH")}</div>',
  '          <div ref={areaRef} className={`drawing-area tool-${tool}`}>\n            {import.meta.env.DEV && (\n              <div className="ink-lab-switch" role="group" aria-label="INK LAB renderer">\n                <span>INK LAB</span>\n                {(["current", "streamlined", "freehand"] as const).map((mode) => (\n                  <button\n                    key={mode}\n                    type="button"\n                    aria-pressed={inkMode === mode}\n                    onClick={() => setInkMode(mode)}\n                  >\n                    {{ current: "RAW", streamlined: "SMOOTH", freehand: "INK" }[mode]}\n                  </button>\n                ))}\n              </div>\n            )}\n            <div className="pitch-hint high">{t("HIGH")}</div>',
  "dev A/B selector",
);

app = replaceOnce(
  app,
  '              <g className="source-strokes">\n                {project.strokes.map((s, index) => (\n                  <path key={s.id} d={pathFor(s)} data-stroke={s.id} style={{ stroke: strokeColor(index) }} />\n                ))}\n              </g>',
  '              <g className="source-strokes">\n                {renderedStrokes.map(({ stroke, rendered, color }) => (\n                  <path\n                    key={stroke.id}\n                    d={rendered.d}\n                    data-stroke={stroke.id}\n                    data-ink-kind={rendered.kind}\n                    style={rendered.kind === "outline"\n                      ? { fill: color, stroke: "none" }\n                      : { fill: "none", stroke: color }}\n                  />\n                ))}\n              </g>',
  "saved stroke renderer",
);

app = replaceOnce(
  app,
  '              {draft && <path ref={draftPathRef} className="draft-stroke" d={pathFor(draft)} />}',
  '              {draft && (() => {\n                const rendered = renderStroke(draft, inkMode);\n                return <path\n                  ref={draftPathRef}\n                  className="draft-stroke"\n                  d={rendered.d}\n                  data-ink-kind={rendered.kind}\n                  style={rendered.kind === "outline"\n                    ? { fill: "#cd553c", stroke: "none" }\n                    : undefined}\n                />;\n              })()}',
  "draft JSX renderer",
);

fs.writeFileSync(appPath, app);

const stylesPath = "src/styles.css";
let styles = fs.readFileSync(stylesPath, "utf8");
styles = replaceOnce(
  styles,
  '.paper-meta > span:nth-child(2) {\n  font-family: Georgia, serif;\n  font-size: 12px;\n}\n.new-page {',
  '.paper-meta > span:nth-child(2) {\n  font-family: Georgia, serif;\n  font-size: 12px;\n}\n.ink-lab-switch {\n  position: absolute;\n  top: 7px;\n  right: 7px;\n  z-index: 7;\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  padding: 3px;\n  border: 1px solid #dedbd0;\n  border-radius: 7px;\n  background: #fffef7e8;\n  box-shadow: 0 2px 8px #4a463510;\n  backdrop-filter: blur(4px);\n}\n.ink-lab-switch > span {\n  padding: 0 5px;\n  font-size: 7px;\n  letter-spacing: 0.8px;\n  color: #8c8d82;\n}\n.ink-lab-switch button {\n  padding: 4px 6px;\n  border-radius: 4px;\n  font-size: 7px;\n  letter-spacing: 0.45px;\n  color: #7d8074;\n}\n.ink-lab-switch button[aria-pressed="true"] {\n  background: #555e4d;\n  color: #fffefa;\n}\n.new-page {',
  "ink lab selector styles",
);

styles = replaceOnce(
  styles,
  '.draft-stroke {\n  stroke: #cd553c;\n  stroke-width: 2.5;\n}\n.score-note {',
  '.draft-stroke {\n  stroke: #cd553c;\n  stroke-width: 2.5;\n}\n.source-strokes path[data-ink-kind="outline"],\n.draft-stroke[data-ink-kind="outline"] {\n  stroke: none;\n  vector-effect: none;\n}\n.score-note {',
  "outline stroke styles",
);
fs.writeFileSync(stylesPath, styles);

console.log("INK LAB integration applied");
