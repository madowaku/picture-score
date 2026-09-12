import type { GardenState } from '../garden/gardenState';
import type { WonderGardenEffect } from './wonderTypes';
import { spatialSlot } from './gardenMusic';
export function WonderGardenLayer({ garden, effects, beat, playing }: { garden: GardenState; effects: WonderGardenEffect[]; beat: number; playing: boolean }) {
  return <svg className="wonder-garden-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    {effects.map(effect => {
      const points = effect.objectIds.map(id => garden.objects.find(o => o.id === id)?.world);
      if (points.some(p => !p)) return null;
      const valid = points.filter(p => !!p);
      const local = beat % 16, width = 12 / valid.length;
      const slot = Math.floor(local / width);
      const index = effect.objectIds.findIndex(id => spatialSlot(effect, id, Math.floor(beat / 16)) === slot);
      const point = valid[index];
      return <g key={effect.rule + effect.objectIds.join()} data-wonder={effect.rule} style={{ opacity: effect.strength }}>
        <path d={valid.map((p, i) => (i ? 'L' : 'M') + p.x * 1000 + ',' + p.y * 1000).join(' ') + (effect.rule === 'garden-triad-round' ? ' Z' : '')} />
        {playing && local < 12 && point && <circle className="wonder-traveller" cx={point.x * 1000} cy={point.y * 1000} r="31" />}
      </g>;
    })}
  </svg>;
}
