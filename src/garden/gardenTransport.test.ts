import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyGarden } from "./gardenState";
import { GardenTransport } from "./gardenTransport";

class FakeAudioParam {
  value = 0;
  setTargetAtTime() {}
  cancelScheduledValues() {}
}

class FakeNode {
  connect<T>(target: T): T { return target; }
  disconnect() {}
}

class FakeGainNode extends FakeNode {
  gain = new FakeAudioParam();
}

class FakeCompressorNode extends FakeNode {
  threshold = new FakeAudioParam();
  knee = new FakeAudioParam();
  ratio = new FakeAudioParam();
  attack = new FakeAudioParam();
  release = new FakeAudioParam();
}

class FakeAudioContext {
  currentTime = 10;
  state: AudioContextState = "suspended";
  destination = new FakeNode() as unknown as AudioDestinationNode;

  createGain(): GainNode {
    return new FakeGainNode() as unknown as GainNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return new FakeCompressorNode() as unknown as DynamicsCompressorNode;
  }

  async resume(): Promise<void> {
    this.state = "running";
  }

  async suspend(): Promise<void> {
    this.state = "suspended";
  }
}

async function startedTransport() {
  const context = new FakeAudioContext();
  const transport = new GardenTransport(() => context as unknown as AudioContext);
  const state = emptyGarden();
  await transport.start(state);
  return { context, transport, state };
}

describe("GardenTransport clock controls", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("exposes transport time in seconds from the existing beat clock", async () => {
    const { context, transport } = await startedTransport();
    context.currentTime = 12.06;

    expect(transport.time).toBeCloseTo(2, 6);
    expect(transport.beat).toBeCloseTo(2 * 104 / 60, 6);

    transport.stop();
  });

  it("pause freezes time without stopping the transport and resume continues from it", async () => {
    const { context, transport } = await startedTransport();
    context.currentTime = 12.06;
    const before = transport.time;

    await transport.pause();
    expect(transport.running).toBe(true);
    expect(transport.paused).toBe(true);
    expect(context.state).toBe("suspended");
    expect(transport.time).toBeCloseTo(before, 6);

    // The transport owns the paused beat even if a test/browser clock changes.
    context.currentTime = 99;
    expect(transport.time).toBeCloseTo(before, 6);

    await transport.resume();
    expect(transport.paused).toBe(false);
    expect(context.state).toBe("running");
    expect(transport.time).toBeCloseTo(before, 6);

    context.currentTime += 1;
    expect(transport.time).toBeCloseTo(before + 1, 6);

    transport.stop();
  });

  it("seek reanchors the same transport deterministically and clamps negative targets", async () => {
    const { context, transport } = await startedTransport();
    const heard = vi.fn();
    transport.onHeard = heard;
    context.currentTime = 12.06;

    transport.seek(5);
    expect(transport.time).toBeCloseTo(5, 6);
    expect(transport.beat).toBeCloseTo(5 * 104 / 60, 6);
    expect(heard.mock.calls.every(([slice]) => slice === null)).toBe(true);

    transport.seek(-4);
    expect(transport.time).toBeCloseTo(0, 6);
    expect(transport.beat).toBeCloseTo(0, 6);
    expect(() => transport.seek(Number.NaN)).toThrow(/seek time must be finite/);

    transport.stop();
  });

  it("seek while paused changes phase but remains paused until resume", async () => {
    const { context, transport } = await startedTransport();
    context.currentTime = 11.06;
    await transport.pause();

    transport.seek(7.5);
    expect(transport.paused).toBe(true);
    expect(transport.time).toBeCloseTo(7.5, 6);

    context.currentTime = 50;
    expect(transport.time).toBeCloseTo(7.5, 6);

    await transport.resume();
    expect(transport.time).toBeCloseTo(7.5, 6);
    context.currentTime += 0.5;
    expect(transport.time).toBeCloseTo(8, 6);

    transport.stop();
  });

  it("updating Garden placement does not restart or shift the transport clock", async () => {
    const { context, transport, state } = await startedTransport();
    context.currentTime = 13.06;
    const before = transport.time;

    transport.update({ ...state, listener: { x: 0.2, y: 0.3 } });
    expect(transport.time).toBeCloseTo(before, 6);

    context.currentTime += 1;
    expect(transport.time).toBeCloseTo(before + 1, 6);

    transport.stop();
  });

  it("stop clears paused state and resets the public clock", async () => {
    const { context, transport } = await startedTransport();
    context.currentTime = 12.06;
    await transport.pause();

    transport.stop();
    expect(transport.running).toBe(false);
    expect(transport.paused).toBe(false);
    expect(transport.time).toBe(0);
  });
});
