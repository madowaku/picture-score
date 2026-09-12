// Isolated QA browser only. Real musical-clock growth; no counter acceleration.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(() => {
    for (const key of ["picture-score:garden:v1", "picture-score:growth:v1", "picture-score:project:v1"]) localStorage.removeItem(key);
    localStorage.setItem("picture-score:language", "ja");
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  const nav = page.locator(".space-nav"), field = page.getByTestId("garden-field");
  const saved = () => page.evaluate(() => localStorage.getItem("picture-score:growth:v1"));
  await page.getByRole("button", { name: "波", exact: true }).click();
  await page.getByRole("button", { name: "庭に置く", exact: true }).click();
  await page.getByRole("button", { name: "ここに置く", exact: true }).click();
  assert(await page.locator("[data-growth-object]").count() === 0, "immediate scenery");
  await page.waitForFunction(() => document.querySelector("[data-growth-stage='1']"), null, { timeout: 30000 });
  assert((await page.locator(".growth-discovery").innerText()).includes("聴いた音"), "first discovery missing");
  await page.getByRole("button", { name: "音を休める", exact: true }).click();
  const stopped = await saved();
  await page.waitForTimeout(1200);
  assert(await saved() === stopped, "STOP grew");
  await page.screenshot({ path: "output/playwright/grow-first.png", fullPage: true });

  await nav.getByRole("button", { name: "DRAW", exact: true }).click();
  await page.getByRole("button", { name: "波", exact: true }).click();
  await page.getByRole("textbox", { name: "作品名" }).fill("返事の波");
  await page.getByRole("button", { name: "庭に置く", exact: true }).click();
  const box = await field.boundingBox();
  await field.click({ position: { x: box.width * .57, y: box.height * .42 } });
  await page.waitForFunction(() => document.querySelector("[data-growth-pair]"), null, { timeout: 120000 });
  await page.getByRole("button", { name: "音を休める", exact: true }).click();
  const grown = await saved();
  assert(Object.values(JSON.parse(grown).relations).some((r) => r.sharedBeats >= 8), "no earned path");
  const shape = await page.locator(".growth-layer").innerHTML();
  await page.screenshot({ path: "output/playwright/grow-pair-desktop.png", fullPage: true });
  await page.reload();
  await nav.getByRole("button", { name: "GARDEN", exact: true }).click();
  assert(await saved() === grown, "reload changed counters");
  assert(await page.locator(".growth-discovery").count() === 0, "discovery repeated on reload");
  assert(await page.locator("[data-growth-pair]").count() === 1, "path not persistent");

  const work = page.locator(".garden-artwork[data-object]").last();
  await work.focus(); for (let i = 0; i < 10; i++) await work.press("ArrowRight");
  const separated = JSON.parse(await saved());
  await page.getByRole("button", { name: "庭を聴く", exact: true }).click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "音を休める", exact: true }).click();
  assert(JSON.stringify(JSON.parse(await saved()).relations) === JSON.stringify(separated.relations), "separated relation grew");
  assert(await page.locator("[data-growth-pair]").count() === 1, "separating erased path");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert(await page.getByTestId("growth-layer").evaluate((el) => getComputedStyle(el).pointerEvents) === "none", "growth intercepts input");
  await page.screenshot({ path: "output/playwright/grow-mobile.png", fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "mobile overflow");

  await work.focus(); await page.getByRole("button", { name: "庭から取り除く", exact: true }).click();
  await page.waitForTimeout(2200);
  assert(Object.keys(JSON.parse(await saved()).relations).length === 0, "removed pair survived");
  const gardenBefore = await page.evaluate(() => localStorage.getItem("picture-score:garden:v1"));
  await page.evaluate(() => localStorage.setItem("picture-score:growth:v1", "{broken"));
  await page.reload();
  await nav.getByRole("button", { name: "GARDEN", exact: true }).click();
  assert(await page.locator(".garden-artwork[data-object]").count() === 1, "corrupt growth lost artwork");
  await page.getByRole("button", { name: "庭を聴く", exact: true }).click();
  await page.waitForTimeout(2300);
  await page.getByRole("button", { name: "音を休める", exact: true }).click();
  assert(await saved() === "{broken", "corrupt growth overwritten");
  assert(await page.evaluate(() => localStorage.getItem("picture-score:garden:v1")) === gardenBefore, "corrupt growth changed garden");
  assert(!errors.length, errors.join("; "));
  return { grown: JSON.parse(grown), stopSafe: true, migrationSafe: true, mobile: "390x844", errors, svgLength: shape.length };
}
