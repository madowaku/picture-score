import type { Instrument, MusicIR } from "./types";
import { nearestPitch } from "./score";

type Context = AudioContext | OfflineAudioContext;
export function outputBus(ctx: Context) {
  const gain = ctx.createGain();
  gain.gain.value = 0.62;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 15;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;
  gain.connect(compressor).connect(ctx.destination);
  return gain;
}

/** Small additive voices: no network, samples, accounts or generation API required. */
export function voice(
  ctx: Context,
  bus: AudioNode,
  pitch: number,
  at: number,
  duration: number,
  velocity: number,
  instrument: Instrument,
): OscillatorNode[] {
  const frequency = 440 * 2 ** ((pitch - 69) / 12);
  const settings: Record<
    Instrument,
    {
      type: OscillatorType;
      harmonics: number[];
      gains: number[];
      attack: number;
      tail: number;
    }
  > = {
    Piano: {
      type: "sine",
      harmonics: [1, 2, 3],
      gains: [0.7, 0.2, 0.1],
      attack: 0.006,
      tail: 0.42,
    },
    Bell: {
      type: "sine",
      harmonics: [1, 2.756, 5.404],
      gains: [0.72, 0.2, 0.08],
      attack: 0.003,
      tail: 0.85,
    },
    Pluck: {
      type: "triangle",
      harmonics: [1, 2],
      gains: [0.86, 0.14],
      attack: 0.004,
      tail: 0.16,
    },
    Toy: {
      type: "sine",
      harmonics: [1, 3, 7],
      gains: [0.76, 0.19, 0.05],
      attack: 0.002,
      tail: 0.23,
    },
    "Soft Synth": {
      type: "triangle",
      harmonics: [1, 1.003],
      gains: [0.5, 0.5],
      attack: 0.045,
      tail: 0.45,
    },
  };
  const spec = settings[instrument];
  return spec.harmonics.map((harmonic, i) => {
    const osc = ctx.createOscillator(),
      env = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.value = frequency * harmonic;
    const volume = Math.max(0.001, velocity * spec.gains[i] * 0.19);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(volume, at + spec.attack);
    env.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume * 0.25),
      at + Math.max(spec.attack + 0.01, duration),
    );
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration + spec.tail);
    osc.connect(env).connect(bus);
    osc.start(at);
    osc.stop(at + duration + spec.tail + 0.03);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
    return osc;
  });
}

function events(music: MusicIR) {
  // Intersecting strokes keep every visible note, but unisons only need one voice.
  const unique = new Map<
    string,
    {
      pitch: number;
      beat: number;
      duration: number;
      velocity: number;
      support: boolean;
    }
  >();
  for (const n of music.playNotes) {
    const key = `${n.beat}:${n.pitch}`;
    if (!unique.has(key)) unique.set(key, { ...n, support: false });
  }
  return [
    ...unique.values(),
    ...music.support.map((n) => ({ ...n, support: true })),
  ].sort((a, b) => a.beat - b.beat);
}

