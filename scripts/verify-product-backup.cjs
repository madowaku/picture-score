async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:390,height:844}}), tab=await context.newPage();
 const assert=(ok,message)=>{if(!ok)throw Error(message);};const errors=[];tab.on('pageerror',e=>errors.push(e.message));
 const button=name=>tab.getByRole('button',{name,exact:true});
 const rows=()=>tab.evaluate(async()=>(await import('/src/library/store.ts')).listArtworks());
 try{
  await tab.goto('http://127.0.0.1:5173/');
  await tab.evaluate(async()=>{const {saveArtwork}=await import('/src/library/store.ts');const {emptyProject}=await import('/src/music/project.ts');const {exampleStrokes}=await import('/src/music/examples.ts');
   for(const [id,title,shape] of [['one','もとのハート','heart'],['two','青い波','wave']])await saveArtwork({...emptyProject(),title,strokes:exampleStrokes(shape).map(s=>({...s,color:'#2584ac',width:5})),instrument:'Bell',tempo:140},id);
  });
  await button('作品帳').click();await tab.getByRole('article').first().waitFor();
  const [file]=await Promise.all([tab.waitForEvent('download'),button('作品帳をまとめて保存').click()]);
  const path='output/playwright/sketchbook-backup.json';await file.saveAs(path);
  await tab.evaluate(async()=>{const store=await import('/src/library/store.ts');await store.renameArtwork('one','今のハート');await store.deleteArtwork('two');});
  await button('ホーム').click();await button('作品帳').click();
  const input=tab.getByLabel('作品帳バックアップファイル',{exact:true});
  await input.setInputFiles(path);await button('作品を追加する').click();
  await tab.getByRole('status').filter({hasText:'2作品を追加しました'}).waitFor();
  let current=await rows();assert(current.length===3,'Conflicting work overwritten or missing');
  assert(current.find(x=>x.id==='one').project.title==='今のハート','Existing work replaced');
  assert(current.find(x=>x.id==='two').project.strokes[0].color==='#2584ac','Appearance lost');
  assert(current.find(x=>x.id==='two').project.instrument==='Bell','Sound lost');
  await input.setInputFiles(path);await button('作品を追加する').click();
  await tab.getByRole('status').filter({hasText:'0作品を追加しました'}).waitFor();assert((await rows()).length===3,'Repeat import duplicated work');
  await input.setInputFiles('scripts/fixtures/invalid-backup.json');
  await tab.getByRole('alert').filter({hasText:'このファイルは読み込めません'}).waitFor();assert((await rows()).length===3,'Invalid file changed works');
  await input.setInputFiles('scripts/fixtures/quota-backup.json');
  await tab.evaluate(()=>{window.__add=IDBObjectStore.prototype.add;let count=0;IDBObjectStore.prototype.add=function(...args){if(++count===2)throw new DOMException('quota','QuotaExceededError');return window.__add.apply(this,args);};});
  await button('作品を追加する').click();await tab.getByRole('alert').filter({hasText:'空き容量'}).waitFor();
  assert((await rows()).length===3,'Transaction was only partly rolled back');
  await tab.evaluate(()=>{IDBObjectStore.prototype.add=window.__add;});await button('読み込みをやめる').click();
  await tab.screenshot({path:'output/playwright/product-backup-mobile.png',fullPage:true});
  assert(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Backup UI overflow');
  await button('ホーム').click();await tab.getByRole('link',{name:'プライバシー・保存について'}).waitFor();
  await tab.screenshot({path:'output/playwright/product-home-mobile.png',fullPage:true});
  assert(!errors.length,errors.join('; '));
  return {passed:true,works:(await rows()).length,checks:['export','import','conflict protection','repeat import','invalid file','atomic rollback','mobile','privacy link']};
 }finally{await context.close();}
}
