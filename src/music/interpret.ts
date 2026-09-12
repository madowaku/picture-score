import type { PlayNote, ScoreNote } from "./types";

// Source positions, not the visual snapping, drive interpretation.
const LENGTH = 16;
const X_PER_BEAT = 1000 / LENGTH;
const bounded = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const xOf = (n: ScoreNote) => n.sourcePosition.x;
type Phrase = { anchor: ScoreNote; sources: ScoreNote[]; endX: number };

/** X turns become independent voices: both sides of a loop can sound together.
 * Nearly vertical segments form chords instead of a rapid pitch sweep. */
function branches(points: ScoreNote[]): ScoreNote[][] {
  if (points.length < 2) return [points];
  const result: ScoreNote[][] = [];
  let current = [points[0]], direction: number | undefined;
  for (let i = 1; i < points.length; i++) {
    const dx = xOf(points[i]) - xOf(points[i - 1]);
    const nextDirection = Math.abs(dx) < 1.4 ? 0 : Math.sign(dx);
    if (direction !== undefined && nextDirection !== direction) {
      result.push(current);
      current = [points[i - 1]];
    }
    current.push(points[i]);
    direction = nextDirection;
  }
  result.push(current);
  return result;
}

/** Nested thinning keeps endpoints and favours melodic turning points.
 * Higher strength walks farther along the same removal order. */
function thin(phrases: Phrase[], target: number): Phrase[] {
  const kept = phrases.map((p) => ({ ...p, sources: [...p.sources] }));
  while (kept.length > target && kept.length > 2) {
    let remove = 1, smallest = Infinity;
    for (let i = 1; i < kept.length - 1; i++) {
      const a = kept[i - 1].anchor, b = kept[i].anchor, c = kept[i + 1].anchor;
      const width = xOf(c) - xOf(a);
      const expected = a.pitch + (c.pitch - a.pitch) * (xOf(b) - xOf(a)) / Math.max(1, width);
      const turn = (b.pitch - a.pitch) * (c.pitch - b.pitch) < 0 ? 10 : 0;
      const significance = width * (1 + Math.abs(b.pitch - expected) + turn);
      if (significance < smallest) { smallest = significance; remove = i; }
    }
    kept[remove - 1].sources.push(...kept[remove].sources);
    kept[remove - 1].endX = kept[remove].endX;
    kept.splice(remove, 1);
  }
  if (target === 1 && kept.length > 1) {
    kept[0].sources.push(...kept.slice(1).flatMap((p) => p.sources));
    kept[0].endX = kept.at(-1)!.endX;
    kept.splice(1);
  }
  return kept;
}

