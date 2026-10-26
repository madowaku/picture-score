async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'スタジオ', exact:true }).click();
  const results = [];
  for (const [width, height] of [[320,568],[375,667],[390,844],[360,480],[760,600]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      return { width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth,
        scrollHeight:document.documentElement.scrollHeight, canvasHeight:rect('.drawing-area').height,
        controlsBottom:rect('.controls').bottom, navTop:rect('.product-bottom-nav').top };
    });
    assert(layout.scrollHeight === height && layout.scrollWidth === width, `Page scrolls: ${JSON.stringify(layout)}`);
    assert(layout.canvasHeight > 120, `Canvas collapsed: ${JSON.stringify(layout)}`);
    assert(layout.controlsBottom <= layout.navTop, `Controls covered: ${JSON.stringify(layout)}`);
    results.push(layout);
  }
  await page.setViewportSize({width:390,height:844});
  const before = await page.locator('.source-strokes path').count();
  const box = await page.locator('.drawing-area').boundingBox();
  await page.mouse.move(box.x+box.width*.2,box.y+box.height*.45);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:16});
  await page.mouse.up();
  assert(await page.locator('.source-strokes path').count() === before+1, 'Drawing failed');
  await page.getByRole('button',{name:'音の設定',exact:true}).click();
  assert(await page.locator('dialog:modal').count() === 1,'Settings must block drawing underneath');
  await page.getByRole('button',{name:'ベル',exact:true}).click();
  assert(await page.getByRole('button',{name:'ベル',exact:true}).getAttribute('aria-pressed') === 'true','Instrument change failed');
  await page.keyboard.press('Escape');
  assert(await page.locator('dialog:modal').count() === 0,'Escape did not close settings');
  assert(await page.getByRole('button',{name:'音の設定',exact:true}).evaluate(el => el === document.activeElement),'Focus not restored');
  await page.getByRole('button',{name:'PLAY — 絵を演奏する',exact:true}).click();
  await page.getByRole('button',{name:'STOP — 再生を止める',exact:true}).click();
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('slider',{name:'絵と音楽のバランス',exact:true}).waitFor({state:'visible'});
  assert(await page.getByRole('button',{name:'ベル',exact:true}).isVisible(),'Desktop settings missing');
  const context = await page.context().browser().newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  try {
    const landscape = await context.newPage();
    await landscape.goto('http://127.0.0.1:5173/');
    await landscape.getByRole('button',{name:'スタジオ',exact:true}).click();
    const size = await landscape.evaluate(() => ({height:innerHeight,scroll:document.documentElement.scrollHeight,canvas:document.querySelector('.drawing-area').getBoundingClientRect().height}));
    assert(size.scroll===size.height && size.canvas>100,`Landscape failed: ${JSON.stringify(size)}`);
    results.push({landscape:size});
  } finally { await context.close(); }
  await page.setViewportSize({width:390,height:844});
  console.log(JSON.stringify({passed:true,results}));
}

