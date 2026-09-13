import type { GardenState, MusicalObject } from './gardenState';
import type { GardenLifeEvent } from './life';
import type { GrowthState } from './growth';
import { growthStage, pairKey } from './growth';
import { clearingPath, intersectsClearing, seed } from './clearing';
import type { Clearing, GardenLayout, HabitatMark } from './clearing';

export type WeaveRule = 'garden-lineup-cascade' | 'garden-triad-round';
export interface WeaveFormation {
  rule: WeaveRule;
  objectIds: string[];
  repetitions: number;
}
export interface WeaveState {
  version: 1;
  formations: Record<string, WeaveFormation>;
}
export const WEAVE_KEY = 'picture-score:weave:v1';
export const WEAVE_FORMATION_LIMIT = 12;
export const emptyWeave = (): WeaveState => ({ version: 1, formations: {} });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const validRule = (value: unknown): value is WeaveRule =>
  value === 'garden-lineup-cascade' || value === 'garden-triad-round';

function normalizedFormationIds(rule: WeaveRule, objectIds: string[]) {
  return rule === 'garden-triad-round' ? [...objectIds].sort() : [...objectIds];
}
export function formationKey(rule: WeaveRule, objectIds: string[]) {
  return rule + ':' + normalizedFormationIds(rule, objectIds).join('|');
}
export function pruneWeave(state: WeaveState, garden: GardenState): WeaveState {
  const ids = new Set(garden.objects.map(object => object.id));
  const formations = Object.fromEntries(Object.entries(state.formations)
    .filter(([, formation]) => formation.objectIds.every(id => ids.has(id))));
  return { version: 1, formations };
}
export function parseWeave(value: unknown, garden: GardenState): WeaveState {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.formations) ||
    Object.keys(value.formations).length > WEAVE_FORMATION_LIMIT) throw new Error('Invalid weave');
  const ids = new Set(garden.objects.map(object => object.id));
  const formations: Record<string, WeaveFormation> = {};
  for (const [key, raw] of Object.entries(value.formations)) {
    if (!isRecord(raw) || !validRule(raw.rule) || !Array.isArray(raw.objectIds) ||
      raw.objectIds.length < 3 || raw.objectIds.length > 12 ||
      new Set(raw.objectIds).size !== raw.objectIds.length ||
      raw.objectIds.some(id => typeof id !== 'string' || !ids.has(id)) ||
      typeof raw.repetitions !== 'number' || !Number.isInteger(raw.repetitions) ||
      raw.repetitions < 1 || raw.repetitions > 64 || key !== formationKey(raw.rule, raw.objectIds as string[])) throw new Error('Invalid weave');
    const objectIds = normalizedFormationIds(raw.rule, raw.objectIds as string[]);
    formations[key] = { rule: raw.rule, objectIds, repetitions: raw.repetitions };
  }
  return { version: 1, formations };
}
export function loadWeave(garden: GardenState): { state: WeaveState; protected: boolean } {
  try {
    const raw = localStorage.getItem(WEAVE_KEY);
    return { state: raw ? pruneWeave(parseWeave(JSON.parse(raw), garden), garden) : emptyWeave(), protected: false };
  } catch {
    // WEAVE is disposable relationship memory; never block Garden/Growth if it is corrupt.
    return { state: emptyWeave(), protected: false };
  }
}

interface PhraseEvidence {
  phrase: number;
  ids: string[];
  seen: Set<string>;
  order: string[];
  failed: boolean;
  complete: boolean;
}

