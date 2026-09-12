import { outputBus, voice } from "../music/audio";
import type { GardenState, MusicalObject } from "./gardenState";
import { mixGarden } from "./gardenMixer";
import { buildEnsemblePlan, independentNotes, proximityStrength } from "./ensemble";
import type { ArrangementNote, EnsemblePlan, ObjectArrangementPlan } from "./ensemble";
import type { HeardSlice } from "./growth";
import { gardenRelations, StableGardenRelations } from "../wonder/gardenRelations";
import { applyGardenWonder } from "../wonder/gardenMusic";
import type { WonderGardenEffect } from "../wonder/wonderTypes";
import { GardenLifeBridge } from './life';
import type { GardenLifeEvent } from './life';

type Layer = "free" | "ensemble";
type Activity = { at: number; until: number; layer: Layer; pitch: number };
type Lane = {
  object: MusicalObject; gain: GainNode; free: GainNode; ensemble: GainNode;
  next: number; phase: number; voices: Set<OscillatorNode>;
  layerVoices: Record<Layer, Set<OscillatorNode>>;
  notes: ArrangementNote[]; activity: Activity[];
};
/** One AudioContext, one scheduler, two persistent crossfaded buses per artwork. */
export class GardenTransport {
  private ctx?: AudioContext;
  private master?: GainNode;
  private lanes = new Map<string, Lane>();
  private state?: GardenState;
  private startTime = 0;
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  private next = 0;
  private planBeat = -1;
  private currentPlan?: EnsemblePlan;
  private spatialStability = new StableGardenRelations();
  private spatialEffects: WonderGardenEffect[] = [];
  get wonder() { return this.spatialEffects; }
  private heardTick = -1;
  private tapVoices = new Set<OscillatorNode>();
  private spotlightId?: string;
  private spotlightUntil = -1;
  onHeard?: (slice: HeardSlice | null) => void;
  private life = new GardenLifeBridge();
  get onLifeEvent() { return this.life.onEvent; }
  set onLifeEvent(listener: ((event: GardenLifeEvent | null) => void) | undefined) { this.life.onEvent = listener; }
  private startLife() {
    this.life.start(() => this.ctx!.currentTime, event => {
      if (!this.running || document.hidden || this.ctx?.state !== 'running') return false;
      const lane = this.lanes.get(event.objectId);
      return !!lane && (event.type === 'tap' || event.type === 'spotlight' ||
        lane.gain.gain.value * (event.layer ? lane[event.layer].gain.value : 1) > .015);
    });
  }
  running = false;
  get beat() { return this.running && this.ctx && this.state ? Math.max(0, (this.ctx.currentTime - this.startTime) * this.state.bpm / 60) : 0; }
  get plan() { return this.currentPlan; }
  isSounding(id: string) {
    const lane = this.lanes.get(id), now = this.ctx?.currentTime ?? 0;
    return !!(this.running && lane && lane.gain.gain.value > .015 &&
      lane.activity.some((event) => event.at <= now && event.until > now && lane[event.layer].gain.value > .025));
  }
  async start(state: GardenState) {
    this.stop();
    const generation = ++this.generation;
    if (!this.ctx) { this.ctx = new AudioContext(); this.master = outputBus(this.ctx); }
    await this.ctx.resume();
    if (generation !== this.generation) return;
    this.state = state;
    this.startTime = this.ctx.currentTime + 0.06;
    this.running = true;
    this.startLife();
    this.update(state);
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }
  update(state: GardenState) {
    if (this.running && this.state && this.ctx && this.state.bpm !== state.bpm) {
      const beat = this.beat;
      this.startTime = this.ctx.currentTime - beat * 60 / state.bpm;
      this.next = Math.ceil(beat * 4 - .0001) / 4;
      this.planBeat = -1;
      this.startLife();
      for (const lane of this.lanes.values()) {
        this.clearVoices(lane);
        lane.free.gain.cancelScheduledValues(this.ctx.currentTime);
        lane.ensemble.gain.cancelScheduledValues(this.ctx.currentTime);
      }
    }
    this.state = state;
    if (!this.ctx || !this.master || !this.running) return;
    const ids = new Set(state.objects.map((o) => o.id));
    for (const [id, lane] of this.lanes) if (!ids.has(id)) {
      this.life.remove(id);
      this.clearVoices(lane);
      lane.free.disconnect(); lane.ensemble.disconnect(); lane.gain.disconnect();
      this.lanes.delete(id);
    }
    for (const object of state.objects) {
      const existing = this.lanes.get(object.id);
      if (existing) {
        if (existing.object.musicIR !== object.musicIR) existing.notes = independentNotes(object);
        existing.object = object;
      } else {
        const gain = this.ctx.createGain(); gain.gain.value = 0; gain.connect(this.master);
        const free = this.ctx.createGain(), ensemble = this.ctx.createGain();
        free.gain.value = 1; ensemble.gain.value = 0;
        free.connect(gain); ensemble.connect(gain);
        // Never insert into an already scheduled lookahead slice.
        const entryBeat = Math.ceil(Math.max(this.beat, this.next));
        this.lanes.set(object.id, { object, gain, free, ensemble, next: entryBeat, phase: entryBeat,
          voices: new Set(), layerVoices: { free: new Set(), ensemble: new Set() },
          notes: independentNotes(object), activity: [] });
      }
    }
    // Movement only updates distance gain here. Arrangement enters at the next beat.
    this.applyMix();
  }
  private applyMix() {
    if (!this.state || !this.ctx) return;
    if (this.spotlightId && this.beat >= this.spotlightUntil) {
      this.spotlightId = undefined;
      this.spotlightUntil = -1;
    }
    const mix = mixGarden(this.state, Math.floor(this.beat / 16));
    const spotlight = this.spotlightId && this.beat < this.spotlightUntil ? this.spotlightId : undefined;
    for (const [id, lane] of this.lanes) {
      const base = mix.get(id) ?? 0;
      const factor = spotlight ? id === spotlight ? 1.25 : .68 : 1;
      const target = spotlight && id === spotlight
        ? Math.max(.12, base * factor)
        : spotlight && base > .005
          ? Math.max(.02, base * factor)
          : base * factor;
      lane.gain.gain.setTargetAtTime(Math.min(.75, target), this.ctx.currentTime, 0.12);
    }
  }

