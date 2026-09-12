import type { WonderRuleId } from './wonderTypes';
export const WONDER_KEY = 'picture-score:wonder:v1';
export const RULES: WonderRuleId[] = ['closed-loop', 'retrace-thicken', 'crossing-spark', 'mirror-answer', 'garden-lineup-cascade', 'garden-triad-round'];
export interface WonderMemory { version: 1; triggered: Partial<Record<WonderRuleId, number>>; lastHint?: WonderRuleId; lastHintAt?: number }
export function loadWonderMemory(): WonderMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(WONDER_KEY) ?? 'null');
    if (raw?.version !== 1) return { version: 1, triggered: {} };
    return { version: 1, triggered: Object.fromEntries(RULES.filter(id => Number.isFinite(raw.triggered?.[id]) && raw.triggered[id] >= 0).map(id => [id, raw.triggered[id]])), lastHint: RULES.includes(raw.lastHint) ? raw.lastHint : undefined, lastHintAt: Number.isFinite(raw.lastHintAt) ? raw.lastHintAt : undefined };
  } catch { return { version: 1, triggered: {} }; }
}
export function rememberWonder(ids: WonderRuleId[], now = Date.now()) {
  const memory = loadWonderMemory();
  let changed = false;
  for (const id of ids) if (memory.triggered[id] === undefined) { memory.triggered[id] = now; changed = true; }
  if (changed) saveWonderMemory(memory);
}
export function saveWonderMemory(memory: WonderMemory) {
  try { localStorage.setItem(WONDER_KEY, JSON.stringify(memory)); } catch { /* Curiosity works without persistence. */ }
}
