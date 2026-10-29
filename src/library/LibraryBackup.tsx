import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen, LoaderCircle, X } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { countEn } from "../i18n/messages";
import { download } from "../music/export";
import { listArtworks, importSketchbook } from "./store";
import { backupFile, MAX_BACKUP_BYTES, parseBackup, type SketchbookBackup } from "./backup";

export function LibraryBackup({ count, onRestore, onOpen }: { count: number; onRestore: () => Promise<void>; onOpen: () => void }) {
  const { language } = useLanguage(); const ja = language === "ja";
  const input = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLButtonElement>(null);
  const alive = useRef(true), locked = useRef(false);
  const [backup, setBackup] = useState<SketchbookBackup | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (backup) dialog.current?.showModal(); else dialog.current?.close(); }, [backup]);
  const close = () => { if (locked.current) return; dialog.current?.close(); setBackup(null); opener.current?.focus(); };
  async function exportAll() {
    if (locked.current) return; locked.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const blob = backupFile(await listArtworks());
      if (alive.current) {
        download(blob, "picture-score-sketchbook-" + new Date().toISOString().slice(0, 10), "json");
        setMessage(ja ? "バックアップの保存を開始しました。ダウンロード先を確認してください。" : "Backup download started. Check your downloads.");
      }
    } catch { if (alive.current) setError(ja ? "まとめて保存できませんでした。各作品の「作品ファイル」からも保存できます。" : "Couldn’t create a backup. You can still download individual project files."); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function restore() {
    if (!backup || locked.current) return; locked.current = true; setBusy(true); setError("");
    try {
      const result = await importSketchbook(backup);
      if (alive.current) {
        setBackup(null); dialog.current?.close(); opener.current?.focus();
        setMessage(ja ? result.added + "作品を追加しました。" + result.skipped + "作品は同じ内容のためそのままです。" : "Added " + countEn(result.added, "creation") + ". " + countEn(result.skipped, "unchanged creation") + " skipped.");
        try { await onRestore(); } catch { if (alive.current) setError(ja ? "作品は追加しました。表示を更新できなかったため、作品帳を開き直してください。" : "Creations were added. Reopen the sketchbook to refresh the list."); }
      }
    } catch { if (alive.current) setError(ja ? "読み込めませんでした。空き容量を確認して再度お試しください。今ある作品はそのままです。" : "Couldn’t import. Check storage and try again. Existing works are unchanged."); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="library-backup" aria-label={ja ? "作品帳のバックアップ" : "Sketchbook backup"}>
    <div><button className="collection-text-button" disabled={busy || !count} onClick={() => void exportAll()}><Download size={16} />{ja ? "作品帳をまとめて保存" : "Back up sketchbook"}</button>
      <button ref={opener} className="collection-text-button" disabled={busy} onClick={() => { onOpen(); setError(""); setMessage(""); input.current?.click(); }}><FolderOpen size={16} />{ja ? "バックアップを読み込む" : "Import backup"}</button></div>
    <small>{ja ? "機種変更やブラウザのデータ削除に備えて、ファイルで持ち帰れます。" : "Keep a file before changing devices or clearing browser data."}</small>
    {message && <p className="collection-message" role="status">{message}</p>}
    {error && !backup && <p className="collection-error" role="alert">{error}</p>}
    <input className="sr-only" ref={input} type="file" accept=".json,application/json" aria-label={ja ? "作品帳バックアップファイル" : "Sketchbook backup file"}
      onChange={async event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return;
        setError(""); setMessage(""); setBusy(true); locked.current = true;
        try {
          if (file.size > MAX_BACKUP_BYTES) throw new Error("too-large");
          const parsed = parseBackup(JSON.parse(await file.text()));
          if (alive.current) setBackup(parsed);
        } catch { if (alive.current) setError(ja ? "このファイルは読み込めません。50MB以下の作品帳バックアップを選んでください。1作品のファイルはスタジオから開けます。" : "Choose a valid sketchbook backup under 50 MB. Open single project files from Studio."); }
        finally { locked.current = false; if (alive.current) setBusy(false); }
      }} />
    <dialog ref={dialog} className="creation-dialog backup-dialog" aria-labelledby="backup-title" onCancel={e => { e.preventDefault(); close(); }}>
      <header><h2 id="backup-title">{ja ? "作品帳に追加しよう" : "Add to your sketchbook"}</h2><button className="collection-icon" disabled={busy} aria-label={ja ? "読み込みをやめる" : "Cancel import"} onClick={close}><X size={22} /></button></header>
      <p>{ja ? (backup?.artworks.length ?? 0) + "作品のバックアップです。" : countEn(backup?.artworks.length ?? 0, "creation") + " in this backup."}</p>
      <p className="creation-hint">{ja ? "今ある作品は消えません。同じ作品は重ねず、内容が違うものは別の作品として追加します。" : "Existing works stay safe. Identical works are skipped; changed works are added separately."}</p>
      {error && <p role="alert" className="collection-error">{error}</p>}
      <button className="collection-primary" disabled={busy || !backup?.artworks.length} onClick={() => void restore()}>{busy && <LoaderCircle size={18} className="spin" />}{ja ? "作品を追加する" : "Add creations"}</button>
    </dialog>
  </section>;
}
