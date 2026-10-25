async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  // A fresh context protects real drawings and makes this check repeatable.
  const context = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } });
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', error => errors.push(error.message));
  const button = name => tab.getByRole('button', { name, exact: true });
  const artworks = () => tab.evaluate(async () => (await import('/src/library/store.ts')).listArtworks());
  try {
    await tab.goto('http://127.0.0.1:5173/');
    await button('作品帳').click();
    await tab.getByRole('heading', { name: '最初の一枚を、この場所に。' }).waitFor();
    await button('描いてみる').click();
    assert(await button('できた！').isDisabled(), 'Empty work should not be shareable');
    await button('波').click();
    await tab.getByRole('textbox', { name: '作品名', exact: true }).fill('海のうた');
    await button('ベル').click();
    await tab.getByRole('combobox', { name: 'テンポ', exact: true }).selectOption('140');
    await button('ほかの保存方法').click();
    await tab.getByRole('button', { name: /作品帳に残す/ }).click();
    await tab.getByRole('status').filter({ hasText: '作品帳に残しました' }).waitFor();
    const first = (await artworks())[0];
    assert(first.project.instrument === 'Bell' && first.project.tempo === 140, 'Sound settings were lost');
    await button('作品帳').click();
    await tab.getByRole('article', { name: '海のうた', exact: true }).waitFor();
    await button('海のうたを聴く').click();
    await button('海のうたの再生を止める').waitFor();
    await button('海のうたの再生を止める').click();
    await button('複製').click();
    const copy = tab.getByRole('article', { name: '海のうた のコピー', exact: true });
    await copy.waitFor();
    const rows = await artworks();
    assert(rows.length === 2 && rows[0].id !== rows[1].id, 'Duplicate needs its own identity');
    assert(JSON.stringify(rows[0].project.strokes) === JSON.stringify(rows[1].project.strokes), 'Copy changed the drawing');
    await button('海のうた のコピーの名前を変える').click();
    await tab.getByRole('textbox', { name: '作品の新しい名前' }).fill('夜の海');
    await button('名前を保存').click();
    await tab.getByRole('article', { name: '夜の海', exact: true }).waitFor();
    await button('夜の海を作品帳から外す').click();
    await tab.getByRole('article', { name: '夜の海', exact: true }).waitFor({ state: 'detached' });
    await button('元に戻す').click();
    await tab.getByRole('article', { name: '夜の海', exact: true }).waitFor();
    await tab.screenshot({ path: 'output/playwright/sketchbook-desktop.png', fullPage: true });

    // Refresh must preserve both saved works and their original identities.
    await tab.reload();
    await button('作品帳').click();
    await tab.getByRole('article', { name: '海のうた', exact: true }).getByRole('button', { name: '続きを描く', exact: true }).click();
    assert(await button('ベル').getAttribute('aria-pressed') === 'true', 'Reopening lost the timbre');
    assert(await tab.getByRole('combobox', { name: 'テンポ', exact: true }).inputValue() === '140', 'Reopening lost the tempo');
    await tab.getByRole('textbox', { name: '作品名', exact: true }).fill('海のうた・改');
    await button('ほかの保存方法').click();
    await tab.getByRole('button', { name: /作品帳を更新/ }).click();
    await tab.getByRole('status').filter({ hasText: '作品帳に残しました' }).waitFor();
    const updated = await artworks();
    assert(updated.length === 2, 'Saving an opened work should update it, not duplicate it');
    assert(updated.find(item => item.id === first.id).project.title === '海のうた・改', 'Wrong record updated');

    // Failed transactions must keep the previous saved work intact.
    await tab.evaluate(() => {
      window.__realPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function() { throw new DOMException('quota', 'QuotaExceededError'); };
    });
    await tab.getByRole('textbox', { name: '作品名', exact: true }).fill('未保存の変更');
    await button('ほかの保存方法').click();
    await tab.getByRole('button', { name: /作品帳を更新/ }).click();
    await tab.getByRole('status').filter({ hasText: '作品帳に保存できませんでした' }).waitFor();
    assert((await artworks()).find(item => item.id === first.id).project.title === '海のうた・改', 'Failed write damaged existing work');
    await tab.evaluate(() => { IDBObjectStore.prototype.put = window.__realPut; });
    await button('作品帳').click();

    // Share the saved snapshot, independent of the unsaved Studio draft.
    await tab.getByRole('article', { name: '海のうた・改', exact: true }).getByRole('button', { name: '音つきで共有', exact: true }).click();
    await tab.getByRole('dialog', { name: '音つきで、届けよう。' }).waitFor();
    await button('音つき動画をつくる').click();
    await tab.getByRole('button', { name: /動画を保存/ }).waitFor({ timeout: 30000 });
    const metadata = await tab.locator('.share-stage video').evaluate(async video => {
      if (!video.videoWidth) await new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once: true }));
      await video.play();
      return { width: video.videoWidth, height: video.videoHeight, duration: video.duration, muted: video.muted };
    });
    assert(metadata.width === 720 && metadata.height === 720 && metadata.duration > 6 && !metadata.muted, `Bad video: ${JSON.stringify(metadata)}`);
    await tab.screenshot({ path: 'output/playwright/sketchbook-share-desktop.png' });
    const [download] = await Promise.all([tab.waitForEvent('download'), tab.getByRole('button', { name: /動画を保存/ }).click()]);
    const extension = download.suggestedFilename().split('.').at(-1);
    await download.saveAs(`output/playwright/sketchbook-square.${extension}`);
    await button('共有を閉じる').click();
    assert(await tab.getByRole('article', { name: '海のうた・改', exact: true }).getByRole('button', { name: '音つきで共有', exact: true }).evaluate(el => el === document.activeElement), 'Share close did not restore focus');

    await tab.setViewportSize({ width: 390, height: 844 });
    await tab.screenshot({ path: 'output/playwright/sketchbook-mobile.png', fullPage: true });
    for (const width of [320, 390, 760]) {
      await tab.setViewportSize({ width, height: 844 });
      assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Library overflows at ${width}px`);
    }
    assert(errors.length === 0, `Runtime errors: ${errors.join('; ')}`);
    return { passed: true, savedWorks: (await artworks()).length, video: metadata, extension, runtimeErrors: errors };
  } finally { await context.close(); }
}
