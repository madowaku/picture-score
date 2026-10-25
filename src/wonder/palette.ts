import type { Stroke } from "../music/types";

export const inkColors = [
  { value: "#d44f65", ja: "ももいろ", en: "Rose" },
  { value: "#2584ac", ja: "あお", en: "Blue" },
  { value: "#369270", ja: "みどり", en: "Green" },
  { value: "#ae7222", ja: "きいろ", en: "Ochre" },
  { value: "#8660ae", ja: "むらさき", en: "Purple" },
  { value: "#cc613f", ja: "だいだい", en: "Orange" },
] as const;
export const inkWidths = [
  { value: 1.5, ja: "ほそい", en: "Fine" },
  { value: 2.8, ja: "ふつう", en: "Medium" },
  { value: 5, ja: "ふとい", en: "Bold" },
] as const;
export const strokeColor = (index: number) => inkColors[((index % 6) + 6) % 6].value;
export const strokeInk = (stroke: Stroke | undefined, index: number) => stroke?.color ?? strokeColor(index);
export const strokeWidth = (stroke: Stroke, fallback = 2.2) => stroke.width ?? fallback;
