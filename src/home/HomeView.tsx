import { ArrowRight, Pencil, Play, Sprout } from "lucide-react";
import type { Project, Stroke } from "../music/types";
import { useLanguage } from "../i18n/LanguageContext";
import { strokeColor } from "../wonder/palette";
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
  const { language } = useLanguage();
  const ja = language === "ja";
  if (!active) return null;

  return (
    <section className="home-view" role="main" aria-label={ja ? "Picture Score ホーム" : "Picture Score home"}>
      <section className="home-hero">
        <BrandLogo />
        <div className="home-copy">
          <h1>{ja ? "描いた絵が、メロディになる。" : "Your drawing becomes a melody."}</h1>
          <p>{ja ? "小さな絵に、小さな魔法。" : "A little drawing. A little magic."}</p>
        </div>
        <button className="home-primary" onClick={onStart}>
          <Pencil size={21} />
          <span>{ja ? "描いてみる" : "Start drawing"}</span>
          <ArrowRight size={20} />
        </button>
      </section>

      <section className="home-actions" aria-label={ja ? "行き先" : "Destinations"}>
        {recent && (
          <button className="home-action-card" onClick={onContinue}>
            <Play size={19} />
            <span>
              <strong>{ja ? "続きを描く" : "Continue"}</strong>
              <small>{recent.title || (ja ? "名前のない作品" : "Untitled")}</small>
            </span>
            <ArrowRight size={18} />
          </button>
        )}
        <button className="home-action-card garden" onClick={onGarden}>
          <Sprout size={20} />
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
            <h2>{ja ? "最近の作品" : "Recent work"}</h2>
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
                    <path key={stroke.id} d={pathFor(stroke)} style={{ stroke: strokeColor(index) }} />
                  ))}
                </g>
              </svg>
            </div>
            <div className="recent-meta">
              <strong>{recent.title || (ja ? "名前のない作品" : "Untitled")}</strong>
              <span>{ja ? `${recent.strokes.length}本の線` : `${recent.strokes.length} strokes`}</span>
              <small>{ja ? "あなたの小さな曲" : "Your little composition"}</small>
            </div>
            <ArrowRight className="recent-arrow" size={20} />
          </button>
        </section>
      )}

      <section className="home-how" aria-label={ja ? "はじめかた" : "How it works"}>
        <h2>{ja ? "はじめかた" : "How it works"}</h2>
        <div className="home-steps">
          <div><span>1</span><Pencil size={22} /><strong>{ja ? "描く" : "Draw"}</strong><small>{ja ? "好きなように" : "Any way you like"}</small></div>
          <div><span>2</span><Play size={22} /><strong>{ja ? "聴く" : "Listen"}</strong><small>{ja ? "絵が音楽に" : "Your drawing sings"}</small></div>
          <div><span>3</span><Sprout size={22} /><strong>{ja ? "庭に置く" : "Plant it"}</strong><small>{ja ? "音を育てる" : "Let sounds grow"}</small></div>
        </div>
      </section>
    </section>
  );
}
