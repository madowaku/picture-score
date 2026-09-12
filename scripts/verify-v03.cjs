// Run with: npx @playwright/cli -s=picture-v03 run-code --filename scripts/verify-v03.cjs
async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => localStorage.removeItem("picture-score:project:v1"));
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert(await page.getByText("Feel the line.").isVisible(), "v0.3 hero is missing");
  assert((await page.request.get(page.url().replace(/\/$/, "") + "/sfx/magnet-drop.ogg")).ok(), "Magnet SFX is missing");

  const canvas = page.getByTestId("score-canvas");
  const bounds = await canvas.boundingBox();
  const from = { x: bounds.x + bounds.width * 0.14, y: bounds.y + bounds.height * 0.68 };
  const to = { x: bounds.x + bounds.width * 0.72, y: bounds.y + bounds.height * 0.24 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 22; i++) {
    await page.mouse.move(
      from.x + (to.x - from.x) * i / 22,
      from.y + (to.y - from.y) * i / 22,
      { steps: 1 },
    );
  }
  const releasedAt = Date.now();
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll("[data-note]").length > 2);
  assert(await page.locator(".note-arrival").count() > 0, "Magnetic settle animation did not start");
  await page.waitForFunction(() => document.querySelector(".note-active"), null, { timeout: 1600 });
  const answeredAfterMs = Date.now() - releasedAt;
  assert(answeredAfterMs >= 180 && answeredAfterMs < 1200, "Stroke Answer timing is outside its window");
  assert(await page.locator("[data-stroke]").count() === 1, "Stroke Answer changed source geometry");
  await page.screenshot({ path: "output/playwright/v03-stroke-answer.png", fullPage: true });
  await page.waitForFunction(() => !document.querySelector(".note-active"), null, { timeout: 4000 });

  await page.getByRole("combobox", { name: "テンポ" }).selectOption("140");
  await page.getByRole("button", { name: "PLAY — 絵を演奏する", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".is-playing"));
  await page.waitForFunction(() => !document.querySelector(".is-playing"), null, { timeout: 10000 });
  assert(await page.getByText("次は何を鳴らす？").isVisible(), "Post-play curiosity prompt is missing");
  assert(await page.locator(".next-ideas button").count() === 3, "Curiosity prompt does not have three seeds");
  await page.screenshot({ path: "output/playwright/v03-after-play.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile horizontal overflow");
  assert(await page.getByRole("button", { name: "PLAY — 絵を演奏する", exact: true }).isVisible(), "PLAY is not reachable on mobile");
  await page.screenshot({ path: "output/playwright/v03-mobile.png", fullPage: true });
  return {
    answeredAfterMs,
    notes: await page.locator("[data-note]").count(),
    ideas: await page.locator(".next-ideas button").allTextContents(),
  };
}
