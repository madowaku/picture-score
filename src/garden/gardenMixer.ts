import type { GardenState, MusicalRole, Position } from "./gardenState";
import { gardenRelations } from "../wonder/gardenRelations";

/** Smoothstep has zero slope at both the near and far boundary. */
export function distanceGain(a: Position, b: Position): number {
  const t = Math.min(1, Math.max(0, (Math.hypot(a.x - b.x, a.y - b.y) - 0.06) / 0.5));
  return 1 - t * t * (3 - 2 * t);
}
export function mixGarden(garden: GardenState, cycle = 0): Map<string, number> {
  const caps: Record<MusicalRole, number> = { melody: 2, harmony: 1, drone: 1, rhythm: 2, decoration: 2 };
  let ornaments = 0;
  const candidates = garden.objects.map((object, index) => ({ object,
    gain: distanceGain(object.world, garden.listener),
    // Give equally close neighbours a turn each four-bar cycle, deterministically.
    priority: (index - cycle % Math.max(1, garden.objects.length) + garden.objects.length) % Math.max(1, garden.objects.length),
  })).sort((a, b) => b.gain - a.gain || a.priority - b.priority);
  const result = new Map(garden.objects.map((o) => [o.id, 0]));
  const spatial = new Set(gardenRelations(garden, new Map(candidates.map(c => [c.object.id, c.gain])))
    .filter(e => e.strength > .05).flatMap(e => e.objectIds));
  for (const { object, gain } of candidates) {
    const role = object.musicalRole;
    const ornament = role === "rhythm" || role === "decoration";
    if (gain < 0.005 || (!spatial.has(object.id) && (caps[role] <= 0 || (ornament && ornaments >= 2)))) continue;
    caps[role]--;
    if (ornament) ornaments++;
    result.set(object.id, gain * (role === "drone" || role === "harmony" ? 0.6 : 0.85));
  }
  const total = [...result.values()].reduce((sum, gain) => sum + gain, 0);
  const normalization = 0.75 / Math.max(1, total);
  return new Map([...result].map(([id, gain]) => [id, gain * normalization]));
}