export class AudioEngine {
  private ctx?: AudioContext;
  private bus?: GainNode;
  private voices = new Set<OscillatorNode>();
  private timer?: ReturnType<typeof setInterval>;
  private answerGeneration = 0;
  private lastPreview = -Infinity;
  private lastPitch = -1;
  private settleBuffer?: AudioBuffer;
  private settleLoading?: Promise<void>;
  private uiVoices = new Set<OscillatorNode>();
  private captureDestination?: MediaStreamAudioDestinationNode;
  async unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.bus = outputBus(this.ctx);
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
    if (!this.settleBuffer && !this.settleLoading) {
      this.settleLoading = fetch(new URL("sfx/magnet-drop.ogg", document.baseURI))
        .then((response) => response.arrayBuffer())
        .then((data) => this.ctx!.decodeAudioData(data))
        .then((buffer) => { this.settleBuffer = buffer; })
        .catch(() => undefined)
        .finally(() => { this.settleLoading = undefined; });
    }
  }
  private track(nodes: OscillatorNode[]) {
    nodes.forEach((node) => {
      this.voices.add(node);
      node.addEventListener("ended", () => this.voices.delete(node));
    });
  }
  settle(pulses = 3) {
    if (!this.ctx || !this.bus || !this.settleBuffer) return;
    const count = Math.max(1, Math.min(3, pulses));
    for (let i = 0; i < count; i++) {
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = this.settleBuffer;
      gain.gain.value = 0.035 + i * 0.008;
      source.connect(gain).connect(this.bus);
      source.start(this.ctx.currentTime + 0.035 + i * 0.065);
      source.addEventListener("ended", () => {
        source.disconnect();
        gain.disconnect();
      });
    }
  }
  /** Short tonal UI vocabulary. It shares the active engine and never replaces a musical phrase. */
  uiTone(kind: "place" | "relation" | "growth" | "remove" | "press", pitch = 60) {
    if (!this.ctx || !this.bus || this.ctx.state !== "running") return;
    const spec = {
      place: { pitch: pitch + 7, duration: .12, velocity: .22, instrument: "Toy" as Instrument },
      relation: { pitch: pitch + 12, duration: .18, velocity: .2, instrument: "Bell" as Instrument },
      growth: { pitch: pitch + 4, duration: .24, velocity: .16, instrument: "Bell" as Instrument },
      remove: { pitch: pitch - 5, duration: .1, velocity: .14, instrument: "Pluck" as Instrument },
      press: { pitch, duration: .055, velocity: .1, instrument: "Pluck" as Instrument },
    }[kind];
    const nodes = voice(this.ctx, this.bus, spec.pitch, this.ctx.currentTime + .008,
      spec.duration, spec.velocity, spec.instrument);
    nodes.forEach((node) => {
      this.uiVoices.add(node);
      node.addEventListener("ended", () => this.uiVoices.delete(node));
    });
  }
  preview(y: number, speed: number, instrument: Instrument) {
    if (!this.ctx || !this.bus || this.ctx.state !== "running") return;
    const pitch = nearestPitch(y),
      now = this.ctx.currentTime;
    if (
      now - this.lastPreview < 0.065 ||
      (pitch === this.lastPitch && now - this.lastPreview < 0.18)
    )
      return;
    this.lastPreview = now;
    this.lastPitch = pitch;
    const gestureSpeed = Math.min(5, Math.max(0, speed));
    this.track(
      voice(
        this.ctx,
        this.bus,
        pitch,
        now,
        0.1 + 0.34 / (1 + gestureSpeed * 0.85),
        0.46 - gestureSpeed * 0.035,
        instrument,
      ),
    );
  }
  /** A compact call-and-response for one completed stroke. */
  async answer(music: MusicIR, instrument: Instrument, onNote?: (note: { pitch: number; velocity: number; duration: number; at: number; anchorId: string }) => void): Promise<number> {
    const generation = ++this.answerGeneration;
    await this.unlock();
    if (generation !== this.answerGeneration) return 0;
    this.stop();
    if (!music.playNotes.length) return 0;
    const ctx = this.ctx!, bus = this.bus!;
    const notes = [...music.playNotes].sort(
      (a, b) => a.beat - b.beat || a.pitch - b.pitch,
    );
    const first = notes[0].beat;
    const last = Math.max(...notes.map((n) => n.beat));
    const span = Math.max(0.25, last - first);
    const phraseSeconds = Math.min(1.45, Math.max(0.55, notes.length * 0.105));
    const start = ctx.currentTime + 0.025;
    notes.forEach((note, index) => {
      const next = notes[index + 1];
      const offset = ((note.beat - first) / span) * phraseSeconds;
      const nextOffset = next
        ? ((next.beat - first) / span) * phraseSeconds
        : phraseSeconds;
      const duration =
        note.articulation === "sustain"
          ? Math.max(0.65, phraseSeconds)
          : note.articulation === "chord"
            ? 0.42
            : Math.max(0.11, Math.min(0.38, nextOffset - offset + 0.06));
      this.track(
        voice(ctx, bus, note.pitch, start + offset, duration, note.velocity * 0.88, instrument),
      );
      try { onNote?.({ pitch: note.pitch, velocity: note.velocity * .88, duration, at: start + offset, anchorId: note.anchorId }); } catch { /* Observation only. */ }
    });
    return phraseSeconds + 0.9;
  }
  async play(
    music: MusicIR,
    instrument: Instrument,
  ): Promise<{ start: number; seconds: number }> {
    await this.unlock();
    this.stop();
    const ctx = this.ctx!,
      bus = this.bus!;
    const start = ctx.currentTime + 0.06,
      secondsPerBeat = 60 / music.tempo;
    const queue = events(music);
    let index = 0;
    const schedule = () => {
      while (
        index < queue.length &&
        start + queue[index].beat * secondsPerBeat < ctx.currentTime + 0.15
      ) {
        const n = queue[index++];
        const at = start + n.beat * secondsPerBeat;
        if (at < ctx.currentTime - 0.08) continue;
        this.track(
          voice(
            ctx,
            bus,
            n.pitch,
            Math.max(at, ctx.currentTime),
            n.duration * secondsPerBeat,
            n.velocity,
            n.support ? "Soft Synth" : instrument,
          ),
        );
      }
      if (index === queue.length) clearInterval(this.timer);
    };
    schedule();
    this.timer = setInterval(schedule, 25);
    return { start, seconds: music.lengthBeats * secondsPerBeat };
  }
  async captureStream(): Promise<MediaStream> {
    await this.unlock();
    if (!this.captureDestination) {
      this.captureDestination = this.ctx!.createMediaStreamDestination();
      this.bus!.connect(this.captureDestination);
    }
    return this.captureDestination.stream;
  }
  releaseCaptureStream() {
    if (!this.captureDestination) return;
    try {
      this.bus?.disconnect(this.captureDestination);
    } catch {
      // It may already be disconnected while a recorder is shutting down.
    }
    this.captureDestination.stream.getTracks().forEach((track) => track.stop());
    this.captureDestination = undefined;
  }
  get currentTime() {
    return this.ctx?.currentTime ?? 0;
  }
  stop() {
    this.answerGeneration++;
    clearInterval(this.timer);
    this.voices.forEach((node) => {
      try {
        node.stop();
      } catch {
        /* already ended */
      }
    });
    this.voices.clear();
    this.uiVoices.forEach((node) => {
      try {
        node.stop();
      } catch {
        /* already ended */
      }
    });
    this.uiVoices.clear();
  }
}

export async function renderAudio(
  music: MusicIR,
  instrument: Instrument,
): Promise<Blob> {
  const rate = 44100,
    secondsPerBeat = 60 / music.tempo;
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil((music.lengthBeats * secondsPerBeat + 1.4) * rate),
    rate,
  );
  const bus = outputBus(ctx);
  events(music).forEach((n) =>
    voice(
      ctx,
      bus,
      n.pitch,
      0.03 + n.beat * secondsPerBeat,
      n.duration * secondsPerBeat,
      n.velocity,
      n.support ? "Soft Synth" : instrument,
    ),
  );
  const audio = await ctx.startRendering();
  const buffer = new ArrayBuffer(44 + audio.length * 4),
    view = new DataView(buffer);
  const str = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, audio.length * 4, true);
  const left = audio.getChannelData(0),
    right = audio.getChannelData(1);
  for (let i = 0; i < audio.length; i++) {
    view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, left[i])) * 32767, true);
    view.setInt16(
      46 + i * 4,
      Math.max(-1, Math.min(1, right[i])) * 32767,
      true,
    );
  }
  return new Blob([buffer], { type: "audio/wav" });
}
