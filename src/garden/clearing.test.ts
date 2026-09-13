import { describe, expect, it } from 'vitest';
import { emptyGarden, makeObject } from './gardenState';
import { emptyGrowth } from './growth';
import { emptyProject } from '../music/project';
import { exampleStrokes } from '../music/examples';
import {
  artworkBounds,
  artworkClearing,
  artworkSize,
  clearingPaletteRole,
  clearingPath,
  gardenClearings,
  gardenHabitats,
  gardenLayout,
  habitatMarks,
  intersectsClearing,
} from './clearing';
import type { Stroke } from '../music/types';

const line = (points: number[][]): Stroke[] => [{ id: 'line', points: points.map(([x, y], time) => ({ x, y, time, pressure: .5 })) }];
const shapes = [exampleStrokes('cat'), exampleStrokes('wave'),
  line([[500, 160], [510, 190], [540, 190], [515, 210], [525, 240], [500, 220], [475, 240], [485, 210], [460, 190], [490, 190], [500, 160]]),
  line([[500, 30], [510, 390]])];
const objects = shapes.map((strokes, i) => makeObject({ ...emptyProject(), strokes }, { x: .3 + i % 2 * .4, y: .3 + Math.floor(i / 2) * .4 }, 'shape-' + i));

describe('CLEARING rendering geometry', () => {
  it('protects the actual source ink at every responsive size without touching IR', () => {
    const before = structuredClone(objects);
    for (const [width, height] of [[320, 740], [390, 844], [720, 900], [761, 650], [1440, 900], [1920, 1080]]) {
      const layout = gardenLayout(width, height);
      for (const object of objects) for (const stage of [0, 1, 2, 3]) {
        const box = artworkBounds(object), size = artworkSize(object, layout), e = artworkClearing(object, stage, layout);
        for (const stroke of object.strokeIR) for (const point of stroke.points) {
          const x = (point.x - box.x - box.width / 2) / box.width * size.width * 1000 / layout.width;
          const y = (point.y - box.y - box.height / 2) / box.height * size.height * 1000 / layout.height;
          expect(Math.hypot(x / e.rx, y / e.ry)).toBeLessThan(.95);
        }
      }
    }
    expect(objects).toEqual(before);
  });

  it('matures outward at stable angles and keeps no more than eight marks', () => {
    const layout = gardenLayout(390, 844), object = objects[0];
    const early = artworkClearing(object, 1, layout), mature = artworkClearing(object, 3, layout);
    const first = habitatMarks(object, 1, early, layout), last = habitatMarks(object, 3, mature, layout);
    expect(first).toHaveLength(3); expect(last).toHaveLength(8);
    first.forEach((m, i) => {
      expect(Math.hypot(last[i].x - mature.x, last[i].y - mature.y)).toBeGreaterThan(Math.hypot(m.x - early.x, m.y - early.y));
      expect(intersectsClearing(last[i], mature)).toBe(false);
    });
    expect(habitatMarks(object, 3, mature, layout)).toEqual(last);
  });

  it('omits conflicting marks in a close pair and a dense twelve-work garden', () => {
    for (const close of [false, true]) {
      const garden = { ...emptyGarden(), objects: Array.from({ length: close ? 2 : 12 }, (_, i) =>
        makeObject(objects[i % 4].project, close ? { x: .5 + i * .01, y: .5 } :
          { x: .15 + i % 4 * .23, y: .2 + Math.floor(i / 4) * .3 }, 'dense-' + i)) };
      const growth = { ...emptyGrowth(), objects: Object.fromEntries(garden.objects.map(o => [o.id, 64])) };
      const before = structuredClone({ garden, growth }), layout = gardenLayout(390, 844);
      const clearings = gardenClearings(garden, growth, layout), habitats = gardenHabitats(garden, growth, clearings, layout);
      const all = [...habitats.values()].flat();
      expect(all.length).toBeGreaterThan(0); expect(all.length).toBeLessThan(garden.objects.length * 8);
      for (const marks of habitats.values()) {
        expect(marks.length).toBeLessThanOrEqual(8);
        for (const mark of marks) expect(clearings.some(e => intersectsClearing(mark, e))).toBe(false);
      }
      expect(gardenHabitats(garden, growth, clearings, layout)).toEqual(habitats);
      expect({ garden, growth }).toEqual(before);
    }
  });

  it('bridges every legacy Garden role to the official Clearing palette asset', () => {
    const layout = gardenLayout(390, 844), owner = artworkClearing(objects[0], 3, layout);
    const expected = new Map([
      ['melody', ['melody', '/art/clearing-sprout.webp']],
      ['harmony', ['harmony', '/art/clearing-flower.webp']],
      ['drone', ['resonance', '/art/clearing-grass.webp']],
      ['rhythm', ['rhythm', '/art/clearing-seeds.webp']],
      ['decoration', ['ornament', '/art/clearing-star.webp']],
    ] as const);
    for (const [legacyRole, [paletteRole, src]] of expected) {
      const object = { ...objects[0], musicalRole: legacyRole as typeof objects[0]['musicalRole'] };
      expect(clearingPaletteRole(object.musicalRole)).toBe(paletteRole);
      const marks = habitatMarks(object, 3, owner, layout);
      expect(marks.every(mark => mark.role === paletteRole)).toBe(true);
      expect(marks.every(mark => mark.assetSrc === src)).toBe(true);
    }
  });

  it('connects ellipse edges and suppresses overlapping or coincident clearings', () => {
    const a = { id: 'a', x: 200, y: 200, rx: 90, ry: 62 }, b = { ...a, id: 'b', x: 700, y: 450 };
    const path = clearingPath(a, b, .7)!;
    expect(Math.hypot((path.start.x - a.x) / a.rx, (path.start.y - a.y) / a.ry)).toBeGreaterThan(1);
    expect(Math.hypot((path.end.x - b.x) / b.rx, (path.end.y - b.y) / b.ry)).toBeGreaterThan(1);
    expect(path.d).not.toMatch(/NaN|Infinity/);
    expect(clearingPath(a, { ...b, x: 220, y: 210 })).toBeNull();
    expect(clearingPath(a, a)).toBeNull();
  });
});
