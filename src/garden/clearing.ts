import type { GardenState, MusicalObject } from './gardenState';
import type { GrowthState } from './growth';
import { growthStage } from './growth';

export interface GardenLayout { width: number; height: number; artworkWidth: number; artworkHeight: number }
export interface Clearing { id: string; x: number; y: number; rx: number; ry: number }
export interface HabitatMark { index: number; x: number; y: number; width: number; height: number; asset: string; opacity: number }

/** Mirrors the garden's responsive CSS. No DOM measurement or animation-frame reads. */
export function gardenLayout(width: number, height: number): GardenLayout {
  const padding = width <= 420 ? 14 : width <= 760 ? 21 : width <= 1000 ? 30 : 56;
  return {
    width: Math.min(1172, Math.min(1440, width) - padding * 2) - 2,
    height: (width <= 760 ? 500 : Math.max(380, Math.min(610, height * .54))) - 2,
    artworkWidth: width <= 760 ? 62 : Math.max(70, Math.min(142, width * .12)) - 14,
    artworkHeight: width <= 760 ? 64 : Math.max(68, Math.min(124, width * .11)) - 14,
  };
}

const boxes = new WeakMap<MusicalObject['strokeIR'], { x: number; y: number; width: number; height: number }>();
export function artworkBounds(object: MusicalObject) {
  const cached = boxes.get(object.strokeIR);
  if (cached) return cached;
  let x = 1000, y = 420, right = 0, bottom = 0;
  for (const stroke of object.strokeIR) for (const p of stroke.points) {
    x = Math.min(x, p.x); y = Math.min(y, p.y); right = Math.max(right, p.x); bottom = Math.max(bottom, p.y);
  }
  const box = { x: x - 25, y: y - 25, width: Math.max(60, right - x + 50), height: Math.max(50, bottom - y + 50) };
  boxes.set(object.strokeIR, box);
  return box;
}

export function artworkSize(object: MusicalObject, layout: GardenLayout) {
  const box = artworkBounds(object), aspect = box.width / box.height * object.project.canvasAspect * 420 / 1000;
  const width = Math.min(layout.artworkWidth, layout.artworkHeight * aspect);
  return { width, height: width / aspect };
}

export function artworkClearing(object: MusicalObject, stage: number, layout: GardenLayout): Clearing {
  const box = artworkBounds(object), size = artworkSize(object, layout), wide = object.project.canvasAspect > 1.8;
  let rx = Math.max(wide ? 76 : 62, (size.width / 2 + 9) * 1000 / layout.width);
  let ry = Math.max(wide ? 52 : 58, (size.height / 2 + 10) * 1000 / layout.height);
  // Fit the source ink, including dense corners, with room for ALIVE's small body motion.
  let extent = 1;
  for (const s of object.strokeIR) for (const p of s.points) {
    const x = (p.x - box.x - box.width / 2) / box.width * size.width * 1000 / layout.width;
    const y = (p.y - box.y - box.height / 2) / box.height * size.height * 1000 / layout.height;
    extent = Math.max(extent, Math.hypot(x / rx, y / ry) * 1.12);
  }
  rx *= extent; ry *= extent;
  return { id: object.id, x: object.world.x * 1000, y: object.world.y * 1000,
    rx: rx + (stage === 3 ? 10 : 0), ry: ry + (stage === 3 ? 10 : 0) };
}

export function gardenClearings(garden: GardenState, growth: GrowthState, layout: GardenLayout) {
  return garden.objects.map(o => artworkClearing(o, growthStage(growth.objects[o.id] ?? 0), layout));
}

export function seed(id: string) {
  let n = 2166136261;
  for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}

export function intersectsClearing(mark: Pick<HabitatMark, 'x' | 'y' | 'width' | 'height'>, e: Clearing) {
  return Math.hypot(Math.max(0, Math.abs(mark.x - e.x) - mark.width / 2) / e.rx,
    Math.max(0, Math.abs(mark.y - e.y) - mark.height / 2) / e.ry) <= 1;
}

