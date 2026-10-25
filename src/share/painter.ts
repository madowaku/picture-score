import type { MusicIR, Project } from "../music/types";
import { strokeInk, strokeWidth } from "../wonder/palette";

export type ShareShape = "square" | "portrait";
export const videoSize = (shape: ShareShape) => ({ width: 720, height: shape === "portrait" ? 1280 : 720 });

/** Fit the original drawing rectangle, never crop or stretch it for a social format. */
export function artworkBounds(aspect: number, width: number, height: number) {
  const availableWidth = width - 96, availableHeight = height - 300;
  const w = Math.min(availableWidth, availableHeight * aspect), h = w / aspect;
  return { x: (width - w) / 2, y: 150 + (availableHeight - h) / 2, width: w, height: h };
}

function titleLines(ctx: CanvasRenderingContext2D, title: string, width: number) {
  const lines = [""];
  for (const character of Array.from(title)) {
    const i = lines.length - 1;
    if (ctx.measureText(lines[i] + character).width <= width) lines[i] += character;
    else if (i === 0) lines.push(character);
    else {
      while (ctx.measureText(lines[1] + "…").width > width) lines[1] = Array.from(lines[1]).slice(0, -1).join("");
      lines[1] += "…";
      break;
    }
  }
  return lines;
}

export function createVideoPainter(canvas: HTMLCanvasElement, project: Project, music: MusicIR, shape: ShareShape) {
  const { width, height } = videoSize(shape);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  const bounds = artworkBounds(project.canvasAspect, width, height);
  const paths = project.strokes.map(stroke => {
    const path = new Path2D();
    stroke.points.forEach((point, i) => i ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y));
    if (stroke.points.length === 1) path.lineTo(stroke.points[0].x + .1, stroke.points[0].y);
    return path;
  });
  const background = document.createElement("canvas");
  background.width = width;
  background.height = height;
  const paper = background.getContext("2d")!;
  paper.fillStyle = "#fcf9ef";
  paper.fillRect(0, 0, width, height);
  for (const [x, y, color] of [[45, height * .3, "#d8e8d59a"], [width, height * .7, "#f7dbd69a"]] as const) {
    const wash = paper.createRadialGradient(x, y, 0, x, y, 330);
    wash.addColorStop(0, color); wash.addColorStop(1, "#fcf9ef00");
    paper.fillStyle = wash; paper.fillRect(0, 0, width, height);
  }
  paper.fillStyle = "#52644f";
  paper.textAlign = "center";
  paper.font = '30px "Noto Sans JP", sans-serif';
  const lines = titleLines(paper, project.title, width - 100);
  lines.forEach((line, i) => paper.fillText(line, width / 2, 83 + i * 39));
  paper.fillStyle = "#75836e";
  paper.font = "20px Georgia, serif";
  paper.fillText("picture score.", width / 2, height - 62);
  paper.font = "13px sans-serif";
  paper.fillText("A little music born from a drawing.", width / 2, height - 36);
  paper.save();
  paper.translate(bounds.x, bounds.y);
  paper.scale(bounds.width / 1000, bounds.height / 420);
  paper.lineCap = "round"; paper.lineJoin = "round";
  paper.lineWidth = 2.8 * 1000 / bounds.width;
  paths.forEach((path, i) => {
    paper.strokeStyle = strokeInk(project.strokes[i], i);
    paper.lineWidth = strokeWidth(project.strokes[i], 2.8) * 1000 / bounds.width;
    paper.stroke(path);
  });
  paper.restore();
  const sourceStrokes = new Map(music.drawing.map(note => [note.id, note.sourceStroke]));
  const notePositions = new Map(music.drawing.map(note => [note.id, note.visualPosition]));
  return (seconds: number | null) => {
    ctx.drawImage(background, 0, 0);
    if (seconds === null) return;
    const beat = (seconds - .03) * project.tempo / 60;
    const active = music.playNotes.filter(note => beat >= note.beat && beat < note.beat + note.duration);
    const strokeIds = new Set(active.flatMap(note => note.sourceIds.map(id => sourceStrokes.get(id))));
    ctx.save();
    ctx.translate(bounds.x, bounds.y);
    ctx.scale(bounds.width / 1000, bounds.height / 420);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = 4 * 1000 / bounds.width;
    paths.forEach((path, i) => {
      if (!strokeIds.has(project.strokes[i].id)) return;
      ctx.strokeStyle = ctx.shadowColor = strokeInk(project.strokes[i], i);
      ctx.lineWidth = (strokeWidth(project.strokes[i], 2.8) + 1.2) * 1000 / bounds.width;
      ctx.shadowBlur = 12;
      ctx.stroke(path);
    });
    ctx.restore();
    for (const note of active) {
      const point = notePositions.get(note.anchorId);
      if (!point) continue;
      ctx.beginPath();
      ctx.arc(bounds.x + point.x / 1000 * bounds.width, bounds.y + point.y / 420 * bounds.height, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ed8a79"; ctx.fill();
    }
    const fraction = Math.max(0, Math.min(1, beat / music.lengthBeats));
    ctx.lineCap = "round"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(230, height - 110); ctx.lineTo(490, height - 110);
    ctx.strokeStyle = "#e2e4d7"; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(230, height - 110); ctx.lineTo(230 + 260 * fraction, height - 110);
    ctx.strokeStyle = "#e89687"; ctx.stroke();
  };
}
