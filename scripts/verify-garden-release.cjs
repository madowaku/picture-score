async (page) => {
  const assert=(ok,message)=>{if(!ok)throw Error(message)};
  const browser=page.context().browser(), checks=[];
  for(const width of [390,720,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1000,isMobile:width<1000});
    const tab=await context.newPage(),errors=[];
    tab.on('pageerror',e=>errors.push(e.message));
    try {
      await tab.goto('https://picture-score.netlify.app/');
      const nav=tab.getByRole('navigation',{name:'メインナビゲーション'});
      for(const name of ['スタジオ','作品帳','ホーム','ガーデン']) {
        const button=nav.getByRole('button',{name,exact:true});
        assert(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),name+' is covered at '+width);
        await button.click();assert(await button.getAttribute('aria-current')==='page',name+' did not open');
      }
      const field=tab.getByTestId('garden-field');await field.waitFor();
      assert(await field.getAttribute('data-touch-editing')==='false','Release missing touch fix');
      assert(await tab.locator('iframe').count()===0,'Unexpected injected overlay iframe');
      assert(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Release layout overflow');
      assert(await tab.locator('link[rel="canonical"]').getAttribute('href')==='https://picture-score.netlify.app/','Public URL changed');
      if(width<1000) {
        assert(await tab.getByRole('button',{name:'配置を動かす',exact:true}).isVisible(),'Touch toggle missing');
        const before=await tab.locator('[data-object="listener"]').getAttribute('style');
        await field.evaluate(el=>el.scrollIntoView({block:'center'}));
        const box=await field.boundingBox(),yBefore=await tab.evaluate(()=>scrollY);
        const cdp=await context.newCDPSession(tab),x=box.x+box.width*.8,y=box.y+box.height*.55;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*10}]});await tab.waitForTimeout(18);}
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tab.waitForTimeout(300);
        assert(await tab.evaluate(()=>scrollY)>yBefore+20,'Release swipe did not scroll');
        assert(await tab.locator('[data-object="listener"]').getAttribute('style')===before,'Release swipe moved ear');
      } else assert(!await tab.locator('.garden-touch-controls').isVisible(),'Desktop touch controls visible');
      await tab.evaluate(()=>scrollTo(0,0));
      await tab.screenshot({path:'output/playwright/garden-release-'+width+'.jpg',type:'jpeg',quality:65});
      assert(!errors.length,errors.join('; '));
      checks.push({width,allNavigationReachable:true,badgeIframe:false,touchFix:true,script:await tab.locator('script[type="module"]').getAttribute('src')});
    } finally { await context.close(); }
  }
  return {passed:true,checks};
}
