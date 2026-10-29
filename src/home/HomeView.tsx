import { useRef, useState } from "react";
import { ArrowRight, CircleHelp, FileText, Music2, Pencil, Settings, Sprout } from "lucide-react";
import type { Project, Stroke } from "../music/types";
import { useLanguage } from "../i18n/LanguageContext";
import { countEn } from "../i18n/messages";
import { strokeInk, strokeWidth } from "../wonder/palette";
import { BrandLogo } from "../brand/BrandLogo";
import "./home.css";

const pathFor = (stroke: Stroke) =>
  stroke.points
    .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ") + (stroke.points.length === 1 ? "l0.1,0" : "");

export function HomeView({
  active,
  recent,
  onStart,
  onContinue,
  onGarden,
}: {
  active: boolean;
  recent: Project | null;
  onStart: () => void;
  onContinue: () => void;
  onGarden: () => void;
}) {
  const { language, setLanguage } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const howRef = useRef<HTMLElement>(null);
  const ja = language === "ja";
  if (!active) return null;

  return (
    <section className="home-view" role="main" aria-label={ja ? "Picture Score ホーム" : "Picture Score home"}>
      <div className="home-atmosphere" aria-hidden="true">
        <span className="home-wash wash-a" />
        <span className="home-wash wash-b" />
        <span className="home-wash wash-c" />
        <img className="home-botanical botanical-a" src="/art/clearing-sprout.webp" alt="" />
        <img className="home-botanical botanical-b" src="/art/clearing-sprout.webp" alt="" />
        <img className="home-floating-note note-a" src="/art/clearing-flower.webp" alt="" />
        <img className="home-floating-note note-b" src="/art/clearing-flower.webp" alt="" />
      </div>

      <section className="home-hero">
        <div className="home-top-tools">
          <div className="home-settings-wrap">
            <button
              type="button"
              className="home-round-tool"
              aria-label={ja ? "設定" : "Settings"}
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((value) => !value)}
            >
              <Settings size={22} />
            </button>
            {settingsOpen && (
              <div className="home-settings-popover" role="group" aria-label={ja ? "言語" : "Language"}>
                <button className={language === "ja" ? "active" : ""} onClick={() => setLanguage("ja")}>日本語</button>
                <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="home-round-tool"
            aria-label={ja ? "はじめかたを見る" : "How it works"}
            onClick={() => howRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <CircleHelp size={23} />
          </button>
        </div>

        <div className="home-hero-composition">
          <div className="home-hero-message">
            <p className="home-kicker">{ja ? "絵から生まれる、小さな音楽。" : "A little music born from a drawing."}</p>
            <h1>
              {ja ? <><span>描いた絵が、</span><span>メロディになる。</span></> : <><span>Your drawing</span><span>becomes a melody.</span></>}
            </h1>
            <span className="home-drawn-line" aria-hidden="true" />
          </div>
          <BrandLogo />
          <p className="home-whisper" aria-hidden="true">draw<br />feel<br />become music.</p>
        </div>

        <p className="home-copy">{ja ? "小さな絵に、小さな魔法。" : "A little drawing. A little magic."}</p>

        <div className="home-cat" aria-hidden="true">
          <svg viewBox="0 0 150 65"><path d="M18 36 16 14l13 8 13-8 1 24c-6 9-22 9-27-1Zm25 0c23-16 55-5 61 18H88l-1-9-9 1-1 9H64l-1-9-10 1-1 8H41l3-12m59-6c21-1 29-18 19-23-7-3-9 7-3 8M24 32h1m10 0h1m-9 6 4 2 3-3M10 36l10 1m19-1 10-2" /></svg>
          <span>a kinder day<br />with small creations.</span>
        </div>
        <button className="home-primary" onClick={onStart}>
          <Pencil size={24} />
          <span>{ja ? "描いてみる" : "Start drawing"}</span>
          <ArrowRight size={22} />
        </button>
      </section>

      <section className="home-actions" aria-label={ja ? "行き先" : "Destinations"}>
        {recent && (
          <button className="home-action-card studio" onClick={onContinue}>
            <FileText size={20} />
            <span>
              <strong>{ja ? "続きを描く" : "Continue"}</strong>
              <small>{recent.title || (ja ? "名前のない作品" : "Untitled")}</small>
            </span>
            <ArrowRight size={18} />
          </button>
        )}
        <button className="home-action-card garden" onClick={onGarden}>
          <img className="action-sprout" src="/art/clearing-sprout.webp" alt="" />
          <span>
            <strong>{ja ? "庭を見る" : "Visit Garden"}</strong>
            <small>{ja ? "描いた音たちが育つ場所" : "Where your sounds grow"}</small>
          </span>
          <ArrowRight size={18} />
        </button>
      </section>

      {recent && (
        <section className="home-recent" aria-label={ja ? "最近の作品" : "Recent work"}>
          <div className="home-section-heading">
            <h2><Sprout size={15} />{ja ? "最近の作品" : "Recent work"}</h2>
            <button onClick={onContinue}>{ja ? "開く" : "Open"} <ArrowRight size={14} /></button>
          </div>
          <button className="recent-work-card" onClick={onContinue}>
            <div className="recent-thumb" aria-hidden="true">
              <svg viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid meet">
                <g className="recent-staff">
                  {Array.from({ length: 5 }, (_, index) => (
                    <line key={index} x1="30" x2="970" y1={95 + index * 55} y2={95 + index * 55} />
                  ))}
                </g>
                <g className="recent-strokes">
                  {recent.strokes.slice(0, 24).map((stroke, index) => (
                    <path key={stroke.id} d={pathFor(stroke)} style={{ stroke: strokeInk(stroke, index), strokeWidth: strokeWidth(stroke, 2.8), vectorEffect: "non-scaling-stroke" }} />
                  ))}
                </g>
              </svg>
              <Music2 className="recent-note" size={16} />
            </div>
            <div className="recent-meta">
              <strong>{recent.title || (ja ? "名前のない作品" : "Untitled")}</strong>
              <span>{ja ? `${recent.strokes.length}本の線` : countEn(recent.strokes.length, "stroke")}</span>
              <small>{ja ? "あなたの小さな曲" : "Your little composition"}</small>
            </div>
            <ArrowRight className="recent-arrow" size={21} />
          </button>
        </section>
      )}

      <section ref={howRef} className="home-how" aria-label={ja ? "はじめかた" : "How it works"}>
        <div className="home-how-heading"><span /><h2>{ja ? "はじめかた" : "How it works"}</h2><span /></div>
        <div className="home-steps">
          <div><span>1</span><Pencil size={26} /><strong>{ja ? "描く" : "Draw"}</strong><small>{ja ? "好きなように\n絵を描いてみよう" : "Draw anything\nyou like"}</small></div>
          <div><span>2</span><Music2 size={26} /><strong>{ja ? "聴く" : "Listen"}</strong><small>{ja ? "描いた絵が\n音楽になります" : "Your drawing\nbecomes music"}</small></div>
          <div><span>3</span><Sprout size={27} /><strong>{ja ? "庭に置く" : "Plant it"}</strong><small>{ja ? "できた曲を\nあなただけの庭に" : "Place your song\nin your garden"}</small></div>
        </div>
        <p className="home-gentle-line">{ja ? "小さな創造で、やさしい一日を。" : "A kinder day with small creations."}</p>
      </section>
    </section>
  );
}
