import type { Project } from "./types";
import { createMusic, createVisualNotes } from "./score";
import { drawRelations } from "../wonder/drawRelations";
import { applyDrawWonder } from "../wonder/drawMusic";

/** The same interpretation (including WONDER) as Studio, for saved works and exports. */
export function projectMusic(project: Project) {
  return applyDrawWonder(
    createMusic(createVisualNotes(project.strokes, project.magnet), project.tempo, project.accompaniment, project.magnet),
    drawRelations(project.strokes),
  );
}
