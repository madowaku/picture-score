import { memo, useEffect, useId, useRef } from 'react';
import type { GardenState } from './gardenState';
import { LifeAnimations, LifePresentation } from './lifePresentation';
import { clearingPath } from './clearing';
import type { Clearing } from './clearing';
import { ClearingMask } from './ClearingMask';
/** At most one travelling cue per inhabitant. No per-frame React updates. */
export const GardenLifeLayer = memo(function GardenLifeLayer({ garden, life, clearings }: {
  garden: GardenState; life: LifePresentation; clearings: Clearing[];
}) {
  const root = useRef<SVGSVGElement>(null), current = useRef(clearings), mask = useId();
  current.current = clearings;
  useEffect(() => {
    const motions = new Map<string, LifeAnimations>();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const reset = () => { motions.forEach(m => m.clear()); motions.clear(); };
    reduced.addEventListener('change', reset);
    const off = life.observe(event => {
      if (!event) { reset(); return; }
      if (event.type === 'sustain-end' || event.type === 'spotlight') return;
      const owner = current.current.find(e => e.id === event.objectId);
      const partner = current.current.find(e => e.id === event.partnerId);
      const group = [...root.current!.querySelectorAll<SVGGElement>('[data-life-world]')].find(g => g.dataset.lifeWorld === event.objectId);
      if (!owner || !group) return;
      let motion = motions.get(owner.id);
      if (!motion) { motion = new LifeAnimations(); motions.set(owner.id, motion); }
      const ring = group.querySelector('ellipse')!, trail = group.querySelector('path')!;
      ring.setAttribute('cx', String(owner.x)); ring.setAttribute('cy', String(owner.y));
      ring.setAttribute('rx', String(owner.rx + 3)); ring.setAttribute('ry', String(owner.ry + 3));
      group.dataset.lifeFormation = event.formation ?? '';
      if (event.formation || event.relation) motion.animate('ring', ring, [{ opacity: .5 }, { opacity: 0 }],
        Math.min(1000, Math.max(350, event.duration * 1000)));
      if (partner && event.relation) {
        const path = clearingPath(owner, partner, -.8);
        trail.setAttribute('d', path?.d ?? '');
        if (path) motion.animate('trail', trail, reduced.matches ? [{ opacity: .5 }, { opacity: 0 }] :
          [{ opacity: .7, strokeDashoffset: '100' }, { opacity: .7, strokeDashoffset: '0' }, { opacity: 0, strokeDashoffset: '0' }], 650);
      }
      const habitat = [...root.current!.parentElement!.querySelectorAll<SVGGElement>('[data-growth-object]')]
        .find(g => g.dataset.growthObject === owner.id)?.querySelector('.growth-habitat');
      // Brighten in place: the exclusion mask and all perimeter anchors stay stationary.
      if (habitat) motion.animate('habitat', habitat, [{ opacity: .8 }, { opacity: 1 }, { opacity: .8 }],
        Math.min(1500, Math.max(550, event.duration * 1000)));
    });
    return () => { off(); reset(); reduced.removeEventListener('change', reset); };
  }, [life, garden.objects.length]);
  return <svg ref={root} className="garden-life-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    <ClearingMask id={mask} clearings={clearings} />
    <g mask={`url(#${mask})`}>
      {garden.objects.map(o => <g key={o.id} data-life-world={o.id}><ellipse /><path pathLength="100" /></g>)}
    </g>
  </svg>;
});
