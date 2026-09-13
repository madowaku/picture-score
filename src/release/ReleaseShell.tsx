import { useState } from "react";
import type { ReactNode } from "react";
import { Check, LoaderCircle, Share2, Sparkles, X } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import {
  plusCheckoutUrl,
  plusPurchaseEnabled,
  shareCurrentProject,
} from "./share";

type Panel = "share" | "plus" | null;
type Notice = "shared" | "copied" | "downloaded" | "empty" | "failed" | null;

export function ReleaseShell({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [panel, setPanel] = useState<Panel>(null);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const checkoutUrl = plusCheckoutUrl();
  const checkoutEnabled = plusPurchaseEnabled() && Boolean(checkoutUrl);
  const ja = language === "ja";

  async function share() {
    if (sharing) return;
    setSharing(true);
    setNotice(null);
    try {
      const result = await shareCurrentProject(language);
      if (result === "cancelled") return;
      setNotice(
        result === "shared"
          ? "shared"
          : result === "copied-and-downloaded"
            ? "copied"
            : "downloaded",
      );
      setPanel("share");
    } catch (error) {
      setNotice(error instanceof Error && error.message === "empty-project" ? "empty" : "failed");
      setPanel("share");
    } finally {
      setSharing(false);
    }
  }

  const noticeText = notice === "shared"
    ? (ja ? "共有しました。作品が外の世界へ飛び出しました。" : "Shared. Your drawing is out in the world.")
    : notice === "copied"
      ? (ja ? "共有文をコピーし、PNGも保存しました。" : "Share text copied and PNG downloaded.")
      : notice === "downloaded"
        ? (ja ? "PNGを保存しました。SNSへ添付して共有できます。" : "PNG downloaded. Attach it to your social post.")
        : notice === "empty"
          ? (ja ? "まずひと筆描いてから共有してみよう。" : "Draw at least one line before sharing.")
          : notice === "failed"
            ? (ja ? "共有できませんでした。もう一度お試しください。" : "Sharing failed. Please try again.")
            : null;

  return (
    <>
      {children}
      <div className="release-dock" aria-label={ja ? "共有とピクスコ+" : "Share and Picture Score Plus"}>
        <button className="release-share" onClick={() => void share()} disabled={sharing}>
          {sharing ? <LoaderCircle className="spin" size={17} /> : <Share2 size={17} />}
          <span>{ja ? "共有" : "Share"}</span>
        </button>
        <button className="release-plus" onClick={() => setPanel("plus")}>
          <Sparkles size={16} />
          <span>{ja ? "ピクスコ+" : "Plus"}</span>
        </button>
      </div>

      {panel && (
        <div className="release-panel" role="dialog" aria-modal="false" aria-label={panel === "share" ? (ja ? "共有" : "Share") : (ja ? "ピクスコ+" : "Picture Score Plus")}>
          <button className="release-close" aria-label={ja ? "閉じる" : "Close"} onClick={() => setPanel(null)}>
            <X size={17} />
          </button>
          {panel === "share" ? (
            <>
              <span className="release-kicker">SHARE YOUR SCORE</span>
              <h2>{ja ? "描いた線を、外の世界へ。" : "Let your drawing travel."}</h2>
              <p>{noticeText ?? (ja ? "作品画像とピクスコへのリンクをSNSへ共有できます。" : "Share your artwork image together with a link back to Picture Score.")}</p>
              {notice && notice !== "empty" && notice !== "failed" && (
                <div className="release-success"><Check size={15} /> {ja ? "共有素材を用意しました" : "Share package ready"}</div>
              )}
              <button className="release-primary" onClick={() => void share()} disabled={sharing}>
                {sharing ? <LoaderCircle className="spin" size={17} /> : <Share2 size={17} />}
                {ja ? "もう一度共有する" : "Share again"}
              </button>
            </>
          ) : (
            <>
              <span className="release-kicker">PICTURE SCORE +</span>
              <h2>{ja ? "もっと育てる人のための、ピクスコ+。" : "Picture Score Plus, for creations you want to keep growing."}</h2>
              <p>{ja ? "無料の創作とSNS共有はそのまま。Plusは保存・書き出し・追加表現を拡張する買い切り版として準備中です。" : "Creation and social sharing stay free. Plus is being prepared as a one-time upgrade for expanded keeping, exporting, and expression."}</p>
              <div className="release-price">
                <strong>¥980</strong><span>{ja ? "買い切り予定" : "planned one-time"}</span>
              </div>
              {checkoutEnabled ? (
                <a className="release-primary" href={checkoutUrl} target="_blank" rel="noreferrer">
                  <Sparkles size={16} /> {ja ? "テスト購入へ" : "Open test checkout"}
                </a>
              ) : (
                <div className="release-gate">
                  {ja ? "購入導線は安全ゲート中です。Stripe Checkout URLと明示フラグの両方を設定すると開きます。" : "Purchase is behind a safety gate. It opens only when both the Stripe Checkout URL and explicit enable flag are configured."}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
