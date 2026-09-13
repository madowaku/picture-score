import type { PaletteDefinition, PaletteRole, PlacementZone } from "../palettes";
import { createSeededRandom, deriveSeed } from "../world/events";
import type { WorldEntity } from "../world/runtime";
import { intersectsClearing } from "./clearing";
import type { Clearing, GardenLayout } from "./clearing";

export interface ScoreBloomPlacement {
  entityId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type OccupiedPlacement = ScoreBloomPlacement & { role: PaletteRole };

type ZoneRange = readonly [number, number];

const ZONES: Record<PlacementZone, ZoneRange> = {
  ground: [700, 940],
  low: [560, 820],
  middle: [320, 720],
  upper: [140, 480],
  sky: [60, 300],
  any: [60, 940],
};

const ROLE_PIXELS: Record<PaletteRole, { width: number; height: number }> = {
  melody: { width: 40, height: 40 },
  harmony: { width: 40, height: 28 },
  rhythm: { width: 32, height: 32 },
  ornament: { width: 32, height: 32 },
  resonance: { width: 40, height: 40 },
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, amount: number): number =>
  from + (to - from) * clamp01(amount);

const footprint = (entity: WorldEntity, layout: GardenLayout) => {
  const base = ROLE_PIXELS[entity.role];
  return {
    width: Math.max(1, base.width * entity.scale) * 1000 / layout.width,
    height: Math.max(1, base.height * entity.scale) * 1000 / layout.height,
  };
};

const roleCluster = (palette: PaletteDefinition, role: PaletteRole) => {
  const random = createSeededRandom(deriveSeed(palette.id, role, "placement-cluster"));
  return { x: random.range(0.16, 0.84), y: random.range(0.12, 0.88) };
};

const initialPoint = (entity: WorldEntity, palette: PaletteDefinition) => {
  const rule = palette.roles[entity.role].placement;
  const [zoneTop, zoneBottom] = ZONES[rule.zone];
  const cluster = roleCluster(palette, entity.role);
  const hintX = mix(clamp01(entity.positionHint.x), cluster.x, rule.clustering);
  const hintY = mix(clamp01(entity.positionHint.y), cluster.y, rule.clustering);
  return {
    x: 50 + hintX * 900,
    // PositionHint y is musical height: 1 is high. SVG y grows downward.
    y: zoneBottom - hintY * (zoneBottom - zoneTop),
  };
};

const centerOf = (placement: ScoreBloomPlacement, palette: PaletteDefinition, entity: WorldEntity) => {
  const asset = palette.roles[entity.role].assets.find(candidate => candidate.id === entity.assetId);
  const anchor = asset?.anchor ?? { x: 0.5, y: 0.5 };
  return {
    x: placement.x + (0.5 - anchor.x) * placement.width,
    y: placement.y + (0.5 - anchor.y) * placement.height,
  };
};

const insideGardenAndZone = (
  candidate: ScoreBloomPlacement,
  palette: PaletteDefinition,
  entity: WorldEntity,
): boolean => {
  const [zoneTop, zoneBottom] = ZONES[palette.roles[entity.role].placement.zone];
  const center = centerOf(candidate, palette, entity);
  return center.x - candidate.width / 2 >= 0 &&
    center.x + candidate.width / 2 <= 1000 &&
    center.y - candidate.height / 2 >= zoneTop &&
    center.y + candidate.height / 2 <= zoneBottom;
};

const intersectsArtwork = (
  candidate: ScoreBloomPlacement,
  palette: PaletteDefinition,
  entity: WorldEntity,
  clearings: readonly Clearing[],
): boolean => {
  const center = centerOf(candidate, palette, entity);
  return clearings.some(clearing => intersectsClearing({
    x: center.x,
    y: center.y,
    width: candidate.width,
    height: candidate.height,
  }, clearing));
};

const screenRadius = (placement: ScoreBloomPlacement, layout: GardenLayout): number =>
  Math.max(
    placement.width * layout.width / 1000,
    placement.height * layout.height / 1000,
  ) / 2;

const tooClose = (
  candidate: ScoreBloomPlacement,
  palette: PaletteDefinition,
  entity: WorldEntity,
  occupied: readonly OccupiedPlacement[],
  layout: GardenLayout,
): boolean => {
  const currentCenter = centerOf(candidate, palette, entity);
  const minDistance = palette.roles[entity.role].placement.minDistance;
  const currentRadius = screenRadius(candidate, layout);

  return occupied.some(previous => {
    const dx = (currentCenter.x - previous.x) * layout.width / 1000;
    const dy = (currentCenter.y - previous.y) * layout.height / 1000;
    const previousRadius = screenRadius(previous, layout);
    const previousDistance = palette.roles[previous.role].placement.minDistance;
    return Math.hypot(dx, dy) < currentRadius + previousRadius + Math.max(minDistance, previousDistance);
  });
};

const candidateAt = (
  entity: WorldEntity,
  palette: PaletteDefinition,
  layout: GardenLayout,
  attempt: number,
): ScoreBloomPlacement => {
  const base = initialPoint(entity, palette);
  const size = footprint(entity, layout);
  if (attempt === 0) return { entityId: entity.id, ...base, ...size };

  const random = createSeededRandom(deriveSeed(entity.seed, palette.id, "placement-nudge"));
  const phase = random.range(0, Math.PI * 2);
  const spoke = (attempt - 1) % 8;
  const ring = Math.floor((attempt - 1) / 8) + 1;
  const stepPixels = Math.max(14, palette.roles[entity.role].placement.minDistance);
  const radiusPixels = stepPixels * ring;
  const angle = phase + spoke * Math.PI / 4;
  return {
    entityId: entity.id,
    x: base.x + Math.cos(angle) * radiusPixels * 1000 / layout.width,
    y: base.y + Math.sin(angle) * radiusPixels * 1000 / layout.height,
    ...size,
  };
};

/**
 * Resolve one semantic entity into stable Garden coordinates. Existing placements
 * are supplied in stable order so min-distance decisions replay exactly.
 */
export function resolvePalettePosition(
  entity: WorldEntity,
  palette: PaletteDefinition,
  clearings: readonly Clearing[],
  layout: GardenLayout,
  occupied: readonly OccupiedPlacement[] = [],
): ScoreBloomPlacement | null {
  // Base candidate plus four deterministic eight-spoke rings.
  for (let attempt = 0; attempt < 33; attempt += 1) {
    const candidate = candidateAt(entity, palette, layout, attempt);
    if (!insideGardenAndZone(candidate, palette, entity)) continue;
    if (intersectsArtwork(candidate, palette, entity, clearings)) continue;
    if (tooClose(candidate, palette, entity, occupied, layout)) continue;
    return candidate;
  }
  return null;
}

/** Deterministic batch resolver. Suppressed entities are omitted rather than covering source art. */
export function resolvePalettePlacements(
  entities: readonly WorldEntity[],
  palette: PaletteDefinition,
  clearings: readonly Clearing[],
  layout: GardenLayout,
): ReadonlyMap<string, ScoreBloomPlacement> {
  const result = new Map<string, ScoreBloomPlacement>();
  const occupied: OccupiedPlacement[] = [];

  const ordered = [...entities].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  for (const entity of ordered) {
    const placement = resolvePalettePosition(entity, palette, clearings, layout, occupied);
    if (!placement) continue;
    result.set(entity.id, placement);
    const center = centerOf(placement, palette, entity);
    occupied.push({ ...placement, x: center.x, y: center.y, role: entity.role });
  }

  return result;
}