export function createPlayNotes(visualNotes: ScoreNote[], strength: number): PlayNote[] {
  const amount = bounded(strength, 0, 1);
  const spacing = 20 * 8 ** amount;
  const maxChord = Math.round(6 - 3 * amount);
  const snap = (x: number) => {
    const raw = bounded(x / X_PER_BEAT, 0, LENGTH - 0.125);
    return bounded(raw + (Math.round(raw * 4) / 4 - raw) * amount, 0, LENGTH - 0.125);
  };
  const byStroke = new Map<string, ScoreNote[]>();
  for (const n of visualNotes) {
    const group = byStroke.get(n.sourceStroke) ?? [];
    group.push(n);
    byStroke.set(n.sourceStroke, group);
  }
  const played: PlayNote[] = [];
  for (const group of byStroke.values()) {
    group.sort((a, b) => a.sourceIndex - b.sourceIndex);
    for (const branch of branches(group)) {
      const sorted = [...branch].sort((a, b) => xOf(a) - xOf(b) || a.pitch - b.pitch);
      const left = xOf(sorted[0]), right = xOf(sorted.at(-1)!);
      if (right - left <= 10 && sorted.length > 1) {
        const pitches = [...new Map(sorted.map((n) => [n.pitch, n])).values()]
          .sort((a, b) => a.pitch - b.pitch);
        const count = Math.min(maxChord, pitches.length);
        const selected = Array.from({ length: count }, (_, i) => pitches[
          count === 1 ? 0 : Math.round(i * (pitches.length - 1) / (count - 1))
        ]);
        for (const anchor of selected) {
          const sources = sorted.filter((n) => selected.reduce((best, candidate) =>
            Math.abs(candidate.pitch - n.pitch) < Math.abs(best.pitch - n.pitch) ? candidate : best,
          selected[0]).id === anchor.id);
          const beat = snap((left + right) / 2);
          played.push({ id: "play-" + anchor.id, anchorId: anchor.id,
            pitch: anchor.pitch, beat, duration: Math.min(0.6 + amount * 0.65, LENGTH - beat),
            velocity: anchor.velocity, sourceIds: sources.map((n) => n.id), articulation: "chord" });
        }
        continue;
      }
      const phrases: Phrase[] = [];
      for (const n of sorted) {
        const last = phrases.at(-1);
        if (last && last.anchor.pitch === n.pitch) {
          last.sources.push(n);
          last.endX = xOf(n);
        } else phrases.push({ anchor: n, sources: [n], endX: xOf(n) });
      }
      const selected = thin(phrases, Math.max(1, Math.ceil((right - left) / spacing)));
      selected.forEach((phrase, i) => {
        const beat = snap(xOf(phrase.anchor));
        const next = selected[i + 1];
        const end = next ? snap(xOf(next.anchor)) : Math.max(snap(right), beat + 0.3 + amount * 0.15);
        const duration = Math.min(LENGTH - beat, Math.max(0.125, end - beat));
        const isLevel = phrase.sources.every((n) => n.pitch === phrase.anchor.pitch);
        played.push({ id: "play-" + phrase.anchor.id, anchorId: phrase.anchor.id,
          pitch: phrase.anchor.pitch, beat, duration,
          velocity: phrase.anchor.velocity, sourceIds: phrase.sources.map((n) => n.id),
          articulation: isLevel && duration >= 0.75 ? "sustain" : "melody" });
      });
    }
  }

  // One onset / pitch is one voice, even where branches or separate strokes meet.
  const onsets = new Map<number, Map<number, PlayNote>>();
  played.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch || a.id.localeCompare(b.id));
  for (const note of played) {
    const tick = Math.round(note.beat * 1000000);
    const chord = onsets.get(tick) ?? new Map<number, PlayNote>();
    const existing = chord.get(note.pitch);
    if (existing) {
      existing.duration = Math.max(existing.duration, note.duration);
      existing.velocity = Math.max(existing.velocity, note.velocity);
      existing.sourceIds.push(...note.sourceIds);
    } else chord.set(note.pitch, { ...note, sourceIds: [...note.sourceIds] });
    onsets.set(tick, chord);
  }
  const result: PlayNote[] = [];
  for (const [tick, chord] of onsets) {
    const notes = [...chord.values()].sort((a, b) => a.pitch - b.pitch);
    const count = Math.min(maxChord, notes.length);
    const selected = Array.from({ length: count }, (_, i) => notes[
      count === 1 ? 0 : Math.round(i * (notes.length - 1) / (count - 1))
    ]);
    for (const n of notes) {
      if (selected.includes(n)) continue;
      const closest = selected.reduce((best, s) =>
        Math.abs(s.pitch - n.pitch) < Math.abs(best.pitch - n.pitch) ? s : best, selected[0]);
      closest.sourceIds.push(...n.sourceIds);
      closest.duration = Math.max(closest.duration, n.duration);
    }
    for (const n of selected) {
      n.id = "play-" + tick + "-" + n.pitch;
      n.sourceIds = [...new Set(n.sourceIds)];
      if (selected.length > 1) {
        n.articulation = "chord";
        n.chordId = "chord-" + tick;
        n.velocity *= 1 / Math.sqrt(selected.length);
      }
      result.push(n);
    }
  }
  // Match MIDI's pitch-scoped note-off contract in live audio and WAV as well.
  const nextOnset = new Map<number, number>();
  for (let i = result.length - 1; i >= 0; i--) {
    const note = result[i], next = nextOnset.get(note.pitch);
    if (next !== undefined) note.duration = Math.min(note.duration, next - note.beat);
    nextOnset.set(note.pitch, note.beat);
  }
  return result;
}
