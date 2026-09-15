import fs from "node:fs";

const path = "src/App.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  "imports",
  'import { GardenView } from "./garden/GardenView";\n',
  'import { GardenView } from "./garden/GardenView";\nimport { HomeView } from "./home/HomeView";\nimport { loadRecentProject, rememberRecentProject } from "./home/recentProject";\nimport { BrandSymbol } from "./brand/BrandLogo";\n',
);

replaceOnce(
  "legacy logo",
  `function Logo({ small = false }: { small?: boolean }) {\n  return (\n    <svg\n      className={small ? "logo-mark small" : "logo-mark"}\n      viewBox="0 0 42 42"\n      fill="none"\n      aria-hidden="true"\n    >\n      <path\n        d="M5 26C11 26 10 11 17 11S21 30 28 30 34 18 38 18"\n        stroke="currentColor"\n        strokeWidth="2.5"\n        strokeLinecap="round"\n      />\n      <ellipse\n        cx="28"\n        cy="30"\n        rx="4.4"\n        ry="3"\n        transform="rotate(-25 28 30)"\n        fill="currentColor"\n      />\n      <path d="M32 29V10" stroke="currentColor" strokeWidth="1.8" />\n    </svg>\n  );\n}\n`,
  "",
);

replaceOnce(
  "space state",
  `  const [space, setSpace] = useState<"draw" | "garden">("draw");\n  const [gardenSeed, setGardenSeed] = useState<Project | null>(null);\n  const [project, setProject] = useState<Project>(loadProject);\n`,
  `  const [space, setSpace] = useState<"home" | "draw" | "garden">("home");\n  const [gardenSeed, setGardenSeed] = useState<Project | null>(null);\n  const [project, setProject] = useState<Project>(loadProject);\n  const [recentProject, setRecentProject] = useState<Project | null>(loadRecentProject);\n`,
);

replaceOnce(
  "recent memory",
  `        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));\n        setSaved(true);\n        setSaveFailed(false);\n`,
  `        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));\n        if (project.strokes.length) {\n          rememberRecentProject(project);\n          setRecentProject(project);\n        }\n        setSaved(true);\n        setSaveFailed(false);\n`,
);

replaceOnce(
  "app shell",
  `  return (\n    <div className="app-shell">\n`,
  `  function startFreshFromHome() {\n    stop();\n    if (projectRef.current.strokes.length) {\n      rememberRecentProject(projectRef.current);\n      setRecentProject(projectRef.current);\n    }\n    history.current = [];\n    future.current = [];\n    update({\n      title: "Untitled no. 01",\n      strokes: [],\n      canvasAspect: WIDTH / HEIGHT,\n    });\n    setTool("draw");\n    setGardenSeed(null);\n    setSpace("draw");\n  }\n\n  function continueRecentFromHome() {\n    const recent = recentProject ?? (projectRef.current.strokes.length ? projectRef.current : null);\n    if (!recent) {\n      setSpace("draw");\n      return;\n    }\n    stop();\n    history.current = [];\n    future.current = [];\n    update(structuredClone(recent));\n    setTool("draw");\n    setGardenSeed(null);\n    setSpace("draw");\n  }\n\n  return (\n    <div className={\`app-shell space-\${space}\`}>\n`,
);

replaceOnce(
  "brand mark",
  `          <Logo />\n`,
  `          <BrandSymbol compact />\n`,
);

replaceOnce(
  "space nav",
  `        <nav className="space-nav" aria-label={t("制作スペース")}>\n          <button aria-pressed={space === "draw"} onClick={() => { stop(); setSpace("draw"); setGardenSeed(null); }}><Pencil size={15} /> DRAW</button>\n          <button aria-pressed={space === "garden"} onClick={() => { stop(); setSpace("garden"); }}>GARDEN <Music2 size={15} /></button>\n        </nav>\n`,
  `        <nav className="space-nav" aria-label={t("制作スペース")}>\n          <button aria-pressed={space === "home"} onClick={() => { stop(); setSpace("home"); setGardenSeed(null); }}>HOME</button>\n          <button aria-pressed={space === "draw"} onClick={() => { stop(); setSpace("draw"); setGardenSeed(null); }}><Pencil size={15} /> STUDIO</button>\n          <button aria-pressed={space === "garden"} onClick={() => { stop(); setSpace("garden"); }}>GARDEN <Music2 size={15} /></button>\n        </nav>\n`,
);

replaceOnce(
  "home insertion",
  `      <GardenView active={space === "garden"} seed={gardenSeed} onSeedPlaced={() => setGardenSeed(null)}\n        onDraw={() => { setSpace("draw"); setGardenSeed(null); }} />\n`,
  `      <HomeView\n        active={space === "home"}\n        recent={recentProject}\n        onStart={startFreshFromHome}\n        onContinue={continueRecentFromHome}\n        onGarden={() => { stop(); setGardenSeed(null); setSpace("garden"); }}\n      />\n      <GardenView active={space === "garden"} seed={gardenSeed} onSeedPlaced={() => setGardenSeed(null)}\n        onDraw={() => { setSpace("draw"); setGardenSeed(null); }} />\n`,
);

fs.writeFileSync(path, source);
console.log("Brand & Home patch applied to src/App.tsx");
// workflow trigger