/** Counts one real formation per audio phrase. Proximity alone never reaches this class. */
export class WeaveEvidence {
  private state: WeaveState;
  private phrases = new Map<string, PhraseEvidence>();
  constructor(initial: WeaveState = emptyWeave()) { this.state = initial; }
  get current() { return this.state; }
  prune(garden: GardenState) {
    this.state = pruneWeave(this.state, garden);
    return this.state;
  }
  resetPhrase() { this.phrases.clear(); }
  observe(event: GardenLifeEvent | null): WeaveState | null {
    if (!event) { this.resetPhrase(); return null; }
    if (!event.formation || !event.formationIds || !validRule(event.formation)) return null;
    const rawIds = [...new Set(event.formationIds)];
    if (rawIds.length < 3 || !rawIds.includes(event.objectId)) return null;
    const ids = normalizedFormationIds(event.formation, rawIds);
    const key = formationKey(event.formation, rawIds);
    const phrase = Math.floor(event.beat / 16);
    let evidence = this.phrases.get(key);
    if (!evidence || evidence.phrase !== phrase || evidence.ids.join('|') !== ids.join('|')) {
      evidence = { phrase, ids, seen: new Set<string>(), order: [], failed: false, complete: false };
    }
    if (evidence.complete || evidence.failed) { this.phrases.set(key, evidence); return null; }
    if (event.formation === 'garden-lineup-cascade') {
      const expected = rawIds[evidence.seen.size];
      if (expected !== event.objectId) {
        evidence.failed = true;
        this.phrases.set(key, evidence);
        return null;
      }
    }
    if (!evidence.seen.has(event.objectId)) {
      evidence.seen.add(event.objectId);
      evidence.order.push(event.objectId);
    }
    this.phrases.set(key, evidence);
    if (evidence.seen.size !== ids.length) return null;
    evidence.complete = true;
    const previous = this.state.formations[key];
    const next: WeaveFormation = {
      rule: event.formation, objectIds: ids,
      repetitions: Math.min(64, (previous?.repetitions ?? 0) + 1),
    };
    this.state = { version: 1, formations: { ...this.state.formations, [key]: next } };
    return this.state;
  }
}

export interface WeavePatch {
  id: string;
  source: 'pair' | 'cascade' | 'round';
  x: number;
  y: number;
  width: number;
  height: number;
  assets: string[];
  opacity: number;
  formationKey?: string;
}
export interface WeaveTrailMark extends WeavePatch {
  index: number;
  /** Segment index along the recorded CASCADE route. */
  step: number;
}
export interface WeavePath {
  key: string;
  a: string;
  b: string;
  d: string;
  opacity: number;
  sharedBeats: number;
}
export interface WeaveScene {
  patches: WeavePatch[];
  trails: WeaveTrailMark[];
  paths: WeavePath[];
}

