import type {
  EnvironmentState,
  PaletteDefinition,
  PaletteRole,
  RoleDefinition,
} from "./types";

export const PALETTE_ROLES: readonly PaletteRole[] = [
  "melody",
  "harmony",
  "rhythm",
  "ornament",
  "resonance",
];

const PLACEMENT_ZONES = ["ground", "low", "middle", "upper", "sky", "any"] as const;
const IDLE_MOTIONS = ["none", "sway", "float", "pulse", "twinkle"] as const;
const BIRTH_MOTIONS = ["none", "fade", "grow", "rise", "pop"] as const;
const REDUCED_MOTIONS = ["static", "fade-only"] as const;

const finite = (value: number, label: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
};

const unit = (value: number, label: string): number => {
  const n = finite(value, label);
  if (n < 0 || n > 1) throw new Error(`${label} must be between 0 and 1`);
  return n;
};

const nonNegative = (value: number, label: string): number => {
  const n = finite(value, label);
  if (n < 0) throw new Error(`${label} must be >= 0`);
  return n;
};

const validateEnvironment = (state: EnvironmentState, label: string): void => {
  unit(state.energy, `${label}.energy`);
  unit(state.brightness, `${label}.brightness`);
  unit(state.wind, `${label}.wind`);
  unit(state.glow, `${label}.glow`);
  unit(state.atmosphere, `${label}.atmosphere`);
};

const validateRole = (role: PaletteRole, definition: RoleDefinition): void => {
  if (!definition.assets.length)
    throw new Error(`palette role ${role} needs at least one asset`);

  const assetIds = new Set<string>();
  for (const asset of definition.assets) {
    if (!asset.id || assetIds.has(asset.id))
      throw new Error(`palette role ${role} asset ids must be unique and non-empty`);
    assetIds.add(asset.id);
    if (!asset.src) throw new Error(`palette role ${role} asset src is required`);
    if (!["png", "webp", "svg"].includes(asset.format))
      throw new Error(`palette role ${role} asset format is unsupported`);
    if (!(finite(asset.weight, `palette role ${role} asset weight`) > 0))
      throw new Error(`palette role ${role} asset weight must be > 0`);
    if (asset.anchor) {
      unit(asset.anchor.x, `palette role ${role} anchor.x`);
      unit(asset.anchor.y, `palette role ${role} anchor.y`);
    }
    if (
      asset.baseScale !== undefined &&
      !(finite(asset.baseScale, `palette role ${role} baseScale`) > 0)
    )
      throw new Error(`palette role ${role} baseScale must be > 0`);
  }

  if (!PLACEMENT_ZONES.includes(definition.placement.zone))
    throw new Error(`palette role ${role} placement zone is unsupported`);
  unit(definition.placement.clustering, `palette role ${role} clustering`);
  nonNegative(definition.placement.minDistance, `palette role ${role} minDistance`);
  const [scaleMin, scaleMax] = definition.placement.scaleRange;
  if (!(finite(scaleMin, "scale min") > 0) || scaleMax < scaleMin)
    throw new Error(`palette role ${role} scaleRange is invalid`);
  finite(scaleMax, "scale max");
  const [rotationMin, rotationMax] = definition.placement.rotationRange;
  finite(rotationMin, "rotation min");
  finite(rotationMax, "rotation max");
  if (rotationMax < rotationMin)
    throw new Error(`palette role ${role} rotationRange is invalid`);

  if (!IDLE_MOTIONS.includes(definition.motion.idleMotion))
    throw new Error(`palette role ${role} idle motion is unsupported`);
  if (!BIRTH_MOTIONS.includes(definition.motion.birthMotion))
    throw new Error(`palette role ${role} birth motion is unsupported`);
  if (!REDUCED_MOTIONS.includes(definition.motion.reducedMotion))
    throw new Error(`palette role ${role} reduced motion is unsupported`);
  nonNegative(definition.motion.amplitude, `palette role ${role} amplitude`);
  nonNegative(definition.motion.speed, `palette role ${role} speed`);
  unit(definition.motion.responseStrength, `palette role ${role} responseStrength`);
}

export function validatePaletteDefinition(
  definition: PaletteDefinition,
): PaletteDefinition {
  if (definition.version !== "picture-score:palette:v1")
    throw new Error("unsupported palette version");
  if (!definition.id.trim()) throw new Error("palette id is required");
  if (!definition.displayName.trim()) throw new Error("palette displayName is required");
  if (!definition.author.name.trim()) throw new Error("palette author name is required");

  for (const role of PALETTE_ROLES) validateRole(role, definition.roles[role]);

  validateEnvironment(definition.environment.initial, "palette environment.initial");
  validateEnvironment(
    definition.environment.sectionResponse,
    "palette environment.sectionResponse",
  );

  let roleLimitSum = 0;
  for (const role of PALETTE_ROLES) {
    const limit = definition.limits.roles[role];
    if (!Number.isInteger(limit) || limit < 0)
      throw new Error(`palette role ${role} limit must be a non-negative integer`);
    roleLimitSum += limit;
  }
  if (!Number.isInteger(definition.limits.total) || definition.limits.total < 0)
    throw new Error("palette total limit must be a non-negative integer");
  if (definition.limits.total > roleLimitSum)
    throw new Error("palette total limit cannot exceed the sum of role limits");

  return definition;
}
