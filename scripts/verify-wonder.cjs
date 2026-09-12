async (page) => {
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1050});
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1900);
  const canvas=page.getByTestId("score-canvas"),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.4);
  await page.mouse.down();
  assert(await page.getByTestId("wonder-hint").first().innerText()==="", "hint visible during drawing");
  for(let i=1;i<=64;i++){
    const angle=i/64*Math.PI*2;
    await page.mouse.move(box.x+box.width*(.35+.15*Math.cos(angle)),box.y+box.height*(.4+.24*Math.sin(angle)));
  }
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-wonder="closed-loop"]'));
  assert(await page.locator(".source-strokes path").count()===1,"canonical stroke changed");
  await page.waitForTimeout(900);
  await page.getByRole("button",{name:"PLAY — 絵を演奏する",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector(".play-button.playing"));
  await page.screenshot({path:"output/playwright/wonder-draw-desktop.png",fullPage:true});
  await page.getByRole("button",{name:"STOP — 再生を止める",exact:true}).click();
  await page.evaluate(async()=>{
    const {emptyProject}=await import('/src/music/project.ts');
    const {makeObject,emptyGarden,GARDEN_KEY}=await import('/src/garden/gardenState.ts');
    const project={...emptyProject(),strokes:[{id:"line",points:[{x:100,y:280,pressure:.5,time:0},{x:300,y:130,pressure:.5,time:1},{x:600,y:190,pressure:.5,time:2}]}]};
    const state={...emptyGarden(),bpm:140,listener:{x:.5,y:.6},objects:[.32,.5,.68].map((x,i)=>makeObject({...project,title:["いちご","そら","わかば"][i]},{x,y:.4},"work"+i))};
    localStorage.setItem(GARDEN_KEY,JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("button",{name:"GARDEN",exact:true}).click();
  await page.getByRole("button",{name:"庭を聴く",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.garden-artwork[data-wonder="garden-lineup-cascade"]'));
  await page.screenshot({path:"output/playwright/wonder-garden-desktop.png",fullPage:true});
  const work=page.locator('[data-object="work1"]'), workBox=await work.boundingBox(), field=await page.getByTestId("garden-field").boundingBox();
  await page.mouse.move(workBox.x+workBox.width/2,workBox.y+workBox.height/2);
  await page.mouse.down();
  await page.mouse.move(field.x+field.width*.5,field.y+field.height*.69,{steps:15});
  assert((await page.getByTestId("wonder-hint").allInnerTexts()).every(s=>!s),"hint during drag");
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.garden-artwork[data-wonder="garden-triad-round"]'),{},{timeout:8000});
  assert(await page.getByRole("button",{name:"音を休める",exact:true}).isVisible(),"transport restarted during drag");
  await page.screenshot({path:"output/playwright/wonder-triangle-desktop.png",fullPage:true});
  await page.getByRole("combobox",{name:"Language / 言語",exact:true}).selectOption("en");
  for(const [width,height] of [[360,800],[390,844],[720,1280]]){
    await page.setViewportSize({width,height});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+"px overflow");
    await page.screenshot({path:"output/playwright/wonder-garden-"+width+".png",fullPage:true});
  }
  await page.emulateMedia({reducedMotion:"reduce"});
  assert(await page.locator(".garden-artwork[data-wonder]").count()===3,"reduced motion removed functionality");
  await page.getByRole("button",{name:"DRAW",exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"draw overflow");
  await page.screenshot({path:"output/playwright/wonder-draw-mobile.png",fullPage:true});
  assert(!errors.length,errors.join(";"));
  return {errors, screenshots:"output/playwright/wonder-*.png", sizes:[360,390,720,1440]};
}