function objectPair(garden: GardenState, relation: { a: string; b: string }) {
  const a = garden.objects.find(object => object.id === relation.a);
  const b = garden.objects.find(object => object.id === relation.b);
  return a && b ? { a, b } : undefined;
}
function roleAssets(a: MusicalObject, b: MusicalObject) {
  const roles = new Set([a.musicalRole, b.musicalRole]);
  if (roles.has('melody') && roles.has('harmony')) return ['flower', 'sprout'];
  if (roles.has('melody') && roles.has('drone')) return ['grass'];
  if (roles.has('melody') && roles.has('rhythm')) return ['seeds'];
  if (roles.has('melody') && roles.has('decoration')) return ['star'];
  if (roles.has('drone') && roles.has('decoration')) return ['grass', 'star'];
  if (roles.has('rhythm') && roles.has('decoration')) return ['seeds', 'star'];
  if (roles.has('harmony')) return ['flower'];
  if (roles.has('drone')) return ['grass'];
  if (roles.has('decoration')) return ['star'];
  return ['seeds'];
}
function roleAssetsForIds(garden: GardenState, ids: string[]) {
  const objects = ids.map(id => garden.objects.find(object => object.id === id)).filter((object): object is MusicalObject => !!object);
  if (objects.some(object => object.musicalRole === 'harmony') && objects.some(object => object.musicalRole === 'melody')) return ['flower', 'sprout'];
  if (objects.some(object => object.musicalRole === 'drone')) return ['grass'];
  if (objects.some(object => object.musicalRole === 'decoration')) return ['star'];
  return ['seeds'];
}
function markOutside(clearings: Clearing[], x: number, y: number, width: number, height: number) {
  const mark = { x, y, width, height };
  return !clearings.some(clear => intersectsClearing(mark, clear));
}
function inField(mark: Pick<HabitatMark, 'x' | 'y' | 'width' | 'height'>) {
  return mark.x >= mark.width / 2 && mark.x <= 1000 - mark.width / 2 &&
    mark.y >= mark.height / 2 && mark.y <= 1000 - mark.height / 2;
}
function quad(start: { x: number; y: number }, control: { x: number; y: number }, end: { x: number; y: number }, t: number) {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}
function pathIsClear(path: ReturnType<typeof clearingPath>, clearings: Clearing[]) {
  if (!path) return false;
  for (let i = 0; i <= 24; i++) {
    const point = quad(path.start, path.control, path.end, i / 24);
    if (clearings.some(clear =>
      Math.hypot((point.x - clear.x) / clear.rx, (point.y - clear.y) / clear.ry) < .98)) return false;
  }
  return true;
}
function pathMark(path: ReturnType<typeof clearingPath>, clearings: Clearing[], key: string, stage: number, layout: GardenLayout, a: MusicalObject, b: MusicalObject): WeavePatch | null {
  if (!path) return null;
  const width = (stage === 1 ? 24 : stage === 2 ? 29 : 34) * 1000 / layout.width;
  const height = width * .78;
  const dx = path.end.x - path.start.x, dy = path.end.y - path.start.y, distance = Math.hypot(dx, dy);
  const px = -dy / distance, py = dx / distance, sign = seed(key) > .5 ? 1 : -1;
  const mid = { x: (path.start.x + path.end.x) / 2, y: (path.start.y + path.end.y) / 2 };
  const offsets = [0, sign * 18, sign * 36, -sign * 24, sign * 54];
  for (const offset of offsets) {
    const mark = { x: mid.x + px * offset, y: mid.y + py * offset, width, height };
    if (inField(mark) && markOutside(clearings, mark.x, mark.y, width, height))
      return { id: 'pair:' + key, source: 'pair', ...mark, assets: roleAssets(a, b),
        opacity: (.13 + stage * .055) * Math.min(1, path.opacity + .2) };
  }
  return null;
}
function formationPatch(garden: GardenState, formation: WeaveFormation, clearings: Clearing[], layout: GardenLayout): WeavePatch | null {
  const key = formationKey(formation.rule, formation.objectIds);
  if (formation.rule === 'garden-lineup-cascade') return null;
  const points = formation.objectIds.map(id => clearings.find(clear => clear.id === id)).filter((clear): clear is Clearing => !!clear);
  if (points.length !== formation.objectIds.length) return null;
  const width = (formation.repetitions >= 4 ? 48 : 39) * 1000 / layout.width, height = width * .72;
  const center = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
  const angle = seed(key) * Math.PI * 2, shifts = [0, 18, -18, 36, -36, 54];
  for (const shift of shifts) {
    const mark = { x: center.x + Math.cos(angle) * shift, y: center.y + Math.sin(angle) * shift, width, height };
    if (inField(mark) && markOutside(clearings, mark.x, mark.y, width, height))
      return { id: 'round:' + key, source: 'round', ...mark, assets: roleAssetsForIds(garden, formation.objectIds),
        opacity: Math.min(.28, .12 + formation.repetitions * .035), formationKey: key };
  }
  return null;
}
function cascadeTrail(formation: WeaveFormation, clearings: Clearing[], layout: GardenLayout): WeaveTrailMark[] {
  if (formation.rule !== 'garden-lineup-cascade') return [];
  const key = formationKey(formation.rule, formation.objectIds), marks: WeaveTrailMark[] = [];
  const segments = formation.objectIds.slice(0, -1).map((id, index) => {
    const a = clearings.find(clear => clear.id === id), b = clearings.find(clear => clear.id === formation.objectIds[index + 1]);
    return a && b ? { a, b } : null;
  }).filter((segment): segment is { a: Clearing; b: Clearing } => !!segment);
  const count = Math.min(4, 2 + Math.floor(formation.repetitions / 2));
  for (const [segmentIndex, segment] of segments.entries()) {
    const path = clearingPath(segment.a, segment.b, seed(key + ':' + segmentIndex) * 2 - 1);
    if (!path || !pathIsClear(path, clearings)) continue;
    for (let index = 0; index < count; index++) {
      const t = (index + 1) / (count + 1);
      const point = quad(path.start, path.control, path.end, t);
      const width = 15 * 1000 / layout.width, height = width;
      const mark = { x: point.x, y: point.y, width, height };
      if (!inField(mark) || !markOutside(clearings, mark.x, mark.y, width, height)) continue;
      marks.push({ id: 'cascade:' + key + ':' + segmentIndex + ':' + index, source: 'cascade', index: marks.length, step: segmentIndex,
        ...mark, assets: index % 3 === 2 ? ['star'] : ['seeds'], opacity: Math.min(.25, .08 + formation.repetitions * .025), formationKey: key });
    }
  }
  return marks.slice(0, 16);
}

