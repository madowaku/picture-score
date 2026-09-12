async (page) => {
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'no-preference'});
  async function seed(mode) {
    await page.reload();
    await page.evaluate(async mode=>{
      const {emptyProject}=await import('/src/music/project.ts'),{exampleStrokes}=await import('/src/music/examples.ts');
      const {emptyGarden,makeObject,GARDEN_KEY}=await import('/src/garden/gardenState.ts');
      const stroke=(id,pts)=>({id,points:pts.map(([x,y],time)=>({x,y,time,pressure:.5}))});
      const line=stroke('line',[[100,280],[300,130],[600,190]]);
      const cross=[stroke('a',[[100,80],[850,340]]),stroke('b',[[100,340],[850,80]])];
      const retrace=[line,{...line,id:'repeat'}];
      const coords=mode==='call'?[[.4,.4],[.49,.4]]:mode==='source'?[[.3,.3],[.7,.31],[.5,.7]]:[[.32,.4],[.5,.4],[.68,.4]];
      const objects=coords.map(([x,y],i)=>makeObject({...emptyProject(),title:['こもれび','ひかり','そよかぜ'][i],
        strokes:mode==='source'?[exampleStrokes('heart'),cross,retrace][i]:exampleStrokes('wave')},{x,y},'w'+i));
      localStorage.setItem(GARDEN_KEY,JSON.stringify({...emptyGarden(),bpm:140,listener:mode==='source'?{x:.3,y:.3}:{x:.5,y:.5},objects}));
      localStorage.removeItem('picture-score:growth:v1');localStorage.setItem('picture-score:language','ja');
    },mode);
    await page.reload();await page.getByRole('button',{name:'GARDEN',exact:true}).click();
    assert(await page.locator('.inhabitant').count()===(mode==='call'?2:3),'fixture overwritten');
    await page.evaluate(async()=>{
      const {GardenTransport}=await import('/src/garden/gardenTransport.ts');
      const original=GardenTransport.prototype.start;
      window.wonderLifeQA={events:[],scheduled:[],mismatches:[],starts:0};
      GardenTransport.prototype.start=async function(garden){
        const q=window.wonderLifeQA;q.starts++;q.engine=this;
        if(!this.observed){
          this.observed=true;const enqueue=this.life.enqueue.bind(this.life),observer=this.onLifeEvent;
          this.life.enqueue=e=>{q.scheduled.push(structuredClone(e));enqueue(e);};
          this.onLifeEvent=e=>{
            observer?.(e);if(!e)return;
            q.events.push(structuredClone(e));
            const node=document.querySelector('[data-object="'+e.objectId+'"]');
            if(e.formation && node?.dataset.lifeFormation!==e.formation)q.mismatches.push('formation');
            if(e.source?.spark && node?.querySelector('.life-spark').getAttribute('transform')!=='translate('+e.source.spark.x+','+e.source.spark.y+')')q.mismatches.push('spark');
            if(e.source?.mirror && node?.dataset.lifeSide!==e.source.mirror)q.mismatches.push('mirror');
          };
        }
        return original.call(this,garden);
      };
    });
    await page.getByRole('button',{name:'庭を聴く',exact:true}).click();
  }
  await seed('call');await page.waitForTimeout(20500);
  const call=await page.evaluate(()=>{
    const q=window.wonderLifeQA,events=q.events.filter(e=>e.relation==='call-response'&&['note','sustain-start'].includes(e.type));
    return {speakers:[...new Set(events.map(e=>e.objectId))],windows:events.map(e=>({id:e.objectId,beat:e.beat})),starts:q.starts};
  });
  assert(call.speakers.length===2&&call.starts===1,'call/response did not alternate');
  assert(call.windows.every(e=>e.id===(((Math.floor((e.beat+.02)/16)+Math.floor(((e.beat+.02)%16)/8))%2===0)?'w0':'w1')),'call/response windows mismatch');
  await page.getByRole('button',{name:'音を休める',exact:true}).click();
  await seed('line');await page.waitForTimeout(14000);
  async function formationReport(rule) {
    return page.evaluate(rule=>{
      const q=window.wonderLifeQA;
      const events=q.events.filter(e=>e.formation===rule && ['note','sustain-start'].includes(e.type));
      return {ids:[...new Set(events.map(e=>e.objectId))],events:events.length,mismatches:q.mismatches,
        onlyScheduled:events.every(e=>q.scheduled.some(n=>n.objectId===e.objectId&&n.formation===e.formation&&Math.abs(n.at-e.at)<.001)),
        starts:q.starts};
    },rule);
  }
  const cascade=await formationReport('garden-lineup-cascade');
  assert(cascade.ids.length===3&&cascade.onlyScheduled&&!cascade.mismatches.length,'cascade order/source mismatch: '+JSON.stringify(cascade));
  const field=await page.getByTestId('garden-field').boundingBox();
  const obj=page.locator('[data-object="w1"]'),box=await obj.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(field.x+field.width*.5,field.y+field.height*.70,{steps:16});await page.mouse.up();
  await page.waitForTimeout(14000);
  const round=await formationReport('garden-triad-round');
  assert(round.ids.length===3&&round.onlyScheduled&&!round.mismatches.length&&round.starts===1,'round order/source mismatch');
  const roundOrder=await page.evaluate(async()=>{
    const {spatialSlot}=await import('/src/wonder/gardenMusic.ts');
    const q=window.wonderLifeQA,effect=q.engine.wonder.find(e=>e.rule==='garden-triad-round');
    return q.events.filter(e=>e.formation==='garden-triad-round'&&['note','sustain-start'].includes(e.type)).every(e=>{
      const local=(e.beat+.005)%16;return local>=12 || Math.floor(local/4)===spatialSlot(effect,e.objectId,Math.floor((e.beat+.005)/16));
    });
  });
  assert(roundOrder,'round visual lead differs from audio slot');
  await page.screenshot({path:'output/playwright/alive-round-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'音を休める',exact:true}).click();
  await seed('source');await page.waitForTimeout(8000);
  // The unchanged mixer admits two melodies. Move the listener so the retrace
  // gets an audible turn too, rather than expecting a muted drawing to react.
  const sourceField=await page.getByTestId('garden-field').boundingBox();
  const listener=await page.locator('.garden-listener').boundingBox();
  await page.mouse.move(listener.x+listener.width/2,listener.y+listener.height/2);await page.mouse.down();
  await page.mouse.move(sourceField.x+sourceField.width*.5,sourceField.y+sourceField.height*.7,{steps:16});await page.mouse.up();
  await page.waitForTimeout(8000);
  const source=await page.evaluate(()=>{
    const q=window.wonderLifeQA,notes=q.events.filter(e=>['note','sustain-start'].includes(e.type));
    return {loop:notes.filter(e=>e.source?.loop).length,spark:notes.filter(e=>e.source?.spark).length,
      answer:notes.filter(e=>e.source?.mirror==='answer').length,thicken:notes.filter(e=>e.source?.thicken).length,mismatches:q.mismatches};
  });
  assert(source.loop&&source.spark&&source.answer&&source.thicken&&!source.mismatches.length,'missing localized WONDER cue: '+JSON.stringify(source));
  await page.screenshot({path:'output/playwright/alive-source-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'音を休める',exact:true}).click();
  return {call:{speakers:call.speakers,events:call.windows.length,seconds:20.5},cascade,round,roundOrder,source};
}