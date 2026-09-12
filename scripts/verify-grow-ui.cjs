// Isolated QA session. Seeded mature counters test rendering bounds, not earned growth.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.evaluate(() => {
    for (const key of ["picture-score:garden:v1", "picture-score:growth:v1", "picture-score:project:v1"]) localStorage.removeItem(key);
    localStorage.setItem("picture-score:language", "ja");
  });
  await page.reload();
  await page.setViewportSize({ width:390, height:844 });
  assert(await page.locator(".creation-trail li").count() === 3, "missing first-use steps");
  await page.screenshot({ path:"output/playwright/grow-first-use-mobile.png", fullPage:true });
  await page.locator(".space-nav").getByRole("button", {name:"GARDEN", exact:true}).click();
  await page.getByRole("button", {name:"最初の音を描く", exact:true}).click();
  assert(await page.getByTestId("score-canvas").isVisible(), "empty garden entry");
  await page.getByRole("combobox", {name:"Language / 言語"}).selectOption("en");
  assert((await page.locator(".creation-trail").innerText()).includes("Draw a line"), "English guidance");
  await page.screenshot({ path:"output/playwright/grow-first-use-en.png", fullPage:true });
  await page.evaluate(async () => {
    const { emptyGarden, makeObject } = await import("/src/garden/gardenState.ts");
    const { emptyProject } = await import("/src/music/project.ts");
    const { exampleStrokes } = await import("/src/music/examples.ts");
    const garden = emptyGarden();
    garden.objects = Array.from({length:12}, (_, i) => makeObject(
      {...emptyProject(), strokes:exampleStrokes("wave")}, {x:.15+(i%4)*.23, y:.2+Math.floor(i/4)*.3}, "mature-"+i));
    const relations = {};
    garden.objects.forEach((a,i) => garden.objects.slice(i+1).forEach(b => {
      relations[JSON.stringify([a.id,b.id].sort())] = {a:a.id,b:b.id,sharedBeats:64};
    }));
    localStorage.setItem("picture-score:garden:v1", JSON.stringify(garden));
    localStorage.setItem("picture-score:growth:v1", JSON.stringify({version:1,
      objects:Object.fromEntries(garden.objects.map(o=>[o.id,64])), relations,
      discoveries:{object:true,relation:true}}));
  });
  await page.reload();
  await page.locator(".space-nav").getByRole("button", {name:"GARDEN",exact:true}).click();
  assert(await page.locator("[data-growth-object]").count() === 12, "habitat bound");
  const paths = await page.locator("[data-growth-pair]").count();
  assert(paths > 0 && paths <= 24, "path bound");
  const primitives = await page.locator(".growth-habitat > *").count();
  assert(primitives > 0 && primitives <= 96, "primitive bound");
  const shape = await page.getByTestId("growth-layer").innerHTML();
  await page.reload();
  await page.locator(".space-nav").getByRole("button", {name:"GARDEN",exact:true}).click();
  assert(await page.getByTestId("growth-layer").innerHTML() === shape, "reload not deterministic");
  await page.emulateMedia({reducedMotion:"reduce"});
  assert(await page.getByTestId("growth-layer").evaluate(el=>getComputedStyle(el).pointerEvents) === "none", "growth intercepts input");
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), "mobile overflow");
  const before = await page.locator("[data-object='mature-0']").getAttribute("style");
  await page.locator("[data-object='mature-0']").focus();
  await page.keyboard.press("ArrowRight");
  assert(await page.locator("[data-object='mature-0']").getAttribute("style") !== before, "mature work cannot move");
  await page.screenshot({path:"output/playwright/grow-dense-mobile.png",fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:"output/playwright/grow-dense-desktop.png",fullPage:true});
  return {firstUse:true, japaneseEnglish:true, habitats:12, paths, primitives, deterministic:true};
}
