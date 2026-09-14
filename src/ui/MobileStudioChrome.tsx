import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * Mobile-only chrome for the DRAW workspace.
 * Existing DRAW / ERASE / PLAY controls stay owned by App; this layer only
 * exposes the compact MUSIC sheet and backdrop used by the mobile layout.
 */
export function MobileStudioChrome() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("mobile-music-open", open);
    return () => document.body.classList.remove("mobile-music-open");
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const drawMain = document.querySelector("main");
    const observer = drawMain
      ? new MutationObserver(() => {
          if (drawMain.hasAttribute("hidden")) setOpen(false);
        })
      : undefined;
    if (drawMain) observer?.observe(drawMain, { attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      observer?.disconnect();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      {open && (
        <button
          type="button"
          className="mobile-studio-backdrop"
          aria-label="音楽設定を閉じる"
          onClick={() => setOpen(false)}
        />
      )}
      <button
        type="button"
        className={`mobile-music-trigger ${open ? "open" : ""}`}
        aria-label={open ? "音楽設定を閉じる" : "音楽設定を開く"}
        aria-expanded={open}
        aria-controls="mobile-music-sheet"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={18} /> : <SlidersHorizontal size={18} />}
        <span>{open ? "DONE" : "MUSIC"}</span>
      </button>
    </>
  );
}
