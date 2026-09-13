import {
  normalizeMusicalTimeline,
  type MusicalEvent,
  type MusicalTimeline,
} from "../../music/ir";
import { createSeededRandom, deriveSeed } from "./random";
import type {
  MappingContext,
  PositionHint,
  WorldEvent,
} from "./types";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const eventId = (sourceEventId: string, type: WorldEvent["type"]): string =>
  `world:${sourceEventId}:${type}`;

const worldSeed = (
  event: MusicalEvent,
  context: MappingContext,
  type: WorldEvent["type"],
): number => {
  const densityKey = Math.round(clamp01(context.worldDensity) * 1000);
  return deriveSeed(
    context.trackSeed,
    event.id,
    context.eventIndex,
    context.sectionIndex,
    densityKey,
    type,
  );
};

const positionFromSeed = (seed: number, y?: number): PositionHint => {
  const random = createSeededRandom(seed);
  return {
    x: random.range(0.05, 0.95),
    y: y === undefined ? random.range(0.05, 0.95) : clamp01(y),
  };
};

export function mapMusicalEvent(
  event: MusicalEvent,
  context: MappingContext,
): WorldEvent[] {
  switch (event.type) {
    case "melody": {
      const birthSeed = worldSeed(event, context, "birth");
      const growthSeed = worldSeed(event, context, "growth");
      const birthId = eventId(event.id, "birth");
      return [
        {
          id: birthId,
          type: "birth",
          role: "melody",
          time: event.time,
          sourceEventId: event.id,
          seed: birthSeed,
          intensity: event.strength,
          positionHint: positionFromSeed(birthSeed, event.normalizedPitch),
        },
        {
          id: eventId(event.id, "growth"),
          type: "growth",
          role: "melody",
          time: event.time,
          sourceEventId: event.id,
          seed: growthSeed,
          amount: clamp01(event.strength * Math.min(1, event.duration)),
          targetHint: birthId,
        },
      ];
    }

    case "harmony": {
      const seed = worldSeed(event, context, "bloom");
      return [
        {
          id: eventId(event.id, "bloom"),
          type: "bloom",
          role: "harmony",
          time: event.time,
          sourceEventId: event.id,
          seed,
          openness: clamp01(event.changeAmount * 0.7 + event.strength * 0.3),
          tension: event.tension,
          positionHint: positionFromSeed(seed),
        },
      ];
    }

    case "rhythm": {
      const seed = worldSeed(event, context, "pulse");
      return [
        {
          id: eventId(event.id, "pulse"),
          type: "pulse",
          role: "rhythm",
          time: event.time,
          sourceEventId: event.id,
          seed,
          intensity: event.strength,
          positionHint: positionFromSeed(seed),
        },
      ];
    }

    case "ornament": {
      const seed = worldSeed(event, context, "spark");
      return [
        {
          id: eventId(event.id, "spark"),
          type: "spark",
          role: "ornament",
          time: event.time,
          sourceEventId: event.id,
          seed,
          intensity: clamp01(event.strength * 0.7 + event.complexity * 0.3),
          height: event.brightness,
          positionHint: positionFromSeed(seed, event.brightness),
        },
      ];
    }

    case "resonance": {
      const seed = worldSeed(event, context, "sway");
      const random = createSeededRandom(seed);
      return [
        {
          id: eventId(event.id, "sway"),
          type: "sway",
          role: "resonance",
          time: event.time,
          sourceEventId: event.id,
          seed,
          intensity: clamp01(event.strength * 0.6 + event.depth * 0.4),
          duration: event.duration,
          direction: random.range(-1, 1),
        },
      ];
    }

    case "section": {
      const seed = worldSeed(event, context, "atmosphere");
      return [
        {
          id: eventId(event.id, "atmosphere"),
          type: "atmosphere",
          role: "section",
          time: event.time,
          sourceEventId: event.id,
          seed,
          sectionIndex: event.index,
          confidence: event.confidence,
          energyDelta: event.energyDelta,
        },
      ];
    }
  }
}

const densityAt = (timeline: MusicalTimeline, time: number): number => {
  let density = 0;
  for (const frame of timeline.frames) {
    if (frame.time > time) break;
    density = frame.density;
  }
  return density;
};

export function mapMusicalTimeline(
  timeline: MusicalTimeline,
  trackSeed: string | number,
): WorldEvent[] {
  const normalized = normalizeMusicalTimeline(timeline);
  const mapped: WorldEvent[] = [];
  let sectionIndex = 0;

  normalized.events.forEach((event, eventIndex) => {
    if (event.type === "section") sectionIndex = event.index;
    mapped.push(
      ...mapMusicalEvent(event, {
        trackSeed,
        eventIndex,
        sectionIndex,
        worldDensity: densityAt(normalized, event.time),
      }),
    );
  });

  const ids = new Set<string>();
  for (const event of mapped) {
    if (ids.has(event.id)) throw new Error(`duplicate WorldEvent id: ${event.id}`);
    ids.add(event.id);
  }

  return mapped;
}
