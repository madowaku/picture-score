import type { Stroke } from '../music/types';
import type { WonderDrawEffect } from './wonderTypes';
export function WonderDrawLayer({ effects, strokes, recent, beat }: { effects: WonderDrawEffect[]; strokes: Stroke[]; recent: string | null; beat?: number }) {
  return <g className="wonder-draw-layer" aria-hidden="true">
    {effects.map((effect, index) => {
      const responding = recent && effect.strokeIds.includes(recent);
      const sounding = beat !== undefined && Math.abs(beat - effect.position.x * .016) < .3;
      if (!responding && !sounding) return null;
      return <g key={effect.rule + index + (recent ?? 'play')} className={'wonder-mark ' + effect.rule} data-wonder={effect.rule}>
        {effect.rule === 'crossing-spark' ? <g transform={'translate(' + effect.position.x + ',' + effect.position.y + ')'}><circle r="12" /><path d="M-18 0H18M0-18V18" /></g>
          : strokes.filter(s => effect.strokeIds.includes(s.id)).map(s => <path key={s.id} d={s.points.map((p, i) => (i ? 'L' : 'M') + p.x + ',' + p.y).join(' ')} />)}
      </g>;
    })}
  </g>;
}
