import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Film, Image, LoaderCircle, Music2, Share2, X } from "lucide-react";
import type { Project } from "../music/types";
import { useLanguage } from "../i18n/LanguageContext";
import { projectMusic } from "../music/arrangement";
import { renderAudio } from "../music/audio";
import { download, pictureFile } from "../music/export";
import { createVideoPainter, type ShareShape } from "./painter";
import { recordArtwork, videoCapability, videoExtension } from "./video";
import "./share.css";
import { PUBLIC_WEB_URL } from "../product/config";

export function ShareDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { language } = useLanguage();
  const ja = language === "ja";
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const job = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const [shape, setShape] = useState<ShareShape>("square");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const music = useMemo(() => projectMusic(project), [project]);
  const capability = videoCapability();
  const duration = Math.ceil(music.lengthBeats * 60 / project.tempo + 1.4);
  const caption = ja ? `「${project.title}」を描いて、音楽にしてみました。 #PictureScore #お絵かき音楽` : `I drew “${project.title}” and turned it into music. #PictureScore #DrawingMusic`;
  const shareCaption = caption + (PUBLIC_WEB_URL ? "\n" + PUBLIC_WEB_URL : "");
  const file = useMemo(() => blob ? new File([blob], `${project.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim() || "Picture Score"}.${videoExtension(blob.type)}`, { type: blob.type.split(";")[0] }) : null, [blob, project.title]);
  let canShare = false;
  try { canShare = !!file && typeof navigator.share === "function" && !!navigator.canShare?.({ files: [file] }); } catch { /* Offer download. */ }

  useEffect(() => {
    alive.current = true;
    const element = dialog.current!;
    element.showModal();
    return () => {
      alive.current = false;
      job.current?.abort();
      element.close();
    };
  }, []);
  useEffect(() => {
    if (!blob) { setUrl(""); return; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  useEffect(() => {
    if (canvas.current && !busy) createVideoPainter(canvas.current, project, music, shape)(null);
  }, [project, music, shape, busy]);

  function close() {
    video.current?.pause();
    job.current?.abort();
    onClose();
  }
  async function generate() {
    if (job.current || !canvas.current) return;
    const controller = new AbortController();
    job.current = controller;
    video.current?.pause();
    setBlob(null); setProgress(0); setMessage(""); setError(""); setBusy(true);
    try {
      const result = await recordArtwork(project, shape, canvas.current, {
        signal: controller.signal, onProgress: fraction => { if (alive.current) setProgress(fraction); },
      });
      if (alive.current && !controller.signal.aborted) setBlob(result);
    } catch (cause) {
      if (alive.current && !controller.signal.aborted) setError(cause instanceof Error && cause.message === "video-background"
        ? (ja ? "画面を離れたので作成を止めました。この画面を開いたまま、もう一度お試しください。" : "Creation stopped when you left this screen. Keep it open and try again.")
        : (ja ? "動画を作れませんでした。もう一度試すか、絵と音を別々に保存できます。" : "Couldn’t create the video. Try again, or save the picture and audio separately."));
    } finally {
      job.current = null;
      if (alive.current) setBusy(false);
    }
  }
  async function share() {
    if (!file || sharing) return;
    video.current?.pause(); setError(""); setMessage(""); setSharing(true);
    try {
      await navigator.share({ files: [file] });
      if (alive.current) setMessage(ja ? "共有先に渡しました。投稿内容は共有先で確認してください。" : "Sent to your chosen app. Review your post there.");
    } catch (cause) {
      if (alive.current && !(cause instanceof DOMException && cause.name === "AbortError"))
        setError(ja ? "共有画面を開けませんでした。「動画を保存」から投稿できます。" : "Couldn’t open sharing. Save the video and upload it instead.");
    } finally { if (alive.current) setSharing(false); }
  }
  async function saveFallback(kind: "png" | "wav") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = kind === "png" ? await pictureFile(project, music.drawing, language) : await renderAudio(music, project.instrument);
      if (alive.current) download(result, project.title, kind);
    } catch { if (alive.current) setError(ja ? "保存できませんでした。もう一度お試しください。" : "Couldn’t save. Please try again."); }
    finally { if (alive.current) setBusy(false); }
  }

  return <dialog ref={dialog} className="share-dialog" aria-labelledby="share-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="share-heading">
      <div><p className="collection-eyebrow">{ja ? "絵と音を、ひとつに。" : "Your picture. Your music."}</p><h2 id="share-title">{ja ? "音つきで、届けよう。" : "Send a little music."}</h2></div>
      <button className="collection-icon" aria-label={ja ? "共有を閉じる" : "Close sharing"} onClick={close}><X size={23} /></button>
    </header>
    <div className="share-body">
      <div className={`share-stage ${shape}`}>
        <canvas ref={canvas} aria-label={ja ? "共有する作品のプレビュー" : "Artwork preview"} hidden={!!url && !busy} />
        {url && !busy && <video ref={video} src={url} controls playsInline preload="metadata" aria-label={ja ? "音つき動画のプレビュー" : "Video preview with sound"} />}
        {!blob && !busy && <span className="share-stage-caption"><Music2 size={14} />{ja ? `音つき・約${duration}秒` : `With sound · about ${duration}s`}</span>}
      </div>
      <div className="share-options">
        <p className="share-work-title">{project.title}</p>
        <fieldset className="share-shapes" disabled={busy || sharing}><legend>{ja ? "動画のかたち" : "Video shape"}</legend>
          <button aria-pressed={shape === "square"} onClick={() => { setShape("square"); setBlob(null); setError(""); setMessage(""); }}><span className="shape-square" />{ja ? "正方形" : "Square"}<small>1:1</small></button>
          <button aria-pressed={shape === "portrait"} onClick={() => { setShape("portrait"); setBlob(null); setError(""); setMessage(""); }}><span className="shape-portrait" />{ja ? "縦長" : "Portrait"}<small>9:16</small></button>
        </fieldset>
        <p className="share-hint">{ja ? "絵のかたちはそのまま。鳴っている線が、そっと光ります。" : "Your drawing stays intact. The lines glow as they play."}</p>
        {busy && job.current ? <div className="share-progress" role="status">
          <p><LoaderCircle size={17} className="spin" />{ja ? "音と絵を合わせています…" : "Putting picture and music together…"} {Math.floor(progress * 100)}%</p>
          <progress value={progress} max={1} aria-label={ja ? "動画の作成状況" : "Video progress"} />
          <small>{ja ? "この画面を開いたままお待ちください。" : "Please keep this screen open."}</small>
          <button className="collection-text-button" onClick={() => job.current?.abort()}>{ja ? "作成をやめる" : "Cancel creation"}</button>
        </div> : !blob && capability ? <button className="collection-primary" disabled={busy} onClick={() => void generate()}><Film size={18} />{ja ? "音つき動画をつくる" : "Create video with sound"}</button> : null}
        {!capability && <p className="share-hint">{ja ? "このブラウザでは動画を作れません。絵と音をそれぞれ保存できます。" : "This browser can’t create video. Save your picture and audio below."}</p>}
        {blob && !busy && <div className="share-ready">
          <p><Check size={16} />{ja ? "できました。再生して確かめてね。" : "Ready. Play it to check your creation."}</p>
          {canShare && <button className="collection-primary" disabled={sharing} onClick={() => void share()}><Share2 size={18} />{ja ? "共有する" : "Share"}</button>}
          <button className={canShare ? "collection-secondary" : "collection-primary"} onClick={() => download(blob, project.title, videoExtension(blob.type))}><Download size={18} />{ja ? "動画を保存" : "Save video"}<small>{videoExtension(blob.type).toUpperCase()}</small></button>
          <small>{canShare ? (ja ? "共有先は端末の共有画面で選べます。" : "Choose an app in your device’s share sheet.") : (ja ? "保存した動画を、好きなSNSに投稿できます。" : "Upload the saved video to your favorite social app.")}</small>
          {videoExtension(blob.type) === "webm" && <small>{ja ? "WebM形式です。投稿先が対応しない場合は、MP4対応ブラウザで作成してください。" : "This is a WebM video. If your social app doesn’t accept it, create it in a browser with MP4 recording."}</small>}
        </div>}
        <div className="share-caption">
          <label htmlFor="share-caption">{ja ? "投稿文" : "Caption"}</label>
          <textarea id="share-caption" readOnly value={shareCaption} rows={3} onFocus={event => event.currentTarget.select()} />
          <button className="collection-text-button" onClick={async () => {
            try { await navigator.clipboard.writeText(shareCaption); setCopied(true); }
            catch { setMessage(ja ? "投稿文を選択してコピーしてください。" : "Select the caption and copy it."); }
          }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? (ja ? "コピーしました" : "Copied") : (ja ? "投稿文をコピー" : "Copy caption")}</button>
        </div>
        <details className="share-other"><summary>{ja ? "絵や音だけを保存する" : "Save picture or audio separately"}</summary>
          <button disabled={busy} onClick={() => void saveFallback("png")}><Image size={16} />{ja ? "絵を保存" : "Save picture"}<small>PNG</small></button>
          <button disabled={busy} onClick={() => void saveFallback("wav")}><Music2 size={16} />{ja ? "音を保存" : "Save audio"}<small>WAV</small></button>
        </details>
        {message && <p className="collection-message" role="status">{message}</p>}
        {error && <p className="collection-error" role="alert">{error}</p>}
      </div>
    </div>
    <footer className="share-footer">{ja ? "共有するまでは、この端末の中だけ。お子さんの作品は、おうちの人と確認してから届けてね。" : "Your work stays on this device until you share it. Children can review their creation with a grown-up before sending."}</footer>
  </dialog>;
}

