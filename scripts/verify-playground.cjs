async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(() => {
    for (const key of ["picture-score:project:v1","picture-score:garden:v1","picture-score:growth:v1"]) localStorage.removeItem(key);
    localStorage.setItem("picture-score:language","ja");
  });
  await page.reload();
  assert(await page.locator(".creation-trail").isVisible(), "draw trail missing");
  assert(await page.locator(".gesture-hint").count() === 0, "hint should be empty-canvas only");
  assert(await page.locator(".empty-gesture-hint").isVisible(), "empty-canvas hint missing");
  const canvas = page.getByTestId("score-canvas"), box = await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.18, box.y+box.height*.72);
  await page.mouse.down();
  for (let i=1;i<=18;i++) await page.mouse.move(box.x+box.width*(.18+.55*i/18), box.y+box.height*(.72-.38*i/18), {steps:1});
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector(".note-arrival"));
  assert(await page.locator("[data-testid=gesture-feedback]").count() === 1, "gesture feedback missing");
  await page.waitForFunction(() => document.querySelector(".is-answering"));
  await page.waitForTimeout(700);
  await page.getByRole("button",{name:"PLAY — 絵を演奏する",exact:true}).click();
  await page.waitForFunction(() => document.querySelector(".play-button.playing"));
  assert(await page.locator(".play-button.playing").isVisible(), "play state missing");
  await page.waitForTimeout(1000);
  await page.getByRole("button",{name:"STOP — 再生を止める",exact:true}).click();
  await page.getByRole("button",{name:"庭に置く",exact:true}).click();
  const field = page.getByTestId("garden-field");
  await field.click({position:{x:280,y:170}});
  await page.waitForFunction(() => document.querySelectorAll(".garden-artwork[data-object]").length === 1);
  assert(await page.locator(".garden-field.place-pulse").count() === 1, "place pulse missing");
  const work = page.locator(".garden-artwork[data-object]").first();
  await work.click();
  await page.waitForTimeout(120);
  assert(await page.locator(".garden-artwork.answer-pulse").count() === 1, "tap pulse missing");
  assert(await page.locator(".garden-selection-actions").isVisible(), "selection actions missing");
  await page.getByRole("button",{name:"ひときわ聴く",exact:true}).click();
  assert(await page.locator(".garden-artwork.spotlight-lead").count() === 1, "spotlight visual missing");
  await page.getByRole("button",{name:"音を休める",exact:true}).click();
  // A stopped garden answers immediately through its short audition engine.
  await work.click();
  await page.waitForTimeout(120);
  assert(await page.locator(".garden-artwork.answer-pulse").count() === 1, "stopped tap pulse missing");
  await page.waitForTimeout(400);
  assert(!errors.length, errors.join(";"));
  for (const [width, height] of [[360,800],[390,844],[720,1280]]) {
    await page.setViewportSize({width, height});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${width}px overflow`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await page.getByRole("button",{name:"GARDEN",exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), "mobile overflow");
  const listener = page.locator(".garden-listener");
  assert(await listener.isVisible(), "listener missing");
  await page.screenshot({path:"output/playwright/playground-mobile.png",fullPage:true});
  return {errors, gesture:await page.locator("[data-testid=gesture-feedback]").count(), artwork:await page.locator(".garden-artwork[data-object]").count(), mobile:"390x844"};
}
