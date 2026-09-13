import type { PaletteCue, PaletteReactCue, PaletteSpawnCue } from "../../palettes";
import type { EntityOrigin, WorldEntity } from "./types";

const cloneEntity = (entity: WorldEntity): WorldEntity => ({
  ...entity,
  positionHint: { ...entity.positionHint },
  origin: { ...entity.origin },
  motion: { ...entity.motion },
  reaction: { ...entity.reaction },
});

const originFromCue = (cue: PaletteSpawnCue): EntityOrigin => ({
  musicalEventId: cue.sourceEventId,
  worldEventId: cue.worldEventId,
  paletteCueId: cue.id,
});

export class EntityStore {
  private readonly entities = new Map<string, WorldEntity>();

  constructor(private readonly totalLimit: number) {
    if (!Number.isInteger(totalLimit) || totalLimit < 0) {
      throw new Error("entity store total limit must be a non-negative integer");
    }
  }

  get size(): number {
    return this.entities.size;
  }

  apply(cue: PaletteCue, time: number): boolean {
    if (!Number.isFinite(time) || time < 0) {
      throw new Error("entity apply time must be a finite non-negative number");
    }

    if (cue.type === "spawn") return this.applySpawn(cue, time);
    if (cue.type === "react") return this.applyReact(cue);
    return false;
  }

  reset(): void {
    this.entities.clear();
  }

  snapshot(): readonly WorldEntity[] {
    return [...this.entities.values()]
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map(cloneEntity);
  }

  get(id: string): WorldEntity | undefined {
    const entity = this.entities.get(id);
    return entity ? cloneEntity(entity) : undefined;
  }

  private applySpawn(cue: PaletteSpawnCue, time: number): boolean {
    if (this.entities.has(cue.id)) return false;
    if (this.entities.size >= this.totalLimit) return false;

    this.entities.set(cue.id, {
      id: cue.id,
      role: cue.role,
      assetId: cue.asset.id,
      assetSrc: cue.asset.src,
      createdAt: time,
      positionHint: { ...cue.positionHint },
      scale: cue.scale,
      rotation: cue.rotation,
      intensity: cue.intensity,
      seed: cue.seed,
      origin: originFromCue(cue),
      motion: { ...cue.motion },
      reaction: {
        amount: 0,
        revision: 0,
      },
    });
    return true;
  }

  private applyReact(cue: PaletteReactCue): boolean {
    const targets = cue.targetCueId
      ? [this.entities.get(cue.targetCueId)].filter(
          (entity): entity is WorldEntity => entity !== undefined,
        )
      : [...this.entities.values()].filter((entity) => entity.role === cue.targetRole);

    if (!targets.length) return false;

    for (const entity of targets) {
      entity.reaction = {
        amount: cue.amount,
        direction: cue.direction,
        duration: cue.duration,
        revision: entity.reaction.revision + 1,
      };
    }
    return true;
  }
}