export function weaveScene(garden: GardenState, growth: GrowthState, state: WeaveState, clearings: Clearing[], layout: GardenLayout): WeaveScene {
  const candidates = Object.values(growth.relations).map(relation => {
    const pair = objectPair(garden, relation);
    if (!pair) return null;
    const stage = growthStage(relation.sharedBeats, true);
    const key = pairKey(relation.a, relation.b);
    const path = stage >= 2 ? clearingPath(clearings.find(clear => clear.id === relation.a)!, clearings.find(clear => clear.id === relation.b)!, seed(key) * 2 - 1) : null;
    return { relation, pair, stage, key, path };
  }).filter((candidate): candidate is { relation: { a: string; b: string; sharedBeats: number }; pair: { a: MusicalObject; b: MusicalObject }; stage: number; key: string; path: ReturnType<typeof clearingPath> } => !!candidate)
    .sort((a, b) => b.relation.sharedBeats - a.relation.sharedBeats || a.key.localeCompare(b.key));
  const patches: WeavePatch[] = [], occupied: WeavePatch[] = [];
  for (const candidate of candidates.slice(0, 24)) {
    const patch = pathMark(candidate.path ?? clearingPath(clearings.find(clear => clear.id === candidate.relation.a)!, clearings.find(clear => clear.id === candidate.relation.b)!, seed(candidate.key) * 2 - 1),
      clearings, candidate.key, candidate.stage, layout, candidate.pair.a, candidate.pair.b);
    if (!patch || occupied.some(previous => Math.abs(previous.x - patch.x) < (previous.width + patch.width) * .4 &&
      Math.abs(previous.y - patch.y) < (previous.height + patch.height) * .4)) continue;
    occupied.push(patch); patches.push(patch);
  }
  const paths: WeavePath[] = [];
  for (const candidate of candidates) {
    if (paths.length >= 8 || candidate.stage < 2 || !candidate.path ||
      !pathIsClear(candidate.path, clearings)) continue;
    paths.push({ key: candidate.key, a: candidate.relation.a, b: candidate.relation.b, d: candidate.path.d,
      opacity: Math.min(.32, .07 + candidate.stage * .055 + candidate.relation.sharedBeats / 600), sharedBeats: candidate.relation.sharedBeats });
  }
  const formations = Object.values(state.formations).filter(formation => formation.repetitions >= 2)
    .sort((a, b) => b.repetitions - a.repetitions || formationKey(a.rule, a.objectIds).localeCompare(formationKey(b.rule, b.objectIds)));
  const trails: WeaveTrailMark[] = [];
  for (const formation of formations.slice(0, 3)) {
    const patch = formationPatch(garden, formation, clearings, layout);
    if (patch && !occupied.some(previous => Math.abs(previous.x - patch.x) < (previous.width + patch.width) * .4 &&
      Math.abs(previous.y - patch.y) < (previous.height + patch.height) * .4)) {
      occupied.push(patch); patches.push(patch);
    }
    for (const mark of cascadeTrail(formation, clearings, layout)) {
      if (trails.length >= 16 || occupied.some(previous => Math.abs(previous.x - mark.x) < (previous.width + mark.width) * .35 &&
        Math.abs(previous.y - mark.y) < (previous.height + mark.height) * .35)) continue;
      occupied.push(mark); trails.push(mark);
    }
  }
  return { patches, trails, paths };
}