  /** Audition one or two placed works. A running garden shares its next quarter boundary. */
  ping(ids: string | string[]) {
    if (!this.ctx || !this.master || !this.state) return;
    const requested = Array.isArray(ids) ? ids : [ids];
    const unique = [...new Set(requested)].map((id) => this.lanes.get(id)).filter((lane): lane is Lane => !!lane);
    if (!unique.length) return;
    const seconds = 60 / this.state.bpm;
    const now = this.ctx.currentTime;
    const at = this.running
      ? Math.max(now + .012, this.startTime + Math.ceil(this.beat - .0001) * seconds)
      : now + .02;
    unique.forEach((lane, laneIndex) => {
      lane.notes.slice(0, 3).forEach((note, index) => {
        const start = at + index * .115 + laneIndex * .012;
        const nodes = voice(this.ctx!, this.master!, note.pitch, start,
          Math.min(.18, Math.max(.08, note.duration * seconds * .55)),
          Math.min(.32, note.velocity * .55),
          lane.object.musicalRole === "decoration" ? "Pluck" : lane.object.project.instrument);
        this.life.enqueue({ objectId: lane.object.id, type: 'tap', at: start, beat: (start - this.startTime) / seconds,
          pitch: note.pitch, velocity: Math.min(.32, note.velocity * .55), duration: .18, role: lane.object.musicalRole, source: note.life });
        nodes.forEach((node) => {
          this.tapVoices.add(node);
          node.addEventListener("ended", () => this.tapVoices.delete(node));
        });
      });
    });
  }

