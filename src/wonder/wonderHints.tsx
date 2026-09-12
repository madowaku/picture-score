import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { loadWonderMemory, RULES, saveWonderMemory } from './wonderMemory';
import type { WonderMemory } from './wonderMemory';
import type { WonderRuleId } from './wonderTypes';

export const HINTS: Record<WonderRuleId, string> = {
  'closed-loop': '閉じてみる？', 'retrace-thicken': '同じところを、もう一度。',
  'crossing-spark': '線を交差させたら？', 'mirror-answer': 'そっくりな形を描いてみよう。',
  'garden-lineup-cascade': '3つ並べてみる？', 'garden-triad-round': '三角に置いたら？',
};
export function nextWonderHint(space: 'draw' | 'garden', memory: WonderMemory, recent: WonderRuleId[]): WonderRuleId | undefined {
  const available = RULES.filter(id => id.startsWith('garden') === (space === 'garden') && !recent.includes(id) && memory.lastHint !== id);
  return available.find(id => memory.triggered[id] === undefined) ?? available[0];
}
export function WonderHint({ space, busy, enabled = true, className = '' }: { space: 'draw' | 'garden'; busy: boolean; enabled?: boolean; className?: string }) {
  const { t } = useLanguage();
  const [hint, setHint] = useState<WonderRuleId>();
  useEffect(() => {
    setHint(undefined);
    if (busy || !enabled) return;
    const recent: WonderRuleId[] = [];
    let hide: ReturnType<typeof setTimeout>;
    const show = () => {
      const memory = loadWonderMemory(), now = Date.now();
      if (memory.lastHintAt && now - memory.lastHintAt < 23000) return;
      const next = nextWonderHint(space, memory, recent.slice(-(space === 'draw' ? 2 : 1)));
      if (!next) return;
      recent.push(next); setHint(next); saveWonderMemory({ ...memory, lastHint: next, lastHintAt: now });
      hide = setTimeout(() => setHint(undefined), 6500);
    };
    const first = setTimeout(show, 1800), timer = setInterval(show, 24000);
    return () => { clearTimeout(first); clearTimeout(hide); clearInterval(timer); };
  }, [busy, enabled, space]);
  return <span className={'wonder-hint ' + className} data-testid="wonder-hint" aria-hidden={busy || !hint}>{!busy && hint ? t(HINTS[hint]) : ''}</span>;
}
