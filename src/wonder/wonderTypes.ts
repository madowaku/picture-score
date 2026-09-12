export type WonderRuleId = 'closed-loop' | 'retrace-thicken' | 'crossing-spark' | 'mirror-answer' | 'garden-lineup-cascade' | 'garden-triad-round';
export interface WonderDrawEffect {
  rule: Exclude<WonderRuleId, 'garden-lineup-cascade' | 'garden-triad-round'>;
  strokeIds: string[];
  position: { x: number; y: number };
  stage?: number;
}
export interface WonderGardenEffect {
  rule: 'garden-lineup-cascade' | 'garden-triad-round';
  objectIds: string[];
  strength: number;
}
export interface WonderPlan {
  drawEffects: WonderDrawEffect[];
  gardenEffects: WonderGardenEffect[];
}
