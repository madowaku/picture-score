async (page) => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
  const tab = await context.newPage(), errors = [];
  tab.on('pageerror', error => errors.push(error.message));
  const button = name => tab.getByRole('button', { name, exact: true });
  const artworks = () => tab.evaluate(async () => (await import('/src/library/store.ts')).listArtworks());
  const styles = selector => tab.locator(selector).evaluateAll(paths => paths.map(el => ({color:getComputedStyle(el).stroke,width:getComputedStyle(el).strokeWidth})));
  try {
    await tab.goto('http://127.0.0.1:5173/');
    await button('スタジオ').click();
    assert(await button('できた！').isDisabled(), 'Empty drawings cannot be finished');
    const layouts=[];
    for(const [width,height] of [[320,568],[390,844],[360,480],[760,600],[1280,900]]) {
      await tab.setViewportSize({width,height});
      const layout=await tab.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('.drawing-area').getBoundingClientRect().height,title:document.querySelector('.project-name').getBoundingClientRect().width}));
      assert(layout.scroll<=width && layout.canvas>120 && layout.title>45,'Layout: '+JSON.stringify(layout));
      layouts.push(layout);
    }
    await tab.setViewportSize({width:390,height:844});
    await button('いろ・ふとさを選ぶ').click();
    assert(await tab.locator('dialog:modal').count()===1,'Palette must prevent drawing underneath');
    await button('あお').click(); await button('ふとい').click();
    await tab.screenshot({path:'output/playwright/creation-palette.png'});
    await button('この線で描く').click();
    assert(await button('いろ・ふとさを選ぶ').evaluate(el=>el===document.activeElement),'Palette focus not restored');
    const draw=async y=>{const box=await tab.locator('.score-canvas').boundingBox(); await tab.mouse.move(box.x+box.width*.15,box.y+box.height*y);await tab.mouse.down();await tab.mouse.move(box.x+box.width*.75,box.y+box.height*(y+.1),{steps:18});await tab.mouse.up();};
    await draw(.25);
    await button('いろ・ふとさを選ぶ').click();
    await button('むらさき').click();await button('ほそい').click();await tab.keyboard.press('Escape');
    await draw(.6);
    let expected=await styles('.source-strokes path');
    assert(expected[0].color==='rgb(37, 132, 172)'&&expected[0].width==='5px'&&expected[1].width==='1.5px','Selected brush not used: '+JSON.stringify(expected));
    await button('Undo — 元に戻す').click();
    await tab.keyboard.press('Control+Shift+z');
    assert(JSON.stringify(await styles('.source-strokes path'))===JSON.stringify(expected),'Undo/redo lost appearance');
    await tab.screenshot({path:'output/playwright/creation-studio-mobile.png'});
    await button('できた！').click();
    await tab.getByRole('textbox',{name:'作品に名前をつけよう'}).fill('あおとむらさきのうた');
    await button('きいてみる').click();await button('とめる').click();
    await button('作品帳に残す').click();
    await tab.getByRole('heading',{name:'作品帳に残したよ。'}).waitFor();
    const first=(await artworks())[0];
    assert(first.project.strokes[0].color==='#2584ac'&&first.project.strokes[1].width===1.5,'Saved appearance changed');
    const exportInk = await tab.evaluate(async () => {
      const {createVideoPainter,artworkBounds}=await import('/src/share/painter.ts');
      const {pictureFile}=await import('/src/music/export.ts');
      const {emptyProject}=await import('/src/music/project.ts');
      const {projectMusic}=await import('/src/music/arrangement.ts');
      const project={...emptyProject(),strokes:[
        {id:'a',color:'#2584ac',width:5,points:[{x:200,y:140,pressure:.5,time:0},{x:800,y:140,pressure:.5,time:100}]},
        {id:'b',color:'#8660ae',width:1.5,points:[{x:200,y:280,pressure:.5,time:0},{x:800,y:280,pressure:.5,time:100}]}
      ]};
      const canvas=document.createElement('canvas');
      createVideoPainter(canvas,project,projectMusic(project),'square')(null);
      const b=artworkBounds(project.canvasAspect,720,720);
      const check=(ctx,x,ys)=>ys.map(y=>{let count=0;for(let dy=-15;dy<=15;dy++){const c=ctx.getImageData(Math.round(x),Math.round(y)+dy,1,1).data;if(c[0]<160&&c[2]>130&&c[2]>c[0])count++;}return count;});
      const video=check(canvas.getContext('2d'),360,[b.y+b.height/3,b.y+2*b.height/3]);
      const bitmap=await createImageBitmap(await pictureFile(project,[]));
      canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
      const png=check(canvas.getContext('2d'),1000,[2*(85+.95*140),2*(85+.95*280)]);
      return {video,png};
    });
    assert(exportInk.video[0]>exportInk.video[1]&&exportInk.video[1]>0&&exportInk.png[0]>exportInk.png[1]&&exportInk.png[1]>0,'Export lost ink widths: '+JSON.stringify(exportInk));
    await tab.screenshot({path:'output/playwright/creation-finished-mobile.png'});
    await button('音つきで共有').click();
    await button('音つき動画をつくる').click();
    await tab.getByRole('button',{name:/動画を保存/}).waitFor({timeout:30000});
    const [download]=await Promise.all([tab.waitForEvent('download'),tab.getByRole('button',{name:/動画を保存/}).click()]);
    await download.saveAs('output/playwright/creation-colored.'+download.suggestedFilename().split('.').at(-1));
    await button('共有を閉じる').click();
    assert(await button('音つきで共有').evaluate(el=>el===document.activeElement),'Share should return focus to completion');
    await button('作品帳を見る').click();
    assert(JSON.stringify(await styles('.artwork-preview path'))===JSON.stringify(expected),'Library appearance changed');
    await button('続きを描く').click();
    assert(JSON.stringify(await styles('.source-strokes path'))===JSON.stringify(expected),'Reopened drawing changed');
    await button('できた！').click();
    await tab.getByRole('textbox',{name:'作品に名前をつけよう'}).fill('保存の再試行');
    await tab.evaluate(()=>{window.__put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('quota','QuotaExceededError');};});
    await button('作品帳を更新').click();
    await tab.getByRole('alert').filter({hasText:'作品帳に保存できませんでした'}).waitFor();
    assert((await artworks())[0].project.title===first.project.title,'Failed save damaged saved work');
    await tab.evaluate(()=>{IDBObjectStore.prototype.put=window.__put;});
    await button('作品帳を更新').click();
    await tab.getByRole('heading',{name:'作品帳に残したよ。'}).waitFor();
    assert((await artworks()).length===1&&(await artworks())[0].id===first.id,'Retry should update the same work');
    await tab.setViewportSize({width:1280,height:900});
    await tab.screenshot({path:'output/playwright/creation-finished-desktop.png'});
    await button('もう少し描く').click();
    assert(await button('できた！').evaluate(el=>el===document.activeElement),'Completion focus not restored');
    await button('ホーム').click();
    assert(JSON.stringify(await styles('.recent-strokes path'))===JSON.stringify(expected),'Home appearance changed');
    await tab.reload();await button('作品帳').click();await button('続きを描く').click();
    assert(JSON.stringify(await styles('.source-strokes path'))===JSON.stringify(expected),'Reload lost stroke styles');
    await button('庭に置く').click();
    await tab.locator('.inhabitant-ink path').first().waitFor();
    assert(JSON.stringify(await styles('.inhabitant-ink path'))===JSON.stringify(expected),'Garden appearance changed');
    assert(!errors.length,'Browser errors: '+errors.join('; '));
    return {passed:true,layouts,styles:expected,exportInk,checks:['palette','drawing','undo/redo','completion/listen','save/reopen','share/video','failure/retry','focus','reload','home','garden']};
  } finally {await context.close();}
}
