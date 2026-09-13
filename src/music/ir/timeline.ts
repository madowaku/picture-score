import type {
  MusicalEvent,
  MusicalEventType,
  MusicalFrame,
  MusicalTimeline,
} from "./types";

const EVENT_ORDER: Record<MusicalEventType, number> = {
  section: 0,
  rhythm: 1,
  harmony: 2,
  melody: 3,
  ornament: 4,
  resonance: 5,
};

const FRAME_UNIT_FIELDS = [
  "energy",
  "brightness",
  "density",
  "beatStrength",
  "melodyActivity",
  "ornamentActivity",
  "sustainLevel",
  "lowEnergy",
  "midEnergy",
  "highEnergy",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const finite = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be a finite number`);
  return value;
};

const nonNegative = (value: unknown, label: string): number => {
  const n = finite(value, label);
  if (n < 0) throw new Error(`${label} must be >= 0`);
  return n;
};

export const normalizeUnitInterval = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error("normalized value must be finite");
  return Math.min(1, Math.max(0, value));
};

const eventTime = (value: unknown, duration: number): number => {
  const n = finite(value, "event.time");
  if (n < 0 || n > duration)
    throw new Error("event.time must be inside timeline duration");
  return n;
};

const parseFrame = (value: unknown, duration: number): MusicalFrame => {
  if (!isRecord(value)) throw new Error("frame must be an object");
  const time = finite(value.time, "frame.time");
  if (time < 0 || time > duration)
    throw new Error("frame.time must be inside timeline duration");

  const frame = { time } as MusicalFrame;
  for (const field of FRAME_UNIT_FIELDS) {
    const n = finite(value[field], `frame.${field}`);
    frame[field] = normalizeUnitInterval(n);
  }
  return frame;
};

const baseEvent = (
  value: Record<string, unknown>,
  duration: number,
): { id: string; time: number; strength: number } => {
  if (typeof value.id !== "string" || !value.id.length)
    throw new Error("event.id must be a non-empty string");
  return {
    id: value.id,
    time: eventTime(value.time, duration),
    strength: normalizeUnitInterval(finite(value.strength, "event.strength")),
  };
};

const parseEvent = (value: unknown, duration: number): MusicalEvent => {
  if (!isRecord(value)) throw new Error("event must be an object");
  if (typeof value.type !== "string" || !(value.type in EVENT_ORDER))
    throw new Error("event.type is unsupported");

  const base = baseEvent(value, duration);
  switch (value.type) {
    case "rhythm": {
      const subdivision = value.subdivision;
      if (
        subdivision !== undefined &&
        ![1, 2, 4, 8, 16].includes(subdivision as number)
      )
        throw new Error("rhythm.subdivision is unsupported");
      return { ...base, type: "rhythm", subdivision: subdivision as 1 | 2 | 4 | 8 | 16 | undefined };
    }
    case "melody": {
      const direction = value.direction;
      if (
        direction !== undefined &&
        direction !== "up" &&
        direction !== "down" &&
        direction !== "flat"
      )
        throw new Error("melody.direction is unsupported");
      return {
        ...base,
        type: "melody",
        pitch: finite(value.pitch, "melody.pitch"),
        normalizedPitch: normalizeUnitInterval(
          finite(value.normalizedPitch, "melody.normalizedPitch"),
        ),
        duration: nonNegative(value.duration, "melody.duration"),
        direction,
      };
    }
    case "harmony": {
      const root = value.root;
      if (root !== undefined && (!Number.isInteger(root) || root < 0 || root > 11))
        throw new Error("harmony.root must be an integer from 0 to 11");
      if (value.quality !== undefined && typeof value.quality !== "string")
        throw new Error("harmony.quality must be a string");
      return {
        ...base,
        type: "harmony",
        tension: normalizeUnitInterval(finite(value.tension, "harmony.tension")),
        changeAmount: normalizeUnitInterval(
          finite(value.changeAmount, "harmony.changeAmount"),
        ),
        root: root as number | undefined,
        quality: value.quality as string | undefined,
      };
    }
    case "ornament":
      return {
        ...base,
        type: "ornament",
        brightness: normalizeUnitInterval(
          finite(value.brightness, "ornament.brightness"),
        ),
        complexity: normalizeUnitInterval(
          finite(value.complexity, "ornament.complexity"),
        ),
      };
    case "resonance":
      return {
        ...base,
        type: "resonance",
        duration: nonNegative(value.duration, "resonance.duration"),
        depth: normalizeUnitInterval(finite(value.depth, "resonance.depth")),
      };
    case "section": {
      const index = finite(value.index, "section.index");
      if (!Number.isInteger(index) || index < 0)
        throw new Error("section.index must be a non-negative integer");
      return {
        ...base,
        type: "section",
        index,
        confidence: normalizeUnitInterval(
          finite(value.confidence, "section.confidence"),
        ),
        energyDelta: Math.max(-1, Math.min(1, finite(value.energyDelta, "section.energyDelta"))),
      };
    }
  }
};

const compareEvents = (a: MusicalEvent, b: MusicalEvent): number =>
  a.time - b.time || EVENT_ORDER[a.type] - EVENT_ORDER[b.type] || a.id.localeCompare(b.id);

export function parseMusicalTimeline(value: unknown): MusicalTimeline {
  if (!isRecord(value)) throw new Error("MusicalTimeline must be an object");
  if (value.version !== "picture-score:musical-ir:v1")
    throw new Error("unsupported MusicalTimeline version");

  const duration = nonNegative(value.duration, "timeline.duration");
  const bpm = value.bpm;
  if (bpm !== undefined && (typeof bpm !== "number" || !Number.isFinite(bpm) || bpm <= 0))
    throw new Error("timeline.bpm must be a positive finite number");
  if (!Array.isArray(value.frames) || !Array.isArray(value.events))
    throw new Error("timeline frames/events must be arrays");
  if (!isRecord(value.metadata) || typeof value.metadata.analysisVersion !== "string" || !value.metadata.analysisVersion.length)
    throw new Error("timeline.metadata.analysisVersion is required");

  const frames = value.frames.map((frame) => parseFrame(frame, duration)).sort((a, b) => a.time - b.time);
  for (let i = 1; i < frames.length; i++)
    if (frames[i - 1].time === frames[i].time)
      throw new Error("frame times must be unique");

  const events = value.events.map((event) => parseEvent(event, duration)).sort(compareEvents);
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id)) throw new Error("event ids must be unique");
    ids.add(event.id);
  }

  return {
    version: "picture-score:musical-ir:v1",
    duration,
    ...(bpm === undefined ? {} : { bpm }),
    frames,
    events,
    metadata: { analysisVersion: value.metadata.analysisVersion },
  };
}

export const normalizeMusicalTimeline = parseMusicalTimeline;

export const serializeMusicalTimeline = (timeline: MusicalTimeline): string =>
  JSON.stringify(normalizeMusicalTimeline(timeline));
