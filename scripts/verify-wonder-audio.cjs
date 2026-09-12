async (page) => {
  const result=await page.evaluate(async()=>{
    const {createMusic,createVisualNotes}=await import('/src/music/score.ts');
    const {renderAudio}=await import('/src/music/audio.ts');
    const {midiFile,pictureFile}=await import('/src/music/export.ts');
    const {emptyProject,parseProject}=await import('/src/music/project.ts');
    const {drawRelations}=await import('/src/wonder/drawRelations.ts');
    const {applyDrawWonder}=await import('/src/wonder/drawMusic.ts');
    const ring=i=>({id:'ring'+i,points:Array.from({length:81},(_,j)=>({x:350+140*Math.cos(j/80*Math.PI*2),y:210+120*Math.sin(j/80*Math.PI*2),pressure:.5,time:j}))});
    const sources=[ring(0),ring(1),ring(2),ring(3),ring(4)];
    const project={...emptyProject(),strokes:sources};
    const before=JSON.stringify(project);
    const started=performance.now(),effects=drawRelations(sources),detectionMs=performance.now()-started;
    const base=createMusic(createVisualNotes(sources,.5),140,false,.5),music=applyDrawWonder(base,effects);
    const wav=await renderAudio(music,"Piano"), view=new DataView(await wav.arrayBuffer());
    let peak=0,energy=0,count=0;
    for(let i=44;i<view.byteLength;i+=4){const s=view.getInt16(i,true)/32768;peak=Math.max(peak,Math.abs(s));energy+=s*s;count++;}
    const midi=midiFile(music),png=await pictureFile(project,base.drawing,"en"),bitmap=await createImageBitmap(png);
    const dimensions=[bitmap.width,bitmap.height];bitmap.close();
    const many=Array.from({length:100},(_,i)=>ring(i));
    const bulkStart=performance.now();drawRelations(many);const bulkMs=performance.now()-bulkStart;
    return {detectionMs,bulkMs,notes:music.playNotes.length,baseNotes:base.playNotes.length,peak,rms:Math.sqrt(energy/count),wavBytes:wav.size,midiHeader:[...midi.slice(0,4)],png:dimensions,sourcePreserved:JSON.stringify(project)===before,jsonRoundTrip:parseProject(JSON.parse(before)).strokes.length===5};
  });
  if(!result.sourcePreserved||!result.jsonRoundTrip||result.rms<.001||result.peak>=.98||result.wavBytes<10000||result.midiHeader.join()!=="77,84,104,100")throw Error(JSON.stringify(result));
  return result;
}
