// v0.10 Creator Palette Lab browser gate.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/art/') && response.status() >= 400) failedAssets.push(response.url());
  });

  await page.goto('http://127.0.0.1:5173/creator-palette-lab.html');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('[data-creator-role]').count() === 5, 'five role cards missing');
  assert(await page.locator('main').getAttribute('data-creator-lab-valid') === 'false', 'empty draft should be invalid');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'initial mobile overflow');

  await page.getByRole('button', { name: 'Use sample assets' }).click();
  await page.waitForTimeout(120);
  assert(await page.locator('main').getAttribute('data-creator-lab-valid') === 'true', 'sample draft did not compile');
  assert((await page.locator('main').getAttribute('data-creator-lab-preview'))?.startsWith('creator:'), 'creator preview not selected');

  const slider = page.getByRole('slider', { name: 'Creator Lab preview time' });
  const max = Number(await slider.getAttribute('max'));
  await slider.fill(String(max));
  await page.waitForTimeout(120);

  const creatorHtml = await page.locator('.score-bloom-layer').innerHTML();
  const creatorCount = await page.locator('[data-score-bloom-entity]').count();
  assert(creatorCount > 0, 'creator palette produced no entities');

  await page.getByRole('button', { name: 'Clearing' }).click();
  await page.waitForTimeout(100);
  const clearingHtml = await page.locator('.score-bloom-layer').innerHTML();
  assert(clearingHtml !== creatorHtml, 'Clearing and Creator worlds are identical');

  await page.getByRole('button', { name: 'My Palette' }).click();
  await page.waitForTimeout(100);
  const beforeReplay = await page.locator('.score-bloom-layer').innerHTML();
  await slider.fill('0');
  await page.waitForTimeout(60);
  await slider.fill(String(max));
  await page.waitForTimeout(100);
  const afterReplay = await page.locator('.score-bloom-layer').innerHTML();
  assert(beforeReplay === afterReplay, 'creator replay is not deterministic');

  // A-E fixtures should still express their neutral role profiles.
  const profiles = {
    'quiet-piano': counts => counts.rhythm === 0 && counts.ornament === 0 && counts.resonance === 0,
    'steady-beat': counts => counts.rhythm > (counts.melody + counts.harmony + counts.ornament + counts.resonance) * 2,
    'dense-electronic': counts => Object.values(counts).every(value => value > 0),
    'ambient-long-tail': counts => counts.resonance >= counts.melody && counts.resonance >= counts.harmony,
    'ornament-heavy': counts => counts.ornament >= counts.melody + counts.harmony + counts.rhythm + counts.resonance,
  };

  for (const id of Object.keys(profiles)) {
    await page.locator(`[data-creator-fixture-id="${id}"]`).click();
    await page.waitForTimeout(60);
    const fixtureSlider = page.getByRole('slider', { name: 'Creator Lab preview time' });
    await fixtureSlider.fill(await fixtureSlider.getAttribute('max'));
    await page.waitForTimeout(100);
    const counts = await page.evaluate(() => {
      const result = { melody: 0, harmony: 0, rhythm: 0, ornament: 0, resonance: 0 };
      for (const node of document.querySelectorAll('[data-score-bloom-entity]')) {
        const role = node.getAttribute('data-score-bloom-role');
        if (role in result) result[role] += 1;
      }
      return result;
    });
    assert(profiles[id](counts), `semantic profile drift for ${id}: ${JSON.stringify(counts)}`);
  }

  await page.getByRole('checkbox', { name: 'Creator Lab reduced motion' }).check();
  await page.waitForTimeout(80);
  const reducedMotions = await page.locator('[data-score-bloom-entity]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-score-bloom-motion')),
  );
  assert(reducedMotions.every(value => value === 'none'), 'reduced motion still animates creator entities');

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(80);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow at ${viewport.width}`);
  }

  // Smoke the real File -> object URL -> draft -> compiler path with a local SVG.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Clear' }).click();
  const labels = ['Melody', 'Harmony', 'Rhythm', 'Ornament', 'Resonance'];
  for (const label of labels) {
    await page.getByLabel(`Add image for ${label}`).setInputFiles('scripts/fixtures/creator-upload.svg');
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(140);
  assert(await page.locator('main').getAttribute('data-creator-lab-valid') === 'true', 'real file uploads did not compile');
  assert((await page.locator('main').getAttribute('data-creator-lab-preview'))?.startsWith('creator:'), 'uploaded creator palette not previewed');

  const uploadSlider = page.getByRole('slider', { name: 'Creator Lab preview time' });
  await uploadSlider.fill(await uploadSlider.getAttribute('max'));
  await page.waitForTimeout(100);
  assert(await page.locator('[data-score-bloom-entity]').count() > 0, 'uploaded palette produced no entities');

  await page.screenshot({ path: 'output/playwright/creator-palette-lab-mobile.jpg', type: 'jpeg', quality: 80, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'output/playwright/creator-palette-lab-desktop.jpg', type: 'jpeg', quality: 80, fullPage: true });

  assert(!errors.length && !failedAssets.length, JSON.stringify({ errors, failedAssets }));
  await page.goto('http://127.0.0.1:5173/');
  return { creatorCount, fileUpload: true, reducedMotion: true, errors, failedAssets };
}
