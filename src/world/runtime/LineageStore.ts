import type { EntityOrigin } from "./types";

const sameOrigin = (a: EntityOrigin, b: EntityOrigin): boolean =>
  a.musicalEventId === b.musicalEventId &&
  a.worldEventId === b.worldEventId &&
  a.paletteCueId === b.paletteCueId;

export class LineageStore {
  private readonly origins = new Map<string, EntityOrigin>();

  record(entityId: string, origin: EntityOrigin): void {
    if (!entityId.trim()) throw new Error("lineage entity id is required");
    const existing = this.origins.get(entityId);
    if (existing) {
      if (!sameOrigin(existing, origin)) {
        throw new Error(`conflicting lineage for entity: ${entityId}`);
      }
      return;
    }
    this.origins.set(entityId, { ...origin });
  }

  get(entityId: string): EntityOrigin | undefined {
    const origin = this.origins.get(entityId);
    return origin ? { ...origin } : undefined;
  }

  reset(): void {
    this.origins.clear();
  }

  snapshot(): Readonly<Record<string, EntityOrigin>> {
    return Object.fromEntries(
      [...this.origins.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, origin]) => [id, { ...origin }]),
    );
  }
}
