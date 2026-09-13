import { describe, expect, it } from 'vitest';
import { emptyProject } from '../music/project';
import { exampleStrokes } from '../music/examples';
import { emptyGarden, makeObject } from './gardenState';
import type { GardenLifeEvent } from './life';
import { gardenClearings, gardenLayout, intersectsClearing } from './clearing';
import { emptyGrowth } from './growth';
import { emptyWeave, formationKey, parseWeave, WeaveEvidence, weaveScene } from './weave';

const event = (objectId: string, beat: number, formation: GardenLifeEvent['formation'],
  formationIds: string[]): GardenLifeEvent => ({
  objectId, beat, at: beat, duration: .2, type: 'note', role: 'melody', formation, formationIds,
});

function eventGarden(count = 4) {
  const garden = emptyGarden();
  garden.objects = Array.from({ length: count }, (_, index) => makeObject(
    { ...emptyProject(), strokes: exampleStrokes(index % 2 ? 'wave' : 'heart'), title: 'work-' + index },
    { x: .18 + (index % 4) * .21, y: .3 + Math.floor(index / 4) * .38 }, 'object-' + index));
  return garden;
}

describe('WEAVE evidence', () => {
  it('counts CASCADE only after every audible participant arrives in route order', () => {
    const tracker = new WeaveEvidence();
    const ids = ['a', 'b', 'c'];
    expect(tracker.observe(event('a', 0, 'garden-lineup-cascade', ids))).toBeNull();
    expect(tracker.observe(event('b', 2, 'garden-lineup-cascade', ids))).toBeNull();
    const first = tracker.observe(event('c', 4, 'garden-lineup-cascade', ids));
    expect(first?.formations[formationKey('garden-lineup-cascade', ids)].repetitions).toBe(1);
    expect(tracker.observe(event('b', 5, 'garden-lineup-cascade', ids))).toBeNull();

    // A wrong first voice cannot be repaired by proximity or a later note.
    expect(tracker.observe(event('c', 16, 'garden-lineup-cascade', ids))).toBeNull();
    expect(tracker.observe(event('a', 20, 'garden-lineup-cascade', ids))).toBeNull();
    tracker.resetPhrase();
    expect(tracker.observe(event('a', 16, 'garden-lineup-cascade', ids))).toBeNull();
    expect(tracker.observe(event('b', 18, 'garden-lineup-cascade', ids))).toBeNull();
    const second = tracker.observe(event('c', 20, 'garden-lineup-cascade', ids));
    expect(second?.formations[formationKey('garden-lineup-cascade', ids)].repetitions).toBe(2);
  });

  it('accepts ROUND rotations under one canonical identity and clears partial phrases on stop', () => {
    const tracker = new WeaveEvidence();
    const ids = ['a', 'b', 'c'];
    expect(tracker.observe(event('c', 0, 'garden-triad-round', ['c', 'a', 'b']))).toBeNull();
    expect(tracker.observe(event('a', 1, 'garden-triad-round', ['c', 'a', 'b']))).toBeNull();
    const first = tracker.observe(event('b', 2, 'garden-triad-round', ['c', 'a', 'b']));
    const key = formationKey('garden-triad-round', ids);
    expect(first?.formations[key]).toMatchObject({ objectIds: ids, repetitions: 1 });
    tracker.observe(event('a', 16, 'garden-triad-round', ids));
    tracker.observe(null);
    expect(tracker.observe(event('b', 17, 'garden-triad-round', ids))).toBeNull();
    expect(tracker.observe(event('c', 18, 'garden-triad-round', ids))).toBeNull();
    const second = tracker.observe(event('a', 19, 'garden-triad-round', ids));
    expect(second?.formations[key].repetitions).toBe(2);
  });
});

describe('WEAVE persistence and scenery', () => {
  it('canonicalizes ROUND saves and rejects missing or malformed participants', () => {
    const garden = eventGarden(3);
    const key = formationKey('garden-triad-round', ['object-2', 'object-0', 'object-1']);
    const parsed = parseWeave({ version: 1, formations: {
      [key]: { rule: 'garden-triad-round', objectIds: ['object-2', 'object-0', 'object-1'], repetitions: 2 },
    } }, garden);
    expect(parsed.formations[key].objectIds).toEqual(['object-0', 'object-1', 'object-2']);
    expect(() => parseWeave({ version: 1, formations: {
      'garden-triad-round:a|b|c': { rule: 'garden-triad-round', objectIds: ['a', 'b', 'c'], repetitions: 2 },
    } }, garden)).toThrow();
  });

  it('derives pair scenery only from Growth evidence and keeps paths bounded', () => {
    const garden = eventGarden(12);
    const positions = garden.objects.map((object, index) => ({
      ...object, world: { ...object.world, x: .13 + (index % 4) * .25, y: .17 + Math.floor(index / 4) * .33 },
    }));
    garden.objects = positions;
    const layout = gardenLayout(1440, 900);
    const growth = emptyGrowth();
    growth.relations = Object.fromEntries(garden.objects.slice(0, 6).map((object, index) => {
      const other = garden.objects[index + 6];
      return [JSON.stringify([object.id, other.id].sort()), { a: object.id, b: other.id, sharedBeats: 64 }];
    }));
    const clearings = gardenClearings(garden, growth, layout);
    const scene = weaveScene(garden, growth, emptyWeave(), clearings, layout);
    expect(scene.paths.length).toBeLessThanOrEqual(8);
    expect(scene.patches.length).toBeGreaterThan(0);
    expect(scene.patches.every(mark => clearings.every(clear => !intersectsClearing(mark, clear)))).toBe(true);
    expect(scene.trails.every(mark => clearings.every(clear => !intersectsClearing(mark, clear)))).toBe(true);

    const quiet = weaveScene(garden, emptyGrowth(), emptyWeave(), clearings, layout);
    expect(quiet).toMatchObject({ paths: [], patches: [], trails: [] });
  });

  it('places a repeated ROUND patch outside its three clearings', () => {
    const garden = eventGarden(3);
    garden.objects[0].world = { ...garden.objects[0].world, x: .22, y: .28 };
    garden.objects[1].world = { ...garden.objects[1].world, x: .5, y: .26 };
    garden.objects[2].world = { ...garden.objects[2].world, x: .36, y: .64 };
    const layout = gardenLayout(390, 844);
    const growth = emptyGrowth();
    const clearings = gardenClearings(garden, growth, layout);
    const formation = { rule: 'garden-triad-round' as const, objectIds: garden.objects.map(object => object.id), repetitions: 3 };
    const scene = weaveScene(garden, growth, { version: 1, formations: {
      [formationKey(formation.rule, formation.objectIds)]: formation,
    } }, clearings, layout);
    expect(scene.patches.some(mark => mark.source === 'round')).toBe(true);
    expect(scene.patches.filter(mark => mark.source === 'round')
      .every(mark => clearings.every(clear => !intersectsClearing(mark, clear)))).toBe(true);
  });
});
