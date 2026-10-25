import { renderAudioBuffer } from "../music/audio";
import { projectMusic } from "../music/arrangement";
import type { Project } from "../music/types";
import { createVideoPainter, type ShareShape } from "./painter";

export const VIDEO_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

export function supportedVideoType(supported: (mime: string) => boolean): string | null {
  return VIDEO_TYPES.find(supported) ?? null;
}

export function videoCapability(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined" ||
      typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  return supportedVideoType(type => MediaRecorder.isTypeSupported(type));
}

export function videoExtension(mime: string): "mp4" | "webm" {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

/** Record generated artwork and synthesized audio only. No screen/microphone access. */
export async function recordArtwork(project: Project, shape: ShareShape, canvas: HTMLCanvasElement,
  options: { signal: AbortSignal; onProgress: (fraction: number) => void }): Promise<Blob> {
  const mimeType = videoCapability();
  if (!mimeType) throw new Error("video-unsupported");
  const controller = new AbortController();
  const { signal } = controller;
  const abort = () => controller.abort(options.signal.reason);
  const hidden = () => { if (document.hidden) controller.abort(new Error("video-background")); };
  options.signal.addEventListener("abort", abort, { once: true });
  document.addEventListener("visibilitychange", hidden);
  if (options.signal.aborted) abort();
  hidden();
  const timeout = setTimeout(() => controller.abort(new Error("video-timeout")), 60000);
  let context: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let source: AudioBufferSourceNode | undefined;
  let recorder: MediaRecorder | undefined;
  let frame = 0;
  try {
    signal.throwIfAborted();
    // Unlock in the click handler before waiting for offline rendering.
    context = new AudioContext();
    await abortable(context.resume(), signal);
    const music = projectMusic(project);
    const buffer = await abortable(renderAudioBuffer(music, project.instrument), signal);
    signal.throwIfAborted();
    const paint = createVideoPainter(canvas, project, music, shape);
    paint(null);
    const destination = context.createMediaStreamDestination();
    source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    // A silent speaker connection keeps the audio clock alive on mobile.
    const silent = context.createGain();
    silent.gain.value = 0;
    source.connect(silent).connect(context.destination);
    stream = canvas.captureStream(30);
    destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000, audioBitsPerSecond: 128_000 });
    const ctx = context, rec = recorder, audioSource = source;
    return await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = [];
      const cancel = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", cancel, { once: true });
      const release = () => signal.removeEventListener("abort", cancel);
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      rec.onerror = () => { release(); reject(new Error("video-recording")); };
      rec.onstop = () => {
        release();
        if (signal.aborted) { cancel(); return; }
        const blob = new Blob(chunks, { type: rec.mimeType || mimeType });
        if (blob.size === 0) reject(new Error("video-empty"));
        else resolve(blob);
      };
      try {
        rec.start(250);
        const start = ctx.currentTime + .08;
        audioSource.start(start);
        const tick = () => {
          if (signal.aborted) return;
          const seconds = Math.max(0, ctx.currentTime - start);
          paint(seconds);
          options.onProgress(Math.min(1, seconds / buffer.duration));
          if (seconds >= buffer.duration) { rec.stop(); return; }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch (error) { release(); reject(error); }
    });
  } finally {
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    options.signal.removeEventListener("abort", abort);
    document.removeEventListener("visibilitychange", hidden);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    try { source?.stop(); } catch { /* May not have started yet. */ }
    source?.disconnect();
    stream?.getTracks().forEach(track => track.stop());
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }
}
