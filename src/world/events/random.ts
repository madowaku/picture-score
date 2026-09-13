export interface RandomSource {
  next(): number;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

const fnv1a32 = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const deriveSeed = (...parts: readonly (string | number)[]): number =>
  fnv1a32(parts.map(String).join("\u001f"));

export const createSeededRandom = (seed: number): RandomSource => {
  let state = (seed >>> 0) || 0x6d2b79f5;

  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };

  return {
    next,
    range(min, max) {
      if (!Number.isFinite(min) || !Number.isFinite(max) || max < min)
        throw new Error("random range is invalid");
      return min + (max - min) * next();
    },
    pick<T>(items: readonly T[]): T {
      if (!items.length) throw new Error("cannot pick from an empty list");
      return items[Math.min(items.length - 1, Math.floor(next() * items.length))];
    },
  };
};
