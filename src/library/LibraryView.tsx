import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Check, Copy, Download, LoaderCircle, Pencil, Play, Plus, Share2, Square, Trash2, Undo2, X } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import type { Project } from "../music/types";
import { AudioEngine } from "../music/audio";
import { projectMusic } from "../music/arrangement";
import { download } from "../music/export";
import { ArtworkPreview } from "./ArtworkPreview";
import { deleteArtwork, duplicateArtwork, listArtworks, renameArtwork, restoreArtwork, type Artwork } from "./store";
import "./library.css";
import { LibraryBackup } from "./LibraryBackup";

export function LibraryView({ onOpen, onNew, onShare, onDeleted, onRenamed }: {
  onOpen: (item: Artwork) => void;
  onNew: () => void;
  onShare: (project: Project) => void;
  onDeleted: (id: string) => void;
  onRenamed: (item: Artwork) => void;
}) {
  const { language } = useLanguage();
  const ja = language === "ja";
  const [items, setItems] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [removed, setRemoved] = useState<Artwork | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const engine = useRef(new AudioEngine());
  const generation = useRef(0);
  const endTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const stop = useCallback(() => {
    generation.current++;
    engine.current.stop();
    clearTimeout(endTimer.current);
    setPlaying(null);
  }, []);
  const reload = useCallback(async () => {
    const rows = await listArtworks();
    if (mounted.current) setItems(rows);
  }, []);
  useEffect(() => {
    mounted.current = true;
    void reload().catch(() => { if (mounted.current) setError(language === "ja" ? "作品帳を開けませんでした。再読み込みをお試しください。" : "Couldn’t open your sketchbook. Please retry."); })
      .finally(() => { if (mounted.current) setLoading(false); });
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { mounted.current = false; stop(); engine.current.dispose(); document.removeEventListener("visibilitychange", visibility); };
  }, [reload, stop, language]);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); await reload(); }
    catch { if (mounted.current) setError(ja ? "変更を保存できませんでした。空き容量などを確認して、もう一度お試しください。" : "Couldn’t save the change. Check available storage and try again."); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function listen(item: Artwork) {
    const wasPlaying = playing === item.id;
    stop();
    if (wasPlaying) return;
    const token = generation.current;
    setPlaying(item.id); setError("");
    try {
      const timing = await engine.current.play(projectMusic(item.project), item.project.instrument);
      if (token !== generation.current) { engine.current.stop(); return; }
      endTimer.current = setTimeout(stop, (timing.seconds + 1.4) * 1000);
    } catch { if (token !== generation.current) return; stop(); setError(ja ? "音を開始できませんでした。もう一度お試しください。" : "Couldn’t play. Please try again."); }
  }
  const date = (at: number) => new Intl.DateTimeFormat(ja ? "ja-JP" : "en", { month: "short", day: "numeric" }).format(at);

  return <main className="library-view">
    <header className="library-heading">
      <div><p className="collection-eyebrow">{ja ? "描いた日も、鳴った音も。" : "Little drawings. Lasting melodies."}</p><h1>{ja ? "わたしの作品帳" : "My sketchbook"}</h1><p>{ja ? "お気に入りをひらいて、また聴こう。" : "Open a favorite. Hear it come to life again."}</p></div>
      <button className="collection-primary" onClick={() => { stop(); onNew(); }}><Plus size={20} />{ja ? "新しく描く" : "New drawing"}</button>
    </header>
    <div className="library-meta"><span><BookOpen size={17} />{ja ? `${items.length} 作品` : `${items.length} creations`}</span><span>{ja ? "この端末のブラウザに保存" : "Saved in this browser on this device"}</span></div>
    <LibraryBackup count={items.length} onRestore={reload} onOpen={stop} />
    {error && <div className="collection-error" role="alert">{error}<button className="collection-text-button" disabled={busy} onClick={() => void perform(async () => undefined)}>{ja ? "再読み込み" : "Retry"}</button></div>}
    {message && <p className="collection-message" role="status">{message}</p>}
    {removed && <div className="library-undo" role="status"><span>{ja ? `「${removed.project.title}」を作品帳から外しました。` : `Removed “${removed.project.title}” from your sketchbook.`}</span><button disabled={busy} onClick={() => void perform(async () => { await restoreArtwork(removed); setRemoved(null); })}><Undo2 size={16} />{ja ? "元に戻す" : "Undo"}</button></div>}
    {loading ? <p className="library-loading" role="status"><LoaderCircle className="spin" size={24} />{ja ? "作品をひらいています…" : "Opening your sketchbook…"}</p> : !items.length && !error ? <section className="library-empty">
      <div className="library-empty-mark" aria-hidden="true"><BookOpen size={64} strokeWidth={1} /><span>♪</span></div>
      <h2>{ja ? "最初の一枚を、この場所に。" : "A home for your first creation."}</h2>
      <p>{ja ? "絵を描いたら「作品帳に残す」を押してね。\n絵と音を、いっしょにしまっておけます。" : "After drawing, choose “Save to sketchbook”.\nYour picture and its music will stay together."}</p>
      <button className="collection-secondary" onClick={onNew}><Pencil size={18} />{ja ? "描いてみる" : "Start drawing"}</button>
    </section> : <div className="library-grid">
      {items.map(item => <article className="artwork-card" key={item.id} aria-label={item.project.title}>
        <button className={`artwork-listen ${playing === item.id ? "is-playing" : ""}`} aria-label={playing === item.id ? (ja ? `${item.project.title}の再生を止める` : `Stop ${item.project.title}`) : (ja ? `${item.project.title}を聴く` : `Listen to ${item.project.title}`)} onClick={() => void listen(item)}>
          <ArtworkPreview project={item.project} /><span className="artwork-play">{playing === item.id ? <Square size={17} /> : <Play size={18} />}<span>{playing === item.id ? (ja ? "とめる" : "Stop") : (ja ? "聴く" : "Listen")}</span></span>
        </button>
        <div className="artwork-details">
          {editing === item.id ? <form className="artwork-rename" onSubmit={event => { event.preventDefault(); void perform(async () => { const next = await renameArtwork(item.id, title); onRenamed(next); setEditing(null); }); }}>
            <input autoFocus aria-label={ja ? "作品の新しい名前" : "New artwork name"} value={title} maxLength={80} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setEditing(null); }} />
            <button className="collection-icon" disabled={busy || !title.trim()} aria-label={ja ? "名前を保存" : "Save name"}><Check size={18} /></button>
            <button type="button" className="collection-icon" aria-label={ja ? "名前の変更をやめる" : "Cancel rename"} onClick={() => setEditing(null)}><X size={18} /></button>
          </form> : <div className="artwork-title"><h2>{item.project.title}</h2><button className="collection-icon" aria-label={ja ? `${item.project.title}の名前を変える` : `Rename ${item.project.title}`} onClick={() => { setEditing(item.id); setTitle(item.project.title); }}><Pencil size={15} /></button></div>}
          <p className="artwork-date">{date(item.updatedAt)}<span>·</span>{ja ? `${item.project.strokes.length} 本の線` : `${item.project.strokes.length} strokes`}</p>
          <div className="artwork-actions"><button className="collection-secondary" onClick={() => { stop(); onOpen(item); }}><Pencil size={16} />{ja ? "続きを描く" : "Open"}</button><button className="collection-text-button" onClick={() => { stop(); onShare(item.project); }}><Share2 size={17} />{ja ? "音つきで共有" : "Share with sound"}</button></div>
          <div className="artwork-tools"><button disabled={busy} onClick={() => void perform(async () => { await duplicateArtwork(item, ja ? " のコピー" : " (copy)"); setMessage(ja ? "コピーを作品帳に残しました。" : "Saved a copy to your sketchbook."); })}><Copy size={14} />{ja ? "複製" : "Duplicate"}</button>
            <button onClick={() => download(new Blob([JSON.stringify(item.project, null, 2)], { type: "application/json" }), item.project.title, "json")}><Download size={14} />{ja ? "作品ファイル" : "Project file"}</button>
            <button disabled={busy} aria-label={ja ? `${item.project.title}を作品帳から外す` : `Remove ${item.project.title}`} onClick={() => void perform(async () => { stop(); await deleteArtwork(item.id); onDeleted(item.id); setRemoved(item); })}><Trash2 size={15} /></button>
          </div>
        </div>
      </article>)}
    </div>}
    {!!items.length && <p className="library-footnote">{ja ? "ブラウザのデータを消すと作品帳も消えます。大切な作品は「作品ファイル」で持ち帰ってね。" : "Clearing browser data also clears your sketchbook. Download a project file to keep a backup of your favorites."}</p>}
  </main>;
}

