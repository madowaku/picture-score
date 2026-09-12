import { memo, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { MusicalObject } from './gardenState';
import { useLanguage } from '../i18n/LanguageContext';
import { strokeColor } from '../wonder/palette';
import { artworkBounds } from './clearing';
import { roleMotion } from './life';
import { LifeAnimations, LifePresentation } from './lifePresentation';
export const roleNames = { melody: 'うた', harmony: '和音', drone: '余韻', rhythm: 'リズム', decoration: 'きらめき' };
const pathFor = (s: MusicalObject['strokeIR'][number]) => s.points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ') + (s.points.length===1?'l0.1,0':'');
export const Artwork = memo(function Artwork({object}: {object: MusicalObject}) {
  const box=useMemo(()=>artworkBounds(object),[object.strokeIR]);
  return <svg className="inhabitant-svg" viewBox={[box.x,box.y,box.width,box.height].join(' ')} preserveAspectRatio="none" aria-hidden="true"
    style={{aspectRatio:box.width/box.height*object.project.canvasAspect*420/1000, maxWidth:'100%',maxHeight:110}}>
    <g className="inhabitant-ink">{object.strokeIR.map(s=><path key={s.id} d={pathFor(s)} />)}</g>
    <path className="life-contour" pathLength="100" />
    <circle className="life-anchor" r="8" />
    <path className="life-spark" d="M-12 0H12M0-12V12M-7-7L7 7M7-7L-7 7" />
  </svg>;
});
interface Props {
  object: MusicalObject; index: number; gain: number; selected: boolean; pressed: boolean; spotlight: string | null;
  life: LifePresentation; arrangement: string; wonder?: string;
  onSelect: (id: string) => void; onKey: (event: KeyboardEvent, id: string, position: {x:number;y:number}) => void;
}
export const GardenArtwork = memo(function GardenArtwork({object,index,gain,selected,pressed,spotlight,life,arrangement,wonder,onSelect,onKey}: Props) {
  const {t}=useLanguage(), root=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const element=root.current!;
    const body=element.querySelector('.artwork-drawing');
    const anchor=element.querySelector('.life-anchor')!;
    const spark=element.querySelector('.life-spark')!;
    const contour=element.querySelector('.life-contour')!;
    const paths=new Map(object.strokeIR.map(s=>[s.id,pathFor(s)]));
    const motion=new LifeAnimations(), reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let pitch=60, loopBeat=-Infinity;
    const reset=()=>{ motion.clear(); delete element.dataset.life; delete element.dataset.lifeWonder; delete element.dataset.lifeRelation; delete element.dataset.lifeSide; delete element.dataset.lifeFormation; element.classList.remove('audible','wonder-leading','life-held','life-spotlight'); };
    const preference=()=>reset();
    reduced.addEventListener('change',preference);
    const unregister=life.register(object.id,event=>{
      if (!event) {reset();return;}
      if(event.type==='sustain-end') {element.classList.remove('life-held');delete element.dataset.life;return;}
      if(event.type==='relation') return;
      if(event.type==='spotlight') {
        element.classList.add('life-spotlight');
        motion.later('spotlight',event.duration*1000,()=>element.classList.remove('life-spotlight'));return;
      }
      element.dataset.life=event.type; element.dataset.lifeRelation=event.relation ?? '';
      element.classList.add('audible');
      if(event.type==='sustain-start')element.classList.add('life-held');else element.classList.remove('life-held');
      if(event.formation) {
        element.classList.add('wonder-leading'); element.dataset.lifeWonder=event.formation; element.dataset.lifeFormation=event.formation;
        motion.later('formation',Math.max(300,event.duration*1000),()=>{element.classList.remove('wonder-leading');delete element.dataset.lifeFormation;});
      }
      const shape=roleMotion(object.musicalRole,event.duration,(event.pitch??pitch)-pitch);pitch=event.pitch??pitch;
      const duration=Math.max(320,Math.min(10000,event.duration*1000+120));
      if(!reduced.matches) motion.animate('body',body,shape.frames.map(transform=>({transform})),shape.duration);
      motion.animate('halo',element.querySelector('.life-ring'),[{opacity:.8,transform:'scale(.95)'},{opacity:0,transform:reduced.matches?'scale(.95)':'scale(1.14)'}],Math.min(900,duration));
      const source=event.source;
      if(source) {
        anchor.setAttribute('cx',String(source.point.x));anchor.setAttribute('cy',String(source.point.y));
        motion.animate('anchor',anchor,[{opacity:1},{opacity:.75},{opacity:0}],Math.min(900,duration));
        element.dataset.lifeSide=source.mirror??'';
        if(source.thicken && !reduced.matches) {
          element.dataset.lifeWonder='retrace-thicken';
          motion.animate('thicken',element.querySelector('.inhabitant-ink'),[{filter:'drop-shadow(0 0 0 currentColor)'},{filter:'drop-shadow(0 0 3px currentColor)'},{filter:'drop-shadow(0 0 0 currentColor)'}],duration);
        }
        if(source.loop && event.beat-loopBeat>1) {
          loopBeat=event.beat; element.dataset.lifeWonder='closed-loop';
          contour.setAttribute('d',paths.get(source.strokeId)??'');
          motion.animate('loop',contour,reduced.matches?[{opacity:.85},{opacity:0}]:[{opacity:1,strokeDashoffset:'100'},{opacity:.9,strokeDashoffset:'0'},{opacity:0,strokeDashoffset:'0'}],Math.min(1400,Math.max(650,duration)));
        }
        if(source.mirror)element.dataset.lifeWonder='mirror-answer';
        if(source.spark || object.musicalRole==='decoration') {
          const point=source.spark??source.point;
          spark.setAttribute('transform','translate('+point.x+','+point.y+')');
          if(source.spark)element.dataset.lifeWonder='crossing-spark';
          motion.animate('spark',spark,[{opacity:1},{opacity:0}],360);
        }
      }
      motion.later('rest',duration,()=>{ delete element.dataset.life;delete element.dataset.lifeWonder;delete element.dataset.lifeSide;delete element.dataset.lifeRelation;delete element.dataset.lifeFormation;element.classList.remove('audible','life-held','wonder-leading'); });
    });
    return ()=>{unregister();reduced.removeEventListener('change',preference);reset();};
  },[life,object.id,object.strokeIR,object.musicalRole]);
  return <button ref={root} data-object={object.id} data-role={object.musicalRole} data-gain={gain.toFixed(3)} data-arrangement={arrangement} data-wonder={wonder}
    className={'garden-artwork inhabitant '+(gain>.015?'near-listener ':'')+(selected?'chosen ':'')+(pressed?'pressed ':'')+(spotlight===object.id?'spotlight-lead ':spotlight?'spotlight-dim ':'')}
    style={{left:object.world.x*100+'%',top:object.world.y*100+'%','--art-color':strokeColor(index)} as CSSProperties}
    aria-label={t('{title} — {role}。矢印キーで移動',{title:object.title,role:t(roleNames[object.musicalRole])})}
    onFocus={()=>onSelect(object.id)} onKeyDown={e=>onKey(e,object.id,object.world)}>
    <span className="life-ring" aria-hidden="true" />
    <span className="artwork-drawing"><Artwork object={object}/></span>
    <span className="inhabitant-label"><span className="artwork-title">{object.title}</span><small>{t(roleNames[object.musicalRole])}</small></span>
  </button>;
});
