import type { Instrument, MusicIR, Project, ScoreNote } from "./types";
import { HEIGHT, WIDTH } from "./score";
import { translate } from "../i18n/messages";
import type { Language } from "../i18n/messages";

export function download(blob: Blob, title: string, extension: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim() || "Picture Score"}.${extension}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function variable(n: number): number[] {
  const bytes = [n & 127];
  while ((n >>= 7) > 0) bytes.unshift((n & 127) | 128);
  return bytes;
}
const u32 = (n: number) => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
export function midiFile(
  music: MusicIR,
  instrument: Instrument = "Piano",
): Uint8Array<ArrayBuffer> {
  const ticks = 480;
  const track = (
    items: {
      pitch: number;
      beat: number;
      duration: number;
      velocity: number;
    }[],
    channel: number,
    program: number,
  ) => {
    const tempo = Math.round(60000000 / music.tempo);
    const data = [
      0,
      0xff,
      0x51,
      3,
      (tempo >>> 16) & 255,
      (tempo >>> 8) & 255,
      tempo & 255,
      0,
      0xc0 | channel,
      program,
    ];
    // MIDI note-offs are pitch-scoped: collapse unisons and end repeated notes
    // before the next onset so an earlier note-off cannot cut off a later voice.
    const unique = new Map<
      string,
      { tick: number; end: number; pitch: number; velocity: number }
    >();
    items.forEach((n) => {
      const tick = Math.round(n.beat * ticks),
        pitch = Math.round(n.pitch);
      const key = tick + ":" + pitch,
        previous = unique.get(key);
      unique.set(key, {
        tick,
        pitch,
        end: Math.max(
          previous?.end ?? 0,
          Math.round((n.beat + n.duration) * ticks),
        ),
        velocity: Math.max(
          previous?.velocity ?? 0,
          Math.round(n.velocity * 100),
        ),
      });
    });
    const nextOnset = new Map<number, number>();
    const events = [...unique.values()]
      .sort((a, b) => b.tick - a.tick)
      .flatMap((n) => {
        const end = Math.max(
          n.tick + 1,
          Math.min(n.end, nextOnset.get(n.pitch) ?? Infinity),
        );
        nextOnset.set(n.pitch, n.tick);
        return [
          { tick: n.tick, bytes: [0x90 | channel, n.pitch, n.velocity] },
          { tick: end, bytes: [0x80 | channel, n.pitch, 0] },
        ];
      })
      .sort((a, b) => a.tick - b.tick || a.bytes[0] - b.bytes[0]);
    let previous = 0;
    events.forEach((e) => {
      data.push(...variable(e.tick - previous), ...e.bytes);
      previous = e.tick;
    });
    data.push(
      ...variable(Math.max(0, music.lengthBeats * ticks - previous)),
      0xff,
      0x2f,
      0,
    );
    return [77, 84, 114, 107, ...u32(data.length), ...data];
  };
  return new Uint8Array([
    77,
    84,
    104,
    100,
    0,
    0,
    0,
    6,
    0,
    1,
    0,
    2,
    1,
    224,
    ...track(
      music.playNotes,
      0,
      { Piano: 0, Bell: 14, Pluck: 24, Toy: 10, "Soft Synth": 89 }[instrument],
    ),
    ...track(music.support, 1, 89),
  ]);
}

export async function pictureFile(
  project: Project,
  notes: ScoreNote[],
  language: Language = "ja",
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const pageHeight = 1000 / project.canvasAspect + 140;
  canvas.width = 2000;
  canvas.height = Math.ceil(pageHeight * 2);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.fillStyle = "#fcfbf8";
  ctx.fillRect(0, 0, 1000, pageHeight);
  ctx.fillStyle = "#272823";
  ctx.font = "28px Georgia";
  ctx.fillText(project.title, 38, 51);
  ctx.fillStyle = "#77776e";
  ctx.font = "11px sans-serif";
  ctx.fillText("PICTURE SCORE  /  " + translate(language, "Every stroke answers back."), 38, pageHeight - 29);
  ctx.save();
  ctx.translate(25, 85);
  ctx.scale(0.95, (0.95 * (1000 / project.canvasAspect)) / HEIGHT);
  ctx.strokeStyle = "#e9e7e0";
  ctx.lineWidth = 1;
  for (let y = 30; y < HEIGHT; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#d7573b";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  project.strokes.forEach((s) => {
    ctx.beginPath();
    s.points.forEach((p, i) =>
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
    );
    if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.1, s.points[0].y);
    ctx.stroke();
  });
  ctx.fillStyle = "#b44831";
  notes.forEach((n) => {
    const { x, y } = n.visualPosition;
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 2.8, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 1);
    ctx.lineTo(x + 3, y - 12);
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  ctx.restore();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("画像を書き出せませんでした。")),
      "image/png",
    ),
  );
}
