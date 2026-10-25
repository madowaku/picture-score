import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { inkColors, inkWidths } from "../wonder/palette";

export function BrushPicker({ color, width, onChange }: {
  color: string; width: number; onChange: (color: string, width: number) => void;
}) {
  const { language } = useLanguage();
  const ja = language === "ja";
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  return <>
    <button ref={trigger} className="brush-trigger" aria-haspopup="dialog" aria-expanded={open}
      aria-label={ja ? "いろ・ふとさを選ぶ" : "Choose color and line width"} onClick={() => setOpen(true)}>
      <span className="brush-dot" style={{ background: color }} />
      <span>{ja ? "いろ・ふとさ" : "Brush"}</span><ChevronDown size={13} />
    </button>
    <dialog ref={dialog} className="brush-dialog creation-dialog" aria-labelledby="brush-title"
      onCancel={e => { e.preventDefault(); close(); }}>
      <header><h2 id="brush-title">{ja ? "どんな線で描こう？" : "Make the line your own."}</h2>
        <button className="collection-icon" aria-label={ja ? "パレットを閉じる" : "Close palette"} onClick={close}><X size={22} /></button></header>
      <fieldset><legend>{ja ? "いろ" : "Color"}</legend><div className="ink-colors">
        {inkColors.map(ink => <button key={ink.value} aria-pressed={color === ink.value}
          aria-label={ja ? ink.ja : ink.en} onClick={() => onChange(ink.value, width)}>
          <span style={{ background: ink.value }}>{color === ink.value && <Check size={20} />}</span>
          <small>{ja ? ink.ja : ink.en}</small>
        </button>)}
      </div></fieldset>
      <fieldset><legend>{ja ? "ふとさ" : "Line width"}</legend><div className="ink-widths">
        {inkWidths.map(ink => <button key={ink.value} aria-pressed={width === ink.value}
          onClick={() => onChange(color, ink.value)}>
          <svg viewBox="0 0 60 18" aria-hidden="true"><path d="M6 12 Q22 2 32 9 T54 6" fill="none" stroke={color} strokeWidth={ink.value} strokeLinecap="round" /></svg>
          <span>{ja ? ink.ja : ink.en}</span>
        </button>)}
      </div></fieldset>
      <p className="creation-hint">{ja ? "これから描く線に使います。" : "Your next strokes will use this brush."}</p>
      <button className="collection-primary" onClick={close}>{ja ? "この線で描く" : "Draw with this brush"}</button>
    </dialog>
  </>;
}