  /** Temporarily makes one selected work the lead; the clock and arrangement continue. */
  spotlight(id: string, beats = 4) {
    if (!this.state?.objects.some((object) => object.id === id)) return;
    this.spotlightId = id;
    this.spotlightUntil = this.beat + Math.max(1, beats);
    const object = this.state.objects.find(o => o.id === id)!;
    this.life.enqueue({ objectId: id, type: 'spotlight', at: this.ctx?.currentTime ?? 0, beat: this.beat,
      duration: Math.max(1, beats) * 60 / this.state.bpm, role: object.musicalRole });
    this.applyMix();
  }
  private applyPlan(beat: number, at: number) {
    if (!this.state || !this.ctx) return;
    this.planBeat = Math.floor(beat);
    const previous = this.currentPlan;
    this.currentPlan = applyGardenWonder(buildEnsemblePlan(this.state, mixGarden(this.state, Math.floor(beat / 16)), Math.floor(beat / 16)), this.state, this.spatialEffects, beat);
    for (const [id, lane] of this.lanes) {
      const plan = this.currentPlan.objectPlans.get(id)!;
      const window = Math.floor((beat % 16) / 4);
      // Constant-sum crossfade prevents a volume boost when two renderings coexist.
      lane.free.gain.setTargetAtTime(1 - plan.strength, at, .16);
      lane.ensemble.gain.setTargetAtTime(plan.strength * plan.roleWeight *
        (plan.activeWindows.includes(window) ? 1 : 0), at, .16);
      const before = previous?.objectPlans.get(id);
      const changed = !before || before.strength <= .001 || before.kind !== plan.kind || before.wonder !== plan.wonder ||
        before.partnerIds.join() !== plan.partnerIds.join() || before.activeWindows.join() !== plan.activeWindows.join();
      if (changed && plan.strength > .35) this.life.enqueue({ objectId: id, type: "relation", at, beat, duration: .45,
        role: lane.object.musicalRole, layer: "ensemble", relation: plan.kind, partnerId: plan.partnerIds[0] });
      if (changed && plan.strength > .001 && beat >= lane.phase) {
        const local = beat % 16;
        // A bed joined mid-phrase must enter now, not wait silently for the next loop.
        this.emit(lane, plan.notes.filter((n) => n.beat < local && n.beat + n.duration > local &&
          !lane.activity.some((event) => event.layer === "ensemble" && event.pitch === n.pitch && event.at <= at && event.until > at + .1))
          .map((n) => ({ ...n, duration: n.beat + n.duration - local })), "ensemble", at, 60 / this.state.bpm);
      }
    }
  }
  private emit(lane: Lane, notes: ArrangementNote[], layer: Layer, at: number, seconds: number) {
    if (!this.ctx) return;
    for (const note of notes) {
      // Per-layer limits keep the quiet branch from stealing the answer's voices.
      const harmonics = lane.object.project.instrument === "Pluck" || lane.object.project.instrument === "Soft Synth" ||
        lane.object.musicalRole === "decoration" ? 2 : 3;
      if (lane.layerVoices[layer].size + harmonics > 24) break;
      const duration = lane.object.musicalRole === "rhythm" ? Math.min(.2, note.duration * seconds) : note.duration * seconds;
      const nodes = voice(this.ctx, lane[layer], note.pitch, at, duration,
        Math.min(.65, note.velocity), lane.object.musicalRole === "decoration" ? "Pluck" : lane.object.project.instrument);
      const plan = layer === 'ensemble' ? this.currentPlan?.objectPlans.get(lane.object.id) : undefined;
      const anchor = note.life ?? (() => {
        const source = lane.object.scoreIR.reduce<(typeof lane.object.scoreIR)[number] | undefined>((best, candidate) =>
          !best || Math.abs(candidate.pitch - note.pitch) < Math.abs(best.pitch - note.pitch) ? candidate : best, undefined);
        return source ? { strokeId: source.sourceStroke, point: source.sourcePosition } : undefined;
      })();
      this.life.enqueue({ objectId: lane.object.id, type: duration >= .6 ? 'sustain-start' : 'note', at,
        beat: (at - this.startTime) / seconds, pitch: note.pitch, velocity: Math.min(.65, note.velocity), duration,
        role: lane.object.musicalRole, layer, source: anchor, relation: plan?.kind, partnerId: plan?.partnerIds[0], formation: note.formation });
      lane.activity.push({ at, until: at + duration + .12, layer, pitch: note.pitch });
      nodes.forEach((node) => {
        lane.voices.add(node); lane.layerVoices[layer].add(node);
        node.addEventListener("ended", () => { lane.voices.delete(node); lane.layerVoices[layer].delete(node); });
      });
    }
  }
  private schedule() {
    if (!this.running || !this.ctx || !this.state) return;
    this.observeHeard();
    this.applyMix();
    const ctx = this.ctx, seconds = 60 / this.state.bpm;
    this.spatialEffects = this.spatialStability.update(gardenRelations(this.state, mixGarden(this.state, Math.floor(this.beat / 16))), ctx.currentTime * 1000);
    const beat = this.beat, horizon = beat + .13 / seconds;
    // A stalled frame skips expired subdivisions; it never produces a catch-up burst.
    this.next = Math.max(this.next, Math.floor(beat * 4) / 4);
    for (const lane of this.lanes.values()) lane.activity = lane.activity.filter((event) => event.until > ctx.currentTime);
    while (this.next < horizon) {
      const at = Math.max(ctx.currentTime, this.startTime + this.next * seconds);
      if (Math.floor(this.next) !== this.planBeat) this.applyPlan(this.next, at);
      const tick = Math.round(this.next * 4) % 64;
      for (const [id, lane] of this.lanes) {
        if (this.next < lane.phase) continue;
        const freeTick = ((Math.round((this.next - lane.phase) * 4) % 64) + 64) % 64;
        this.emit(lane, lane.notes.filter((n) => Math.round(n.beat * 4) === freeTick), "free", at, seconds);
        const plan: ObjectArrangementPlan | undefined = this.currentPlan?.objectPlans.get(id);
        if (plan && plan.strength > .001) {
          this.emit(lane, plan.notes.filter((n) => Math.round(n.beat * 4) === tick), "ensemble", at, seconds);
        }
        lane.next = this.next + .25;
      }
      this.next += .25;
    }
  }
  private clearVoices(lane: Lane) {
    lane.voices.forEach((node) => { try { node.stop(); } catch { /* ended */ } });
    lane.voices.clear(); lane.layerVoices.free.clear(); lane.layerVoices.ensemble.clear(); lane.activity = [];
  }
  private observeHeard() {
    const tick = Math.floor(this.beat * 4);
    if (tick === this.heardTick || !this.state) return;
    const consecutive = tick === this.heardTick + 1 && this.heardTick >= 0;
    this.heardTick = tick;
    if (!consecutive || document.hidden || this.ctx?.state !== "running") { this.onHeard?.(null); return; }
    const mix = mixGarden(this.state, Math.floor(this.beat / 16));
    const eligible = [...this.lanes].filter(([id, lane]) => (mix.get(id) ?? 0) > .015 && lane.gain.gain.value > .015).map(([id]) => id);
    const now = this.ctx.currentTime;
    const audible = eligible.filter((id) => {
      const lane = this.lanes.get(id)!;
      return lane.activity.some((event) => event.at <= now && event.until > now &&
        lane.gain.gain.value * lane[event.layer].gain.value > .015);
    });
    // Read-only observation of the existing clock. Never award missed/background slices.
    this.onHeard?.({ beat: this.beat, delta: .25, audible, eligible,
      relations: (this.currentPlan?.relations ?? []).flatMap((r) => {
        const a = this.state!.objects.find((o) => o.id === r.a), b = this.state!.objects.find((o) => o.id === r.b);
        return a && b ? [{ ...r, strength: Math.min(r.strength, proximityStrength(a.world, b.world)) }] : [];
      }) });
  }
  stop() {
    this.life.clear();
    this.generation++; this.running = false; clearInterval(this.timer);
    for (const lane of this.lanes.values()) {
      this.clearVoices(lane);
      lane.free.disconnect(); lane.ensemble.disconnect(); lane.gain.disconnect();
    }
    this.tapVoices.forEach((node) => { try { node.stop(); } catch { /* ended */ } });
    this.tapVoices.clear();
    this.lanes.clear(); this.next = 0; this.planBeat = -1; this.currentPlan = undefined;
    this.spatialStability = new StableGardenRelations(); this.spatialEffects = [];
    this.heardTick = -1; this.spotlightId = undefined; this.spotlightUntil = -1; this.onHeard?.(null);
  }
}
