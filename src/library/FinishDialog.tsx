import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, LoaderCircle, Play, Share2, Sprout, Square, X } from "lucide-react";
import type { Project } from "../music/types";
import { useLanguage } from "../i18n/LanguageContext";
import { ArtworkPreview } from "./ArtworkPreview";

export function FinishDialog({ project, updating, playing, gardenFull = false, onListen, onSave, onPlant, onShare, onLibrary, onClose }: {
  project: Project; updating: boolean; playing: boolean; gardenFull?: boolean; onListen: () => void;
  onSave: (title: string) => Promise<void>; onPlant?: () => void; onShare?: () => void; onLibrary?: () => void; onClose: () => void;
}) {
  const { language } = useLanguage();
  const ja = language === "ja";
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(true), saving = useRef(false);
  const [title, setTitle] = useState(project.title.startsWith("Untitled") ? "" : project.title);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState("");
  // The Garden keeps its own copy, so a failed sketchbook save must not block planting.
  const [plantOnly, setPlantOnly] = useState(false);
  useEffect(() => {
    alive.current = true;
    const element = dialog.current!;
    element.showModal();
    return () => { alive.current = false; element.close(); };
  }, []);
  async function save(): Promise<boolean> {
    if (saving.current) return false;
    saving.current = true; setBusy(true); setError("");
    try {
      await onSave(title.trim() || (ja ? "わたしの音の絵" : "My musical drawing"));
      if (alive.current) setSaved(true);
      return true;
    } catch {
      if (alive.current) setError(ja ? "作品帳に保存できませんでした。絵は残っています。もう一度お試しください。" : "Couldn’t save to your sketchbook. Your drawing is still here. Please try again.");
      return false;
    } finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  async function plant() {
    if (!onPlant) return;
    if (saved || plantOnly) { onPlant(); return; }
    if (await save()) onPlant();
    else if (alive.current) setPlantOnly(true);
  }
  const plantButton = onPlant && <button type="button" className="collection-primary finish-plant" disabled={busy} onClick={() => void plant()}>
    {busy ? <LoaderCircle className="spin" size={18} /> : <Sprout size={18} />}
    <span>{plantOnly ? (ja ? "庭にだけ植える" : "Plant in garden only") : (ja ? "庭に植える" : "Plant in garden")}
      {!saved && !plantOnly && <small>{ja ? "作品帳にも残ります" : "Also kept in your sketchbook"}</small>}</span>
  </button>;
  const fullNote = onPlant && gardenFull && <p className="creation-hint finish-garden-full">
    {ja ? "庭は12作品でいっぱいです。植えるときに、休ませる作品を選べます。" : "Your garden is full with 12 artworks. You can choose one to rest when you plant."}</p>;
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
        <p className="creation-hint">{onPlant ? (ja ? "庭に植えると、音の庭で鳴りはじめます。" : "Plant it and it starts playing in your sound garden.") : (ja ? "絵と音を、このブラウザの作品帳に残します。" : "Keep the picture and sound in this browser’s sketchbook.")}</p>
        {plantButton}
        {fullNote}
        <button className={onPlant ? "collection-secondary" : "collection-primary"} disabled={busy} type="submit">
          {busy ? <LoaderCircle className="spin" size={18} /> : <BookOpen size={18} />}
          {busy ? (ja ? "残しています…" : "Saving…") : updating ? (ja ? "作品帳を更新" : "Update sketchbook") : (ja ? "作品帳に残す" : "Save to sketchbook")}
        </button>
      </form>}
    {error && <p className="creation-error" role="alert">{error}</p>}
    {saved && plantButton}
    {saved && fullNote}
    {saved && onShare && <button className={onPlant ? "collection-secondary finish-share" : "collection-primary"} onClick={onShare}><Share2 size={18} />{ja ? "音つきで共有" : "Share with sound"}</button>}
    <div className="finish-actions">
      <button className="collection-secondary" disabled={busy} onClick={onListen}>{playing ? <Square size={16} /> : <Play size={16} />}{playing ? (ja ? "とめる" : "Stop") : (ja ? "きいてみる" : "Listen")}</button>
      {saved && onLibrary && <button className="collection-secondary" onClick={onLibrary}><BookOpen size={17} />{ja ? "作品帳を見る" : "View sketchbook"}</button>}
    </div>
    {saved && <button className="collection-text-button finish-back" onClick={onClose}>{ja ? "もう少し描く" : "Keep drawing"}</button>}
  </dialog>;
}
