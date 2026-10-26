import { useCallback, useRef, useState } from "react";
import { BookOpen, Home, Pencil, Sprout } from "lucide-react";
import App from "./App";
import { HomeView } from "./home/HomeView";
import { loadRecentProject, rememberRecentProject } from "./home/recentProject";
import { emptyProject, loadProject, STORAGE_KEY } from "./music/project";
import type { Project } from "./music/types";
import { useLanguage } from "./i18n/LanguageContext";
import { LibraryView } from "./library/LibraryView";
import { activeArtworkId, rememberActiveArtwork, saveArtwork, type Artwork } from "./library/store";
import { ShareDialog } from "./share/ShareDialog";
import "./root-shell.css";
import { AppAvailability } from "./product/AppAvailability";

type Surface = "home" | "studio" | "library" | "garden";
type AppSpace = "draw" | "garden";

export function RootShell() {
  const { language } = useLanguage();
  const ja = language === "ja";
  const [surface, setSurface] = useState<Surface>("home");
  const [initial] = useState(loadProject);
  const draft = useRef(initial);
  const [artworkId, setArtworkId] = useState(() => activeArtworkId(initial));
  const artworkIdRef = useRef(artworkId);
  const session = useRef(0);
  const [sharing, setSharing] = useState<Project | null>(null);
  const shareOpener = useRef<HTMLElement | null>(null);

  const rememberDraft = useCallback((project: Project) => {
    draft.current = project;
    rememberActiveArtwork(artworkIdRef.current, project);
  }, []);
  const selectArtwork = useCallback((id: string | null) => {
    artworkIdRef.current = id;
    setArtworkId(id);
    rememberActiveArtwork(id, draft.current);
  }, []);
  const detachArtwork = useCallback(() => { session.current++; selectArtwork(null); }, [selectArtwork]);
  const persistDraft = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft.current)); rememberActiveArtwork(artworkIdRef.current, draft.current); return true; } catch { return false; }
  };
  const keepArtwork = useCallback(async (project: Project) => {
    const token = session.current;
    const item = await saveArtwork(project, artworkIdRef.current);
    if (token === session.current) selectArtwork(item.id);
  }, [selectArtwork]);

  function startFresh() {
    if (draft.current.strokes.length) rememberRecentProject(draft.current);
    draft.current = emptyProject();
    detachArtwork(); persistDraft(); setSurface("studio");
  }
  function continueRecent() {
    if (surface === "garden") { setSurface("studio"); return; }
    if (!draft.current.strokes.length) {
      const previous = loadRecentProject();
      if (previous) { draft.current = previous; detachArtwork(); persistDraft(); }
    }
    setSurface("studio");
  }
  function openArtwork(item: Artwork) {
    if (draft.current.strokes.length) rememberRecentProject(draft.current);
    draft.current = structuredClone(item.project);
    session.current++;
    selectArtwork(item.id); persistDraft(); setSurface("studio");
  }
  const shareArtwork = useCallback((project: Project) => {
    shareOpener.current = document.activeElement as HTMLElement;
    setSharing(structuredClone(project));
  }, []);
  const syncAppSpace = useCallback((space: AppSpace) => setSurface(space === "garden" ? "garden" : "studio"), []);
  const recent = draft.current.strokes.length ? draft.current : loadRecentProject();

  return <div className="product-root" data-surface={surface}>
    {surface === "home" ? <HomeView active recent={recent} onStart={startFresh} onContinue={continueRecent}
      onGarden={() => setSurface("garden")} />
      : surface === "library" ? <LibraryView onOpen={openArtwork} onNew={startFresh} onShare={shareArtwork}
        onDeleted={id => { if (artworkIdRef.current === id) detachArtwork(); }}
        onRenamed={item => {
          if (artworkIdRef.current === item.id) { draft.current = { ...draft.current, title: item.project.title }; persistDraft(); }
        }} />
      : <div className="product-app-shell"><App initialSpace={surface === "garden" ? "garden" : "draw"}
        initialProject={draft.current} onProjectChange={rememberDraft} onSpaceChange={syncAppSpace}
        artworkId={artworkId} onNewArtwork={detachArtwork} onSaveArtwork={keepArtwork} onShare={shareArtwork} onOpenLibrary={() => setSurface("library")} /></div>}
    <AppAvailability active={surface === "home"} beforeUpdate={persistDraft} />
    <nav className="product-bottom-nav" aria-label={ja ? "メインナビゲーション" : "Main navigation"}>
      <button className={surface === "home" ? "active" : ""} aria-current={surface === "home" ? "page" : undefined} onClick={() => setSurface("home")}><Home size={23} /><span>{ja ? "ホーム" : "Home"}</span></button>
      <button className={surface === "studio" ? "active" : ""} aria-current={surface === "studio" ? "page" : undefined} onClick={continueRecent}><Pencil size={23} /><span>{ja ? "スタジオ" : "Studio"}</span></button>
      <button className={surface === "library" ? "active" : ""} aria-current={surface === "library" ? "page" : undefined} onClick={() => setSurface("library")}><BookOpen size={23} /><span>{ja ? "作品帳" : "Sketchbook"}</span></button>
      <button className={surface === "garden" ? "active" : ""} aria-current={surface === "garden" ? "page" : undefined} onClick={() => setSurface("garden")}><Sprout size={24} /><span>{ja ? "ガーデン" : "Garden"}</span></button>
    </nav>
    {sharing && <ShareDialog project={sharing} onClose={() => {
      setSharing(null);
      requestAnimationFrame(() => shareOpener.current?.focus());
    }} />}
  </div>;
}
