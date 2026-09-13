// Isolated real-browser ALIVE check; generated fixtures never touch user storage.
async (page) => {
  const assert=(ok,message)=>{if(!ok)throw Error(message);}, errors=[], failedAssets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/art/')&&r.status()>=400)failedAssets.push(r.url());});
  await page.emulateMedia({reducedMotion:'no-preference'});
  async function seed(dense=false) {
    // Flush the previous UI before replacing fixture storage.
    await page.reload();
    await page.evaluate(async(dense)=>{
      const {emptyProject}=await import('/src/music/project.ts'),{exampleStrokes}=await import('/src/music/examples.ts');
      const {emptyGarden,makeObject,GARDEN_KEY}=await import('/src/garden/gardenState.ts');
      const {emptyGrowth,GROWTH_KEY}=await import('/src/garden/growth.ts');
      const line=points=>[{id:'s',points:points.map(([x,y],time)=>({x,y,time,pressure:.5}))}];
      const inputs=[exampleStrokes('wave'),line([[500,30],[500,390]]),line([[30,210],[950,210]]),line([[20,100],[150,320],[280,80],[410,340],[540,80],[670,330],[800,80],[950,300]]),line([[500,200]])];
      const objects=Array.from({length:dense?12:5},(_,i)=>makeObject({...emptyProject(),strokes:inputs[i%5],title:['うたの波','和音のつぼみ','余韻の糸','はねるリズム','ひとつ星'][i%5]},
        dense?{x:.15+(i%4)*.23,y:.18+Math.floor(i/4)*.30}:{x:[.25,.52,.76,.34,.67][i],y:[.3,.32,.35,.65,.67][i]},'role'+i));
      const garden={...emptyGarden(),objects,listener:{x:.5,y:.53},bpm:140};
      const relations={};
      if(dense)objects.forEach((a,i)=>objects.slice(i+1).forEach(b=>{relations[JSON.stringify([a.id,b.id].sort())]={a:a.id,b:b.id,sharedBeats:64};}));
      const growth={...emptyGrowth(),objects:Object.fromEntries(objects.map((o,i)=>[o.id,dense?64:[4,16,32,4,16][i]])),relations,discoveries:{object:true,relation:true}};
      localStorage.setItem(GARDEN_KEY,JSON.stringify(garden));localStorage.setItem(GROWTH_KEY,JSON.stringify(growth));localStorage.setItem('picture-score:language','ja');
    },dense);
    await page.reload();await page.getByRole('button',{name:'GARDEN',exact:true}).click();
    assert(await page.locator('.inhabitant').count()===(dense?12:5),'fixture overwritten during reload');
    if (!dense) {
      const assets = await page.locator('.growth-layer image').evaluateAll(nodes => [...new Set(nodes.map(n => n.getAttribute('href')))]);
      assert(['sprout','flower','grass','seeds','star'].every(name => assets.includes('/art/clearing-' + name + '.webp')), 'missing generated clearing asset: ' + assets.join(','));
    }
    await page.evaluate(async()=>{
      window.aliveQA={events:[],scheduled:[],starts:0,engine:null,mismatches:[]};
      const field=document.querySelector('.garden-field');
      const observer=new MutationObserver(records=>{
        const q=window.aliveQA;
        for(const record of records) {
          const node=record.target.closest?.('[data-object]');
          const type=node?.dataset.life;
          if(!node || !type || !['note','sustain-start','tap'].includes(type)) continue;
          const observedAt=performance.now()/1000;
          q.events.push({objectId:node.dataset.object,role:node.dataset.role,type,at:observedAt,observedAt});
        }
      });
      observer.observe(field,{subtree:true,attributes:true,attributeFilter:['data-life']});
      window.aliveQA.observer=observer;
    });
  }
  const field=page.getByTestId('garden-field'), work=page.locator('[data-object="role0"]');
  const listen=async()=>{ await page.evaluate(()=>{ if(window.aliveQA) window.aliveQA.starts++; }); await page.getByRole('button',{name:'庭を聴く',exact:true}).click(); };
  const stop=()=>page.getByRole('button',{name:'音を休める',exact:true}).click();
  await seed();
  await page.setViewportSize({width:1440,height:900});
  assert(await page.locator('.inhabitant-label').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).opacity==='0')),'unselected labels remain visible');
  assert(await page.locator('.inhabitant').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).backgroundImage==='none'&&getComputedStyle(n).borderWidth==='0px')),'permanent artwork card');
  await page.screenshot({path:'output/playwright/alive-desktop-rest.png',fullPage:true});
  await listen();
  await page.waitForTimeout(8500);
  const roles=await page.evaluate(()=>[...new Set(window.aliveQA.events.filter(e=>['note','sustain-start'].includes(e.type)).map(e=>e.role))]);
  assert(roles.length===5,'missing role audio events: '+roles);
  assert(await page.evaluate(()=>window.aliveQA.mismatches.length===0),'presentation did not follow event');
  await page.screenshot({path:'output/playwright/alive-desktop-playing.png',fullPage:true});
  await stop();await page.waitForTimeout(350);
  assert(await field.evaluate(n=>n.getAnimations({subtree:true}).length===0),'STOP leaked animations');
  await page.setViewportSize({width:390,height:844});await field.scrollIntoViewIfNeeded();
  assert(await page.locator('.inhabitant').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().width>=44&&n.getBoundingClientRect().height>=44)),'small touch target');
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  const point=async()=>{const b=await work.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,id:1};};
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await touch('touchStart',[await point()]);
  assert(await work.evaluate(n=>n.classList.contains('pressed')),'no immediate press');
  await touch('touchEnd',[]);
  await page.waitForFunction(()=>document.querySelector('[data-object="role0"][data-life="tap"]'));
  await page.waitForTimeout(2200);
  assert(await field.evaluate(n=>n.getAnimations({subtree:true}).length===0),'stopped audition did not rest');
  const before=await work.getAttribute('style');
  await touch('touchStart',[await point()]);await page.waitForTimeout(540);
  assert(await work.evaluate(n=>n.classList.contains('spotlight-lead')),'hold did not spotlight');
  const held=await point();await touch('touchMove',[{...held,x:held.x+40,y:held.y+40}]);await touch('touchEnd',[]);
  assert(await work.getAttribute('style')===before,'held artwork dragged');
  await page.waitForTimeout(2100);
  assert(await page.locator('.spotlight-lead').count()===0,'Spotlight did not expire');
  await touch('touchStart',[await point()]);
  const drag=await point();await touch('touchMove',[{...drag,x:drag.x+35,y:drag.y+20}]);await page.waitForTimeout(550);await touch('touchEnd',[]);
  assert(await work.getAttribute('style')!==before,'touch drag failed');
  assert(await page.locator('.spotlight-lead').count()===0,'drag caused spotlight');
  await touch('touchStart',[await point()]);await touch('touchCancel',[]);await page.waitForTimeout(550);
  assert(await page.locator('.pressed,.spotlight-lead').count()===0,'pointercancel leaked hold');
  await work.focus();await work.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-object="role0"][data-life]'));
  await page.getByRole('button',{name:'ひときわ聴く',exact:true}).click();
  assert(await work.evaluate(n=>n.classList.contains('spotlight-lead')),'accessible spotlight failed');
  await listen();const starts=await page.evaluate(()=>window.aliveQA.starts);
  await page.getByRole('combobox',{name:'Language / 言語'}).selectOption('en');
  assert(await page.getByRole('button',{name:'Pause garden',exact:true}).isVisible(),'language stopped playback');
  assert(await page.evaluate(()=>window.aliveQA.starts)===starts,'language restarted transport');
  await page.getByRole('combobox',{name:'Language / 言語'}).selectOption('ja');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(1000);
  assert(await field.evaluate(n=>n.getAnimations({subtree:true}).every(a=>{
    const frames=a.effect.getKeyframes();
    return new Set(frames.map(f=>f.transform).filter(Boolean)).size<=1 && new Set(frames.map(f=>f.strokeDashoffset).filter(Boolean)).size<=1;
  })),'reduced motion still moves');
  await page.screenshot({path:'output/playwright/alive-mobile-reduced.png',fullPage:true});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(350);
  assert(await page.evaluate(()=>!window.aliveQA.engine?.running && document.querySelector('.garden-listen')?.textContent?.includes('庭を聴く')),'page hide did not clear scheduler');
  assert(await field.evaluate(n=>n.getAnimations({subtree:true}).length===0),'page hide leaked animations');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await seed(true);await page.setViewportSize({width:390,height:844});
  await listen();await field.scrollIntoViewIfNeeded();
  const nodeCount=await field.locator('*').count();
  await page.evaluate(()=>{
    window.aliveQA.gaps=[];window.aliveQA.frames=true;let previous=performance.now();
    const step=now=>{if(!window.aliveQA.frames)return;window.aliveQA.gaps.push(now-previous);previous=now;requestAnimationFrame(step);};requestAnimationFrame(step);
  });
  const listener=page.locator('.garden-listener');await listener.focus();
  for(let i=0;i<40;i++){await listener.press(i%2?'ArrowRight':'ArrowLeft');await page.waitForTimeout(750);}
  const dense=await page.evaluate(()=>{
    const q=window.aliveQA;q.frames=false;
    const notes=q.events.filter(e=>['note','sustain-start','tap'].includes(e.type));
    const maxEvents=Math.max(0,...notes.map(e=>notes.filter(x=>x.observedAt>=e.observedAt&&x.observedAt<e.observedAt+1).length));
    const sorted=q.gaps.sort((a,b)=>a-b);
    return {objects:q.engine?.state?.objects.length ?? document.querySelectorAll('.inhabitant').length,events:notes.length,maxEvents,starts:q.starts,p95FrameMs:sorted[Math.floor(sorted.length*.95)],mismatches:q.mismatches.length,
      maxLag:Math.max(0,...notes.map(e=>e.observedAt-e.at)),queue:q.engine?.life?.pendingCount ?? 0};
  });
  assert(dense.starts===1 && dense.mismatches===0,'dense playback restart/event mismatch');
  assert(dense.maxEvents<=64 && dense.queue<=256 && dense.maxLag<.16,'dense observation caps/timing');
  assert(await field.locator('*').count()<=nodeCount+12,'runaway DOM');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
  await page.screenshot({path:'output/playwright/alive-dense-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'output/playwright/alive-dense-desktop.png',fullPage:true});
  await stop();await page.waitForTimeout(350);
  assert(await field.evaluate(n=>n.getAnimations({subtree:true}).length===0),'dense STOP cleanup');
  assert(!errors.length&&!failedAssets.length,JSON.stringify({errors,failedAssets}));
  return {roles,touch:true,keyboard:true,reducedMotion:true,pageHide:true,dense,errors,failedAssets};
}