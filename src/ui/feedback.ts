/** Tiny, optional tactile response. Unsupported devices simply continue silently. */
export function tactileTick(duration = 8) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(Math.max(1, Math.min(14, duration))); } catch { /* vibration is never required */ }
}
