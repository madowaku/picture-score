import type { MusicIR, PlayNote, Project } from "../music/types";
import { strokeInk, strokeWidth } from "../wonder/palette";

export type ShareShape = "square" | "portrait";
export const videoSize = (shape: ShareShape) => ({ width: 720, height: shape === "portrait" ? 1280 : 720 });

/** Fit the original drawing rectangle, never crop or stretch it for a social format. */
export function artworkBounds(aspect: number, width: number, height: number) {
  const availableWidth = width - 96, availableHeight = height - 300;
  const w = Math.min(availableWidth, availableHeight * aspect), h = w / aspect;
  return { x: (width - w) / 2, y: 150 + (availableHeight - h) / 2, width: w, height: h };
}

/** Every puchi note on the drawing, in drawing space, with the performed note that sounds it (if any). */
export function puchiNoteMarks(project: Project, music: MusicIR) {
  const strokes = new Map(project.strokes.map((stroke, index) => [stroke.id, { stroke, index }]));
  const performedBy = new Map(music.playNotes.map(note => [note.anchorId, note]));
  return music.drawing.map(note => {
    const source = strokes.get(note.sourceStroke);
    return { id: note.id, x: note.visualPosition.x, y: note.visualPosition.y,
      color: strokeInk(source?.stroke, source?.index ?? 0), performed: performedBy.get(note.id) as PlayNote | undefined };
  });
}

// Puchi note in Studio's geometry (head 4.2×2.8 at −25°, stem 3.5,−1→3.5,−14), with `unit` pixels per
// drawing unit. Drawing notes into the video was ported from Short REC (#55).
function drawPuchiNote(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, fill: string, stem: string | null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-25 * Math.PI / 180);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(0, 0, 4.2 * unit, 2.8 * unit, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (!stem) return;
  ctx.strokeStyle = stem; ctx.lineWidth = Math.max(1, 1.3 * unit); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + 3.5 * unit, y - unit); ctx.lineTo(x + 3.5 * unit, y - 14 * unit); ctx.stroke();
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
  const marks = puchiNoteMarks(project, music);
  // Studio's note size, enlarged a little because the video shows the drawing smaller than Studio.
  const noteUnit = bounds.width / 1000 * 1.5;
  const at = (mark: { x: number; y: number }) => [bounds.x + mark.x / 1000 * bounds.width, bounds.y + mark.y / 420 * bounds.height] as const;
  // Performed notes read clearly; the remaining notes stay as quiet heads so dense drawings stay legible.
  for (const mark of marks) {
    paper.globalAlpha = mark.performed ? .9 : .45;
    drawPuchiNote(paper, ...at(mark), noteUnit, mark.color, mark.performed ? mark.color : null);
  }
  paper.globalAlpha = 1;
  const sourceStrokes = new Map(music.drawing.map(note => [note.id, note.sourceStroke]));
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
    const fraction = Math.max(0, Math.min(1, beat / music.lengthBeats));
    // X is time: a soft playhead crosses the drawing as it sounds.
    const playheadX = bounds.x + bounds.width * fraction;
    const glow = ctx.createLinearGradient(playheadX - 68, 0, playheadX, 0);
    glow.addColorStop(0, "rgba(205,85,60,0)"); glow.addColorStop(1, "rgba(205,85,60,.10)");
    ctx.fillStyle = glow; ctx.fillRect(Math.max(bounds.x, playheadX - 68), bounds.y, Math.min(68, playheadX - bounds.x), bounds.height);
    ctx.strokeStyle = "#cd553c"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(playheadX, bounds.y); ctx.lineTo(playheadX, bounds.y + bounds.height); ctx.stroke();
    const sounding = new Set(active.map(note => note.anchorId));
    for (const mark of marks) {
      if (!sounding.has(mark.id)) continue;
      const [x, y] = at(mark);
      ctx.globalAlpha = .2; ctx.fillStyle = mark.color;
      ctx.beginPath(); ctx.arc(x, y, 11 * noteUnit, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      drawPuchiNote(ctx, x, y, noteUnit, "#f0a45e", "#d66a40");
    }
    ctx.lineCap = "round"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(230, height - 110); ctx.lineTo(490, height - 110);
    ctx.strokeStyle = "#e2e4d7"; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(230, height - 110); ctx.lineTo(230 + 260 * fraction, height - 110);
    ctx.strokeStyle = "#e89687"; ctx.stroke();
  };
}
