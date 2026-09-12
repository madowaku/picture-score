import type { GardenState, MusicalObject } from '../garden/gardenState';
import type { WonderGardenEffect } from './wonderTypes';
const smooth = (n: number) => { const t = Math.min(1, Math.max(0, n)); return t * t * (3 - 2 * t); };
const dist = (a: MusicalObject, b: MusicalObject) => Math.hypot(a.world.x - b.world.x, a.world.y - b.world.y);

/** Tolerance bands, stable tie breaks, and no semantic or random decisions. */
export function gardenRelations(state: GardenState, audible: Map<string, number>): WonderGardenEffect[] {
  const objects = state.objects.filter(o => o.musicIR.playNotes.length && (audible.get(o.id) ?? 0) > .015).sort((a, b) => a.id < b.id ? -1 : 1);
  const candidates: WonderGardenEffect[] = [];
  for (const axis of ['x', 'y'] as const) {
    const cross = axis === 'x' ? 'y' : 'x';
    for (const anchor of objects) {
      const group = objects.filter(o => Math.abs(o.world[cross] - anchor.world[cross]) < .045).sort((a, b) => a.world[axis] - b.world[axis] || (a.id < b.id ? -1 : 1));
      // Split at unreasonable gaps, so unrelated distant works don't prevent a local lineup.
      let run: MusicalObject[] = [];
      const add = () => {
        if (run.length < 3) return;
        const spread = Math.max(...run.map(o => o.world[cross])) - Math.min(...run.map(o => o.world[cross]));
        const strength = smooth((.045 - spread) / .035);
        if (strength > .01) candidates.push({ rule: 'garden-lineup-cascade', objectIds: run.map(o => o.id), strength });
      };
      for (const o of group) {
        const gap = run.length ? o.world[axis] - run.at(-1)!.world[axis] : .15;
        if (gap < .09 || gap > .32) { add(); run = []; }
        run.push(o);
      }
      add();
    }
  }
  for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) for (let k = j + 1; k < objects.length; k++) {
    const group = [objects[i], objects[j], objects[k]], [a, b, c] = group;
    const sides = [dist(a, b), dist(b, c), dist(c, a)], min = Math.min(...sides), max = Math.max(...sides);
    const area = Math.abs((b.world.x - a.world.x) * (c.world.y - a.world.y) - (b.world.y - a.world.y) * (c.world.x - a.world.x)) / 2;
    if (min < .1 || max > .42 || area < .005) continue;
    const strength = smooth((min / max - .65) / .22) * smooth((.42 - max) / .07) * smooth((min - .1) / .04);
    if (strength <= .01) continue;
    const center = { x: group.reduce((s, o) => s + o.world.x, 0) / 3, y: group.reduce((s, o) => s + o.world.y, 0) / 3 };
    group.sort((a, b) => Math.atan2(a.world.y - center.y, a.world.x - center.x) - Math.atan2(b.world.y - center.y, b.world.x - center.x));
    candidates.push({ rule: 'garden-triad-round', objectIds: group.map(o => o.id), strength });
  }
  candidates.sort((a, b) => b.strength - a.strength || b.objectIds.length - a.objectIds.length || a.objectIds.join().localeCompare(b.objectIds.join()));
  const used = new Set<string>();
  return candidates.filter(e => { if (e.objectIds.some(id => used.has(id))) return false; e.objectIds.forEach(id => used.add(id)); return true; });
}

/** Require a relationship identity to persist for 220ms, even during a moving gesture. */
export class StableGardenRelations {
  private pending = '';
  private since = 0;
  private committed: WonderGardenEffect[] = [];
  update(effects: WonderGardenEffect[], now: number) {
    const key = effects.map(e => e.rule + ':' + e.objectIds.join(',')).join('|');
    if (key !== this.pending) { this.pending = key; this.since = now; }
    if (now - this.since >= 220) this.committed = effects;
    else this.committed = this.committed.map(e => ({ ...e, strength: effects.find(n => n.rule === e.rule && n.objectIds.join() === e.objectIds.join())?.strength ?? e.strength }));
    return this.committed;
  }
}
