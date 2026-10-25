async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const context = await page.context().browser().newContext({ viewport: { width:390, height:844 } });
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', e => errors.push(e.message));
  try {
    await tab.goto('http://127.0.0.1:5173/');
    // Select the fallback encoder without changing the real implementation.
    await tab.evaluate(() => {
      const native = MediaRecorder.isTypeSupported.bind(MediaRecorder);
      MediaRecorder.isTypeSupported = mime => mime.startsWith('video/webm') && native(mime);
      Object.defineProperty(navigator, 'canShare', { configurable:true, value:() => false });
    });
    await tab.getByRole('button', { name:'スタジオ', exact:true }).click();
    await tab.getByRole('button', { name:'ハート', exact:true }).click();
    await tab.getByRole('combobox', { name:'Language / 言語', exact:true }).selectOption('en');
    await tab.getByRole('button', { name:'Choose color and line width', exact:true }).click();
    await tab.getByRole('button', { name:'Purple', exact:true }).click();
    await tab.getByRole('button', { name:'Bold', exact:true }).click();
    for(const [width,height] of [[320,568],[360,480],[844,390]]) {
      await tab.setViewportSize({width,height});
      const box=await tab.locator('.brush-dialog').boundingBox();
      assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'Palette outside screen');
      assert(await tab.locator('.brush-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'Palette overflows horizontally');
    }
    await tab.getByRole('button', { name:'Draw with this brush', exact:true }).click();
    await tab.getByRole('button', { name:'Done!', exact:true }).click();
    await tab.getByRole('textbox',{name:'Give your creation a name'}).fill('A name I can change later');
    for(const [width,height] of [[320,568],[360,480],[844,390]]) {
      await tab.setViewportSize({width,height});
      assert(await tab.locator('.finish-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'Completion overflows horizontally');
    }
    await tab.keyboard.press('Escape');
    await tab.setViewportSize({width:390,height:844});
    await tab.getByRole('button', { name:'Sound', exact:true }).click();
    await tab.getByRole('combobox', { name:'Tempo', exact:true }).selectOption('140');
    await tab.getByRole('button', { name:'Close sound settings', exact:true }).click();
    await tab.getByRole('button', { name:'More save options', exact:true }).click();
    await tab.getByRole('button', { name:'Share with sound', exact:true }).click();
    await tab.getByRole('button', { name:'Create video with sound', exact:true }).click();
    await tab.getByRole('button', { name:/Save video/ }).waitFor({ timeout:30000 });
    assert(await tab.getByRole('button', { name:'Share', exact:true }).count() === 0, 'Unsupported native share should offer download only');
    await tab.getByText(/This is a WebM video/).waitFor();
    const [file] = await Promise.all([tab.waitForEvent('download'), tab.getByRole('button', { name:/Save video/ }).click()]);
    assert(file.suggestedFilename().endsWith('.webm'), 'Wrong fallback extension');
    await file.saveAs('output/playwright/sketchbook-fallback.webm');
    await tab.getByRole('button', { name:'Close sharing', exact:true }).click();
    await tab.getByRole('button', { name:'More save options', exact:true }).click();
    await tab.getByRole('button', { name:/Save to sketchbook/ }).click();
    await tab.getByRole('status').filter({ hasText:'Saved to your sketchbook' }).waitFor();
    const toast = await tab.locator('.toast').evaluate(el => ({ bottom:el.getBoundingClientRect().bottom, nav:document.querySelector('.product-bottom-nav').getBoundingClientRect().top }));
    assert(toast.bottom <= toast.nav, 'Save confirmation is hidden under navigation');
    // Reload immediately after an edit: pagehide flush keeps the newest draft and identity.
    await tab.getByRole('textbox', { name:'Artwork title', exact:true }).fill('After reload');
    await tab.reload();
    await tab.getByRole('button', { name:'Studio', exact:true }).click();
    assert(await tab.getByRole('textbox', { name:'Artwork title', exact:true }).inputValue() === 'After reload', 'Reload lost the latest edit');
    await tab.getByRole('button', { name:'More save options', exact:true }).click();
    await tab.getByRole('button', { name:/Update sketchbook/ }).waitFor();
    await tab.getByRole('button', { name:/Update sketchbook/ }).click();
    await tab.getByRole('button', { name:'Sketchbook', exact:true }).click();
    await tab.getByRole('heading', { name:'My sketchbook' }).waitFor();
    await tab.getByRole('article', { name:'After reload', exact:true }).waitFor();
    assert(await tab.getByRole('article').count() === 1, 'Reload caused duplicate artwork');
    assert(errors.length === 0, `Runtime errors: ${errors.join('; ')}`);
    return { passed:true, fallback:'WebM', language:'English', toast, runtimeErrors:errors };
  } finally { await context.close(); }
}

