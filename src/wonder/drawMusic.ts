import type { MusicIR, PlayNote } from '../music/types';
import type { WonderDrawEffect } from './wonderTypes';

/** A transient performance. Source score, music, and strokes are never edited. */
export function applyDrawWonder(base: MusicIR, effects: WonderDrawEffect[]): MusicIR {
  if (!effects.length) return base;
  const source = new Map(base.drawing.map(n => [n.id, n]));
  const owns = (n: PlayNote, e: WonderDrawEffect) => n.sourceIds.some(id => e.strokeIds.includes(source.get(id)?.sourceStroke ?? ''));
  let notes = base.playNotes.map(n => ({ ...n, sourceIds: [...n.sourceIds] }));
  const looped = new Set<string>(), answered = new Set<string>();
  for (const e of effects.filter(e => e.rule === 'closed-loop')) {
    const phrase = notes.filter(n => owns(n, e) && !looped.has(n.id));
    if (!phrase.length) continue;
    const start = Math.min(...phrase.map(n => n.beat));
    const end = Math.min(base.lengthBeats, Math.max(...phrase.map(n => n.beat + n.duration)));
    const half = (end - start) / 2;
    if (half < .125) continue;
    for (const n of phrase) {
      looped.add(n.id);
      n.beat = start + (n.beat - start) / 2; n.duration /= 2;
      looped.add(`${n.id}:loop`);
      notes.push({ ...n, id: `${n.id}:loop`, beat: n.beat + half, sourceIds: [...n.sourceIds], velocity: n.velocity * .9 });
    }
  }
  for (const e of effects.filter(e => e.rule === 'mirror-answer')) {
    const phrase = notes.filter(n => owns(n, e));
    if (!phrase.length) continue;
    for (const n of phrase) {
      const x = source.get(n.anchorId)?.sourcePosition.x ?? 0;
      if (x <= e.position.x || answered.has(n.id)) continue;
      answered.add(n.id); n.duration *= .7; n.articulation = 'melody';
      n.pitch += n.pitch > 76 ? -12 : 12; n.velocity *= .85;
    }
  }
  const companions: PlayNote[] = [];
  for (const e of effects.filter(e => e.rule === 'retrace-thicken')) {
    const seen = new Map<string, PlayNote>(), remove = new Set<PlayNote>();
    for (const n of notes.filter(n => owns(n, e))) {
      const key = `${Math.round(n.beat * 8)}:${n.pitch}`;
      const previous = seen.get(key);
      if (previous) {
        previous.sourceIds = [...new Set([...previous.sourceIds, ...n.sourceIds])];
        previous.duration = Math.max(previous.duration, n.duration); remove.add(n);
      } else seen.set(key, n);
    }
    notes = notes.filter(n => !remove.has(n));
    for (const n of seen.values()) {
      // Constant energy across the original and its quiet octave colors.
      n.velocity *= .86;
      if (companions.length < 48) companions.push({ ...n, id: `${n.id}:warm`, pitch: n.pitch > 76 ? n.pitch - 12 : n.pitch + 12, velocity: n.velocity * .42 });
      if (e.stage === 2 && companions.length < 48) companions.push({ ...n, id: `${n.id}:color`, pitch: n.pitch > 64 ? n.pitch - 24 : n.pitch + 24, velocity: n.velocity * .24 });
    }
  }
  for (const e of effects.filter(e => e.rule === 'crossing-spark')) {
    const near = notes.filter(n => owns(n, e)).sort((a, b) => Math.abs(a.beat - e.position.x * .016) - Math.abs(b.beat - e.position.x * .016))[0];
    if (near) companions.push({ ...near, id: `spark:${e.position.x}:${e.position.y}`, beat: Math.min(15.875, e.position.x * .016), duration: .16, pitch: near.pitch > 76 ? near.pitch - 12 : near.pitch + 12, velocity: .24, articulation: 'chord' });
  }
  // Added voices cannot overwhelm a dense source. Existing voices always have priority.
  for (const n of companions) if (notes.filter(p => p.beat <= n.beat && p.beat + p.duration > n.beat).length < 8) notes.push(n);
  const unique = new Map<string, PlayNote>();
  for (const n of notes) {
    n.duration = Math.min(n.duration, base.lengthBeats - n.beat);
    const key = `${Math.round(n.beat * 480)}:${n.pitch}`, old = unique.get(key);
    if (old) { old.duration = Math.max(old.duration, n.duration); old.velocity = Math.max(old.velocity, n.velocity); old.sourceIds = [...new Set([...old.sourceIds, ...n.sourceIds])]; }
    else unique.set(key, n);
  }
  const result = [...unique.values()].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  const next = new Map<number, number>();
  for (let i = result.length - 1; i >= 0; i--) {
    const n = result[i]; n.duration = Math.min(n.duration, (next.get(n.pitch) ?? base.lengthBeats) - n.beat); next.set(n.pitch, n.beat);
  }
  return { ...base, playNotes: result.filter(n => n.duration > 0) };
}
