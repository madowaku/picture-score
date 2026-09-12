import type { GardenLifeEvent } from './life';
type Listener = (event: GardenLifeEvent | null) => void;
/** Local subscribers touch only their own DOM; no React state per note. */
export class LifePresentation {
  private objects = new Map<string, Listener>();
  private world = new Set<Listener>();
  register(id: string, listener: Listener) {
    this.objects.set(id, listener);
    return () => { if (this.objects.get(id) === listener) this.objects.delete(id); listener(null); };
  }
  observe(listener: Listener) { this.world.add(listener); return () => { this.world.delete(listener); listener(null); }; }
  dispatch = (event: GardenLifeEvent | null) => {
    const listeners = event ? [this.objects.get(event.objectId), ...this.world] : [...this.objects.values(), ...this.world];
    for (const listener of listeners) { try { listener?.(event); } catch { /* Presentation never blocks another voice. */ } }
  };
}
/** Fixed named slots cancel a previous effect instead of accumulating animations or timers. */
export class LifeAnimations {
  private animations = new Map<string, Animation>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  animate(key: string, node: Element | null, frames: Keyframe[], duration: number) {
    this.animations.get(key)?.cancel();
    if (!node || !node.animate) return;
    const animation = node.animate(frames, { duration, easing: 'ease-out' });
    this.animations.set(key, animation);
    animation.onfinish = () => { animation.cancel(); if (this.animations.get(key) === animation) this.animations.delete(key); };
  }
  later(key: string, delay: number, action: () => void) {
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => { this.timers.delete(key); action(); }, delay));
  }
  clear() { this.animations.forEach(a => a.cancel()); this.timers.forEach(clearTimeout); this.animations.clear(); this.timers.clear(); }
}
