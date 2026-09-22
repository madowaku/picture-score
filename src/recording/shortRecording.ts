import type { MusicIR, Project, ScoreNote } from "../music/types";
import { HEIGHT, WIDTH } from "../music/score";
import { strokeColor } from "../wonder/palette";

export const SHORT_RECORDING_MAX_SECONDS = 15;
export const SHORT_RECORDING_FPS = 30;
export const SHORT_RECORDING_WIDTH = 720;
export const SHORT_RECORDING_HEIGHT = 1280;

type CaptureCanvas = HTMLCanvasElement & {
  captureStream?: (frameRate?: number) => MediaStream;
};

export interface ShortRecordingRenderer {
  canvas: HTMLCanvasElement;
  stream: MediaStream;
  draw: (progress: number) => void;
  dispose: () => void;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function shortRecordingDurationSeconds(
  music: Pick<MusicIR, "lengthBeats" | "tempo">,
) {
  const seconds = (music.lengthBeats * 60) / Math.max(1, music.tempo);
  return Math.max(1, Math.min(SHORT_RECORDING_MAX_SECONDS, seconds));
}

export function preferredShortRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported)
    return "";
  return (
    [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

export function supportsShortRecording() {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement === "undefined"
  )
    return false;
  return typeof (HTMLCanvasElement.prototype as CaptureCanvas).captureStream === "function";
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitTitle(ctx: CanvasRenderingContext2D, title: string, maxWidth: number) {
  const value = title.trim() || "Untitled";
  if (ctx.measureText(value).width <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && ctx.measureText(cut + "…").width > maxWidth)
    cut = cut.slice(0, -1);
  return cut + "…";
}

export function createShortRecordingRenderer(input: {
  project: Project;
  notes: ScoreNote[];
  music: MusicIR;
}): ShortRecordingRenderer {
  const { project, notes, music } = input;
  const canvas = document.createElement("canvas") as CaptureCanvas;
  canvas.width = SHORT_RECORDING_WIDTH;
  canvas.height = SHORT_RECORDING_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.captureStream)
    throw new Error("Short recording canvas is unavailable.");

  const stream = canvas.captureStream(SHORT_RECORDING_FPS);
  const strokeIndices = new Map(
    project.strokes.map((stroke, index) => [stroke.id, index]),
  );
  const playByAnchor = new Map(
    music.playNotes.map((note) => [note.anchorId, note]),
  );

  const draw = (rawProgress: number) => {
    const progress = clamp01(rawProgress);
    const width = canvas.width;
    const height = canvas.height;
    const beat = progress * music.lengthBeats;

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f5f3ed";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#30322d";
    ctx.textAlign = "left";
    ctx.font = "700 31px sans-serif";
    ctx.fillText("picture score.", 54, 82);
    ctx.fillStyle = "#cd553c";
    ctx.beginPath();
    ctx.arc(236, 76, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "700 45px sans-serif";
    ctx.fillStyle = "#30322d";
    ctx.fillText(fitTitle(ctx, project.title, width - 108), 54, 172);
    ctx.font = "600 14px sans-serif";
    ctx.fillStyle = "#858779";
    ctx.fillText("DRAWING BECOMES MUSIC", 55, 207);

    const targetAspect = Math.max(
      0.5,
      Math.min(3.4, project.canvasAspect || WIDTH / HEIGHT),
    );
    const maxArtWidth = 576;
    const maxArtHeight = 570;
    let artWidth = maxArtWidth;
    let artHeight = artWidth / targetAspect;
    if (artHeight > maxArtHeight) {
      artHeight = maxArtHeight;
      artWidth = artHeight * targetAspect;
    }
    const cardWidth = 632;
    const cardHeight = artHeight + 196;
    const cardX = (width - cardWidth) / 2;
    const cardY = Math.max(266, (height - cardHeight) / 2 + 42);
    const artX = (width - artWidth) / 2;
    const artY = cardY + 92;

    ctx.save();
    ctx.shadowColor = "rgba(48,50,45,.12)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    roundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, 22);
    ctx.fillStyle = "#fffefa";
    ctx.fill();
    ctx.restore();

    roundedRectPath(ctx, cardX, cardY, cardWidth, cardHeight, 22);
    ctx.strokeStyle = "#e3e1d8";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "600 12px sans-serif";
    ctx.fillStyle = "#8b8d82";
    ctx.fillText("YOUR LITTLE COMPOSITION", cardX + 28, cardY + 41);
    ctx.textAlign = "right";
    ctx.fillText(String(music.tempo) + " BPM", cardX + cardWidth - 28, cardY + 41);
    ctx.textAlign = "left";

    const mapX = (x: number) => artX + (x / WIDTH) * artWidth;
    const mapY = (y: number) => artY + (y / HEIGHT) * artHeight;

    ctx.save();
    roundedRectPath(ctx, artX, artY, artWidth, artHeight, 8);
    ctx.clip();

    ctx.strokeStyle = "#e9e9e1";
    ctx.lineWidth = 1.35;
    for (let group = 0; group < 3; group++) {
      for (let line = 0; line < 5; line++) {
        const y = mapY(52 + group * 132 + line * 18);
        ctx.beginPath();
        ctx.moveTo(artX, y);
        ctx.lineTo(artX + artWidth, y);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "#eeeee6";
    ctx.setLineDash([4, 9]);
    for (const position of [0.25, 0.5, 0.75]) {
      const x = artX + artWidth * position;
      ctx.beginPath();
      ctx.moveTo(x, artY);
      ctx.lineTo(x, artY + artHeight);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    project.strokes.forEach((stroke, index) => {
      if (!stroke.points.length) return;
      ctx.strokeStyle = strokeColor(index);
      ctx.fillStyle = strokeColor(index);
      ctx.globalAlpha = 0.66;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2.2, artWidth / 250);
      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          mapX(stroke.points[0].x),
          mapY(stroke.points[0].y),
          2.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        return;
      }
      ctx.beginPath();
      stroke.points.forEach((point, pointIndex) => {
        const x = mapX(point.x);
        const y = mapY(point.y);
        if (!pointIndex) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    for (const note of notes) {
      const performed = playByAnchor.get(note.id);
      const active =
        !!performed &&
        beat >= performed.beat &&
        beat < performed.beat + performed.duration;
      const color = strokeColor(strokeIndices.get(note.sourceStroke) ?? 0);
      const x = mapX(note.visualPosition.x);
      const y = mapY(note.visualPosition.y);

      if (active) {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = performed ? 0.92 : 0.36;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.42);
      ctx.fillStyle = active ? "#f0a45e" : color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.2, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = active ? "#d66a40" : color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 1);
      ctx.lineTo(x + 4, y - 18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const playheadX = artX + artWidth * progress;
    const glow = ctx.createLinearGradient(playheadX - 68, 0, playheadX, 0);
    glow.addColorStop(0, "rgba(205,85,60,0)");
    glow.addColorStop(1, "rgba(205,85,60,.10)");
    ctx.fillStyle = glow;
    ctx.fillRect(playheadX - 68, artY, 68, artHeight);
    ctx.strokeStyle = "#cd553c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, artY);
    ctx.lineTo(playheadX, artY + artHeight);
    ctx.stroke();

    ctx.restore();

    const footerY = artY + artHeight + 54;
    ctx.font = "600 12px sans-serif";
    ctx.fillStyle = "#999b90";
    ctx.fillText("01", artX, footerY);
    ctx.fillText("02", artX + artWidth * 0.25, footerY);
    ctx.fillText("03", artX + artWidth * 0.5, footerY);
    ctx.fillText("04", artX + artWidth * 0.75, footerY);

    const barY = footerY + 34;
    ctx.fillStyle = "#ebe8df";
    roundedRectPath(ctx, artX, barY, artWidth, 8, 4);
    ctx.fill();
    if (progress > 0) {
      ctx.fillStyle = "#cd553c";
      roundedRectPath(ctx, artX, barY, Math.max(8, artWidth * progress), 8, 4);
      ctx.fill();
    }

    ctx.textAlign = "center";
    ctx.font = "600 15px sans-serif";
    ctx.fillStyle = "#777b70";
    ctx.fillText("DRAW  •  LISTEN  •  SHARE", width / 2, height - 86);
    ctx.font = "500 12px sans-serif";
    ctx.fillStyle = "#a0a296";
    ctx.fillText("picture-score.netlify.app", width / 2, height - 55);
    ctx.restore();
  };

  draw(0);

  return {
    canvas,
    stream,
    draw,
    dispose: () => stream.getTracks().forEach((track) => track.stop()),
  };
}
