import { outputBus, voice } from "../music/audio";
import type { GardenState, MusicalObject } from "./gardenState";
import { mixGarden } from "./gardenMixer";

type Lane = { object: MusicalObject; gain: GainNode; next: number; phase: number; voices: Set<OscillatorNode> };
/** One AudioContext clock and lookahead scheduler for the whole world. */
export class GardenTransport {
  private ctx?: AudioContext;
  private master?: GainNode;
  private lanes = new Map<string, Lane>();
  private state?: GardenState;
  private startTime = 0;
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  running = false;
  get beat() { return this.running && this.ctx && this.state ? Math.max(0, (this.ctx.currentTime - this.startTime) * this.state.bpm / 60) : 0; }
  async start(state: GardenState) {
    this.stop();
    const generation = ++this.generation;
    if (!this.ctx) { this.ctx = new AudioContext(); this.master = outputBus(this.ctx); }
    await this.ctx.resume();
    if (generation !== this.generation) return;
    this.state = state;
    this.startTime = this.ctx.currentTime + 0.06;
    this.running = true;
    this.update(state);
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
  }
  update(state: GardenState) {
    if (this.running && this.state && this.ctx && this.state.bpm !== state.bpm) {
      const beat = this.beat;
      this.startTime = this.ctx.currentTime - beat * 60 / state.bpm;
      // Cancel the short lookahead and old sustained tails when changing tempo.
      for (const lane of this.lanes.values()) {
        lane.voices.forEach((node) => { try { node.stop(); } catch { /* ended */ } });
        lane.voices.clear(); lane.next = Math.ceil(beat * 4 - 0.0001) / 4;
      }
    }
    this.state = state;
    if (!this.ctx || !this.master || !this.running) return;
    const ids = new Set(state.objects.map((o) => o.id));
    for (const [id, lane] of this.lanes) if (!ids.has(id)) {
      lane.voices.forEach((n) => { try { n.stop(); } catch { /* ended */ } });
      lane.gain.disconnect(); this.lanes.delete(id);
    }
    for (const object of state.objects) {
      const existing = this.lanes.get(object.id);
      if (existing) existing.object = object;
      else {
        const gain = this.ctx.createGain(); gain.gain.value = 0; gain.connect(this.master);
        const entryBeat = Math.ceil(this.beat);
        this.lanes.set(object.id, { object, gain, next: entryBeat, phase: entryBeat, voices: new Set() });
      }
    }
    this.applyMix();
  }
  private applyMix() {
    if (!this.state || !this.ctx) return;
    const mix = mixGarden(this.state, Math.floor(this.beat / 16));
    for (const [id, lane] of this.lanes) lane.gain.gain.setTargetAtTime(mix.get(id) ?? 0, this.ctx.currentTime, 0.12);
  }
  private schedule() {
    if (!this.running || !this.ctx || !this.state) return;
    this.applyMix();
    const ctx = this.ctx, seconds = 60 / this.state.bpm;
    const beat = this.beat, horizon = beat + 0.13 / seconds;
    for (const lane of this.lanes.values()) {
      // Quantize gently, retaining the spatial phrase; every object uses the same 16-beat cycle.
      lane.next = Math.max(lane.next, Math.floor(beat * 4) / 4);
      while (lane.next < horizon) {
        const tick = ((Math.round((lane.next - lane.phase) * 4) % 64) + 64) % 64;
        const first = lane.object.musicIR.playNotes[0]?.beat ?? 0;
        const notes = lane.object.musicIR.playNotes.filter((n) => Math.min(63, Math.round((n.beat - first) * 4)) === tick).slice(0, 6);
        const at = Math.max(ctx.currentTime, this.startTime + lane.next * seconds);
        for (const note of notes) {
          // A hard per-object voice ceiling bounds pathological dense scribbles, including tails.
          if (lane.voices.size >= 24) break;
          const duration = lane.object.musicalRole === "rhythm" ? Math.min(0.2, note.duration * seconds) : note.duration * seconds;
          const nodes = voice(ctx, lane.gain, note.pitch, at, duration,
            Math.min(0.65, note.velocity), lane.object.musicalRole === "decoration" ? "Pluck" : lane.object.project.instrument);
          nodes.forEach((node) => { lane.voices.add(node); node.addEventListener("ended", () => lane.voices.delete(node)); });
        }
        lane.next += 0.25;
      }
    }
  }
  stop() {
    this.generation++; this.running = false; clearInterval(this.timer);
    for (const lane of this.lanes.values()) {
      lane.voices.forEach((node) => { try { node.stop(); } catch { /* ended */ } });
      lane.gain.disconnect();
    }
    this.lanes.clear();
  }
}
