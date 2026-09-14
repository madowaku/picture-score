// v0.9 Creator Palette browser proof: same semantic lineage, different visual world.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/art/') && response.status() >= 400) failedAssets.push(response.url());
  });

  await page.goto('http://127.0.0.1:5173/creator-palette-proof.html');
  const fixtures = ['quiet-piano','steady-beat','dense-electronic','ambient-long-tail','ornament-heavy'];

  async function choose(id) {
    await page.locator(`[data-proof-fixture-id="${id}"]`).click();
    await page.waitForTimeout(80);
  }

  async function seekEnd() {
    const slider = page.getByRole('slider',{name:'Creator Palette proof time'});
    await slider.fill(await slider.getAttribute('max'));
    await page.waitForTimeout(120);
  }

  async function report() {
    return page.evaluate(() => [...document.querySelectorAll('[data-proof-world]')].map(world => {
      const stage = world.querySelector('[data-proof-stage]');
      const nodes = [...world.querySelectorAll('[data-score-bloom-entity]')];
      const roleY = {};
      for (const role of ['melody','harmony','rhythm','ornament','resonance']) {
        const values = nodes
          .filter(node => node.getAttribute('data-score-bloom-role') === role)
          .map(node => {
            const match = node.getAttribute('transform')?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
            return match ? Number(match[2]) : NaN;
          })
          .filter(Number.isFinite);
        roleY[role] = values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
      }
      return {
        palette: world.getAttribute('data-proof-palette'),
        counts: JSON.parse(world.getAttribute('data-proof-role-counts')),
        worldEvents: JSON.parse(world.getAttribute('data-proof-world-events')).slice().sort(),
        musicalEvents: JSON.parse(world.getAttribute('data-proof-musical-events')).slice().sort(),
        assets: nodes.map(node => node.getAttribute('data-score-bloom-asset')),
        motions: nodes.map(node => node.getAttribute('data-score-bloom-motion')),
        roleY,
        visible: nodes.length,
        stageWidth: stage.getBoundingClientRect().width,
      };
    }));
  }

  function assertMeaning(id, counts) {
    const total = Object.values(counts).reduce((sum,value)=>sum+value,0);
    if(id==='quiet-piano') {
      assert(total<=5 && counts.rhythm===0 && counts.ornament===0 && counts.resonance===0,'quiet meaning drift');
    }
    if(id==='steady-beat') {
      assert(counts.rhythm>(total-counts.rhythm)*2,'steady beat lost rhythm dominance');
    }
    if(id==='dense-electronic') {
      assert(Object.values(counts).every(value=>value>0),'dense lost one of five roles');
    }
    if(id==='ambient-long-tail') {
      assert(counts.resonance>=counts.melody && counts.resonance>=counts.harmony,'ambient lost resonance dominance');
    }
    if(id==='ornament-heavy') {
      assert(counts.ornament>=total-counts.ornament,'ornament lost dominance');
    }
  }

  for (const viewport of [{width:390,height:844},{width:1440,height:900}]) {
    await page.setViewportSize(viewport);
    for (const id of fixtures) {
      await choose(id);
      await seekEnd();
      const [clearing, prism] = await report();
      assert(clearing.palette==='clearing' && prism.palette==='prism-proof','palette identity mismatch');
      assert(JSON.stringify(clearing.worldEvents)===JSON.stringify(prism.worldEvents),'WorldEvent lineage changed across palettes');
      assert(JSON.stringify(clearing.musicalEvents)===JSON.stringify(prism.musicalEvents),'MusicalEvent lineage changed across palettes');
      assertMeaning(id, clearing.counts);
      assertMeaning(id, prism.counts);
      assert(clearing.assets.every(value=>value?.startsWith('clearing-')),'Clearing asset vocabulary leaked');
      assert(prism.assets.every(value=>value?.startsWith('prism-')),'Prism asset vocabulary leaked');
      assert(!clearing.assets.some(value=>prism.assets.includes(value)),'palettes share visual asset ids');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+viewport.width+' '+id);
    }
  }

  // Dense fixture should visibly occupy a different spatial grammar, not just swap files.
  await page.setViewportSize({width:1440,height:900});
  await choose('dense-electronic');
  await seekEnd();
  let [clearing, prism] = await report();
  const shiftedRoles = ['melody','harmony','rhythm','ornament','resonance'].filter(role =>
    clearing.roleY[role] != null && prism.roleY[role] != null && Math.abs(clearing.roleY[role]-prism.roleY[role]) >= 70,
  );
  assert(shiftedRoles.length>=3,'visual grammar is not distinct enough: '+JSON.stringify({shiftedRoles,clearing:clearing.roleY,prism:prism.roleY}));

  const before = await page.locator('.score-bloom-layer').evaluateAll(nodes=>nodes.map(node=>node.innerHTML));
  const slider = page.getByRole('slider',{name:'Creator Palette proof time'});
  await slider.fill('0'); await page.waitForTimeout(80); await seekEnd();
  const after = await page.locator('.score-bloom-layer').evaluateAll(nodes=>nodes.map(node=>node.innerHTML));
  assert(JSON.stringify(before)===JSON.stringify(after),'palette replay is not deterministic');
  await page.screenshot({path:'output/playwright/creator-palette-dense-desktop.jpg',type:'jpeg',quality:80,fullPage:true});

  // Reduced Motion must preserve semantic identity in both worlds.
  await page.getByRole('checkbox',{name:'Creator proof reduced motion'}).check();
  await choose('ambient-long-tail');
  await seekEnd();
  [clearing, prism] = await report();
  assert([...clearing.motions,...prism.motions].every(value=>value==='none'),'reduced motion differs across palettes');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/playwright/creator-palette-ambient-mobile.jpg',type:'jpeg',quality:80,fullPage:true});

  const perf = await page.evaluate(async () => {
    const { ScoreBloomSession } = await import('/src/world/runtime/ScoreBloomSession.ts');
    const { clearingPalette, prismProofPalette } = await import('/src/palettes/index.ts');
    const { coreMeaningFixture } = await import('/src/qa/coreMeaningFixtures.ts');
    const fixture = coreMeaningFixture('dense-electronic');
    const measure = palette => {
      const session = new ScoreBloomSession({trackId:'perf',seed:'perf',timeline:structuredClone(fixture.timeline),palette,reducedMotion:false});
      const started = performance.now();
      for(let i=0;i<60;i++) { session.seek(fixture.timeline.duration); session.seek(0); }
      return performance.now()-started;
    };
    return {clearingMs:measure(clearingPalette),prismMs:measure(prismProofPalette)};
  });
  assert(perf.clearingMs<500 && perf.prismMs<500,'palette replay performance regression: '+JSON.stringify(perf));

  assert(!errors.length && !failedAssets.length,JSON.stringify({errors,failedAssets}));
  return {shiftedRoles,performance:perf,reducedMotion:true,errors,failedAssets};
}
