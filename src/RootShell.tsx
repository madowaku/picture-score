import { useCallback, useMemo, useState } from "react";
import { Home, Pencil, Sprout } from "lucide-react";
import App from "./App";
import { HomeView } from "./home/HomeView";
import { loadRecentProject, rememberRecentProject } from "./home/recentProject";
import { emptyProject, loadProject, STORAGE_KEY } from "./music/project";
import type { Project } from "./music/types";
import { useLanguage } from "./i18n/LanguageContext";
import "./root-shell.css";

type Surface = "home" | "studio" | "garden";
type AppSpace = "draw" | "garden";

function writeCurrentProject(project: Project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Studio reports storage problems when it opens.
  }
}

export function RootShell() {
  const { language } = useLanguage();
  const ja = language === "ja";
  const [surface, setSurface] = useState<Surface>("home");
  const [homeVersion, setHomeVersion] = useState(0);

  const current = useMemo(() => loadProject(), [homeVersion]);
  const recent = useMemo(
    () => (current.strokes.length ? current : loadRecentProject()),
    [current],
  );

  function openHome() {
    setHomeVersion((value) => value + 1);
    setSurface("home");
  }

  function startFresh() {
    if (current.strokes.length) rememberRecentProject(current);
    writeCurrentProject(emptyProject());
    setSurface("studio");
  }

  function continueRecent() {
    if (recent) writeCurrentProject(recent);
    setSurface("studio");
  }

  function openGarden() {
    setSurface("garden");
  }

  const appSpace: AppSpace = surface === "garden" ? "garden" : "draw";
  const syncAppSpace = useCallback((space: AppSpace) => {
    setSurface(space === "garden" ? "garden" : "studio");
  }, []);

  return (
    <div className="product-root" data-surface={surface}>
      {surface === "home" ? (
        <HomeView
          active
          recent={recent}
          onStart={startFresh}
          onContinue={continueRecent}
          onGarden={openGarden}
        />
      ) : (
        <div className="product-app-shell">
          <App initialSpace={appSpace} onSpaceChange={syncAppSpace} />
        </div>
      )}

      <nav
        className="product-bottom-nav"
        aria-label={ja ? "メインナビゲーション" : "Main navigation"}
      >
        <button
          type="button"
          className={surface === "home" ? "active" : ""}
          aria-current={surface === "home" ? "page" : undefined}
          onClick={openHome}
        >
          <Home size={23} />
          <span>{ja ? "ホーム" : "Home"}</span>
        </button>
        <button
          type="button"
          className={surface === "studio" ? "active" : ""}
          aria-current={surface === "studio" ? "page" : undefined}
          onClick={() => {
            if (surface === "home") recent ? continueRecent() : startFresh();
            else setSurface("studio");
          }}
        >
          <Pencil size={23} />
          <span>{ja ? "スタジオ" : "Studio"}</span>
        </button>
        <button
          type="button"
          className={surface === "garden" ? "active" : ""}
          aria-current={surface === "garden" ? "page" : undefined}
          onClick={openGarden}
        >
          <Sprout size={24} />
          <span>{ja ? "ガーデン" : "Garden"}</span>
        </button>
      </nav>
    </div>
  );
}
