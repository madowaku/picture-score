async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', error => errors.push(error.message));
  const button = name => tab.getByRole('button', { name, exact: true });
  try {
    // Install before React computes canShare for the generated file. Headless Chromium
    // has no OS share sheet; changing this after generation does not trigger a render.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable:true, value:() => true });
      Object.defineProperty(navigator, 'share', { configurable:true, value:async data => {
        window.__sharedFile = { count:data.files.length, size:data.files[0].size, type:data.files[0].type, name:data.files[0].name };
        throw new DOMException('cancelled', 'AbortError');
      } });
    });
    await tab.goto('http://127.0.0.1:5173/');
    await button('スタジオ').click();
    await button('猫').click();
    await tab.getByRole('textbox', { name: '作品名', exact: true }).fill('星をさがすねこ');
    await button('音の設定').click();
    await tab.getByRole('combobox', { name: 'テンポ', exact: true }).selectOption('140');
    await button('音の設定を閉じる').click();
    const layouts = [];
    for (const [width, height] of [[320,568], [390,844], [360,480], [760,600]]) {
      await tab.setViewportSize({ width, height });
      const layout = await tab.evaluate(() => ({ width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
        height:innerHeight, scrollHeight:document.documentElement.scrollHeight,
        canvas:document.querySelector('.drawing-area').getBoundingClientRect().height,
        controls:document.querySelector('.controls').getBoundingClientRect().bottom,
        nav:document.querySelector('.product-bottom-nav').getBoundingClientRect().top,
        title:document.querySelector('.project-name input').getBoundingClientRect().width }));
      assert(layout.width === layout.scrollWidth && layout.height === layout.scrollHeight && layout.canvas > 120 && layout.controls <= layout.nav, `Studio layout broken: ${JSON.stringify(layout)}`);
      assert(layout.title >= 45, `Title field too narrow: ${JSON.stringify(layout)}`);
      layouts.push(layout);
    }
    await tab.setViewportSize({ width:390, height:844 });
    await tab.screenshot({ path:'output/playwright/sketchbook-studio-mobile.png' });
    await button('ほかの保存方法').click();
    await button('音つきで共有').click();
    await tab.getByRole('button', { name:/縦長/ }).click();
    await button('音つき動画をつくる').click();
    await button('作成をやめる').click();
    await button('音つき動画をつくる').waitFor();
    assert(await tab.locator('.share-stage video').count() === 0, 'Cancelled video exposed a partial file');
    await button('音つき動画をつくる').click();
    await tab.getByRole('button', { name:/動画を保存/ }).waitFor({ timeout:30000 });
    await tab.locator('.share-dialog').evaluate(el => el.scrollTop = 0);
    const metadata = await tab.locator('video').evaluate(async video => {
      if (!video.videoWidth) await new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once:true }));
      return { width:video.videoWidth, height:video.videoHeight, duration:video.duration };
    });
    assert(metadata.width === 720 && metadata.height === 1280, `Wrong portrait video: ${JSON.stringify(metadata)}`);
    await tab.screenshot({ path:'output/playwright/sketchbook-share-mobile.png' });
    const [download] = await Promise.all([tab.waitForEvent('download'), tab.getByRole('button', { name:/動画を保存/ }).click()]);
    await download.saveAs(`output/playwright/sketchbook-portrait.${download.suggestedFilename().split('.').at(-1)}`);

    // Native share is intercepted: verify file handoff without posting anywhere.
    await button('共有する').click();
    assert(await tab.getByRole('alert').count() === 0, 'User cancelling share is not an error');
    const handoff = await tab.evaluate(() => window.__sharedFile);
    assert(handoff.count === 1 && handoff.size > 10000 && ['video/mp4', 'video/webm'].includes(handoff.type), `Invalid file handoff: ${JSON.stringify(handoff)}`);
    await tab.evaluate(() => Object.defineProperty(navigator, 'share', { configurable:true, value:async () => { throw new DOMException('unavailable', 'NotAllowedError'); } }));
    await button('共有する').click();
    await tab.getByRole('alert').filter({ hasText:'動画を保存' }).waitFor();
    await button('共有を閉じる').click();
    assert(await button('ほかの保存方法').evaluate(el => el === document.activeElement), 'Focus not restored to Studio');

    // Unsupported recording retains usable PNG/WAV exports.
    await tab.evaluate(() => { window.__recorder = window.MediaRecorder; window.MediaRecorder = undefined; });
    await button('ほかの保存方法').click();
    await button('音つきで共有').click();
    await tab.getByText('このブラウザでは動画を作れません。絵と音をそれぞれ保存できます。').waitFor();
    assert(await button('音つき動画をつくる').count() === 0, 'Unsupported encoder offered a broken action');
    await tab.locator('.share-other summary').click();
    const [picture] = await Promise.all([tab.waitForEvent('download'), tab.getByRole('button', { name:/絵を保存/ }).click()]);
    assert(picture.suggestedFilename().endsWith('.png'), 'PNG fallback failed');
    const [audio] = await Promise.all([tab.waitForEvent('download'), tab.getByRole('button', { name:/音を保存/ }).click()]);
    assert(audio.suggestedFilename().endsWith('.wav'), 'WAV fallback failed');
    await audio.saveAs('output/playwright/sketchbook-reference.wav');
    await button('共有を閉じる').click();
    await tab.evaluate(() => { window.MediaRecorder = window.__recorder; });

    // Stop work when the page is hidden; don’t return an incomplete recording.
    await button('ほかの保存方法').click();
    await button('音つきで共有').click();
    await button('音つき動画をつくる').click();
    await tab.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable:true, value:true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await tab.getByRole('alert').filter({ hasText:'画面を離れたので' }).waitFor();
    assert(await tab.locator('video').count() === 0, 'Background interruption exposed incomplete video');
    await tab.evaluate(() => { delete document.hidden; });
    await tab.keyboard.press('Escape');
    assert(await tab.locator('dialog:modal').count() === 0, 'Escape did not close share dialog');
    assert(errors.length === 0, `Runtime errors: ${errors.join('; ')}`);
    return { passed:true, layouts, portrait:metadata, interceptedShare:handoff, runtimeErrors:errors };
  } finally { await context.close(); }
}
