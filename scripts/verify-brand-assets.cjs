async (page) => {
  const base=await page.evaluate(()=>location.origin);
  const context=await page.context().browser().newContext({viewport:{width:390,height:844}}),tab=await context.newPage();
  const assert=(ok,msg)=>{if(!ok)throw Error(msg);},errors=[];tab.on('pageerror',e=>errors.push(e.message));
  try {
    const response=await tab.goto(base+'/');assert(response.ok(),'Home unavailable');
    const html=await response.text();assert(html.includes('summary_large_image')&&html.includes('https://picture-score.netlify.app/social/picture-score-og-v2.png'),'Crawler HTML missing social image');
    assert(await tab.locator('meta[property="og:image"]').getAttribute('content')==='https://picture-score.netlify.app/social/picture-score-og-v2.png','OGP address wrong');
    assert(await tab.locator('meta[property="og:image:width"]').getAttribute('content')==='1200','OGP width missing');
    const report=await tab.evaluate(async()=>{
      const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
      const manifest=await (await fetch('/manifest.webmanifest')).json();
      assert(manifest.icons.some(i=>i.purpose==='maskable'),'No maskable icon');
      const paths=[...manifest.icons.map(i=>[i.src,Number(i.sizes.split('x')[0]),Number(i.sizes.split('x')[1])]),['/icons/picture-score-180-v2.png',180,180],['/icons/favicon-16-v2.png',16,16],['/icons/favicon-32-v2.png',32,32],['/icons/favicon-48-v2.png',48,48],['/social/picture-score-og-v2.png',1200,630]];
      let maskRadius=0;
      for(const [src,w,h] of paths){
        const response=await fetch(src);assert(response.ok&&response.headers.get('content-type').includes('image/'),'Not an image: '+src);
        const img=new Image();img.src=src;await img.decode();assert(img.naturalWidth===w&&img.naturalHeight===h,'Wrong image size: '+src);
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.drawImage(img,0,0);const pixels=c.getImageData(0,0,w,h).data;
        for(let i=0;i<pixels.length;i+=4){
          if(!src.includes('favicon'))assert(pixels[i+3]===255,'Unexpected transparent icon/social pixel');
          if(src.includes('maskable')&&Math.abs(pixels[i]-252)+Math.abs(pixels[i+1]-249)+Math.abs(pixels[i+2]-239)>65){const n=i/4;maskRadius=Math.max(maskRadius,Math.hypot(n%w-w/2,Math.floor(n/w)-h/2));}
        }
      }
      assert(maskRadius<512*.4,'Logo exceeds maskable safe circle');
      for(const link of document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]'))assert((await fetch(link.href)).ok,'Missing icon: '+link.href);
      return {images:paths.length,maskRadius,manifest};
    });
    await tab.getByRole('button',{name:'ガーデン',exact:true}).click();
    await tab.getByRole('button',{name:'配置を動かす',exact:true}).waitFor();
    assert(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
    await tab.getByRole('button',{name:'ホーム',exact:true}).click();
    await tab.getByText('オフラインでも描いて、聴けます。',{exact:true}).waitFor({timeout:30000});
    await tab.reload();await tab.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);await tab.reload();
    const offline=await tab.evaluate(async()=>{
      const links=[...document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]')];
      const available=await Promise.all(links.map(async link=>(await fetch(link.href)).ok));
      const names=await caches.keys();let socialCached=false;
      for(const name of names){const cache=await caches.open(name);if((await cache.keys()).some(r=>r.url.includes('/social/')))socialCached=true;}
      return {available,socialCached};
    });
    assert(offline.available.every(Boolean),'Icons unavailable offline');assert(!offline.socialCached,'OGP unnecessarily precached');
    assert(!errors.length,errors.join('; '));
    return {passed:true,base,images:report.images,maskRadius:report.maskRadius,manifestIcons:report.manifest.icons,offlineIcons:true,ogpPrecached:false,errors};
  } finally {await context.close();}
}
