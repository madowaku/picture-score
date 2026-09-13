import type { MusicalRole, Position } from './gardenState';
import type { RelationKind } from './ensemble';
import type { WonderRuleId } from '../wonder/wonderTypes';

export interface LifeSource {
  strokeId: string;
  point: Position;
  loop?: number;
  thicken?: number;
  spark?: Position;
  mirror?: 'question' | 'answer';
}
/** Transient observations in AudioContext seconds. Never part of a saved IR. */
export interface GardenLifeEvent {
  objectId: string;
  type: 'note' | 'sustain-start' | 'sustain-end' | 'relation' | 'spotlight' | 'tap';
  at: number;
  beat: number;
  pitch?: number;
  velocity?: number;
  duration: number;
  role: MusicalRole;
  layer?: 'free' | 'ensemble';
  source?: LifeSource;
  relation?: RelationKind;
  partnerId?: string;
  formation?: WonderRuleId;
  /** Ordered participants that actually produced a WONDER garden phrase. */
  formationIds?: string[];
  token?: number;
}
export const LIFE_LIMITS = { queue: 256, perObjectInterval: .125, globalPerSecond: 64, staleAfter: .15 };

/** A separate UI clock reader: listeners never run inside the audio scheduling loop. */
export class GardenLifeBridge {
  onEvent?: (event: GardenLifeEvent | null) => void;
  private pending: GardenLifeEvent[] = [];
  private last = new Map<string, number>();
  private active = new Map<string, number>();
  private delivered: number[] = [];
  private serial = 0;
  private timer?: ReturnType<typeof setInterval>;
  get pendingCount() { return this.pending.length; }

  start(clock: () => number, audible: (event: GardenLifeEvent) => boolean) {
    this.clear();
    this.timer = setInterval(() => this.flush(clock(), audible), 16);
  }
  enqueue(event: GardenLifeEvent) {
    if (!Number.isFinite(event.at + event.duration) || event.duration < 0 || this.pending.length >= LIFE_LIMITS.queue) return;
    this.pending.push({ ...event, formationIds: event.formationIds ? [...event.formationIds] : undefined,
      source: event.source ? { ...event.source, point: { ...event.source.point }, spark: event.source.spark ? { ...event.source.spark } : undefined } : undefined, token: ++this.serial });
  }
  /** Pure clock seam for tests; stale attacks are skipped instead of caught up. */
  flush(now: number, audible: (event: GardenLifeEvent) => boolean) {
    const due = this.pending.filter(e => e.at <= now).sort((a, b) => a.at - b.at || (a.token ?? 0) - (b.token ?? 0));
    this.pending = this.pending.filter(e => e.at > now);
    this.delivered = this.delivered.filter(at => now - at < 1);
    // Chord tones and crossfaded branches share one body response. Keep localized
    // WONDER cues even when the corresponding added note is not the first pitch.
    const attacks = new Map<string, GardenLifeEvent>();
    const ready: GardenLifeEvent[] = [];
    for (const event of due) {
      if (event.type === 'sustain-end') { ready.push(event); continue; }
      if (now - event.at > LIFE_LIMITS.staleAfter || !audible(event)) continue;
      if (event.type === 'relation' || event.type === 'spotlight') { ready.push(event); continue; }
      const key = event.objectId + ':' + event.at;
      const first = attacks.get(key);
      if (!first) { attacks.set(key, event); ready.push(event); continue; }
      first.duration = Math.max(first.duration, event.duration);
      if (event.type === 'sustain-start') first.type = 'sustain-start';
      if (event.formation) { first.formation = event.formation; first.formationIds = event.formationIds ? [...event.formationIds] : first.formationIds; }
      if (event.relation) { first.relation = event.relation; first.partnerId = event.partnerId; }
      if (event.source) {
        const before = first.source;
        first.source = { ...event.source,
          loop: before?.loop ?? event.source.loop, thicken: before?.thicken ?? event.source.thicken,
          spark: before?.spark ?? event.source.spark, mirror: before?.mirror ?? event.source.mirror };
      }
    }
    for (const event of ready) {
      if (event.type === 'sustain-end') {
        if (this.active.get(event.objectId) === event.token) { this.active.delete(event.objectId); this.publish(event); }
        continue;
      }
      if (event.type !== 'spotlight' && event.type !== 'relation') {
        if (event.at - (this.last.get(event.objectId) ?? -Infinity) < LIFE_LIMITS.perObjectInterval || this.delivered.length >= LIFE_LIMITS.globalPerSecond) continue;
        this.last.set(event.objectId, event.at); this.delivered.push(now);
        this.active.set(event.objectId, event.token!);
      }
      this.publish(event);
      if (event.type === 'sustain-start') this.pending.push({ ...event, type: 'sustain-end', at: event.at + event.duration, duration: 0 });
    }
  }
  remove(id: string) {
    this.pending = this.pending.filter(e => e.objectId !== id);
    this.last.delete(id); this.active.delete(id);
  }
  private publish(event: GardenLifeEvent | null) {
    try { this.onEvent?.(event); } catch { /* A presentation failure cannot interrupt music. */ }
  }
  clear() {
    clearInterval(this.timer); this.timer = undefined;
    this.pending = []; this.last.clear(); this.active.clear(); this.delivered = [];
    this.publish(null);
  }
}

/** One bounded body response per attack; held poses use the actual note duration. */
export function roleMotion(role: MusicalRole, duration: number, direction = 0) {
  const tilt = Math.max(-1, Math.min(1, direction)) * 2;
  switch (role) {
    case 'melody': return { duration: Math.max(320, Math.min(1400, duration * 1000)), frames: ['translateY(0) scale(1)', `translateY(-6px) rotate(${tilt}deg) scale(1.035)`, 'translateY(-2px) scale(1.01)', 'translateY(0) scale(1)'] };
    case 'harmony': return { duration: 650, frames: ['scale(1)', 'scale(1.07,1.035)', 'scale(1.025,1.01)', 'scale(1)'] };
    case 'drone': return { duration: Math.max(900, duration * 1000), frames: ['rotate(0deg) scale(1)', 'rotate(-1.8deg) scale(1.025)', 'rotate(1.8deg) scale(1.035)', 'rotate(0deg) scale(1)'] };
    case 'rhythm': return { duration: 290, frames: ['scale(1.03,.97)', 'translateY(-4px) scale(.99,1.02)', 'scale(1.02,.99)', 'scale(1)'] };
    case 'decoration': return { duration: 380, frames: ['rotate(0deg)', 'rotate(-3deg) scale(1.025)', 'rotate(2deg)', 'rotate(0deg)'] };
  }
}