/** Stable perimeter angles. Maturity expands existing anchors before adding more. */
export function habitatMarks(object: MusicalObject, stage: number, owner: Clearing, layout: GardenLayout): HabitatMark[] {
  if (!stage) return [];
  const count = stage === 1 ? 3 : stage === 2 ? 6 : 8;
  return Array.from({ length: count }, (_, index) => {
    const angle = seed(object.id) * Math.PI * 2 + index * 2.399963229728653;
    const small = object.musicalRole === 'rhythm' || object.musicalRole === 'decoration';
    const pixels = (small ? 32 : 40) + (stage - 1) * 2;
    const width = pixels * 1000 / layout.width;
    const height = pixels * (object.musicalRole === 'harmony' ? .7 : 1) * 1000 / layout.height;
    // Include the entire sprite rectangle, not just its centre, in exclusion checks.
    let distance = 5 + stage * 7;
    const mark = { index, x: 0, y: 0, width, height,
      asset: object.musicalRole === 'decoration' ? 'star' :
        object.musicalRole === 'harmony' ? 'flower' :
        object.musicalRole === 'drone' ? 'grass' :
        object.musicalRole === 'rhythm' ? 'seeds' : 'sprout',
      opacity: object.musicalRole === 'decoration' ? .58 : .72 };
    do {
      mark.x = owner.x + Math.cos(angle) * (owner.rx + distance);
      mark.y = owner.y + Math.sin(angle) * (owner.ry + distance);
      distance += 4;
    } while (intersectsClearing(mark, owner));
    return mark;
  });
}

/** Omit competing marks instead of piling pigment up between close neighbours. */
export function gardenHabitats(garden: GardenState, growth: GrowthState, clearings: Clearing[], layout: GardenLayout) {
  const occupied: HabitatMark[] = [], result = new Map<string, HabitatMark[]>();
  for (const object of [...garden.objects].sort((a, b) => a.id.localeCompare(b.id))) {
    const owner = clearings.find(e => e.id === object.id)!;
    const marks = habitatMarks(object, growthStage(growth.objects[object.id] ?? 0), owner, layout).filter(mark => {
      if (mark.x < mark.width / 2 || mark.x > 1000 - mark.width / 2 ||
          mark.y < mark.height / 2 || mark.y > 1000 - mark.height / 2 ||
          clearings.some(e => intersectsClearing(mark, e)) ||
          occupied.some(p => Math.abs(p.x - mark.x) < (p.width + mark.width) * .38 &&
            Math.abs(p.y - mark.y) < (p.height + mark.height) * .38)) return false;
      occupied.push(mark); return true;
    });
    result.set(object.id, marks);
  }
  return result;
}

/** Endpoints lie just beyond the two clearing edges. Touching/overlapping gaps disappear. */
export function clearingPath(a: Clearing, b: Clearing, variation = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
  if (distance < 1) return null;
  const ux = dx / distance, uy = dy / distance;
  const ra = 1 / Math.hypot(ux / a.rx, uy / a.ry) + 2;
  const rb = 1 / Math.hypot(ux / b.rx, uy / b.ry) + 2;
  const gap = distance - ra - rb;
  if (gap < 14) return null;
  const start = { x: a.x + ux * ra, y: a.y + uy * ra };
  const end = { x: b.x - ux * rb, y: b.y - uy * rb };
  const bend = Math.max(-1, Math.min(1, variation)) * Math.min(24, gap * .12);
  const cx = (start.x + end.x) / 2 - uy * bend, cy = (start.y + end.y) / 2 + ux * bend;
  return { start, end, control: { x: cx, y: cy }, opacity: Math.min(1, gap / 60),
    d: `M${start.x} ${start.y} Q${cx} ${cy} ${end.x} ${end.y}` };
}
