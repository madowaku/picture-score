async (page) => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const browser = page.context().browser();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const tab = await mobile.newPage();
  const errors = []; tab.on('pageerror', e => errors.push(e.message));
  const button = name => tab.getByRole('button', { name, exact: true });
  const field = tab.getByTestId('garden-field');
  const positions = () => tab.locator('[data-object]').evaluateAll(nodes => nodes.map(el => ({ id: el.dataset.object, left: el.style.left, top: el.style.top })));
  const pause = ms => tab.waitForTimeout(ms);
  const centerField = async () => { await field.evaluate(el => el.scrollIntoView({block:'center'})); await pause(120); };
  const cdp = await mobile.newCDPSession(tab);
  const swipe = async (x,y,dx=0,dy=-120) => {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=12;i++) { await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:x+dx*i/12,y:y+dy*i/12}]}); await pause(18); }
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]}); await pause(400);
  };
  const swipeTarget = async selector => {
    await centerField(); const box = await tab.locator(selector).boundingBox();
    await swipe(box.x+box.width/2,box.y+box.height/2);
  };
  let desktop;
  try {
    await tab.goto('http://127.0.0.1:5173/');
    const saved = await tab.evaluate(async () => {
      const {GARDEN_KEY,emptyGarden,makeObject}=await import('/src/garden/gardenState.ts');
      const {emptyProject}=await import('/src/music/project.ts');
      const {exampleStrokes}=await import('/src/music/examples.ts');
      const g=emptyGarden();g.objects=[makeObject({...emptyProject(),title:'タッチ確認の花',strokes:exampleStrokes('heart')},{x:.32,y:.48},'touch-flower')];
      localStorage.setItem(GARDEN_KEY,JSON.stringify(g));return g;
    });
    await button('ガーデン').tap();
    await tab.locator('[data-object="touch-flower"]').waitFor();
    assert(await field.getAttribute('data-touch-editing')==='false','Garden starts in edit mode');
    const original = JSON.stringify(await positions());
    await centerField(); let box=await field.boundingBox(); const yBefore=await tab.evaluate(()=>scrollY);
    await swipe(box.x+box.width*.8,box.y+box.height*.5);
    assert(await tab.evaluate(()=>scrollY)>yBefore+20,'Swiping the garden did not scroll');
    assert(JSON.stringify(await positions())===original,'Blank swipe moved listener');
    await swipeTarget('[data-object="touch-flower"]');
    assert(JSON.stringify(await positions())===original,'Swipe moved artwork');
    assert(await tab.locator('.garden-artwork.chosen').count()===0,'Swipe selected or played artwork');
    await swipeTarget('[data-object="listener"]');
    assert(JSON.stringify(await positions())===original,'Swipe moved ear');
    await centerField();await tab.locator('[data-object="touch-flower"]').tap();
    assert(await tab.locator('[data-object="touch-flower"]').evaluate(el=>el.classList.contains('chosen')),'Tap did not select artwork');
    await button('配置を動かす').tap();
    assert(await field.getAttribute('data-touch-editing')==='true','Edit mode not active');
    await centerField();box=await tab.locator('[data-object="touch-flower"]').boundingBox();
    const editingY=await tab.evaluate(()=>scrollY);
    await swipe(box.x+box.width/2,box.y+box.height/2,75,-35);
    assert(JSON.stringify(await positions())!==original,'Explicit drag did not move artwork');
    assert(Math.abs((await tab.evaluate(()=>scrollY))-editingY)<2,'Editing drag scrolled page');
    const moved=JSON.stringify(await positions());
    await tab.locator('.garden-arrange-done').tap();
    assert(await field.getAttribute('data-touch-editing')==='false','Done did not restore scrolling');
    await swipeTarget('[data-object="listener"]');
    assert(JSON.stringify(await positions())===moved,'Finished edit still moves ear');
    await button('配置を動かす').tap();await button('ホーム').tap();await button('ガーデン').tap();
    assert(await field.getAttribute('data-touch-editing')==='false','Edit mode leaked across navigation');
    await tab.evaluate(()=>scrollTo(0,0));await tab.screenshot({path:'output/playwright/garden-touch-mobile.png',fullPage:true});
    for(const width of [320,390,720]) {
      await tab.setViewportSize({width,height:844});
      assert(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);
      await tab.getByRole('combobox',{name:'Language / 言語'}).selectOption('en');
      assert(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'English overflow at '+width);
      await tab.getByRole('combobox',{name:'Language / 言語'}).selectOption('ja');
    }
    await tab.setViewportSize({width:390,height:844});
    await button('スタジオ').tap();await button('ハート').tap();await button('庭に置く').tap();
    await field.waitFor();assert(await field.evaluate(el=>el.classList.contains('placing')),'No pending placement');
    const count=await tab.locator('.inhabitant').count();await centerField();box=await field.boundingBox();
    await swipe(box.x+box.width*.75,box.y+box.height*.6);
    assert(await tab.locator('.inhabitant').count()===count,'Scrolling accidentally planted a work');
    await centerField();box=await field.boundingBox();await tab.touchscreen.tap(box.x+box.width*.75,box.y+box.height*.45);
    assert(await tab.locator('.inhabitant').count()===count+1,'Tap did not plant work');
    desktop=await browser.newContext({viewport:{width:1440,height:900}});
    const desk=await desktop.newPage();desk.on('pageerror',e=>errors.push(e.message));
    await desk.goto('http://127.0.0.1:5173/');
    await desk.evaluate(g=>localStorage.setItem('picture-score:garden:v1',JSON.stringify(g)),saved);
    await desk.getByRole('button',{name:'ガーデン',exact:true}).click();
    assert(!await desk.locator('.garden-touch-controls').isVisible(),'Desktop shows touch controls');
    const art=desk.locator('[data-object="touch-flower"]');const before=await art.getAttribute('style');box=await art.boundingBox();
    await desk.mouse.move(box.x+box.width/2,box.y+box.height/2);await desk.mouse.down();await desk.mouse.move(box.x+box.width/2+90,box.y+box.height/2-20,{steps:8});await desk.mouse.up();
    assert(await art.getAttribute('style')!==before,'Desktop mouse drag stopped working');
    await art.focus();const keyBefore=await art.getAttribute('style');await desk.keyboard.press('ArrowRight');
    assert(await art.getAttribute('style')!==keyBefore,'Keyboard movement stopped working');
    await desk.screenshot({path:'output/playwright/garden-touch-desktop.png',fullPage:true});
    assert(!errors.length,errors.join('; '));
    return {passed:true,checks:['native touch scrolling','artwork and ear swipe protection','tap audition','explicit drag','done and navigation reset','pending swipe/tap','mouse drag','keyboard','320/390/720/1440 layouts','Japanese/English'],errors};
  } finally { await mobile.close();await desktop?.close(); }
}
