import type { WorldEvent } from "../world/events";
import { createSeededRandom, deriveSeed } from "../world/events";
import { validatePaletteDefinition } from "./schema";
import type {
  AssetVariant,
  EnvironmentState,
  MotionProfile,
  PaletteCue,
  PaletteDefinition,
  PaletteReactCue,
  PaletteRole,
  PaletteRuntime,
  PaletteRuntimeSnapshot,
  PaletteSpawnCue,
  ResolvedMotionProfile,
  RoleDefinition,
} from "./types";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const cloneEnvironment = (state: EnvironmentState): EnvironmentState => ({ ...state });

const cueId = (
  paletteId: string,
  worldEventId: string,
  type: PaletteCue["type"],
): string => `palette:${paletteId}:${worldEventId}:${type}`;

const weightedAsset = (
  assets: readonly AssetVariant[],
  seed: number,
): AssetVariant => {
  const random = createSeededRandom(seed);
  const total = assets.reduce((sum, asset) => sum + asset.weight, 0);
  let cursor = random.range(0, total);
  for (const asset of assets) {
    cursor -= asset.weight;
    if (cursor <= 0) return asset;
  }
  return assets[assets.length - 1];
};

export const resolveMotionProfile = (
  motion: MotionProfile,
  reducedMotion: boolean,
): ResolvedMotionProfile => {
  if (!reducedMotion) return { ...motion };
  if (motion.reducedMotion === "static") {
    return {
      ...motion,
      idleMotion: "none",
      amplitude: 0,
      speed: 0,
      birthMotion: "none",
      responseStrength: 0,
    };
  }
  return {
    ...motion,
    idleMotion: "none",
    amplitude: 0,
    speed: 0,
    birthMotion: "fade",
    responseStrength: Math.min(0.15, motion.responseStrength),
  };
};

const spawnIntensity = (event: WorldEvent): number => {
  switch (event.type) {
    case "birth":
      return event.intensity;
    case "bloom":
      return event.openness;
    case "pulse":
      return event.intensity;
    case "spark":
      return event.intensity;
    case "sway":
      return event.intensity;
    default:
      return 0;
  }
};

const createSpawnCue = (
  definition: PaletteDefinition,
  roleDefinition: RoleDefinition,
  event: Extract<WorldEvent, { type: "birth" | "bloom" | "pulse" | "spark" | "sway" }>,
  reducedMotion: boolean,
): PaletteSpawnCue => {
  const visualSeed = deriveSeed(event.seed, definition.id, event.role, "visual");
  const random = createSeededRandom(visualSeed);
  const asset = weightedAsset(
    roleDefinition.assets,
    deriveSeed(visualSeed, "asset"),
  );
  const [scaleMin, scaleMax] = roleDefinition.placement.scaleRange;
  const [rotationMin, rotationMax] = roleDefinition.placement.rotationRange;

  return {
    id: cueId(definition.id, event.id, "spawn"),
    type: "spawn",
    paletteId: definition.id,
    worldEventId: event.id,
    sourceEventId: event.sourceEventId,
    role: event.role,
    seed: visualSeed,
    asset,
    positionHint: { ...event.positionHint },
    scale: random.range(scaleMin, scaleMax) * (asset.baseScale ?? 1),
    rotation: random.range(rotationMin, rotationMax),
    intensity: spawnIntensity(event),
    motion: resolveMotionProfile(roleDefinition.motion, reducedMotion),
  };
};

