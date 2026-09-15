import { useEffect, useMemo, useState } from "react";
import App from "./App";
import { HomeView } from "./home/HomeView";
import { loadRecentProject, rememberRecentProject } from "./home/recentProject";
import { emptyProject, loadProject, STORAGE_KEY } from "./music/project";
import type { Project } from "./music/types";
import { MobileStudioChrome } from "./ui/MobileStudioChrome";
import "./root-shell.css";

type Destination = "draw" | "garden";

function writeCurrentProject(project: Project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // App will surface storage failure once Studio opens.
  }
}

export function RootShell() {
  const [surface, setSurface] = useState<"home" | "app">("home");
  const [destination, setDestination] = useState<Destination>("draw");
  const [homeVersion, setHomeVersion] = useState(0);

  const current = useMemo(() => loadProject(), [homeVersion]);
  const recent = useMemo(
    () => loadRecentProject() ?? (current.strokes.length ? current : null),
    [current, homeVersion],
  );

  useEffect(() => {
    if (surface !== "app") return;
    const frame = requestAnimationFrame(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".space-nav button"));
      const target = destination === "garden" ? buttons[1] : buttons[0];
      target?.click();
    });
    return () => cancelAnimationFrame(frame);
  }, [destination, surface]);

  function open(destination: Destination) {
    setDestination(destination);
    setSurface("app");
  }

  function startFresh() {
    if (current.strokes.length) rememberRecentProject(current);
    writeCurrentProject(emptyProject());
    open("draw");
  }

  function continueRecent() {
    if (recent) writeCurrentProject(recent);
    open("draw");
  }

  function visitGarden() {
    open("garden");
  }

  if (surface === "home") {
    return (
      <HomeView
        active
        recent={recent}
        onStart={startFresh}
        onContinue={continueRecent}
        onGarden={visitGarden}
      />
    );
  }

  return (
    <div className="product-app-shell" data-destination={destination}>
      <App />
      <MobileStudioChrome />
      <button
        type="button"
        className="return-home"
        aria-label="HOME"
        onClick={() => {
          setHomeVersion((value) => value + 1);
          setSurface("home");
        }}
      >
        HOME
      </button>
    </div>
  );
}
