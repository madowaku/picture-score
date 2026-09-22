import { describe, expect, it } from "vitest";
import { shortRecordingDurationSeconds } from "./shortRecording";

describe("shortRecordingDurationSeconds", () => {
  it("keeps a short composition at its musical duration", () => {
    expect(shortRecordingDurationSeconds({ lengthBeats: 16, tempo: 120 })).toBe(8);
  });

  it("caps a slow composition at fifteen seconds", () => {
    expect(shortRecordingDurationSeconds({ lengthBeats: 24, tempo: 72 })).toBe(15);
  });

  it("never produces a sub-second recording", () => {
    expect(shortRecordingDurationSeconds({ lengthBeats: 1, tempo: 240 })).toBe(1);
  });
});
