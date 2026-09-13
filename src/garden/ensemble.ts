import type { PlayNote, MusicIR } from "../music/types";
import { applyDrawWonder } from "../wonder/drawMusic";
import { drawRelations } from "../wonder/drawRelations";
import type { LifeSource } from "./life";
import type { WonderRuleId } from "../wonder/wonderTypes";
const performances = new WeakMap<MusicIR, MusicIR>();
import type { GardenState, MusicalObject, Position } from "./gardenState";

export type RelationKind = "call-response" | "support" | "pulse-fill" | "sparkle-fill" | "shared-bed";
export interface EnsembleRelation { a: string; b: string; strength: number; kind: RelationKind }
export interface ArrangementNote { pitch: number; beat: number; duration: number; velocity: number; life?: LifeSource; formation?: WonderRuleId; formationIds?: string[] }
export interface ObjectArrangementPlan {
  wonder?: string;
  strength: number;
  roleWeight: number;
  activeWindows: number[];
  partnerIds: string[];
  kind?: RelationKind;
  notes: ArrangementNote[];
}
export interface EnsemblePlan {
  relations: EnsembleRelation[];
  objectPlans: Map<string, ObjectArrangementPlan>;
}
const quarter = (n: number) => Math.round(n * 4) / 4;
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Smooth near/far boundaries: at .22 the relationship is half-strength. */
export function proximityStrength(a: Position, b: Position) {
  const t = clamp((.34 - Math.hypot(a.x - b.x, a.y - b.y)) / .24, 0, 1);
  return t * t * (3 - 2 * t);
}
export function independentNotes(object: MusicalObject): ArrangementNote[] {
  let performance = performances.get(object.musicIR);
  if (!performance) {
    performance = applyDrawWonder(object.musicIR, drawRelations(object.strokeIR));
    performances.set(object.musicIR, performance);
  }
  const first = performance.playNotes[0]?.beat ?? 0;
  const effects = drawRelations(object.strokeIR);
  const sources = new Map(object.scoreIR.map(n => [n.id, n]));
  return boundNotes(performance.playNotes.map((n) => ({
    pitch: n.pitch, beat: Math.min(15.75, quarter(n.beat - first)),
    duration: n.duration,
    velocity: Math.min(.65, n.velocity),
    life: (() => {
      const anchor = sources.get(n.anchorId);
      if (!anchor) return undefined;
      const related = effects.filter(e => e.strokeIds.includes(anchor.sourceStroke));
      const spark = n.id.startsWith('spark:') ? related.find(e => e.rule === 'crossing-spark' && Math.abs(e.position.x * .016 - n.beat) < .01) : undefined;
      const mirror = related.find(e => e.rule === 'mirror-answer');
      return { strokeId: anchor.sourceStroke, point: { ...anchor.sourcePosition },
        loop: n.id.includes(':loop') ? 1 : undefined,
        thicken: related.find(e => e.rule === 'retrace-thicken')?.stage,
        spark: spark?.position,
        mirror: mirror ? anchor.sourcePosition.x > mirror.position.x ? 'answer' as const : 'question' as const : undefined };
    })(),
  })));
}
/** Deterministic density/voice ceiling, including duplicate pitches in scribbles. */
function boundNotes(notes: ArrangementNote[], perTick = 6) {
  const counts = new Map<number, Set<number>>();
  return notes.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch).filter((n) => {
    const pitches = counts.get(n.beat) ?? new Set<number>();
    if (pitches.size >= perTick || pitches.has(n.pitch)) return false;
    pitches.add(n.pitch); counts.set(n.beat, pitches); return true;
  });
}
function sample<T>(notes: T[], count: number): T[] {
  if (notes.length <= count) return notes;
  return Array.from({ length: count }, (_, i) => notes[Math.round(i * (notes.length - 1) / (count - 1))]);
}
function melodyWindow(object: MusicalObject, start: number): ArrangementNote[] {
  const notes = sample(independentNotes(object), 32);
  const span = Math.max(1, (notes.at(-1)?.beat ?? 0) + .5);
  return boundNotes(notes.map((n) => {
    const local = Math.min(7.5, quarter(n.beat * 7.5 / span));
    return { ...n, beat: start + local, duration: clamp(n.duration * 8 / span, .15, Math.max(.15, 7.85 - local)) };
  }), 3);
}
function noteAt(source: PlayNote[], index: number, beat: number, duration: number, velocity = .8): ArrangementNote {
  const note = source[index % source.length];
  return { pitch: note.pitch, beat, duration, velocity: Math.min(.65, note.velocity) * velocity };
}

