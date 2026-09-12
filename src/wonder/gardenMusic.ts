import type { GardenState } from '../garden/gardenState';
import type { ArrangementNote, EnsemblePlan } from '../garden/ensemble';
import { independentNotes } from '../garden/ensemble';
import type { WonderGardenEffect } from './wonderTypes';

export function spatialSlot(effect: WonderGardenEffect, id: string, phrase: number) {
  const index = effect.objectIds.indexOf(id);
  return effect.rule === 'garden-triad-round' ? (index + 3 - phrase % 3) % 3 : index;
}
/** First 12 beats travel; the final bar retains the ENSEMBLE conversation. */
export function applyGardenWonder(base: EnsemblePlan, state: GardenState, effects: WonderGardenEffect[], beat: number): EnsemblePlan {
  const local = beat % 16;
  if (local >= 12 || !effects.length) return base;
  const objectPlans = new Map(base.objectPlans);
  for (const effect of effects) for (const id of effect.objectIds) {
    const object = state.objects.find(o => o.id === id), original = objectPlans.get(id);
    if (!object || !original) continue;
    const slot = spatialSlot(effect, id, Math.floor(beat / 16));
    const width = 12 / effect.objectIds.length, start = slot * width;
    const input = independentNotes(object).slice(0, 24);
    const span = Math.max(1, ...input.map(n => n.beat + n.duration));
    const notes: ArrangementNote[] = input.map(n => {
      const at = Math.min(width - .25, Math.round(n.beat / span * (width - .25) * 4) / 4);
      return { ...n, beat: start + at, duration: Math.min(width - at, Math.max(.125, n.duration * width / span)), velocity: n.velocity * (effect.rule === 'garden-triad-round' && slot === 2 ? .65 : .9) };
    });
    const strength = original.strength * (1 - effect.strength) + effect.strength;
    const blend = [
      ...original.notes.filter(n => original.activeWindows.includes(Math.floor(n.beat / 4))).map(n => ({ ...n, velocity: n.velocity * original.roleWeight * original.strength * (1 - effect.strength) / strength })),
      ...notes.map(n => ({ ...n, velocity: n.velocity * effect.strength / strength })),
    ].filter(n => n.velocity > .005);
    objectPlans.set(id, { ...original, strength, roleWeight: 1, wonder: effect.rule + ':' + slot,
      partnerIds: effect.objectIds.filter(other => other !== id), activeWindows: [0, 1, 2, 3], notes: blend });
  }
  return { ...base, objectPlans };
}
