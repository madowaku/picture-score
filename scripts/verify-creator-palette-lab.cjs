// v0.10 Creator Palette Lab + persistence browser gate.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const errors = [], failedAssets = [];
  let phase = 'boot';
  const mark = next => { phase = next; console.log(`[creator-palette-lab] ${next}`); };
  const mainAttr = name => page.evaluate(name => document.querySelector('main')?.getAttribute(name) ?? null, name);
  const assertHealthy = () => assert(!errors.length, `[${phase}] page error: ${errors.join(' | ')}`);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/art/') && response.status() >= 400) failedAssets.push(response.url());
  });

  mark('open lab');
  await page.goto('http://127.0.0.1:5173/creator-palette-lab.html');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('[data-creator-role]').count() === 5, `[${phase}] five role cards missing`);
  assert(await mainAttr('data-creator-lab-valid') === 'false', `[${phase}] empty draft should be invalid`);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `[${phase}] initial mobile overflow`);
  assertHealthy();

  mark('sample palette');
  await page.getByRole('button', { name: 'Use sample assets', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-creator-lab-valid') === 'true');
  assert((await mainAttr('data-creator-lab-preview'))?.startsWith('creator:'), `[${phase}] creator preview not selected`);
  assertHealthy();

  const slider = page.getByRole('slider', { name: 'Creator Lab preview time' });
  const max = Number(await slider.getAttribute('max'));
  await slider.fill(String(max));
  await page.waitForTimeout(120);

  const creatorHtml = await page.locator('.score-bloom-layer').innerHTML();
  const creatorCount = await page.locator('[data-score-bloom-entity]').count();
  assert(creatorCount > 0, `[${phase}] creator palette produced no entities`);

  await page.getByRole('button', { name: 'Clearing', exact: true }).click();
  await page.waitForTimeout(100);
  const clearingHtml = await page.locator('.score-bloom-layer').innerHTML();
  assert(clearingHtml !== creatorHtml, `[${phase}] Clearing and Creator worlds are identical`);

  await page.getByRole('button', { name: 'My Palette', exact: true }).click();
  await page.waitForTimeout(100);
  const beforeReplay = await page.locator('.score-bloom-layer').innerHTML();
  await slider.fill('0');
  await page.waitForTimeout(60);
  await slider.fill(String(max));
  await page.waitForTimeout(100);
  const afterReplay = await page.locator('.score-bloom-layer').innerHTML();
  assert(beforeReplay === afterReplay, `[${phase}] creator replay is not deterministic`);

  mark('semantic fixtures');
  const profiles = {
    'quiet-piano': counts => counts.rhythm === 0 && counts.ornament === 0 && counts.resonance === 0,
    'steady-beat': counts => counts.rhythm > (counts.melody + counts.harmony + counts.ornament + counts.resonance) * 2,
    'dense-electronic': counts => Object.values(counts).filter(value => value > 0).length >= 4,
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
    assert(profiles[id](counts), `[${phase}] semantic profile drift for ${id}: ${JSON.stringify(counts)}`);
  }
  assertHealthy();

  mark('reduced motion and responsive');
  await page.getByRole('checkbox', { name: 'Creator Lab reduced motion' }).check();
  await page.waitForTimeout(80);
  const reducedMotions = await page.locator('[data-score-bloom-entity]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-score-bloom-motion')),
  );
  assert(reducedMotions.every(value => value === 'none'), `[${phase}] reduced motion still animates creator entities`);

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(80);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `[${phase}] horizontal overflow at ${viewport.width}`);
  }

  mark('real uploads');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  const labels = ['Melody', 'Harmony', 'Rhythm', 'Ornament', 'Resonance'];
  for (const label of labels) {
    await page.getByLabel(`Add image for ${label}`).setInputFiles('scripts/fixtures/creator-upload.svg');
    await page.waitForTimeout(60);
    assertHealthy();
  }
  await page.getByLabel('Palette name').fill('Persisted Palette');
  await page.waitForTimeout(100);
  const uploadState = await page.evaluate(() => ({
    valid: document.querySelector('main')?.getAttribute('data-creator-lab-valid') ?? null,
    status: document.querySelector('.creator-lab-status')?.textContent?.trim() ?? null,
    roles: [...document.querySelectorAll('[data-creator-role]')].map(card => ({
      role: card.getAttribute('data-creator-role'),
      fileLabel: card.querySelector('.creator-lab-file span')?.textContent?.trim() ?? null,
      inputFile: card.querySelector('input[type="file"]')?.files?.[0]
        ? {
            name: card.querySelector('input[type="file"]').files[0].name,
            type: card.querySelector('input[type="file"]').files[0].type,
            size: card.querySelector('input[type="file"]').files[0].size,
          }
        : null,
      messages: [...card.querySelectorAll('.creator-lab-errors span')].map(node => node.textContent?.trim()),
    })),
  }));
  assert(uploadState.valid === 'true', `[${phase}] real file uploads did not compile: ${JSON.stringify(uploadState)}`);
  assertHealthy();

  const uploadSlider = page.getByRole('slider', { name: 'Creator Lab preview time' });
  await uploadSlider.fill(await uploadSlider.getAttribute('max'));
  await page.waitForTimeout(100);
  assert(await page.locator('[data-score-bloom-entity]').count() > 0, `[${phase}] uploaded palette produced no entities`);

  const signature = () => page.locator('[data-score-bloom-entity]').evaluateAll(nodes => nodes.map(node => ({
    role: node.getAttribute('data-score-bloom-role'),
    asset: node.getAttribute('data-score-bloom-asset'),
    transform: node.getAttribute('transform'),
    motion: node.getAttribute('data-score-bloom-motion'),
    birth: node.getAttribute('data-score-bloom-birth'),
    reaction: node.getAttribute('data-score-bloom-reaction-revision'),
  })));

  mark('save to indexeddb');
  const savedId = await mainAttr('data-creator-current-id');
  const savedSignature = await signature();
  assert(savedId, `[${phase}] saved palette id missing before save`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-creator-saved-count') === '1');
  assertHealthy();

  mark('reload and reopen');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-creator-saved-count') === '1');
  assertHealthy();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.waitForFunction(id => document.querySelector('main')?.getAttribute('data-creator-current-id') === id, savedId);
  const reloadedSlider = page.getByRole('slider', { name: 'Creator Lab preview time' });
  await reloadedSlider.fill(await reloadedSlider.getAttribute('max'));
  await page.waitForTimeout(120);
  assert(JSON.stringify(await signature()) === JSON.stringify(savedSignature), `[${phase}] reload changed deterministic Creator Palette semantics`);
  assertHealthy();

  mark('rename');
  await page.getByLabel('Palette name').fill('Renamed Palette');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('select[aria-label="Saved Creator Palettes"] option')].some(option => option.textContent === 'Renamed Palette'));
  assertHealthy();

  mark('duplicate');
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-creator-saved-count') === '2');
  const duplicateId = await mainAttr('data-creator-current-id');
  assert(duplicateId && duplicateId !== savedId, `[${phase}] duplicate did not receive a new id`);
  assertHealthy();

  mark('delete duplicate');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-creator-saved-count') === '1');
  const dbCounts = await page.evaluate(() => new Promise((resolve, reject) => {
    const opening = indexedDB.open('picture-score:creator-palettes', 1);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const tx = db.transaction(['palettes', 'assets'], 'readonly');
      const palettes = tx.objectStore('palettes').count();
      const assets = tx.objectStore('assets').count();
      tx.oncomplete = () => { resolve({ palettes: palettes.result, assets: assets.result }); db.close(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  assert(dbCounts.palettes === 1 && dbCounts.assets === 5, `[${phase}] delete did not remove owned assets: ${JSON.stringify(dbCounts)}`);
  assertHealthy();

  await page.screenshot({ path: 'output/playwright/creator-palette-persistence-mobile.jpg', type: 'jpeg', quality: 80, fullPage: true });

  mark('garden product integration');
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(async () => {
    const { emptyProject } = await import('/src/music/project.ts');
    const { exampleStrokes } = await import('/src/music/examples.ts');
    const { emptyGarden, makeObject, GARDEN_KEY } = await import('/src/garden/gardenState.ts');
    const { emptyGrowth, GROWTH_KEY } = await import('/src/garden/growth.ts');
    const project = { ...emptyProject(), strokes: exampleStrokes('cat'), title: 'creator-palette-product' };
    const garden = { ...emptyGarden(), objects: [makeObject(project, { x: .5, y: .42 }, 'creator-product')] };
    localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));
    localStorage.setItem(GROWTH_KEY, JSON.stringify(emptyGrowth()));
    localStorage.setItem('picture-score:weave:v1', JSON.stringify({ version: 1, formations: {} }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'GARDEN', exact: true }).click();
  const productPicker = page.getByRole('combobox', { name: 'SCORE BLOOM palette' });
  await page.waitForFunction(() => [...document.querySelectorAll('select[aria-label="SCORE BLOOM palette"] option')].some(option => option.textContent === 'Renamed Palette'));
  await productPicker.selectOption({ label: 'Renamed Palette' });
  await page.waitForFunction(id => document.querySelector('.score-bloom-layer')?.getAttribute('data-score-bloom-palette') === `creator:${id}`, savedId);
  assertHealthy();

  mark('garden selection reload');
  await page.reload();
  await page.getByRole('button', { name: 'GARDEN', exact: true }).click();
  await page.waitForFunction(id => document.querySelector('.score-bloom-layer')?.getAttribute('data-score-bloom-palette') === `creator:${id}`, savedId);
  assert(await page.getByRole('combobox', { name: 'SCORE BLOOM palette' }).inputValue() === savedId, `[${phase}] Garden palette selection did not survive reload`);
  assertHealthy();

  await page.screenshot({ path: 'output/playwright/creator-palette-garden-mobile.jpg', type: 'jpeg', quality: 80, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'output/playwright/creator-palette-garden-desktop.jpg', type: 'jpeg', quality: 80, fullPage: true });

  mark('restore clearing');
  await page.getByRole('combobox', { name: 'SCORE BLOOM palette' }).selectOption('clearing');
  await page.waitForFunction(() => document.querySelector('.score-bloom-layer')?.getAttribute('data-score-bloom-palette') === 'clearing');

  assert(!errors.length && !failedAssets.length, `[${phase}] ${JSON.stringify({ errors, failedAssets })}`);
  await page.goto('http://127.0.0.1:5173/');
  return {
    creatorCount,
    fileUpload: true,
    persistenceReload: true,
    rename: true,
    duplicate: true,
    deleteCleanup: dbCounts,
    gardenSelection: true,
    reducedMotion: true,
    errors,
    failedAssets,
  };
}
