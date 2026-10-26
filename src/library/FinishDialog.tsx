import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, LoaderCircle, Play, Share2, Square, X } from "lucide-react";
import type { Project } from "../music/types";
import { useLanguage } from "../i18n/LanguageContext";
import { ArtworkPreview } from "./ArtworkPreview";

export function FinishDialog({ project, updating, playing, onListen, onSave, onShare, onLibrary, onClose }: {
  project: Project; updating: boolean; playing: boolean; onListen: () => void;
  onSave: (title: string) => Promise<void>; onShare?: () => void; onLibrary?: () => void; onClose: () => void;
}) {
  const { language } = useLanguage();
  const ja = language === "ja";
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(true), saving = useRef(false);
  const [title, setTitle] = useState(project.title.startsWith("Untitled") ? "" : project.title);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    const element = dialog.current!;
    element.showModal();
    return () => { alive.current = false; element.close(); };
  }, []);
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      await onSave(title.trim() || (ja ? "わたしの音の絵" : "My musical drawing"));
      if (alive.current) setSaved(true);
    } catch {
      if (alive.current) setError(ja ? "作品帳に保存できませんでした。絵は残っています。もう一度お試しください。" : "Couldn’t save to your sketchbook. Your drawing is still here. Please try again.");
    } finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  return <dialog ref={dialog} className="finish-dialog creation-dialog" aria-labelledby="finish-title"
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header><div><p className="collection-eyebrow">{ja ? "線から生まれた、ひとつの作品。" : "A little creation, made by you."}</p>
      <h2 id="finish-title">{saved ? (ja ? "作品帳に残したよ。" : "Safe in your sketchbook.") : (ja ? "できたね！" : "You made it!")}</h2></div>
      <button className="collection-icon" disabled={busy} aria-label={ja ? "描く画面へ戻る" : "Back to drawing"} onClick={onClose}><X size={22} /></button></header>
    <ArtworkPreview project={project} />
    {saved ? <p className="finish-saved"><Check size={18} /><strong>{project.title}</strong></p> :
      <form onSubmit={e => { e.preventDefault(); void save(); }}>
        <label htmlFor="finish-name">{ja ? "作品に名前をつけよう" : "Give your creation a name"}</label>
        <input id="finish-name" maxLength={80} value={title} disabled={busy} placeholder={ja ? "わたしの音の絵" : "My musical drawing"}
          onChange={e => setTitle(e.target.value)} />
        <p className="creation-hint">{ja ? "絵と音を、このブラウザの作品帳に残します。" : "Keep the picture and sound in this browser’s sketchbook."}</p>
        <button className="collection-primary" disabled={busy} type="submit">
          {busy ? <LoaderCircle className="spin" size={18} /> : <BookOpen size={18} />}
          {busy ? (ja ? "残しています…" : "Saving…") : updating ? (ja ? "作品帳を更新" : "Update sketchbook") : (ja ? "作品帳に残す" : "Save to sketchbook")}
        </button>
      </form>}
    {error && <p className="creation-error" role="alert">{error}</p>}
    {saved && onShare && <button className="collection-primary" onClick={onShare}><Share2 size={18} />{ja ? "音つきで共有" : "Share with sound"}</button>}
    <div className="finish-actions">
      <button className="collection-secondary" disabled={busy} onClick={onListen}>{playing ? <Square size={16} /> : <Play size={16} />}{playing ? (ja ? "とめる" : "Stop") : (ja ? "きいてみる" : "Listen")}</button>
      {saved && onLibrary && <button className="collection-secondary" onClick={onLibrary}><BookOpen size={17} />{ja ? "作品帳を見る" : "View sketchbook"}</button>}
    </div>
    {saved && <button className="collection-text-button finish-back" onClick={onClose}>{ja ? "もう少し描く" : "Keep drawing"}</button>}
  </dialog>;
}
