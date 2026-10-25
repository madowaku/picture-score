async (page) => {
  const context=await page.context().browser().newContext();const tab=await context.newPage();
  const errors=[];tab.on('pageerror',e=>errors.push(e.message));
  try {
    await tab.goto('http://127.0.0.1:5173/');
    const phase='after';
    const result=await tab.evaluate(async () => {
      const {renderAudioBuffer,renderAudio,voice,outputBus,releaseVoices}=await import('/src/music/audio.ts');
      const {emptyProject}=await import('/src/music/project.ts');
      const {exampleStrokes}=await import('/src/music/examples.ts');
      const {projectMusic}=await import('/src/music/arrangement.ts');
      const analyze=buffer=>{const a=buffer.getChannelData(0),b=buffer.getChannelData(1);let energy=0,peak=0,jump=0,side=0,tail=0;
        for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))throw Error('Non-finite audio');energy+=a[i]*a[i];side+=(a[i]-b[i])**2;peak=Math.max(peak,Math.abs(a[i]),Math.abs(b[i]));if(i)jump=Math.max(jump,Math.abs(a[i]-a[i-1]));if(i>a.length-4410)tail=Math.max(tail,Math.abs(a[i]),Math.abs(b[i]));}
        return {peak,rms:Math.sqrt(energy/a.length),maxJump:jump,stereo:Math.sqrt(side/a.length),tail,seconds:buffer.duration};};
      const assert=(ok,message)=>{if(!ok)throw Error(message);};
      const samples=[];
      for(const instrument of ['Piano','Bell','Pluck','Toy','Soft Synth']) {
        const music=projectMusic({...emptyProject(),strokes:exampleStrokes('heart'),instrument,magnet:.65});
        const buffer=await renderAudioBuffer(music,instrument);
        const metrics=analyze(buffer);
        assert(metrics.peak<.95&&metrics.rms>.005&&metrics.tail<.0001,'Invalid output '+instrument+JSON.stringify(metrics));
        assert(metrics.stereo>0,'Room is missing in '+instrument);
        samples.push({instrument,...metrics});
      }
      // Sustained lines must remain audible; dense/high drawings must stay below clipping.
      const stress=[];
      for(const instrument of ['Piano','Bell','Pluck','Toy','Soft Synth']) {
        for(const shape of ['cat','wave']) {
          const music=projectMusic({...emptyProject(),strokes:exampleStrokes(shape),magnet:0,tempo:160});
          const metrics=analyze(await renderAudioBuffer(music,instrument));
          assert(metrics.peak<.95&&metrics.rms>.001&&metrics.tail<.0001,'Dense drawing '+instrument+shape);
          stress.push({instrument,shape,peak:metrics.peak});
        }
      }
      const sustained=await (async()=>{const ctx=new OfflineAudioContext(2,44100*8,44100);voice(ctx,outputBus(ctx),60,0,6,.6,'Piano');return ctx.startRendering();})();
      const held=sustained.getChannelData(0).slice(44100*4,44100*5);
      const heldRms=Math.sqrt(held.reduce((n,v)=>n+v*v,0)/held.length);
      assert(heldRms>.005,'Long lines fade out too soon');
      async function interrupt(gentle) {
        const ctx=new OfflineAudioContext(2,44100,44100), bus=ctx.createGain();bus.connect(ctx.destination);
        const nodes=voice(ctx,bus,60,0,.8,.8,'Piano');
        const paused=ctx.suspend(.053), rendering=ctx.startRendering();await paused;
        const stoppedAt=ctx.currentTime;
        if(gentle){releaseVoices(nodes);releaseVoices(nodes);}else nodes.forEach(n=>n.stop());
        await ctx.resume();const buffer=await rendering,a=buffer.getChannelData(0);
        let jump=0,late=0;for(let i=Math.floor(stoppedAt*44100)-1;i<Math.ceil((stoppedAt+.06)*44100);i++)jump=Math.max(jump,Math.abs(a[i]-a[i-1]));
        for(let i=Math.ceil((stoppedAt+.04)*44100);i<a.length;i++)late=Math.max(late,Math.abs(a[i]));
        return {jump,late};
      }
      const abrupt=await interrupt(false),gentle=await interrupt(true);
      assert(gentle.late===0&&gentle.jump<abrupt.jump,'Stop did not soften the boundary: '+JSON.stringify({abrupt,gentle}));
      const futureCtx=new OfflineAudioContext(2,44100,44100);
      const future=voice(futureCtx,futureCtx.destination,72,.2,.2,.8,'Bell');releaseVoices(future);
      assert(analyze(await futureCtx.startRendering()).peak===0,'Cancelled note still plays');
      const music=projectMusic({...emptyProject(),strokes:exampleStrokes('heart'),magnet:.65});
      const blob=await renderAudio(music,'Piano');
      const a=document.createElement('a');a.textContent='Audio sample';a.download='heart.wav';a.href=URL.createObjectURL(blob);document.body.append(a);
      return {samples,stress,heldRms,abrupt,gentle};
    });
    const [file]=await Promise.all([tab.waitForEvent('download'),tab.getByRole('link',{name:'Audio sample'}).click()]);
    await file.saveAs('output/playwright/warm-piano-'+phase+'.wav');
    if(errors.length)throw Error(errors.join('; '));
    return {phase,result};
  } finally {await context.close();}
}
