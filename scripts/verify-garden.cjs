// npx @playwright/cli -s=garden run-code --filename scripts/verify-garden.cjs
async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  // Use the dedicated 'garden' QA browser, never a user's browsing session.
  await page.evaluate(() => localStorage.removeItem('picture-score:garden:v1'));
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  const nav = page.getByRole('navigation', { name: '制作スペース' });
  await nav.getByRole('button', { name: 'DRAW', exact: true }).click();
  await page.getByRole('button', { name: 'Wave', exact: true }).click();
  await page.getByRole('button', { name: 'PLACE IN GARDEN', exact: true }).click();
  const field = page.getByTestId('garden-field');
  await field.click({ position: { x: 280, y: 180 } });
  await page.waitForFunction(() => document.querySelectorAll('.garden-artwork[data-object]').length === 1);
  assert(await page.getByRole('button', { name: '音を休める', exact: true }).isVisible(), 'placement did not start transport');
  await nav.getByRole('button', { name: 'DRAW', exact: true }).click();
  assert(await page.locator('[data-stroke]').count() > 0, 'DRAW lost its source');
  await page.getByRole('button', { name: 'Cat', exact: true }).click();
  await page.getByRole('button', { name: 'PLACE IN GARDEN', exact: true }).click();
  await field.click({ position: { x: 750, y: 270 } });
  await page.waitForFunction(() => document.querySelectorAll('.garden-artwork[data-object]').length === 2);
  await page.getByRole('button', { name: '音を休める', exact: true }).click();
  await field.click({ position: { x: 280, y: 180 } });
  const object = page.locator('.garden-artwork[data-object]').first();
  await object.focus(); await object.press('ArrowRight');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('picture-score:garden:v1') || '{}').objects?.length === 2);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('picture-score:garden:v1')));
  assert(stored.objects.every((o) => o.strokeIR.length && o.scoreIR.length && o.musicIR.playNotes.length), 'IR missing');
  await page.screenshot({ path: 'output/playwright/garden-desktop.png', fullPage: true });
  await page.reload();
  await nav.getByRole('button', { name: 'GARDEN', exact: true }).click();
  assert(await page.locator('.garden-artwork[data-object]').count() === 2, 'garden not restored');

  // Real audio graphs: one clock, smooth gains, bounded cluster rendering, cancellation.
  const audio = await page.evaluate(async () => {
    const { GardenTransport } = await import('/src/garden/gardenTransport.ts');
    const { emptyGarden, makeObject } = await import('/src/garden/gardenState.ts');
    const { emptyProject } = await import('/src/music/project.ts');
    const { mixGarden } = await import('/src/garden/gardenMixer.ts');
    const { voice, outputBus } = await import('/src/music/audio.ts');
    const horizontal = { ...emptyProject(), strokes: [{ id: 's', points: [
      { x: 50, y: 210, pressure: .5, time: 0 }, { x: 950, y: 210, pressure: .5, time: 200 },
    ] }] };
    const vertical = { ...horizontal, strokes: [{ id: 'v', points: [
      { x: 500, y: 40, pressure: .5, time: 0 }, { x: 500, y: 380, pressure: .5, time: 200 },
    ] }] };
    const roles = ['melody', 'harmony', 'drone', 'rhythm', 'decoration', 'melody'];
    const objects = Array.from({ length: 12 }, (_, i) => ({ ...makeObject(i % 2 ? vertical : horizontal, { x: .3, y: .3 }, 'audio-' + i), musicalRole: roles[i % 6] }));
    const state = { ...emptyGarden(), listener: { x: .3, y: .3 }, objects };
    const engine = new GardenTransport();
    await engine.start(state);
    const phases = [...engine.lanes.values()].map((l) => l.phase);
    const clock = engine.beat;
    const ramps = [];
    for (const lane of engine.lanes.values()) {
      const original = lane.gain.gain.setTargetAtTime.bind(lane.gain.gain);
      lane.gain.gain.setTargetAtTime = (value, at, timeConstant) => { ramps.push({ value, timeConstant }); return original(value, at, timeConstant); };
    }
    engine.update({ ...state, listener: { x: .95, y: .95 } });
    const smoothFade = ramps.length === 12 && ramps.every((r) => r.value === 0 && r.timeConstant === .12);
    const sameClock = engine.beat >= clock && engine.running;
    engine.stop();
    const cleared = !engine.running && engine.lanes.size === 0;
    const pending = engine.start(state); engine.stop(); await pending;
    const cancelled = !engine.running;
    const ctx = new OfflineAudioContext(1, 44100 * 3, 44100);
    const bus = outputBus(ctx), mix = mixGarden(state);
    for (const object of objects) {
      const gain = ctx.createGain(); gain.gain.value = mix.get(object.id); gain.connect(bus);
      for (const note of object.musicIR.playNotes) voice(ctx, gain, note.pitch, .05, 1.8, note.velocity, object.project.instrument);
    }
    const buffer = await ctx.startRendering();
    let peak = 0, energy = 0;
    for (const sample of buffer.getChannelData(0)) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
    await engine.ctx.close();
    return { sharedPhase: new Set(phases).size === 1, sameClock, smoothFade, cleared, cancelled,
      peak, rms: Math.sqrt(energy / buffer.length), active: [...mix.values()].filter((n) => n > 0).length };
  });
  assert(audio.sharedPhase && audio.sameClock && audio.smoothFade && audio.cleared && audio.cancelled, 'transport clock or stop contract failed');
  assert(audio.peak < .98 && audio.rms > .001 && audio.active === 6, 'cluster silent or clipping');

  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await field.scrollIntoViewIfNeeded();
  const rect = await field.boundingBox();
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const p = (x, y) => ({ x: rect.x + rect.width * x, y: rect.y + rect.height * y, id: 1 });
  await touch('touchStart', [p(.7, .7)]); await touch('touchMove', [p(.9, .85)]); await touch('touchEnd', []);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('picture-score:garden:v1')).listener.x > .85);
  const bounds = await page.locator('.garden-artwork[data-object]').first().boundingBox();
  await touch('touchStart', [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }]);
  await touch('touchMove', [p(.4, .4)]); await touch('touchEnd', []);
  await page.screenshot({ path: 'output/playwright/garden-mobile.png', fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile horizontal overflow');
  await nav.getByRole('button', { name: 'DRAW', exact: true }).click();
  assert(await page.getByTestId('score-canvas').isVisible(), 'return to DRAW failed');
  await page.getByRole('button', { name: 'PLACE IN GARDEN', exact: true }).click();
  await field.scrollIntoViewIfNeeded();
  const r2 = await field.boundingBox();
  await touch('touchStart', [{ x: r2.x + r2.width * .65, y: r2.y + r2.height * .6, id: 1 }]);
  await touch('touchEnd', []);
  assert(await page.locator('.garden-artwork[data-object]').count() === 3, 'mobile placement failed');
  await page.getByRole('button', { name: '音を休める', exact: true }).click();
  return { audio, desktopObjects: stored.objects.length, mobileObjects: 3, mobile: '390x844' };
}
