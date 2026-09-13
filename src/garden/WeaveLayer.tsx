import { memo, useEffect, useId, useMemo, useRef } from 'react';
import type { GardenState } from './gardenState';
import type { GrowthState } from './growth';
import { pairKey } from './growth';
import type { Clearing, GardenLayout } from './clearing';
import { seed } from './clearing';
import { formationKey, weaveScene } from './weave';
import type { WeavePatch, WeaveState, WeaveTrailMark } from './weave';
import { LifeAnimations, LifePresentation } from './lifePresentation';

/**
 * Persistent relationship scenery. It is deliberately a quiet SVG layer: the
 * source drawing and its clearing remain the visual foreground.
 */
export const WeaveLayer = memo(function WeaveLayer({ garden, growth, weave, clearings, layout, moments, life }: {
  garden: GardenState;
  growth: GrowthState;
  weave: WeaveState;
  clearings: Clearing[];
  layout: GardenLayout;
  moments: Set<string>;
  life: LifePresentation;
}) {
  const root = useRef<SVGSVGElement>(null);
  const mask = useId();
  const scene = useMemo(() => weaveScene(garden, growth, weave, clearings, layout),
    [garden, growth, weave, clearings, layout]);
  useEffect(() => {
    const motions = new Map<string, LifeAnimations>();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const reset = () => { motions.forEach(motion => motion.clear()); motions.clear(); };
    const pulse = (node: Element, key: string, amount = .22) => {
      let motion = motions.get(key);
      if (!motion) { motion = new LifeAnimations(); motions.set(key, motion); }
      motion.animate('pulse', node, reduced.matches
        ? [{ opacity: amount }, { opacity: amount * .72 }]
        : [{ opacity: amount }, { opacity: Math.min(1, amount + .26) }, { opacity: amount * .72 }],
        reduced.matches ? 360 : 620);
    };
    const off = life.observe(event => {
      if (!event) { reset(); return; }
      if (event.type === 'sustain-end' || event.type === 'spotlight' || event.type === 'relation') return;
      const keys = new Set<string>();
      const formation = event.formation;
      const isWeaveFormation = formation === 'garden-lineup-cascade' || formation === 'garden-triad-round';
      if (isWeaveFormation && event.formationIds?.length) keys.add(formationKey(formation, event.formationIds));
      if (event.relation && event.partnerId) keys.add(pairKey(event.objectId, event.partnerId));
      if (!keys.size || !root.current) return;
      const nodes = [...root.current.querySelectorAll<SVGElement>('[data-weave-key]')];
      const matched = nodes.filter(node => keys.has(node.dataset.weaveKey ?? ''));
      if (formation === 'garden-lineup-cascade' && event.formationIds) {
        const step = Math.max(0, event.formationIds.indexOf(event.objectId));
        const trail = matched.filter(node => node.dataset.weaveSource === 'cascade' &&
          node.dataset.weaveStep === String(Math.min(step, event.formationIds!.length - 2)));
        (trail.length ? trail : matched).forEach(node => pulse(node, node.dataset.weaveKey ?? 'weave'));
      } else matched.forEach(node => pulse(node, node.dataset.weaveKey ?? 'weave'));
    });
    reduced.addEventListener('change', reset);
    return () => { off(); reset(); reduced.removeEventListener('change', reset); };
  }, [life]);

  const renderImages = (mark: WeavePatch, source: WeavePatch['source']) => {
    const key = mark.formationKey ?? (mark.id.startsWith('pair:') ? mark.id.slice(5) : mark.id);
    return <g key={mark.id} data-weave-key={key} data-weave-source={source}
      data-weave-patch={source !== 'cascade' ? mark.id : undefined}
      data-weave-trail={source === 'cascade' ? mark.id : undefined}
      data-weave-formation={mark.formationKey} data-weave-step={(mark as WeaveTrailMark).step}
      className={moments.has(key) ? 'weave-moment' : undefined}
      style={{ opacity: mark.opacity }}>
      {mark.assets.map((asset, index) => {
        const variant = seed(mark.id + ':' + asset + ':' + index);
        const width = mark.width * (asset === 'grass' ? 1.25 : 1);
        const height = mark.height * (asset === 'flower' ? .82 : asset === 'star' ? .8 : 1);
        const x = mark.x - width / 2 + (variant - .5) * mark.width * .42;
        const y = mark.y - height / 2 + (seed(mark.id + ':y:' + index) - .5) * mark.height * .28;
        return <image key={asset + index} href={`/art/clearing-${asset}.webp`} x={x} y={y}
          width={width} height={height} preserveAspectRatio="none" opacity={source === 'pair' ? .82 : .72} />;
      })}
    </g>;
  };

  return <svg ref={root} className="weave-layer" viewBox="0 0 1000 1000"
    preserveAspectRatio="none" aria-hidden="true" data-testid="weave-layer">
    <defs><mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
      <rect width="1000" height="1000" fill="white" />
      {clearings.map(clear => <ellipse key={clear.id} data-weave-clearing={clear.id}
        cx={clear.x} cy={clear.y} rx={clear.rx} ry={clear.ry} fill="black" />)}
    </mask></defs>
    <g mask={`url(#${mask})`}>
      {scene.paths.map(path => <path key={path.key} data-weave-key={path.key} data-weave-path={path.key}
        data-shared-beats={path.sharedBeats.toFixed(3)} className="weave-path"
        d={path.d} style={{ opacity: path.opacity }} />)}
      {scene.patches.map(mark => renderImages(mark, mark.source))}
      {scene.trails.map(mark => renderImages(mark, 'cascade'))}
    </g>
  </svg>;
});