export function createPaletteRuntime(
  input: PaletteDefinition,
  options: { reducedMotion?: boolean } = {},
): PaletteRuntime {
  const definition = validatePaletteDefinition(input);
  const reducedMotion = options.reducedMotion ?? false;
  let environment = cloneEnvironment(definition.environment.initial);
  let totalSpawned = 0;
  const spawnCounts: Record<PaletteRole, number> = {
    melody: 0,
    harmony: 0,
    rhythm: 0,
    ornament: 0,
    resonance: 0,
  };
  const spawnedCueIds = new Set<string>();

  const canSpawn = (role: PaletteRole): boolean =>
    totalSpawned < definition.limits.total &&
    spawnCounts[role] < definition.limits.roles[role];

  const applyAtmosphere = (
    event: Extract<WorldEvent, { type: "atmosphere" }>,
  ): PaletteCue[] => {
    const signedDelta = event.energyDelta * event.confidence;
    const response = definition.environment.sectionResponse;
    environment = {
      energy: clamp01(environment.energy + signedDelta * response.energy),
      brightness: clamp01(
        environment.brightness + signedDelta * response.brightness,
      ),
      wind: clamp01(environment.wind + signedDelta * response.wind),
      glow: clamp01(environment.glow + signedDelta * response.glow),
      atmosphere: clamp01(
        environment.atmosphere + signedDelta * response.atmosphere,
      ),
    };
    return [
      {
        id: cueId(definition.id, event.id, "environment"),
        type: "environment",
        paletteId: definition.id,
        worldEventId: event.id,
        sourceEventId: event.sourceEventId,
        role: "section",
        seed: deriveSeed(event.seed, definition.id, "environment"),
        state: cloneEnvironment(environment),
      },
    ];
  };

  const apply = (event: WorldEvent): PaletteCue[] => {
    switch (event.type) {
      case "birth":
      case "bloom":
      case "pulse":
      case "spark": {
        const role = event.role;
        if (!canSpawn(role)) return [];
        const cue = createSpawnCue(
          definition,
          definition.roles[role],
          event,
          reducedMotion,
        );
        spawnCounts[role] += 1;
        totalSpawned += 1;
        spawnedCueIds.add(cue.id);
        return [cue];
      }

      case "growth": {
        const targetCueId = cueId(definition.id, event.targetHint, "spawn");
        if (!spawnedCueIds.has(targetCueId)) return [];
        const roleDefinition = definition.roles.melody;
        const cue: PaletteReactCue = {
          id: cueId(definition.id, event.id, "react"),
          type: "react",
          paletteId: definition.id,
          worldEventId: event.id,
          sourceEventId: event.sourceEventId,
          role: "melody",
          seed: deriveSeed(event.seed, definition.id, "react"),
          targetCueId,
          targetRole: "melody",
          amount:
            event.amount *
            resolveMotionProfile(roleDefinition.motion, reducedMotion)
              .responseStrength,
          motion: resolveMotionProfile(roleDefinition.motion, reducedMotion),
        };
        return [cue];
      }

      case "sway": {
        const roleDefinition = definition.roles.resonance;
        const motion = resolveMotionProfile(roleDefinition.motion, reducedMotion);
        const cues: PaletteCue[] = [];

        if (canSpawn("resonance")) {
          const spawn = createSpawnCue(
            definition,
            roleDefinition,
            event,
            reducedMotion,
          );
          spawnCounts.resonance += 1;
          totalSpawned += 1;
          spawnedCueIds.add(spawn.id);
          cues.push(spawn);
        }

        const react: PaletteReactCue = {
          id: cueId(definition.id, event.id, "react"),
          type: "react",
          paletteId: definition.id,
          worldEventId: event.id,
          sourceEventId: event.sourceEventId,
          role: "resonance",
          seed: deriveSeed(event.seed, definition.id, "react"),
          targetRole: "resonance",
          amount: event.intensity * motion.responseStrength,
          direction: event.direction,
          duration: event.duration,
          motion,
        };
        cues.push(react);
        return cues;
      }

      case "atmosphere":
        return applyAtmosphere(event);
    }
  };

  return {
    definition,
    apply,
    reset() {
      environment = cloneEnvironment(definition.environment.initial);
      totalSpawned = 0;
      for (const role of Object.keys(spawnCounts) as PaletteRole[])
        spawnCounts[role] = 0;
      spawnedCueIds.clear();
    },
    snapshot(): PaletteRuntimeSnapshot {
      return {
        paletteId: definition.id,
        reducedMotion,
        spawnCounts: { ...spawnCounts },
        totalSpawned,
        environment: cloneEnvironment(environment),
      };
    },
  };
}
