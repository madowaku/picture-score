import { describe, expect, it } from "vitest";
import type { PlayNote, ScoreNote } from "./types";
import { createHarmonySupport, planHarmony, type HarmonyId } from "./harmony";

function play(
  pitch: number,
  beat: number,
  duration = 1,
  id = `${pitch}-${beat}`,
): PlayNote {
  return {
    id,
    pitch,
    beat,
    duration,
    velocity: 0.55,
    sourceIds: [id],
    anchorId: id,
    articulation: "melody",
  };
}

function visual(pitch: number, beat: number, index: number): ScoreNote {
  return {
    id: `visual-${index}`,
    sourceIndex: index,
    pitch,
    beat,
    duration: 0.3,
    velocity: 0.5,
    sourceStroke: "fixture",
    sourcePosition: { x: beat * 62.5, y: 210 },
    visualPosition: { x: beat * 62.5, y: 210 },
  };
}

const fixedVoicing: Record<HarmonyId, number[]> = {
  C6: [48, 55, 64],
  Am7: [45, 52, 60],
  Fadd9: [41, 48, 57],
  Gsus2: [43, 50, 57],
  Dm7: [50, 57, 60],
};

function motion(sequence: number[][]) {
  let total = 0;
  for (let index = 1; index < sequence.length; index++)
    total += sequence[index].reduce(
      (sum, pitch, voice) => sum + Math.abs(pitch - sequence[index - 1][voice]),
      0,
    );
  return total;
}

describe("HARMONY LAB", () => {
  it("is deterministic and never edits the drawing voice", () => {
    const drawing = [
      visual(60, 0, 0), visual(64, 1, 1), visual(67, 2, 2),
      visual(69, 4, 3), visual(64, 5, 4), visual(60, 6, 5),
    ];
    const played = [play(60, 0, 1.5), play(64, 1.5, 1.5), play(69, 4, 2)];
    const beforeDrawing = structuredClone(drawing);
    const beforePlayed = structuredClone(played);

    expect(planHarmony(drawing, played, 0.7)).toEqual(planHarmony(drawing, played, 0.7));
    expect(createHarmonySupport(drawing, played, 0.7)).toEqual(
      createHarmonySupport(drawing, played, 0.7),
    );
    expect(drawing).toEqual(beforeDrawing);
    expect(played).toEqual(beforePlayed);
  });

  it("stays silent when harmony is disabled by zero magnet or there is no drawing voice", () => {
    const played = [play(60, 0, 2)];
    expect(createHarmonySupport([], played, 0)).toEqual([]);
    expect(createHarmonySupport([], [], 1)).toEqual([]);
  });

  it("voice-leads a multi-bar progression more gently than fixed legacy positions", () => {
    const played = [
      play(60, 0, 1), play(64, 1, 1), play(67, 2, 1),
      play(57, 4, 1), play(60, 5, 1), play(64, 6, 1),
      play(65, 8, 1), play(69, 9, 1), play(60, 10, 1),
      play(60, 12, 1), play(64, 13, 1), play(67, 14, 1),
    ];
    const plan = planHarmony([], played, 1);
    expect(plan).toHaveLength(4);
    const led = motion(plan.map((step) => step.voicing));
    const fixed = motion(plan.map((step) => fixedVoicing[step.chord]));
    expect(led).toBeLessThan(fixed);
    for (let index = 1; index < plan.length; index++)
      expect(Math.abs(plan[index].voicing[0] - plan[index - 1].voicing[0])).toBeLessThanOrEqual(7);
  });

  it("thins and quiets support when the picture is busy", () => {
    const sparsePlayed = [play(60, 0, 2), play(64, 2, 1)];
    const densePlayed = Array.from({ length: 12 }, (_, index) =>
      play([60, 62, 64, 67, 69][index % 5], index * 0.3, 0.65, `dense-${index}`),
    );
    const denseDrawing = Array.from({ length: 30 }, (_, index) =>
      visual([60, 62, 64, 67, 69][index % 5], (index / 30) * 3.9, index),
    );

    const sparsePlan = planHarmony([], sparsePlayed, 1);
    const densePlan = planHarmony(denseDrawing, densePlayed, 1);
    const sparseSupport = createHarmonySupport([], sparsePlayed, 1);
    const denseSupport = createHarmonySupport(denseDrawing, densePlayed, 1);

    expect(sparsePlan[0].voiceCount).toBe(3);
    expect(densePlan[0].voiceCount).toBe(2);
    expect(densePlan[0].density).toBeGreaterThan(sparsePlan[0].density);
    expect(Math.max(...denseSupport.map((note) => note.velocity))).toBeLessThan(
      Math.max(...sparseSupport.map((note) => note.velocity)),
    );
  });

  it("prefers a C-family landing when the final bar agrees", () => {
    const played = [
      play(69, 8, 1), play(64, 9, 1),
      play(60, 12, 1.5), play(64, 13.5, 1), play(67, 14.5, 1),
    ];
    const plan = planHarmony([], played, 1);
    expect(plan.at(-1)?.chord).toBe("C6");
  });

  it("does not force the tonic when the final bar clearly disagrees", () => {
    const played = [
      play(60, 0, 1), play(67, 1, 1),
      play(66, 12, 1.2), play(71, 13.4, 1.2),
    ];
    const plan = planHarmony([], played, 1);
    expect(plan.at(-1)?.chord).not.toBe("C6");
  });

  it("keeps support safely below the drawing voice", () => {
    const drawing = [visual(60, 0, 0), visual(64, 2, 1)];
    const played = [play(60, 0, 2), play(64, 2, 2)];
    const support = createHarmonySupport(drawing, played, 1);
    expect(support.length).toBeGreaterThan(0);
    expect(Math.max(...support.map((note) => note.velocity))).toBeLessThan(0.2);
    expect(Math.max(...support.map((note) => note.velocity))).toBeLessThan(
      Math.min(...played.map((note) => note.velocity)),
    );
  });
});
