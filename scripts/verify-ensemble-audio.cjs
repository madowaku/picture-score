// Real Web Audio / OfflineAudioContext checks, in the isolated 'ensemble' browser.
async (page) => {
  const result = await page.evaluate(async () => {
    const { emptyProject } = await import("/src/music/project.ts");
    const { exampleStrokes } = await import("/src/music/examples.ts");
    const { emptyGarden, makeObject } = await import("/src/garden/gardenState.ts");
    const { buildEnsemblePlan, independentNotes } = await import("/src/garden/ensemble.ts");
    const { mixGarden } = await import("/src/garden/gardenMixer.ts");
    const { GardenTransport } = await import("/src/garden/gardenTransport.ts");
    const { voice, outputBus } = await import("/src/music/audio.ts");
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const wave = { ...emptyProject(), strokes: exampleStrokes("wave") };
    const line = (points) => ({ ...emptyProject(), strokes: [{ id: "stroke", points:
      points.map(([x, y], i) => ({ x, y, time: i * 40, pressure: .5 })) }] });
    const a = makeObject(wave, { x: .25, y: .5 }, "a");
    const b = makeObject(wave, { x: .8, y: .5 }, "b");
    const state = { ...emptyGarden(), bpm: 120, listener: { x: .5, y: .5 }, objects: [a, b] };
    const near = { ...state, objects: [a, { ...b, world: { ...b.world, x: .3 } }] };
    const rms = (samples, from, to, rate) => {
      let sum = 0;
      for (let i = Math.floor(from * rate); i < Math.floor(to * rate); i++) sum += samples[i] * samples[i];
      return Math.sqrt(sum / ((to - from) * rate));
    };
    async function duet(garden) {
      // Separate diagnostic channels isolate the two artworks. Gains are identical near/far.
      const ctx = new OfflineAudioContext(2, 44100 * 9, 44100), merger = ctx.createChannelMerger(2);
      merger.connect(outputBus(ctx));
      const plan = buildEnsemblePlan(garden, new Map([["a", .3], ["b", .3]]), 0);
      for (let i = 0; i < garden.objects.length; i++) {
        const object = garden.objects[i], lane = plan.objectPlans.get(object.id);
        for (const [notes, weight] of [[independentNotes(object), 1 - lane.strength], [lane.notes, lane.strength * lane.roleWeight]]) {
          if (weight < .001) continue;
          const bus = ctx.createGain(); bus.gain.value = .3 * weight; bus.connect(merger, 0, i);
          for (const note of notes) voice(ctx, bus, note.pitch, .05 + note.beat * .5, note.duration * .5, note.velocity, object.project.instrument);
        }
      }
      const buffer = await ctx.startRendering();
      return Array.from({ length: 2 }, (_, i) => ({
        first: rms(buffer.getChannelData(i), .3, 3.4, 44100),
        second: rms(buffer.getChannelData(i), 4.6, 7.8, 44100),
      }));
    }
    const farAudio = await duet(state), nearAudio = await duet(near);
    assert(farAudio.every((lane) => lane.first > .001), "independent melodies are silent");
    assert(nearAudio[0].first > .001 && nearAudio[1].first < .00001, "first duet answer overlaps");
    assert(nearAudio[1].second > .001 && nearAudio[0].second < .0001, "second duet answer overlaps");

    const drone = makeObject(line([[20, 210], [950, 210]]), { x: .8, y: .5 }, "drone");
    const engine = new GardenTransport();
    const initial = { ...state, objects: [a, drone] };
    const notes = [], commands = [];
    const emit = engine.emit.bind(engine);
    engine.emit = (lane, events, layer, at, seconds) => {
      if (layer === "ensemble" && lane.object.id === "drone") notes.push(...events.map((n) => ({ ...n, at })));
      emit(lane, events, layer, at, seconds);
    };
    try {
      await engine.start(initial);
      await new Promise((resolve) => setTimeout(resolve, 800));
      const clock = engine.startTime, context = engine.ctx, previous = engine.plan;
      const bus = engine.lanes.get("drone").ensemble;
      const target = bus.gain.setTargetAtTime.bind(bus.gain);
      bus.gain.setTargetAtTime = (value, at, tau) => { commands.push({ value, at, tau }); return target(value, at, tau); };
      const movedAt = engine.ctx.currentTime;
      engine.update({ ...initial, objects: [a, { ...drone, world: { ...drone.world, x: .3 } }] });
      assert(engine.plan === previous, "arrangement changed between beats");
      await new Promise((resolve) => setTimeout(resolve, 900));
      assert(engine.plan.objectPlans.get("drone").kind === "support", "drone did not join");
      assert(notes.some((n) => n.at - movedAt < .65 && n.duration > 10), "mid-phrase drone waited for a whole loop");
      assert(engine.startTime === clock && engine.ctx === context, "support restarted transport");
      assert(commands.length && commands.every((c) => c.tau === .16 && c.value >= 0 && c.value <= 1), "crossfade is not smooth/bounded");
      engine.update(initial);
      await new Promise((resolve) => setTimeout(resolve, 900));
      assert(engine.plan.objectPlans.get("drone").strength === 0, "support relation stayed after separating");
      engine.stop();
      const pending = engine.start(initial); engine.stop(); await pending;
      assert(!engine.running && engine.lanes.size === 0, "start cancellation leaked voices");
    } finally { engine.stop(); await engine.ctx.close(); }

    const inputs = [wave, line([[500, 20], [500, 390]]), line([[20, 210], [950, 210]]),
      line([[20, 100], [150, 320], [280, 80], [410, 340], [540, 80], [670, 330], [800, 80], [950, 300]]), line([[500, 200]])];
    const objects = Array.from({ length: 12 }, (_, i) => makeObject(inputs[i % inputs.length], { x: .49 + i * .001, y: .5 }, String(i)));
    const dense = { ...state, objects }, peaks = [];
    for (const phrase of [0, 1, 2]) {
      const ctx = new OfflineAudioContext(1, 44100 * 9, 44100), master = outputBus(ctx);
      const mix = mixGarden(dense, phrase), plan = buildEnsemblePlan(dense, mix, phrase);
      for (const object of objects) {
        const lane = plan.objectPlans.get(object.id);
        for (const [notes, weight] of [[independentNotes(object), 1 - lane.strength], [lane.notes, lane.strength * lane.roleWeight]]) {
          if (weight * mix.get(object.id) < .0001) continue;
          const bus = ctx.createGain(); bus.gain.value = mix.get(object.id) * weight; bus.connect(master);
          for (const note of notes) voice(ctx, bus, note.pitch, .05 + note.beat * .5,
            object.musicalRole === "rhythm" ? Math.min(.2, note.duration * .5) : note.duration * .5,
            note.velocity, object.musicalRole === "decoration" ? "Pluck" : object.project.instrument);
        }
      }
      const buffer = await ctx.startRendering(), samples = buffer.getChannelData(0);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
      peaks.push({ peak, rms: rms(samples, 0, 8, 44100) });
    }
    assert(peaks.every((p) => p.peak < .98 && p.rms > .001), "dense cluster is clipping or silent");
    return { farAudio, nearAudio, midPhraseDroneEvents: notes.length, crossfadeCommands: commands.length, dense: peaks };
  });
  return result;
}
