async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:390,height:844}}),tab=await context.newPage();
 const assert=(ok,message)=>{if(!ok)throw Error(message);};const errors=[];tab.on('pageerror',e=>errors.push(e.message));const button=name=>tab.getByRole('button',{name,exact:true});
 try{
  await tab.goto('http://127.0.0.1:4173/');
  await tab.getByText('オフラインでも描いて、聴けます。',{exact:true}).waitFor({timeout:30000});
  const manifest=await tab.evaluate(async()=>{
   const m=await(await fetch('/manifest.webmanifest')).json();
   for(const icon of m.icons){const img=new Image();img.src=icon.src;await img.decode();if(!img.naturalWidth)throw Error('Missing icon');}
   return m;
  });assert(manifest.display==='standalone'&&manifest.icons.some(x=>x.sizes==='512x512'),'Invalid install manifest');
  assert(await tab.locator('meta[property="og:url"]').count()===0,'Unconfigured release leaked an address');
  await tab.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});
  await button('ホーム画面に追加').click();assert(await button('ホーム画面に追加').count()===0,'Install dismissal not respected');
  await tab.reload();await tab.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await tab.reload();await button('スタジオ').click();await button('ハート').click();
  await button('PLAY — 絵を演奏する').click();await button('STOP — 再生を止める').click();
  await button('できた！').click();await tab.getByRole('textbox',{name:'作品に名前をつけよう'}).fill('オフラインのうた');
  await button('作品帳に残す').click();await tab.getByRole('heading',{name:'作品帳に残したよ。'}).waitFor();
  await button('音つきで共有').click();
  assert(!(await tab.locator('#share-caption').inputValue()).includes('127.0.0.1'),'Caption leaked local URL');
  await button('音つき動画をつくる').click();await tab.getByRole('button',{name:/動画を保存/}).waitFor({timeout:30000});
  const video=await tab.locator('video').evaluate(async el=>{if(!el.videoWidth)await new Promise(r=>el.addEventListener('loadedmetadata',r,{once:true}));return {width:el.videoWidth,height:el.videoHeight,duration:el.duration};});assert(video.width===720&&video.duration>5,'Offline video failed');
  await button('共有を閉じる').click();await button('作品帳を見る').click();await tab.getByRole('article',{name:'オフラインのうた',exact:true}).waitFor();
  await tab.reload();await button('作品帳').click();await tab.getByRole('article',{name:'オフラインのうた',exact:true}).waitFor();
  await tab.screenshot({path:'output/playwright/product-offline-library.png',fullPage:true});
  await tab.goto('http://127.0.0.1:4173/privacy.html');await tab.getByRole('heading',{name:'プライバシーと保存について',exact:true}).waitFor();
  assert(await tab.getByRole('link',{name:'raindrum909@gmail.com',exact:true}).count()===2,'Contact page missing');
  assert(!errors.length,errors.join('; '));return {passed:true,video,checks:['manifest/icons','install dismissal','offline reload','offline play/save','offline video','saved work survives reload','offline privacy','no localhost in caption']};
 }finally{await context.close();}
}
