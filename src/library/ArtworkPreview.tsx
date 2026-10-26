import type { Project } from "../music/types";
import { strokeInk, strokeWidth } from "../wonder/palette";

export function ArtworkPreview({ project }: { project: Project }) {
  return <div className="artwork-preview" aria-hidden="true">
    <svg viewBox={`0 0 ${project.canvasAspect * 420} 420`}>
      <g transform={`scale(${project.canvasAspect * 420 / 1000},1)`}>
        {project.strokes.map((stroke, index) => <path key={stroke.id}
          d={stroke.points.map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`).join(" ") + (stroke.points.length === 1 ? "l.1,0" : "")}
          fill="none" stroke={strokeInk(stroke, index)} strokeWidth={strokeWidth(stroke, 2.8)} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}
      </g>
    </svg>
  </div>;
}
