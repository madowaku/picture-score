// Browser release gate for v0.9 SCORE BLOOM Garden integration.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/art/') && response.status() >= 400) failedAssets.push(response.url());
  });

  async function fixture(count = 4) {
    await page.reload();
    await page.evaluate(async ({ count }) => {
      const { emptyProject } = await import('/src/music/project.ts');
      const { exampleStrokes } = await import('/src/music/examples.ts');
      const { emptyGarden, makeObject, GARDEN_KEY } = await import('/src/garden/gardenState.ts');
      const { emptyGrowth, GROWTH_KEY } = await import('/src/garden/growth.ts');
      const line = points => [{ id:'line', points:points.map(([x,y],time)=>({x,y,time,pressure:.5})) }];
      const shapes = [
        exampleStrokes('cat'),
        exampleStrokes('wave'),
        line([[500,160],[510,190],[540,190],[515,210],[525,240],[500,220],[475,240],[485,210],[460,190],[490,190],[500,160]]),
        line([[500,30],[510,390]]),
      ];
      const positions = Array.from({length:count}, (_, i) => count === 12
        ? {x:.13+(i%4)*.25,y:.17+Math.floor(i/4)*.33}
        : {x:.26+(i%2)*.48,y:.27+Math.floor(i/2)*.44});
      const garden = { ...emptyGarden(), objects:Array.from({length:count}, (_,i)=>makeObject(
        {...emptyProject(),strokes:shapes[i%shapes.length],title:'bloom-'+i}, positions[i], 'bloom-'+i)) };
      localStorage.setItem(GARDEN_KEY, JSON.stringify(garden));
      localStorage.setItem(GROWTH_KEY, JSON.stringify(emptyGrowth()));
      localStorage.setItem('picture-score:weave:v1', JSON.stringify({version:1,formations:{}}));
      localStorage.setItem('picture-score:language', 'ja');
    }, { count });
    await page.reload();
    await page.getByRole('button',{name:'GARDEN',exact:true}).click();
    await page.locator('.garden-field').scrollIntoViewIfNeeded();
    assert(await page.locator('.inhabitant').count() === count, 'fixture count');
    assert(await page.locator('.score-bloom-layer').count() === 1, 'score bloom layer missing');
  }

  async function startAndSeek(time) {
    await page.getByRole('button',{name:'庭を聴く'}).click();
    await page.waitForTimeout(120);
    await page.getByRole('button',{name:'IR',exact:true}).click();
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    const range = page.getByRole('slider',{name:'SCORE BLOOM seek'});
    await range.fill(String(time));
    await page.waitForTimeout(650);
    const header = await page.locator('.score-bloom-debug header').innerText();
    assert(header.includes(Number(time).toFixed(2)+'s'), 'seek time mismatch: '+header);
  }

  async function raster() {
    return page.evaluate(async () => {
      const svg = document.querySelector('.score-bloom-layer');
      const clone = svg.cloneNode(true), original = [...svg.querySelectorAll('*')], copied = [...clone.querySelectorAll('*')];
      original.forEach((node,i) => {
        const css=getComputedStyle(node);
        for(const prop of ['fill','stroke','stroke-width','stroke-dasharray','opacity','mask-type','transform','transform-origin'])
          copied[i].style.setProperty(prop,css.getPropertyValue(prop));
      });
      for (const img of clone.querySelectorAll('image')) {
        const response = await fetch(img.getAttribute('href'));
        const blob = await response.blob();
        const url = await new Promise(resolve => {
          const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob);
        });
        img.setAttribute('href', url);
      }
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
      clone.setAttribute('width','1000'); clone.setAttribute('height','1000');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
      const image = new Image(); image.src=url; await image.decode();
      const canvas=document.createElement('canvas'); canvas.width=canvas.height=1000;
      const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0); URL.revokeObjectURL(url);
      const pixels=ctx.getImageData(0,0,1000,1000).data;
      const clearings=[...svg.querySelectorAll('[data-clearing]')].map(n=>({x:+n.getAttribute('cx'),y:+n.getAttribute('cy'),rx:+n.getAttribute('rx'),ry:+n.getAttribute('ry')}));
      let interior=0, painted=0;
      for(let y=0;y<1000;y+=2) for(let x=0;x<1000;x+=2) {
        const alpha=pixels[(y*1000+x)*4+3];
        if(alpha) painted++;
        if(alpha && clearings.some(e=>Math.hypot((x+.5-e.x)/e.rx,(y+.5-e.y)/e.ry)<.95)) interior++;
      }
      return {
        interior, painted,
        rendered:+svg.dataset.scoreBloomEntities,
        entities:svg.querySelectorAll('[data-score-bloom-entity]').length,
      };
    });
  }

  const results=[];
  for (const viewport of [{width:360,height:800},{width:390,height:844},{width:1440,height:900}]) {
    await page.setViewportSize(viewport);
    await fixture(4);
    await startAndSeek(3);
    const check=await raster();
    assert(check.entities>0 && check.rendered>0 && check.painted>0,'missing score bloom pigment: '+JSON.stringify(check));
    assert(!check.interior,'score bloom painted over source art: '+JSON.stringify(check));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+viewport.width);
    const trace=await page.locator('.score-bloom-debug-trace').innerText();
    assert(trace.includes('MusicalEvent')&&trace.includes('WorldEvent')&&trace.includes('PaletteCue')&&trace.includes('Entity'),'lineage trace missing');

    const before=await page.locator('.score-bloom-layer').innerHTML();
    const countBefore=await page.locator('[data-score-bloom-entity]').count();
    const range=page.getByRole('slider',{name:'SCORE BLOOM seek'});
    await range.fill('0'); await page.waitForTimeout(80); await range.fill('3'); await page.waitForTimeout(80);
    const after=await page.locator('.score-bloom-layer').innerHTML();
    assert(before===after,'seek replay changed deterministic layer at '+viewport.width);
    assert(await page.locator('[data-score-bloom-entity]').count()===countBefore,'seek duplicated entities');

    const pausedBefore=await page.locator('.score-bloom-debug header').innerText();
    await page.waitForTimeout(350);
    assert(await page.locator('.score-bloom-debug header').innerText()===pausedBefore,'paused semantic time advanced');
    await page.getByRole('button',{name:'Resume',exact:true}).click();
    await page.waitForTimeout(350);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    const resumed=await page.locator('.score-bloom-debug header').innerText();
    assert(resumed!==pausedBefore,'resume did not advance semantic time');

    await page.screenshot({path:`output/playwright/score-bloom-${viewport.width}.jpg`,type:'jpeg',quality:78,fullPage:true});
    results.push({viewport,...check});
  }

  await page.setViewportSize({width:390,height:844});
  await fixture(12);
  await startAndSeek(4);
  const dense=await raster();
  assert(dense.entities>0 && dense.rendered>0 && !dense.interior,'dense score bloom failure: '+JSON.stringify(dense));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'dense horizontal overflow');
  await page.screenshot({path:'output/playwright/score-bloom-dense-mobile.jpg',type:'jpeg',quality:78,fullPage:true});

  await page.emulateMedia({reducedMotion:'reduce'});
  await fixture(4);
  await startAndSeek(3);
  const motions=await page.locator('[data-score-bloom-entity]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-score-bloom-motion')));
  assert(motions.length>0 && motions.every(value=>value==='none'),'reduced motion fallback failed: '+JSON.stringify(motions));
  await page.screenshot({path:'output/playwright/score-bloom-mobile-reduced.jpg',type:'jpeg',quality:78,fullPage:true});

  assert(!errors.length&&!failedAssets.length,JSON.stringify({errors,failedAssets}));
  return {results,dense,reducedMotion:true,errors,failedAssets};
}