// PUBLIC GARDEN release gate: exercise the real first-run product loop through UI.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if ((response.url().includes('/art/') || response.url().includes('/audio/')) && response.status() >= 400)
      failedAssets.push(`${response.status()} ${response.url()}`);
  });

  async function freshStart(viewport) {
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:5173/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('picture-score:language', 'ja');
    });
    await page.reload();
    assert(await page.getByRole('button', {name:'DRAW', exact:true}).count() === 1, 'DRAW nav missing');
    assert(await page.getByRole('button', {name:'GARDEN', exact:true}).count() === 1, 'GARDEN nav missing');
    assert(await page.locator('.creation-trail li').count() === 3, 'first-run creation trail missing');
    assert(await page.locator('.garden-empty-start').count() === 0, 'Garden should not overlay DRAW on first load');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `initial horizontal overflow ${viewport.width}`);
  }

  async function drawOneStroke() {
    const canvas = page.locator('[data-testid="score-canvas"]');
    const box = await canvas.boundingBox();
    assert(box && box.width > 180 && box.height > 160, 'drawing canvas too small');
    const x0 = box.x + box.width * .22, y0 = box.y + box.height * .68;
    const x1 = box.x + box.width * .78, y1 = box.y + box.height * .32;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      const p = i / 12;
      const wave = Math.sin(p * Math.PI * 2) * box.height * .08;
      await page.mouse.move(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p + wave);
    }
    await page.mouse.up();
    await page.waitForTimeout(260);
    assert(await page.locator('.source-strokes path').count() === 1, 'stroke was not committed');
    assert(await page.locator('.play-button').isEnabled(), 'PLAY did not enable after drawing');
    assert(await page.locator('.place-garden').isEnabled(), 'PLACE IN GARDEN did not enable after drawing');
  }

  async function playAndStop() {
    const play = page.locator('.play-button');
    await play.click();
    await page.waitForFunction(() => document.querySelector('.play-button')?.textContent?.includes('STOP'), null, {timeout: 2500});
    await page.waitForTimeout(180);
    await play.click();
    await page.waitForFunction(() => document.querySelector('.play-button')?.textContent?.includes('PLAY'), null, {timeout: 1500});
  }

  async function placeInGarden() {
    await page.locator('.place-garden').click();
    assert(await page.locator('.garden-view:not([hidden])').count() === 1, 'Garden did not open after PLACE');
    assert(await page.locator('.garden-ghost').count() === 1, 'pending garden placement missing');
    assert((await page.locator('.garden-bottom').innerText()).includes('好きなところにタップ'), 'placement guidance missing');
    await page.locator('.garden-actions button').first().click();
    await page.waitForTimeout(650);
    assert(await page.locator('.inhabitant').count() === 1, 'placed artwork missing');
    assert(await page.locator('.garden-ghost').count() === 0, 'pending ghost remained after placement');
  }

  async function persistenceAndKeyboard() {
    const stored = await page.evaluate(async () => {
      const { GARDEN_KEY } = await import('/src/garden/gardenState.ts');
      const { STORAGE_KEY } = await import('/src/music/project.ts');
      return {
        garden: JSON.parse(localStorage.getItem(GARDEN_KEY) || 'null'),
        project: JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'),
      };
    });
    assert(stored.garden?.objects?.length === 1, 'Garden was not persisted');
    assert(stored.project?.strokes?.length === 1, 'drawing project was not persisted');

    await page.reload();
    await page.getByRole('button', {name:'GARDEN', exact:true}).click();
    assert(await page.locator('.inhabitant').count() === 1, 'Garden placement did not survive reload');

    const object = page.locator('.inhabitant').first();
    await object.focus();
    const before = await object.getAttribute('style');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const after = await object.getAttribute('style');
    assert(before !== after, 'keyboard move did not update Garden artwork');

    await page.getByRole('button', {name:'DRAW', exact:true}).click();
    assert(await page.locator('.source-strokes path').count() === 1, 'DRAW project was lost after Garden round-trip');
  }

  const reports = [];
  for (const viewport of [
    {width:360,height:800},
    {width:390,height:844},
    {width:1440,height:900},
  ]) {
    await page.emulateMedia({reducedMotion:'no-preference'});
    await freshStart(viewport);
    await drawOneStroke();
    await playAndStop();
    await placeInGarden();
    await persistenceAndKeyboard();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `final horizontal overflow ${viewport.width}`);
    await page.screenshot({path:`output/playwright/public-garden-${viewport.width}.jpg`, type:'jpeg', quality:80, fullPage:true});
    reports.push({viewport, firstRun:true, persistence:true, keyboard:true});
  }

  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'Reduced Motion preference not active');
  await page.getByRole('button', {name:'GARDEN', exact:true}).click();
  assert(await page.locator('.inhabitant').count() === 1, 'Reduced Motion reload lost Garden');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Reduced Motion mobile overflow');
  await page.screenshot({path:'output/playwright/public-garden-reduced-390.jpg', type:'jpeg', quality:80, fullPage:true});

  assert(!errors.length, `page errors: ${JSON.stringify(errors)}`);
  assert(!failedAssets.length, `failed assets: ${JSON.stringify(failedAssets)}`);
  return {reports, reducedMotion:true, errors, failedAssets};
}
