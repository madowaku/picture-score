// v0.9 Core Meaning QA browser gate. This verifies perceptual proxies and creates
// blind-review screenshots; the 4/5 human identification criterion remains manual.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/art/') && response.status() >= 400) failedAssets.push(response.url());
  });

  await page.goto('http://127.0.0.1:5173/core-meaning-qa.html');
  const fixtures = ['quiet-piano','steady-beat','dense-electronic','ambient-long-tail','ornament-heavy'];
  const reports = [];

  async function choose(id) {
    await page.locator(`[data-qa-fixture-id="${id}"]`).click();
    await page.waitForTimeout(60);
    assert(await page.locator('[data-qa-answer]').count() === 0, 'blind answer leaked for '+id);
  }

  async function seek(time) {
    const slider = page.getByRole('slider',{name:'Core Meaning QA time'});
    await slider.fill(String(time));
    await page.waitForTimeout(100);
  }

  async function seekEnd() {
    const slider = page.getByRole('slider',{name:'Core Meaning QA time'});
    const max = Number(await slider.getAttribute('max'));
    await seek(max);
  }

  async function report() {
    return page.evaluate(() => {
      const nodes=[...document.querySelectorAll('[data-score-bloom-entity]')];
      const counts={melody:0,harmony:0,rhythm:0,ornament:0,resonance:0};
      for(const node of nodes) counts[node.getAttribute('data-score-bloom-role')]++;
      return {
        total:nodes.length,
        counts,
        roles:Object.entries(counts).filter(([,value])=>value>0).map(([role])=>role),
        motions:nodes.map(node=>node.getAttribute('data-score-bloom-motion')),
        births:nodes.map(node=>node.getAttribute('data-score-bloom-birth')),
        overflow:document.documentElement.scrollWidth-innerWidth,
      };
    });
  }

  function semanticAssertions(id, value, viewport) {
    const non = role => value.total-value.counts[role];
    assert(value.overflow <= 0, `horizontal overflow ${id} ${viewport.width}`);
    if(id==='quiet-piano') {
      assert(value.total>0 && value.total<=5,'quiet is not visually quiet: '+JSON.stringify(value));
      assert(value.counts.rhythm===0 && value.counts.ornament===0 && value.counts.resonance===0,'quiet leaked unrelated roles');
    }
    if(id==='steady-beat') {
      assert(value.counts.rhythm>0 && value.counts.rhythm>=non('rhythm')*2,'beat not rhythm-led: '+JSON.stringify(value));
      assert(value.motions.every((motion,index)=>value.births[index]!=='pop'||motion==='none'),'rhythm made persistent motion');
    }
    if(id==='dense-electronic') {
      const cap=viewport.width<=390?34:viewport.width<=720?40:48;
      assert(value.roles.length>=4,'dense lost semantic roles: '+JSON.stringify(value));
      assert(value.total<=cap,'dense collapsed into clutter: '+JSON.stringify({cap,...value}));
    }
    if(id==='ambient-long-tail') {
      assert(value.counts.resonance>0 && value.counts.resonance>=value.counts.melody && value.counts.resonance>=value.counts.harmony,'ambient resonance is not legible: '+JSON.stringify(value));
    }
    if(id==='ornament-heavy') {
      assert(value.counts.ornament>0 && value.counts.ornament>=non('ornament'),'ornament is not visually primary: '+JSON.stringify(value));
    }
  }

  const viewports=[
    {width:360,height:800},
    {width:390,height:844},
    {width:720,height:1280},
    {width:1440,height:900},
  ];

  for(const viewport of viewports) {
    await page.setViewportSize(viewport);
    for(const id of fixtures) {
      await choose(id);
      await seekEnd();
      const value=await report();
      semanticAssertions(id,value,viewport);
      await page.screenshot({path:`output/playwright/core-meaning-${id}-${viewport.width}.jpg`,type:'jpeg',quality:76,fullPage:true});
      reports.push({viewport,id,...value});
    }
  }

  // Temporal semantics: the roles need to arrive with different musical meanings,
  // not merely coexist in an end-state still image.
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});

  await choose('quiet-piano');
  await seek(0.4);
  let temporal=await report();
  assert(temporal.counts.harmony===0,'harmony bloomed before change');
  await seek(0.6);
  temporal=await report();
  assert(temporal.counts.harmony===1,'harmony change did not create a distinct bloom');
  await seek(1.0);
  assert(await page.locator('[data-score-bloom-role="melody"][data-score-bloom-reaction-revision="1"]').count()>0,'melody birth did not visibly grow/react');

  await choose('steady-beat');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForTimeout(1650);
  temporal=await report();
  assert(temporal.counts.rhythm>=2 && temporal.counts.rhythm<=5,'steady beat did not arrive as local sequential pulses: '+JSON.stringify(temporal));
  assert(temporal.births.some(value=>value==='pop'),'rhythm pulse lacks pop birth');
  await page.getByRole('button',{name:'Pause',exact:true}).click();

  await choose('ambient-long-tail');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForTimeout(1050);
  temporal=await report();
  assert(temporal.counts.resonance===1 && temporal.motions.includes('sway'),'first long-tail resonance did not establish a quiet grass sway');
  await page.getByRole('button',{name:'Pause',exact:true}).click();

  await choose('ornament-heavy');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForTimeout(1550);
  temporal=await report();
  assert(temporal.counts.ornament>=2 && temporal.motions.includes('twinkle'),'ornament moments are not brief high-information twinkles');
  await page.getByRole('button',{name:'Pause',exact:true}).click();

  // Reduced motion must keep role identity while removing continuous motion.
  await page.getByRole('checkbox',{name:'Reduced motion'}).check();
  for(const id of fixtures) {
    await choose(id);await seekEnd();
    const value=await report();
    assert(value.total>0,'reduced motion erased meaning for '+id);
    assert(value.motions.every(motion=>motion==='none'),'reduced motion still animates '+id+': '+JSON.stringify(value.motions));
  }
  await page.screenshot({path:'output/playwright/core-meaning-reduced-390.jpg',type:'jpeg',quality:76,fullPage:true});

  // Product-surface smoke: the QA harness must not disturb normal DRAW/GARDEN navigation.
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'DRAW',exact:true}).click();
  assert(await page.getByRole('button',{name:'GARDEN',exact:true}).count()===1,'DRAW navigation lost GARDEN');
  await page.getByRole('button',{name:'GARDEN',exact:true}).click();
  assert(await page.locator('.garden-field').count()===1,'GARDEN unusable after core meaning QA');

  assert(!errors.length && !failedAssets.length,JSON.stringify({errors,failedAssets}));
  return {reports,reducedMotion:true,productSmoke:true,errors,failedAssets};
}
