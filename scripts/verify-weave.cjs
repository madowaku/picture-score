// Isolated browser fixtures for the persistent WEAVE relationship landscape.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); }, errors = [], failedAssets = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/art/') && r.status() >= 400) failedAssets.push(r.url()); });
  async function fixture(config) {
    await page.reload();
    await page.evaluate(async ({ count, positions, growthBeats, relations, weave }) => {
      const { emptyProject } = await import('/src/music/project.ts');
      const { exampleStrokes } = await import('/src/music/examples.ts');
      const { emptyGarden, makeObject, GARDEN_KEY } = await import('/src/garden/gardenState.ts');
      const { emptyGrowth, GROWTH_KEY } = await import('/src/garden/growth.ts');
      const garden = { ...emptyGarden(), objects:Array.from({length:count}, (_,i) => makeObject(
        {...emptyProject(), strokes:exampleStrokes(i % 2 ? 'wave' : 'heart'), title:'weave-'+i},
        positions[i], 'weave-'+i)) };
      const growth = {...emptyGrowth(), objects:Object.fromEntries(garden.objects.map(o => [o.id, growthBeats])), relations:relations || {}, discoveries:{object:growthBeats > 0, relation:Object.keys(relations || {}).length > 0}};
      localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));
      localStorage.setItem(GROWTH_KEY, JSON.stringify(growth));
      localStorage.setItem('picture-score:weave:v1', JSON.stringify(weave || {version:1,formations:{}}));
      localStorage.setItem('picture-score:language', 'ja');
    }, config);
    await page.reload();
    await page.getByRole('button',{name:'GARDEN',exact:true}).click();
    await page.locator('.garden-field').scrollIntoViewIfNeeded();
    assert(await page.locator('.weave-layer').count() === 1, 'weave layer');
  }
  async function raster() {
    return page.evaluate(async () => {
      const svg = document.querySelector('.weave-layer');
      const clone = svg.cloneNode(true), original = [...svg.querySelectorAll('*')], copied = [...clone.querySelectorAll('*')];
      original.forEach((node,i) => { const css=getComputedStyle(node); for (const prop of ['fill','stroke','stroke-width','stroke-dasharray','opacity','mask-type']) copied[i].style.setProperty(prop,css.getPropertyValue(prop)); });
      for (const img of clone.querySelectorAll('image')) {
        const blob = await (await fetch(img.getAttribute('href'))).blob();
        const url = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        img.setAttribute('href',url);
      }
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg'); clone.setAttribute('width','1000'); clone.setAttribute('height','1000');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
      const image = new Image(); image.src=url; await image.decode();
      const canvas=document.createElement('canvas'); canvas.width=canvas.height=1000; const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0); URL.revokeObjectURL(url);
      const pixels=ctx.getImageData(0,0,1000,1000).data; let interior=0,painted=0;
      const clearings=[...svg.querySelectorAll('[data-weave-clearing]')].map(n=>({x:+n.getAttribute('cx'),y:+n.getAttribute('cy'),rx:+n.getAttribute('rx'),ry:+n.getAttribute('ry')}));
      for(let y=0;y<1000;y++) for(let x=0;x<1000;x++) { const alpha=pixels[(y*1000+x)*4+3]; if(alpha) painted++; if(alpha && clearings.some(e=>Math.hypot((x+.5-e.x)/e.rx,(y+.5-e.y)/e.ry)<.96)) interior++; }
      return {interior,painted,paths:svg.querySelectorAll('[data-weave-path]').length,patches:svg.querySelectorAll('[data-weave-patch]').length,trails:svg.querySelectorAll('[data-weave-trail]').length};
    });
  }
  const positions = { pair:[{x:.25,y:.42},{x:.75,y:.42}], close:[{x:.47,y:.42},{x:.53,y:.42}], six:Array.from({length:6},(_,i)=>({x:.18+(i%3)*.32,y:.26+Math.floor(i/3)*.48})), twelve:Array.from({length:12},(_,i)=>({x:.13+(i%4)*.25,y:.17+Math.floor(i/4)*.33})), cascade:Array.from({length:4},(_,i)=>({x:.10+i*.27,y:.45})), round:[{x:.22,y:.28},{x:.5,y:.26},{x:.36,y:.64}] };
  const pairRelations = {'["weave-0","weave-1"]':{a:'weave-0',b:'weave-1',sharedBeats:64}};
  await page.setViewportSize({width:1440,height:900});
  await fixture({count:2,positions:positions.pair,growthBeats:64,relations:pairRelations});
  const pair=await raster(); assert(pair.patches>0 && pair.paths<=8 && !pair.interior,'pair landscape: '+JSON.stringify(pair));
  await page.screenshot({path:'output/playwright/weave-pair-desktop.jpg',type:'jpeg',quality:78});
  await fixture({count:2,positions:positions.close,growthBeats:0,relations:{}});
  const quiet=await raster(); assert(quiet.patches===0 && quiet.paths===0 && quiet.trails===0,'proximity created scenery: '+JSON.stringify(quiet));
  await fixture({count:6,positions:positions.six,growthBeats:64,relations:Object.fromEntries([[0,1],[2,3],[4,5]].map(([a,b])=>['["weave-'+a+'","weave-'+b+'"]',{a:'weave-'+a,b:'weave-'+b,sharedBeats:64}]))});
  const six=await raster(); assert(six.paths<=8 && !six.interior,'six bounds: '+JSON.stringify(six));
  await fixture({count:12,positions:positions.twelve,growthBeats:64,relations:Object.fromEntries([[0,1],[2,3],[4,5],[6,7],[8,9],[10,11]].map(([a,b])=>['["weave-'+a+'","weave-'+b+'"]',{a:'weave-'+a,b:'weave-'+b,sharedBeats:64}]))});
  const dense=await raster(); assert(dense.paths<=8 && !dense.interior && dense.patches<=24,'twelve bounds: '+JSON.stringify(dense));
  await page.screenshot({path:'output/playwright/weave-twelve-desktop.jpg',type:'jpeg',quality:78});
  const cascadeFormation={version:1,formations:{'garden-lineup-cascade:weave-0|weave-1|weave-2|weave-3':{rule:'garden-lineup-cascade',objectIds:['weave-0','weave-1','weave-2','weave-3'],repetitions:3}}};
  await page.setViewportSize({width:390,height:844});
  await fixture({count:4,positions:positions.cascade,growthBeats:0,relations:{},weave:cascadeFormation});
  const cascade=await raster(); assert(cascade.trails>0 && !cascade.interior,'cascade trail: '+JSON.stringify(cascade));
  const roundFormation={version:1,formations:{'garden-triad-round:weave-0|weave-1|weave-2':{rule:'garden-triad-round',objectIds:['weave-2','weave-0','weave-1'],repetitions:3}}};
  await fixture({count:3,positions:positions.round,growthBeats:0,relations:{},weave:roundFormation});
  const round=await raster(); assert(round.patches>0 && !round.interior,'round patch: '+JSON.stringify(round));
  await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),'reduced motion media');
  await page.screenshot({path:'output/playwright/weave-round-mobile-reduced.jpg',type:'jpeg',quality:78});
  assert(!errors.length && !failedAssets.length,JSON.stringify({errors,failedAssets}));
  return {pair,quiet,six,dense,cascade,round,errors,failedAssets};
}