import { useId } from "react";
import "./brand.css";

export function BrandSymbol({ compact = false }: { compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  return <svg className={`brand-symbol ${compact ? "compact" : ""}`} viewBox="0 0 96 96" role="img" aria-label="Picture Score">
    <defs>
      <linearGradient id={`${id}coral`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#f4778d"/><stop offset="1" stopColor="#f6a05f"/></linearGradient>
      <linearGradient id={`${id}leaf`} x1="0" y1="1" x2=".8" y2="0"><stop stopColor="#edb766"/><stop offset=".35" stopColor="#7ca367"/><stop offset="1" stopColor="#a8bd70"/></linearGradient>
      <filter id={`${id}paint`} x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".35" numOctaves="3" seed="8" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="soft-light"/></filter>
    </defs>
    <g filter={`url(#${id}paint)`}>
      <ellipse cx="16" cy="75" rx="10" ry="12" transform="rotate(35 16 75)" fill={`url(#${id}coral)`}/>
      <path d="M23 74c0-14-1-30 3-44 3-13 12-19 20-16 11 4 11 15 3 23-3 4-7 6-11 7" fill="none" stroke={`url(#${id}coral)`} strokeWidth="8" strokeLinecap="round"/>
      <path d="M78 19c1 14-7 19-17 25-15 10 13 15 13 29 0 11-11 17-22 12-7-3-11-10-11-17" fill="none" stroke={`url(#${id}leaf)`} strokeWidth="8" strokeLinecap="round"/>
      <path d="M77 24c-9-1-14-7-14-15 9 0 15 6 14 15Z" fill="#99b771"/>
      <path d="M78 19c-2-10 3-16 12-18 1 9-4 15-12 18Z" fill="#9cb96d"/>
    </g>
  </svg>;
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <div className={`official-brand ${compact ? "compact" : ""}`}>
    <BrandSymbol compact={compact}/>
    <div className="official-brand-type"><span className="official-wordmark">picture score<span className="official-dot">.</span></span>{!compact && <span className="official-nickname">ピクスコ</span>}</div>
  </div>;
}
