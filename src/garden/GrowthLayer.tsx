import { memo, useId } from 'react';
import type { GardenState } from './gardenState';
import { growthStage } from './growth';
import type { GrowthState } from './growth';
import { clearingPath, gardenHabitats, seed } from './clearing';
import type { Clearing, GardenLayout } from './clearing';
import { ClearingMask } from './ClearingMask';

/** One quiet, noninteractive SVG. Source ink and all neighbouring clearings stay clear. */
export const GrowthLayer = memo(function GrowthLayer({ garden, growth, moments, clearings, layout }: {
  garden: GardenState; growth: GrowthState; moments: Set<string>; clearings: Clearing[]; layout: GardenLayout;
}) {
  const mask = useId();
  const habitats = gardenHabitats(garden, growth, clearings, layout);
  const paths = Object.entries(growth.relations).filter(([, r]) => growthStage(r.sharedBeats, true) > 0)
    .sort((a, b) => b[1].sharedBeats - a[1].sharedBeats || a[0].localeCompare(b[0])).slice(0, 24);
  return <svg className="growth-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" data-testid="growth-layer">
    <ClearingMask id={mask} clearings={clearings} />
    <g mask={`url(#${mask})`}>
      {paths.map(([key, relation]) => {
        const a = clearings.find(e => e.id === relation.a), b = clearings.find(e => e.id === relation.b);
        if (!a || !b) return null;
        const path = clearingPath(a, b, seed(key) * 2 - 1);
        if (!path) return null;
        const stage = growthStage(relation.sharedBeats, true);
        return <g key={key} data-growth-pair={key} data-shared-beats={relation.sharedBeats.toFixed(3)}
          className={moments.has(key) ? 'growth-moment' : ''} style={{ opacity: (.2 + stage * .12) * path.opacity }}>
          <path className="growth-path" d={path.d} />
        </g>;
      })}
      {garden.objects.map(object => {
        const beats = growth.objects[object.id] ?? 0, stage = growthStage(beats);
        if (!stage) return null;
        return <g key={object.id} data-growth-object={object.id} data-audible-beats={beats.toFixed(3)}
          data-growth-stage={stage} data-growth-role={object.musicalRole}>
          <g className={`growth-habitat growth-${object.musicalRole} ${moments.has(object.id) ? 'growth-moment' : ''}`}>
            {habitats.get(object.id)?.map(mark => <image key={mark.index} data-habitat-mark={mark.index}
              href={`/art/clearing-${mark.asset}.webp`} x={mark.x - mark.width / 2} y={mark.y - mark.height / 2}
              width={mark.width} height={mark.height} preserveAspectRatio="none" opacity={mark.opacity} />)}
          </g>
        </g>;
      })}
    </g>
  </svg>;
});
