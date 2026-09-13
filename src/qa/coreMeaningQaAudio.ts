import { outputBus, voice } from "../music/audio";
import type { MusicalEvent, MusicalTimeline } from "../music/ir";
import type { Instrument } from "../music/types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pitchFromRoot = (root = 0) => 48 + ((Math.round(root) % 12) + 12) % 12;

/**
 * QA-only reference sonification for Musical IR fixtures.
 *
 * It is deliberately kept outside the production playback path. The purpose is
 * to let a blind reviewer hear the same semantic stimulus that SCORE BLOOM sees,
 * so the review tests audio -> world meaning rather than visual guessing alone.
 */
export class CoreMeaningQaAudio {
  private context?: AudioContext;
  private bus?: GainNode;
  private active = new Set<OscillatorNode>();

  async play(timeline: MusicalTimeline, fromTime = 0): Promise<void> {
    this.stop();
    const context = this.ensureContext();
    if (context.state !== "running") await context.resume();
    const bus = this.bus!;
    const origin = context.currentTime + 0.035;

    for (const event of timeline.events) {
      if (event.time + 1e-6 < fromTime || event.type === "section") continue;
      const at = origin + Math.max(0, event.time - fromTime);
      this.scheduleEvent(context, bus, event, at);
    }
  }

  stop(): void {
    const now = this.context?.currentTime ?? 0;
    for (const oscillator of this.active) {
      try { oscillator.stop(now + 0.005); } catch { /* already ended */ }
    }
    this.active.clear();
  }

  dispose(): void {
    this.stop();
    void this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.bus = undefined;
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
      this.bus = outputBus(this.context);
      this.bus.gain.value = 0.42;
    }
    return this.context;
  }

  private track(nodes: readonly OscillatorNode[]): void {
    for (const node of nodes) {
      this.active.add(node);
      node.addEventListener("ended", () => this.active.delete(node));
    }
  }

  private tone(
    context: AudioContext,
    bus: AudioNode,
    pitch: number,
    at: number,
    duration: number,
    velocity: number,
    instrument: Instrument,
  ): void {
    this.track(voice(context, bus, pitch, at, duration, clamp(velocity, 0.04, 0.8), instrument));
  }

  private scheduleEvent(
    context: AudioContext,
    bus: AudioNode,
    event: MusicalEvent,
    at: number,
  ): void {
    switch (event.type) {
      case "melody":
        this.tone(context, bus, event.pitch, at, clamp(event.duration, 0.12, 1.5), event.strength * 0.58, "Piano");
        return;

      case "harmony": {
        const root = pitchFromRoot(event.root);
        const velocity = event.strength * 0.28;
        this.tone(context, bus, root, at, 0.72, velocity, "Soft Synth");
        this.tone(context, bus, root + 4, at, 0.72, velocity * 0.86, "Soft Synth");
        this.tone(context, bus, root + 7, at, 0.72, velocity * 0.78, "Soft Synth");
        return;
      }

      case "rhythm":
        this.tone(context, bus, 40, at, 0.045, event.strength * 0.42, "Pluck");
        return;

      case "ornament":
        this.tone(
          context,
          bus,
          76 + Math.round(event.brightness * 12),
          at,
          0.07,
          event.strength * 0.34,
          "Bell",
        );
        return;

      case "resonance":
        this.tone(
          context,
          bus,
          38 + Math.round((1 - event.depth) * 7),
          at,
          clamp(event.duration, 0.4, 3.8),
          event.strength * 0.2,
          "Soft Synth",
        );
        return;

      case "section":
        return;
    }
  }
}
