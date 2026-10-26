async (page) => {
  const context=await page.context().browser().newContext({viewport:{width:1200,height:630},deviceScaleFactor:1});
  const tab=await context.newPage();
  try {
    await tab.goto('http://127.0.0.1:5173/');
    const mark=await tab.locator('.brand-symbol').first().evaluate(el=>el.innerHTML);
    const flat=mark.replace(/ filter="[^"]*"/g,'').replace(/stroke-width="8"/g,'stroke-width="9"').replaceAll('#f4778d','#d96179').replaceAll('#f6a05f','#eb9454').replaceAll('#edb766','#d6a354').replaceAll('#7ca367','#628b50').replaceAll('#a8bd70','#88a45b');
    const icon=(masked=false)=>'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#fcf9ef"/><svg x="'+(masked?106:62)+'" y="'+(masked?106:62)+'" width="'+(masked?300:388)+'" height="'+(masked?300:388)+'" viewBox="0 0 96 96">'+mark+'</svg></svg>';
    const favicon='<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="19" fill="#fcf9ef"/>'+flat+'</svg>';
    const saveText=async(text,name,path)=>{
      const [download]=await Promise.all([tab.waitForEvent('download'),tab.evaluate(({text,name})=>{const u=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);},{text,name})]);
      await download.saveAs(path);
    };
    await saveText(icon(),'app-icon-master.svg','assets/brand/app-icon-master.svg');
    await saveText(favicon,'favicon-v2.svg','public/favicon-v2.svg');
    for(const [size,masked,path] of [
      [180,false,'public/icons/picture-score-180-v2.png'],[192,false,'public/icons/picture-score-192-v2.png'],
      [512,false,'public/icons/picture-score-512-v2.png'],[512,true,'public/icons/picture-score-maskable-512-v2.png'],
      [1024,false,'assets/brand/app-icon-1024.png'],
      [16,false,'public/icons/favicon-16-v2.png'],[32,false,'public/icons/favicon-32-v2.png'],[48,false,'public/icons/favicon-48-v2.png']]) {
      await tab.setViewportSize({width:size,height:size});
      await tab.setContent('<style>html,body{margin:0;background:transparent}body>svg{width:100vw;height:100vh;display:block}</style>'+(size<=48?favicon:icon(masked)));
      await tab.screenshot({path,omitBackground:true});
    }
    await tab.setViewportSize({width:1200,height:630});
    await tab.goto('http://127.0.0.1:5173/');
    await tab.evaluate(async mark=>{
      document.body.innerHTML='<div id="social-card"><img id="wash" src="/assets/brand/ogp-watercolor.png" alt=""/><div class="logo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">'+mark+'</svg><div class="nickname">ピクスコ</div></div><div class="copy"><div class="wordmark">picture score<span>.</span></div><h1>描いた絵が、<br>メロディになる。</h1><p>描く・聴く・音つきでシェア</p></div></div>';
      const style=document.createElement('style');style.textContent='*{box-sizing:border-box}html,body{margin:0!important;width:1200px!important;height:630px!important;min-width:0!important;overflow:hidden;background:#fcf9ef}#social-card{position:relative;width:1200px;height:630px;overflow:hidden;background:#fcf9ef;color:#53614d}#wash{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.65}.logo{position:absolute;left:104px;top:112px;width:320px;text-align:center}.logo svg{display:block;width:320px;height:320px}.nickname{margin-top:27px;font-size:25px;letter-spacing:.26em;padding-left:.26em;font-weight:400}.copy{position:absolute;left:516px;top:132px;right:54px}.wordmark{font-family:"M PLUS Rounded 1c",sans-serif;font-size:43px;line-height:1.2;font-weight:500;letter-spacing:.08em;white-space:nowrap}.wordmark span{color:#e58186}h1{font-family:"M PLUS Rounded 1c",sans-serif;font-size:47px;line-height:1.62;letter-spacing:.075em;font-weight:500;margin:34px 0 25px;color:#52644b}p{font-family:"M PLUS Rounded 1c",sans-serif;font-size:21px;line-height:1.5;letter-spacing:.045em;margin:0;color:#778369}';document.head.append(style);
      await document.fonts.load('500 47px "M PLUS Rounded 1c"');await document.fonts.ready;
      await Promise.all([...document.images].map(img=>img.decode()));
    },mark);
    await tab.screenshot({path:'public/social/picture-score-og-v2.png'});
    // Review sheet compares small favicons, app icons and the safe-zone mask.
    await tab.setViewportSize({width:1200,height:900});
    await tab.goto('http://127.0.0.1:5173/');
    await tab.evaluate(()=>{
      document.body.innerHTML='<main id="brand-review"><h1>picture score. <small>アイコンとSNSカード</small></h1><section class="icons"><article><img width="144" height="144" src="/icons/picture-score-512-v2.png" style="border-radius:32px"/><p>アプリアイコン</p></article><article><img width="144" height="144" src="/icons/picture-score-maskable-512-v2.png" style="border-radius:50%"/><p>丸いホーム画面</p></article><article><div class="favicons"><img width="16" height="16" src="/icons/favicon-16-v2.png"/><img width="32" height="32" src="/icons/favicon-32-v2.png"/><img width="48" height="48" src="/icons/favicon-48-v2.png"/></div><p>16 / 32 / 48 px</p></article></section><img class="social-preview" src="/social/picture-score-og-v2.png"/></main>';
      const style=document.createElement('style');style.textContent='html,body{margin:0;background:#f0efe8;color:#52644b}#brand-review{width:1080px;margin:28px auto}h1{font-size:29px;letter-spacing:.07em;font-weight:500}h1 small{font-size:17px;margin-left:20px;letter-spacing:.08em;color:#7b8776}.icons{display:flex;gap:74px;align-items:center;margin:25px 0}article{text-align:center}article>img{box-shadow:0 5px 20px #6f775512}p{font-size:13px}.favicons{height:144px;display:flex;align-items:center;gap:30px;padding:15px 45px;border-radius:20px;background:#fff}.social-preview{display:block;width:960px;height:504px;border-radius:16px;box-shadow:0 8px 32px #75806018}';document.head.append(style);
    });
    await tab.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
    await tab.screenshot({path:'output/playwright/brand-assets-review.jpg',type:'jpeg',quality:80,fullPage:true});
    return {created:['app icon 180/192/512/1024','maskable 512','favicon SVG and 16/32/48 PNG','OGP 1200x630'],font:await tab.evaluate(()=>document.fonts.check('500 47px "M PLUS Rounded 1c"'))};
  } finally { await context.close(); }
}
