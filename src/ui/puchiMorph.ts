const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/**
 * The drawing/music slider controls visual-note density as a staged morph:
 * almost pure ink at the left, a long expressive blend through the middle,
 * then a denser score near the music edge. We still never restore every
 * analysis sample, so the drawing does not turn back into a toothbrush.
 */
export function visualNoteRatio(strength: number): number {
  const s = clamp01(strength);
  if (s <= 0.1) return 0.012 * smoothstep(s / 0.1);
  if (s <= 0.7) {
    return 0.012 + 0.188 * smoothstep((s - 0.1) / 0.6);
  }
  return 0.2 + 0.14 * smoothstep((s - 0.7) / 0.3);
}

/**
 * Keep the original drawing fully present until the music-heavy end of the
 * slider. Between roughly 70% and 93% the ink falls away quickly, leaving a
 * clean note-only score for the final stretch.
 */
export function drawingPresence(strength: number): number {
  const fade = smoothstep((clamp01(strength) - 0.68) / 0.25);
  return 1 - fade;
}

/** Stable, evenly spread indexes avoid the old toothbrush / eyelash density. */
export function selectedIndexes(length: number, strength: number): number[] {
  if (length <= 0) return [];
  const s = clamp01(strength);
  if (s <= 0.02) return [];
  if (length === 1) return [0];
  const count = Math.max(
    1,
    Math.min(length, 18, Math.round(length * visualNoteRatio(s))),
  );
  if (count === 1) return [Math.floor((length - 1) / 2)];
  return Array.from(
    new Set(
      Array.from({ length: count }, (_, i) =>
        Math.round((i * (length - 1)) / (count - 1)),
      ),
    ),
  );
}

function parseNoteIdentity(element: SVGElement) {
  const id = element.dataset.note ?? "";
  const match = id.match(/^(.*)-(\d+)$/);
  return {
    stroke: match?.[1] ?? id,
    index: match ? Number(match[2]) : 0,
  };
}

function syncMorph() {
  const slider = document.querySelector<HTMLInputElement>("#magnet");
  const canvas = document.querySelector<SVGSVGElement>(".score-canvas");
  if (!slider || !canvas) return;

  const strength = clamp01(Number(slider.value) / 100);
  const notes = Array.from(canvas.querySelectorAll<SVGGElement>(".score-note"));
  const groups = new Map<string, Array<{ element: SVGGElement; index: number }>>();

  for (const element of notes) {
    const identity = parseNoteIdentity(element);
    const group = groups.get(identity.stroke) ?? [];
    group.push({ element, index: identity.index });
    groups.set(identity.stroke, group);
  }

  let visibleCount = 0;
  for (const group of groups.values()) {
    group.sort((a, b) => a.index - b.index);
    const selected = new Set(selectedIndexes(group.length, strength));
    group.forEach(({ element }, index) => {
      const visible = selected.has(index);
      element.dataset.morphVisible = visible ? "true" : "false";
      if (visible) visibleCount++;
    });
  }

  const sourceStrokes = canvas.querySelector<SVGGElement>(".source-strokes");
  if (sourceStrokes) sourceStrokes.style.opacity = String(0.66 * drawingPresence(strength));

  canvas.dataset.morphMode =
    strength < 0.3 ? "drawing" : strength > 0.7 ? "music" : "balance";
  canvas.style.setProperty("--morph-strength", strength.toFixed(3));

  const counter = document.querySelector<HTMLElement>(
    '[data-testid="interpretation-count"]',
  );
  const visualCount = counter?.querySelector<HTMLElement>("strong");
  if (counter) counter.dataset.visualCount = String(visibleCount);
  if (visualCount && visualCount.textContent !== String(visibleCount)) {
    visualCount.textContent = String(visibleCount);
  }
}

/**
 * Presentation-only bridge. It never changes React's music model, playback
 * selection, timing or the saved Project; it only changes how the same score
 * is revealed on the canvas.
 */
export function installPuchiMorph() {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncMorph);
  };

  const onInput = (event: Event) => {
    if ((event.target as HTMLInputElement | null)?.id === "magnet") schedule();
  };

  document.addEventListener("input", onInput);
  const root = document.getElementById("root");
  const observer = root ? new MutationObserver(schedule) : undefined;
  observer?.observe(root!, { childList: true, subtree: true });
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("input", onInput);
    observer?.disconnect();
  };
}
