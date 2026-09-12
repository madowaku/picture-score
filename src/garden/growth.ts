import type { GardenState } from "./gardenState";
import type { EnsembleRelation } from "./ensemble";

export const GROWTH_KEY = "picture-score:growth:v1";
export const GROWTH_LIMIT = 64;
export const OBJECT_STAGES = [4, 16, 32] as const;
export const RELATION_STAGES = [8, 24, 48] as const;
export interface GrowthState {
  version: 1;
  objects: Record<string, number>;
  relations: Record<string, { a: string; b: string; sharedBeats: number }>;
  discoveries: { object: boolean; relation: boolean };
}
export const emptyGrowth = (): GrowthState => ({
  version: 1, objects: {}, relations: {}, discoveries: { object: false, relation: false },
});
export const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
export const growthStage = (beats: number, relation = false) =>
  (relation ? RELATION_STAGES : OBJECT_STAGES).filter((threshold) => beats >= threshold).length;
export function pruneGrowth(growth: GrowthState, garden: GardenState): GrowthState {
  const ids = new Set(garden.objects.map((o) => o.id));
  return { ...growth,
    objects: Object.fromEntries(Object.entries(growth.objects).filter(([id]) => ids.has(id))),
    relations: Object.fromEntries(Object.entries(growth.relations).filter(([, r]) => ids.has(r.a) && ids.has(r.b))),
  };
}
export function parseGrowth(value: unknown, garden: GardenState): GrowthState {
  const g = value as GrowthState;
  const record = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
  const count = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= GROWTH_LIMIT;
  if (!g || g.version !== 1 || !record(g.objects) || !record(g.relations) ||
    !record(g.discoveries) || typeof g.discoveries.object !== "boolean" || typeof g.discoveries.relation !== "boolean" ||
    Object.keys(g.objects).length > 12 || Object.keys(g.relations).length > 66 ||
    Object.values(g.objects).some((n) => !count(n)) ||
    Object.entries(g.relations).some(([key, r]) => !r || typeof r.a !== "string" || typeof r.b !== "string" ||
      r.a === r.b || key !== pairKey(r.a, r.b) || !count(r.sharedBeats))) throw new Error("Invalid growth");
  return pruneGrowth({ version: 1, objects: { ...g.objects }, relations: { ...g.relations }, discoveries: { ...g.discoveries } }, garden);
}
export function loadGrowth(garden: GardenState): { state: GrowthState; protected: boolean } {
  try {
    const raw = localStorage.getItem(GROWTH_KEY);
    return { state: raw ? parseGrowth(JSON.parse(raw), garden) : emptyGrowth(), protected: false };
  } catch { return { state: emptyGrowth(), protected: true }; }
}
export interface HeardSlice {
  beat: number;
  delta: number;
  audible: string[];
  eligible: string[];
  relations: EnsembleRelation[];
}
/** Transient phrase evidence is deliberately never persisted: no offline or resumed credit. */
export class GrowthAccumulator {
  private phrase = -1;
  private pairs = new Map<string, { a: number; b: number; credited: number }>();
  reset() { this.phrase = -1; this.pairs.clear(); }
  advance(growth: GrowthState, slice: HeardSlice): GrowthState {
    const delta = Math.min(.25, Math.max(0, slice.delta));
    if (!delta) return growth;
    const phrase = Math.floor(slice.beat / 16);
    if (phrase !== this.phrase) { this.phrase = phrase; this.pairs.clear(); }
    const heard = new Set(slice.audible), eligible = new Set(slice.eligible);
    const objects = { ...growth.objects }, relations = { ...growth.relations };
    for (const id of heard) Object.defineProperty(objects, id, { enumerable: true, configurable: true, writable: true,
      value: Math.min(GROWTH_LIMIT, (Object.hasOwn(objects, id) ? objects[id] : 0) + delta) });
    const active = new Set<string>();
    for (const relation of slice.relations) {
      if (relation.strength < .35 || !eligible.has(relation.a) || !eligible.has(relation.b)) continue;
      const key = pairKey(relation.a, relation.b);
      active.add(key);
      const evidence = this.pairs.get(key) ?? { a: 0, b: 0, credited: 0 };
      if (heard.has(relation.a)) evidence.a += delta * relation.strength;
      if (heard.has(relation.b)) evidence.b += delta * relation.strength;
      // Both must actually have spoken in this phrase. A call alone earns no path.
      const shared = Math.min(evidence.a, evidence.b);
      const earned = Math.max(0, shared - evidence.credited);
      evidence.credited = shared; this.pairs.set(key, evidence);
      if (earned) relations[key] = { a: relation.a, b: relation.b,
        sharedBeats: Math.min(GROWTH_LIMIT, (relations[key]?.sharedBeats ?? 0) + earned) };
    }
    for (const key of this.pairs.keys()) if (!active.has(key)) this.pairs.delete(key);
    return { ...growth, objects, relations };
  }
}
