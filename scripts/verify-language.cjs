// Dedicated QA browser only:
// npx @playwright/cli -s=language open http://127.0.0.1:5174/
// npx @playwright/cli -s=language run-code --filename scripts/verify-language.cjs
async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [], failedRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(new URL(page.url()).origin)) failedRequests.push(response.url());
  });
  // Reset only this isolated QA session; never clear a user's browsing data.
  await page.evaluate(() => {
    for (const key of ["picture-score:language", "picture-score:project:v1", "picture-score:garden:v1"])
      localStorage.removeItem(key);
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  const language = page.getByRole("combobox", { name: "Language / 言語" });
  const nav = page.locator(".space-nav");
  const saved = () => page.evaluate(() => ({
    project: localStorage.getItem("picture-score:project:v1"),
    garden: localStorage.getItem("picture-score:garden:v1"),
  }));
  assert(await language.inputValue() === "ja", "default language is not Japanese");
  assert(await page.locator("html").getAttribute("lang") === "ja", "document language not Japanese");
  assert(await page.getByRole("button", { name: "ピアノ", exact: true }).isVisible(), "Japanese instrument missing");

  await language.selectOption("en");
  assert(await page.getByRole("heading", { name: "Feel the line." }).isVisible(), "English hero missing");
  await page.getByRole("button", { name: "Wave", exact: true }).click();
  const artworkTitle = "私の波 / My wave";
  await page.getByRole("textbox", { name: "Artwork title" }).fill(artworkTitle);
  await page.waitForFunction((name) => JSON.parse(localStorage.getItem("picture-score:project:v1") || "{}").title === name, artworkTitle);
  const before = await saved();
  const png = await page.evaluate(async () => {
    const { pictureFile } = await import("/src/music/export.ts");
    const { createVisualNotes } = await import("/src/music/score.ts");
    const project = JSON.parse(localStorage.getItem("picture-score:project:v1"));
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    const text = [], sizes = [];
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      text.push(args[0]);
      return fillText.apply(this, args);
    };
    try {
      for (const locale of ["ja", "en"]) {
        const blob = await pictureFile(project, createVisualNotes(project.strokes, project.magnet), locale);
        const bitmap = await createImageBitmap(blob);
        sizes.push([bitmap.width, bitmap.height]);
        bitmap.close();
      }
    } finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
    return { text, sizes };
  });
  assert(png.text.includes("PICTURE SCORE  /  ひと筆ごとに、音がこたえる。") && png.text.includes("PICTURE SCORE  /  Every stroke answers back."), "PNG footer not localized");
  assert(JSON.stringify(png.sizes[0]) === JSON.stringify(png.sizes[1]), "language changed PNG dimensions");
  const paths = await page.locator("[data-stroke]").evaluateAll((els) => els.map((el) => el.getAttribute("d")));
  await page.getByRole("button", { name: "PLAY — Play your drawing", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".playhead")?.style.transform);
  const playhead = await page.locator(".playhead").getAttribute("style");
  await language.selectOption("ja");
  assert(await page.locator(".is-playing").count() === 1, "language change stopped DRAW playback");
  await page.waitForFunction((previous) => document.querySelector(".playhead")?.getAttribute("style") !== previous, playhead);
  assert(await page.getByRole("textbox", { name: "作品名" }).inputValue() === artworkTitle, "artwork title translated");
  assert(JSON.stringify(await saved()) === JSON.stringify(before), "language change mutated project or garden");
  assert(JSON.stringify(paths) === JSON.stringify(await page.locator("[data-stroke]").evaluateAll((els) => els.map((el) => el.getAttribute("d")))), "language changed stroke geometry");
  await language.selectOption("en");
  await page.getByRole("button", { name: "STOP — Stop playback", exact: true }).click();

  await page.getByRole("button", { name: "Export your artwork", exact: true }).click();
  for (const name of ["Save picture", "Save audio", "Save score", "Save project", "Open project"])
    assert(await page.getByRole("button", { name: new RegExp(name) }).isVisible(), name + " translation missing");
  await page.screenshot({ path: "output/playwright/language-en-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Export your artwork", exact: true }).click();
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  assert(await page.getByRole("heading", { name: "There’s no wrong way to draw." }).isVisible(), "English help missing");
  await page.getByRole("button", { name: "Close help", exact: true }).click();

  await page.getByLabel("Open a project file").evaluate((input) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["{"], "invalid.json", { type: "application/json" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector(".toast"));
  assert(await page.locator(".toast").innerText() === "Couldn’t read the project file.", "English import error missing");
  await language.selectOption("ja");
  assert(await page.locator(".toast").innerText() === "作品ファイルを読み込めませんでした。", "existing notice did not translate");
  await language.selectOption("en");
  await page.getByRole("button", { name: "PLACE IN GARDEN", exact: true }).click();
  await page.getByRole("button", { name: "Place here", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector(".garden-clock")?.getAttribute("data-beat")) > .5);
  const beat = Number(await page.locator(".garden-clock").getAttribute("data-beat"));
  const gardenBefore = await saved();
  await language.selectOption("ja");
  assert(await page.getByRole("button", { name: "音を休める", exact: true }).isVisible(), "language change stopped garden");
  await page.waitForFunction((previous) => Number(document.querySelector(".garden-clock")?.getAttribute("data-beat")) > previous, beat);
  assert(await page.locator(".artwork-title").first().innerText() === artworkTitle, "Garden title changed");
  await language.selectOption("en");
  assert(JSON.stringify(await saved()) === JSON.stringify(gardenBefore), "language changed garden IR or positions");
  await page.getByRole("button", { name: "Pause garden", exact: true }).click();
  await page.screenshot({ path: "output/playwright/language-en-garden-desktop.png", fullPage: true });
  await page.reload();
  assert(await language.inputValue() === "en" && await page.locator("html").getAttribute("lang") === "en", "language preference did not survive reload");
  await nav.getByRole("button", { name: "GARDEN", exact: true }).click();
  assert(await page.locator(".garden-artwork[data-object]").count() === 1, "garden did not persist");
  assert(await page.locator(".artwork-title").first().innerText() === artworkTitle, "persisted title changed");

  await page.setViewportSize({ width: 390, height: 844 });
  for (const locale of ["en", "ja"]) {
    await language.selectOption(locale);
    await page.screenshot({ path: "output/playwright/language-" + locale + "-garden-mobile.png", fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), locale + " garden overflows mobile");
    await nav.getByRole("button", { name: "DRAW", exact: true }).click();
    assert(await page.getByTestId("score-canvas").isVisible(), "mobile canvas missing");
    await language.scrollIntoViewIfNeeded();
    const rect = await language.boundingBox();
    assert(rect.x >= 0 && rect.x + rect.width <= 390 && rect.height >= 44, "language selector unreachable on mobile");
    await page.screenshot({ path: "output/playwright/language-" + locale + "-draw-mobile.png", fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), locale + " DRAW overflows mobile");
    await page.getByRole("button", { name: locale === "en" ? "How to play" : "あそびかた", exact: true }).click();
    await page.screenshot({ path: "output/playwright/language-" + locale + "-help-mobile.png", fullPage: true });
    assert(await page.locator("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth), locale + " help overflows");
    await page.getByRole("button", { name: locale === "en" ? "Close help" : "説明を閉じる", exact: true }).click();
    await nav.getByRole("button", { name: "GARDEN", exact: true }).click();
  }
  assert(!errors.length, "Browser errors: " + errors.join("; "));
  assert(!failedRequests.length, "Local network failures: " + failedRequests.join("; "));
  return { locales: ["ja", "en"], playbackPreserved: ["DRAW", "GARDEN"], projectPreserved: true, preferencePersisted: true, viewports: ["1440x900", "390x844"], errors, failedRequests };
}
