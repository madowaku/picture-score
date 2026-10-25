import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { PUBLIC_WEB_URL } from "./config";
import "./product.css";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function AppAvailability({ active, beforeUpdate }: { active: boolean; beforeUpdate: () => boolean }) {
  const { language } = useLanguage(); const ja = language === "ja";
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false), [offlineReady, setOfflineReady] = useState(false), [updateReady, setUpdateReady] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const registration = useRef<ServiceWorkerRegistration | null>(null), reloadRequested = useRef(false), flush = useRef(beforeUpdate);
  flush.current = beforeUpdate;
  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)");
    const detect = () => setInstalled(standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const offer = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt); };
    const done = () => { setInstalled(true); setInstall(null); };
    detect(); standalone.addEventListener("change", detect);
    window.addEventListener("beforeinstallprompt", offer); window.addEventListener("appinstalled", done);
    return () => { standalone.removeEventListener("change", detect); window.removeEventListener("beforeinstallprompt", offer); window.removeEventListener("appinstalled", done); };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let alive = true;
    const workers = new Set<ServiceWorker>();
    const installed = () => {
      if (!alive) return;
      if (registration.current?.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
      if (registration.current?.active) setOfflineReady(true);
    };
    const watch = () => {
      const worker = registration.current?.installing;
      if (worker) { workers.add(worker); worker.addEventListener("statechange", installed); }
    };
    // Only the tab that explicitly requested an update reloads. Other drawings stay open.
    const changed = () => {
      if (reloadRequested.current && flush.current()) location.reload();
      else if (alive) { reloadRequested.current = false; setBusy(false); installed(); }
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    void navigator.serviceWorker.register("/sw.js").then(async value => {
      if (!alive) return;
      registration.current = value; installed(); watch(); value.addEventListener("updatefound", watch);
      await navigator.serviceWorker.ready;
      if (alive) setOfflineReady(true);
    }).catch(() => { /* Online drawing stays available when installation is unavailable. */ });
    return () => {
      alive = false; registration.current?.removeEventListener("updatefound", watch);
      for (const worker of workers) worker.removeEventListener("statechange", installed);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
    };
  }, []);
  if (!active) return null;
  return <footer className="product-essentials">
    <div className="availability-card">
      <strong>{ja ? "また描きたくなったら、すぐここへ。" : "A little space to come back to."}</strong>
      {installed ? <p>{ja ? "ホーム画面から、いつでも開けます。" : "Open it any time from your home screen."}</p> : install ?
        <button className="collection-secondary" disabled={busy} onClick={async () => {
          setBusy(true); setMessage("");
          try { await install.prompt(); const result = await install.userChoice; if (result.outcome === "accepted") setInstalled(true); }
          catch { setMessage(ja ? "ブラウザのメニューからホーム画面に追加できます。" : "Use your browser’s menu to add it to your home screen."); }
          finally { setInstall(null); setBusy(false); }
        }}><Download size={17} />{ja ? "ホーム画面に追加" : "Add to home screen"}</button> :
        <details><summary>{ja ? "ホーム画面に追加するには" : "How to add to your home screen"}</summary><p>{ja ? "ブラウザのメニューで「アプリをインストール」や「ホーム画面に追加」を選びます。iPhoneのSafariでは共有ボタンから選べます。" : "Choose Install app or Add to Home Screen in your browser menu. On iPhone, use Safari’s Share button."}</p></details>}
      {offlineReady && <p className="offline-ready"><WifiOff size={15} />{ja ? "オフラインでも描いて、聴けます。" : "Ready to draw and listen offline."}</p>}
      {updateReady && <div className="app-update"><p>{ja ? "新しいバージョンが届きました。" : "A new version is ready."}</p><button className="collection-secondary" disabled={busy} onClick={() => {
        if (!flush.current()) { setMessage(ja ? "描きかけを保存できませんでした。作品ファイルを保存してから更新してください。" : "Couldn’t save your draft. Export a project file before updating."); return; }
        if (registration.current?.waiting) { setBusy(true); reloadRequested.current = true; registration.current.waiting.postMessage({ type: "SKIP_WAITING" }); }
        else location.reload();
      }}><RefreshCw size={16} />{ja ? "作品を残して更新" : "Save draft and update"}</button></div>}
      {message && <p role="status">{message}</p>}
    </div>
    {PUBLIC_WEB_URL && <button className="collection-text-button" onClick={async () => {
      try { await navigator.clipboard.writeText(PUBLIC_WEB_URL); setMessage(ja ? "アプリのリンクをコピーしました。" : "App link copied."); }
      catch { setMessage(PUBLIC_WEB_URL); }
    }}>{ja ? "友だちにアプリを教える・リンクをコピー" : "Tell a friend · copy app link"}</button>}
    <div className="product-links"><a href="/privacy.html" target="_blank" rel="noopener">{ja ? "プライバシー・保存について" : "Privacy and storage"}</a><span>© madowaku</span></div>
  </footer>;
}