/** Derived only: no changes to persisted projects or any source IR. Called at beat boundaries. */
export function buildEnsemblePlan(state: GardenState, listenerMix: Map<string, number>, phraseIndex: number): EnsemblePlan {
  const objects = [...state.objects].sort((a, b) => compare(a.id, b.id));
  const objectPlans = new Map<string, ObjectArrangementPlan>(objects.map((o) => [o.id, {
    strength: 0, roleWeight: 1, activeWindows: [0, 1, 2, 3], partnerIds: [], notes: independentNotes(o),
  }]));
  const candidates: EnsembleRelation[] = [];
  for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) {
    const a = objects[i], b = objects[j];
    const audible = Math.min(1, (listenerMix.get(a.id) ?? 0) / .04, (listenerMix.get(b.id) ?? 0) / .04);
    const strength = proximityStrength(a.world, b.world) * audible;
    if (strength <= .001) continue;
    const roles = [a.musicalRole, b.musicalRole];
    let kind: RelationKind | undefined;
    if (roles.every((r) => r === "melody")) kind = "call-response";
    else if (roles.includes("melody")) kind = roles.includes("rhythm") ? "pulse-fill" :
      roles.includes("decoration") ? "sparkle-fill" : "support";
    else if (roles.includes("harmony") && roles.includes("drone")) kind = "shared-bed";
    else if (roles.includes("rhythm") && roles.includes("decoration")) kind = "sparkle-fill";
    if (kind) candidates.push({ a: a.id, b: b.id, strength, kind });
  }
  candidates.sort((a, b) => b.strength - a.strength || compare(a.a, b.a) || compare(a.b, b.b));
  const relations: EnsembleRelation[] = [];
  const paired = new Set<string>();
  for (const relation of candidates.filter((r) => r.kind === "call-response")) {
    if (paired.has(relation.a) || paired.has(relation.b)) continue;
    paired.add(relation.a); paired.add(relation.b); relations.push(relation);
    // Stable partners, alternating who asks first each phrase; nobody permanently loses a turn.
    [relation.a, relation.b].forEach((id, index) => {
      const start = (index + Math.floor(phraseIndex)) % 2 === 0 ? 0 : 8;
      const plan = objectPlans.get(id)!;
      Object.assign(plan, { strength: relation.strength, kind: relation.kind,
        activeWindows: start === 0 ? [0, 1] : [2, 3],
        partnerIds: [id === relation.a ? relation.b : relation.a],
        notes: melodyWindow(objects.find((o) => o.id === id)!, start) });
    });
  }
  const order = { melody: 0, harmony: 1, drone: 2, rhythm: 3, decoration: 4 };
  for (const object of objects.filter((o) => o.musicalRole !== "melody").sort((a, b) => order[a.musicalRole] - order[b.musicalRole])) {
    const options = candidates.filter((r) => r.a === object.id || r.b === object.id);
    const other = (r: EnsembleRelation) => objects.find((o) => o.id === (r.a === object.id ? r.b : r.a))!;
    // Prefer a melody as the musical anchor, then a conservative bed/fill partner.
    const relation = options.find((r) => other(r).musicalRole === "melody") ?? options[0];
    if (!relation || !object.musicIR.playNotes.length) continue;
    const partner = other(relation), anchor = objectPlans.get(partner.id)!;
    const plan = objectPlans.get(object.id)!;
    const windows = partner.musicalRole === "melody" ? anchor.activeWindows : [0, 1, 2, 3];
    const source = object.musicIR.playNotes;
    let notes: ArrangementNote[] = [];
    if (object.musicalRole === "harmony") {
      for (const window of windows) {
        // Keep chord colors, but only one bounded chord at each strong bar entrance.
        const first = source[window % source.length];
        const chord = source.filter((n) => Math.abs(n.beat - first.beat) < .01).slice(0, 3);
        notes.push(...chord.map((n) => ({ pitch: n.pitch, beat: window * 4, duration: 2.8, velocity: Math.min(.5, n.velocity) })));
      }
    } else if (object.musicalRole === "drone") {
      // One sustained bed per contiguous span, not a new bass attack at every melody event.
      for (let i = 0; i < windows.length; i++) {
        const start = windows[i]; let end = start;
        while (windows[i + 1] === end + 1) { end++; i++; }
        notes.push(noteAt(source, start, start * 4, (end - start + 1) * 4 - .15, .7));
      }
    } else {
      const occupied = anchor.notes;
      const slots = Array.from({ length: 32 }, (_, i) => i * .5).filter((beat) => {
        const inWindow = windows.includes(Math.floor(beat / 4));
        // Offbeat pulse / phrase-end sparkle. Also use the anchor's resting half.
        const candidate = object.musicalRole === "rhythm" ? beat % 1 === .5 :
          (beat % 4 === 3.5 || !inWindow && beat % 4 === 1.5);
        return candidate && !occupied.some((n) => Math.abs(n.beat - beat) < .26);
      });
      notes = sample(slots, object.musicalRole === "rhythm" ? 12 : 4)
        .map((beat, i) => noteAt(source, i, beat, object.musicalRole === "rhythm" ? .18 : .35, .7));
    }
    Object.assign(plan, { strength: relation.strength, kind: relation.kind,
      roleWeight: object.musicalRole === "drone" ? .7 : .85,
      activeWindows: object.musicalRole === "rhythm" || object.musicalRole === "decoration" ? [0, 1, 2, 3] : windows,
      partnerIds: [partner.id], notes: boundNotes(notes, 3) });
    if (!relations.includes(relation)) relations.push(relation);
  }
  return { relations, objectPlans };
}
