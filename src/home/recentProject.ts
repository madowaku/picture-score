import type { Project } from "../music/types";
import { parseProject } from "../music/project";

export const RECENT_PROJECT_KEY = "picture-score:recent-project:v1";

export function loadRecentProject(): Project | null {
  try {
    const raw = localStorage.getItem(RECENT_PROJECT_KEY);
    if (!raw) return null;
    const project = parseProject(JSON.parse(raw));
    return project.strokes.length ? project : null;
  } catch {
    return null;
  }
}

export function rememberRecentProject(project: Project): void {
  if (!project.strokes.length) return;
  try {
    localStorage.setItem(RECENT_PROJECT_KEY, JSON.stringify(project));
  } catch {
    // Recent-work memory is convenience only; current project autosave remains authoritative.
  }
}
