import { useId } from "react";
import "./brand.css";

export function BrandSymbol({ compact = false }: { compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  const coral = `${id}-coral`;
  const leaf = `${id}-leaf`;
  return (
    <svg
      className={`brand-symbol ${compact ? "compact" : ""}`}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Picture Score"
    >
      <defs>
        <linearGradient id={coral} x1="14" y1="80" x2="54" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dc5169" />
          <stop offset="1" stopColor="#e89a55" />
        </linearGradient>
        <linearGradient id={leaf} x1="47" y1="82" x2="82" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d6a552" />
          <stop offset="0.35" stopColor="#7ea05d" />
          <stop offset="1" stopColor="#4e7c4f" />
        </linearGradient>
      </defs>
      <circle cx="21" cy="70" r="10.5" fill={`url(#${coral})`} />
      <path
        d="M28 70V30c0-12 8-19 19-19 10 0 17 6 17 15 0 11-9 18-24 18"
        fill="none"
        stroke={`url(#${coral})`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M72 19c-12 8-20 17-20 27 0 9 16 11 16 22 0 9-8 15-19 17"
        fill="none"
        stroke={`url(#${leaf})`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M71 19c-8-1-13-5-15-11 8-1 14 3 15 11Z" fill="#79a45e" />
      <path d="M72 19c1-8 6-13 13-15 1 8-4 14-13 15Z" fill="#5f8d51" />
    </svg>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`official-brand ${compact ? "compact" : ""}`}>
      <BrandSymbol compact={compact} />
      <div className="official-brand-type">
        <span className="official-wordmark">
          picture score<span className="official-dot">.</span>
        </span>
        {!compact && <span className="official-nickname">ピクスコ</span>}
      </div>
    </div>
  );
}
