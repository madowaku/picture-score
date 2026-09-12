// Isolated browser fixtures only. Checks real SVG pixels, responsive ink, and mature density.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); }, errors = [], failedAssets = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/art/') && r.status() >= 400) failedAssets.push(r.url()); });
  async function fixture(beats, count = 4, close = false) {
    await page.reload(); // flush the preceding UI before replacing its saved fixture
    await page.evaluate(async ({ beats, count, close }) => {
      const { emptyProject } = await import('/src/music/project.ts');
      const { exampleStrokes } = await import('/src/music/examples.ts');
      const { emptyGarden, makeObject, GARDEN_KEY } = await import('/src/garden/gardenState.ts');
      const { emptyGrowth, GROWTH_KEY, pairKey } = await import('/src/garden/growth.ts');
      const line = points => [{ id:'line', points:points.map(([x,y],time)=>({x,y,time,pressure:.5})) }];
      const shapes = [exampleStrokes('cat'), exampleStrokes('wave'),
        line([[500,160],[510,190],[540,190],[515,210],[525,240],[500,220],[475,240],[485,210],[460,190],[490,190],[500,160]]),
        line([[500,30],[510,390]])];
      const garden = { ...emptyGarden(), objects:Array.from({length:count}, (_,i)=>makeObject(
        {...emptyProject(),strokes:shapes[i%4],title:['ねこの庭','波のうた','小さな星','のびる音'][i%4]},
        close ? {x:.48+i*.02,y:.45} : count === 12 ? {x:.15+i%4*.23,y:.18+Math.floor(i/4)*.31} :
        {x:.28+i%2*.44,y:.27+Math.floor(i/2)*.43}, 'clearing-'+i)) };
      const relations = {};
      garden.objects.forEach((a,i)=>garden.objects.slice(i+1).forEach(b=>{
        relations[pairKey(a.id,b.id)]={a:a.id,b:b.id,sharedBeats:beats ? 64 : 0};
      }));
      localStorage.setItem(GARDEN_KEY,JSON.stringify(garden));
      localStorage.setItem(GROWTH_KEY,JSON.stringify({...emptyGrowth(),objects:Object.fromEntries(garden.objects.map(o=>[o.id,beats])),
        relations,discoveries:{object:true,relation:true}}));
      localStorage.setItem('picture-score:language','ja');
      window.fixtureSource=JSON.stringify(garden.objects.map(o=>[o.project,o.strokeIR,o.scoreIR,o.musicIR]));
    }, { beats, count, close });
    await page.reload();
    await page.getByRole('button',{name:'GARDEN',exact:true}).click();
    assert(await page.locator('.inhabitant').count() === count, 'fixture count');
    await page.locator('.garden-field').scrollIntoViewIfNeeded();
  }
  async function verifyPixels() {
    return page.evaluate(async () => {
      const svg = document.querySelector('.growth-layer'), clone = svg.cloneNode(true);
      const original = [...svg.querySelectorAll('*')], copied = [...clone.querySelectorAll('*')];
      // Inline the live computed presentation, so masks, opacity and strokes match the page.
      original.forEach((node,i) => {
        const css=getComputedStyle(node);
        for(const prop of ['fill','stroke','stroke-width','stroke-dasharray','opacity','mask-type']) copied[i].style.setProperty(prop,css.getPropertyValue(prop));
      });
      for (const img of clone.querySelectorAll('image')) {
        const blob=await (await fetch(img.getAttribute('href'))).blob();
        const url=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
        img.setAttribute('href',url);
      }
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
      clone.setAttribute('width','1000');clone.setAttribute('height','1000');
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
      const image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1000;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);URL.revokeObjectURL(url);
      const pixels=ctx.getImageData(0,0,1000,1000).data;
      let interior=0,painted=0;
      const clearings=[...svg.querySelectorAll('[data-clearing]')].map(n=>({id:n.dataset.clearing,x:+n.getAttribute('cx'),y:+n.getAttribute('cy'),rx:+n.getAttribute('rx'),ry:+n.getAttribute('ry')}));
      for(let y=0;y<1000;y++)for(let x=0;x<1000;x++){
        const alpha=pixels[(y*1000+x)*4+3];if(alpha)painted++;
        if(alpha && clearings.some(e=>Math.hypot((x+.5-e.x)/e.rx,(y+.5-e.y)/e.ry)<.96))interior++;
      }
      // Verify the actual browser-rendered ink fits the approximate clearing, without production DOM reads.
      let outsideInk=0,maxInkRadius=0;
      const field=svg.getBoundingClientRect();
      for(const e of clearings) {
        const artwork=document.querySelector('[data-object="'+e.id+'"] .inhabitant-svg');
        for(const p of artwork.querySelectorAll('.inhabitant-ink path')) {
          const matrix=p.getScreenCTM(), length=p.getTotalLength();
          for(let t=0;t<=40;t++) {
            const point=p.getPointAtLength(length*t/40).matrixTransform(matrix);
            const x=(point.x-field.x)/field.width*1000,y=(point.y-field.y)/field.height*1000;
            const radius=Math.hypot((x-e.x)/e.rx,(y-e.y)/e.ry);
            maxInkRadius=Math.max(maxInkRadius,radius);if(radius>=1)outsideInk++;
          }
        }
      }
      return {interior,painted,outsideInk,maxInkRadius,marks:svg.querySelectorAll('image').length,paths:svg.querySelectorAll('.growth-path').length};
    });
  }
  const results=[];
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:900});
    for(const beats of [0,4,64]) {
      await fixture(beats);
      const check=await verifyPixels();
      assert(!check.interior && !check.outsideInk,'growth/ink clearing failure: '+JSON.stringify(check));
      if(beats)assert(check.painted>0 && check.marks>0 && check.marks<=32,'missing or unbounded growth');
      assert(await page.locator('.inhabitant-label').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).opacity==='0')),'selected readability fixture');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
      await page.screenshot({path:'output/playwright/clearing-'+width+'-stage-'+beats+'.jpg',type:'jpeg',quality:75,fullPage:true});
      results.push({width,beats,...check});
    }
  }
  await fixture(64,2,true);
  assert(await page.locator('.growth-path').count()===0,'close-pair path knot');
  const close=await verifyPixels();assert(!close.interior,'close-pair intrusion');
  await page.screenshot({path:'output/playwright/clearing-close-mobile.jpg',type:'jpeg',quality:75,fullPage:true});
  await fixture(64,12);
  const dense=await verifyPixels();
  assert(!dense.interior&&!dense.outsideInk&&dense.marks>0&&dense.marks<=96&&dense.paths<=24,'dense bounds');
  await page.screenshot({path:'output/playwright/clearing-dense-mobile.jpg',type:'jpeg',quality:75,fullPage:true});
  const shape=await page.locator('.growth-layer').innerHTML();
  await page.reload();await page.getByRole('button',{name:'GARDEN',exact:true}).click();
  assert(await page.locator('.growth-layer').innerHTML()===shape,'reload changed habitats');
  const work=page.locator('[data-object="clearing-0"]');
  const before=await work.getAttribute('style');await work.focus();await work.press('ArrowRight');
  assert(await work.getAttribute('style')!==before,'mature artwork cannot move');
  const moved=await verifyPixels();assert(!moved.interior&&!moved.outsideInk,'drag broke mask');
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'output/playwright/clearing-dense-desktop.jpg',type:'jpeg',quality:75,fullPage:true});
  assert(!errors.length&&!failedAssets.length,JSON.stringify({errors,failedAssets}));
  return {results,close,dense,moved,deterministic:true,errors,failedAssets};
}
