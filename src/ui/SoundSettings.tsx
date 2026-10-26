import { useEffect, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

const query = "(max-width: 760px), (max-height: 520px) and (pointer: coarse)";

/** The same controls stay inline on desktop and open in a modal on phones. */
export function SoundSettings({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const ja = language === "ja";
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setCompact(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  if (!compact) return <div className="desktop-sound-settings">{children}</div>;
  return <>
    <button className="mobile-sound-button" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
      <SlidersHorizontal size={23} /><span>{ja ? "音の設定" : "Sound"}</span>
    </button>
    <dialog ref={dialog} className="mobile-sound-dialog" aria-labelledby="sound-settings-title" onClick={event => {
      if (event.target === event.currentTarget) {
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.current?.close();
      }
    }}>
      <header><h2 id="sound-settings-title">{ja ? "音の設定" : "Sound settings"}</h2>
        <button autoFocus aria-label={ja ? "音の設定を閉じる" : "Close sound settings"} onClick={() => dialog.current?.close()}><X size={22}/></button>
      </header>
      {children}
    </dialog>
  </>;
}
