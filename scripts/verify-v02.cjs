// Run with: npx @playwright/cli -s=picture-v02 run-code --filename scripts/verify-v02.cjs
async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const stats = () => page.getByTestId("interpretation-count").evaluate((el) => ({
    visual: Number(el.dataset.visualCount), play: Number(el.dataset.playCount),
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("combobox", { name: "Language / 言語" }).selectOption("ja");
  await page.getByRole("button", { name: "猫", exact: true }).click();
  const paths = await page.locator("[data-stroke]").evaluateAll((els) => els.map((e) => e.getAttribute("d")));
  const slider = page.getByRole("slider", { name: "絵と音楽のバランス" });
  await slider.focus();
  await slider.press("Home");
  const drawing = await stats();
  await slider.press("End");
  const music = await stats();
  for (let i = 0; i < 50; i++) await slider.press("ArrowLeft");
  const balance = await stats();
  assert(drawing.visual === music.visual && music.visual === balance.visual, "Visual count changed");
  assert(drawing.play > balance.play && balance.play > music.play, "Slider does not compress");
  assert(JSON.stringify(paths) === JSON.stringify(await page.locator("[data-stroke]").evaluateAll(
    (els) => els.map((e) => e.getAttribute("d")))), "Slider modified original lines");
  await page.getByRole("button", { name: "PLAY — 絵を演奏する", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".note-active"));
  await page.screenshot({ path: "output/playwright/v02-playing.png" });
  await page.getByRole("button", { name: "STOP — 再生を止める", exact: true }).click();
  assert(await page.locator(".note-active").count() === 0, "STOP left notes active");

  const cdp = await page.context().newCDPSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await page.getByRole("button", { name: "新しいキャンバス", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const canvas = page.getByTestId("score-canvas");
  const bounds = await canvas.boundingBox();
  const p = (fx, fy, id = 1) => ({
    x: bounds.x + bounds.width * fx, y: bounds.y + bounds.height * fy,
    id, radiusX: 4, radiusY: 4, force: 0.5,
  });
  const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  await touch("touchStart", [p(0.1, 0.6)]);
  await touch("touchMove", [p(0.3, 0.4)]);
  await page.waitForFunction(() => document.querySelector(".draft-stroke")?.getAttribute("d")?.includes(" L"));
  assert(await page.locator("[data-note]").count() === 0, "Notes committed before release");
  // A second finger must not create another stroke or terminate the first.
  await touch("touchStart", [p(0.3, 0.4), p(0.5, 0.5, 2)]);
  await touch("touchEnd", [p(0.5, 0.5, 2)]);
  for (let i = 1; i <= 25; i++) await touch("touchMove", [
    p(0.3 + i / 25 * 0.55, 0.4 + Math.sin(i / 25 * Math.PI) * 0.3),
  ]);
  await page.evaluate(() => {
    window.__releasePaintMs = null;
    document.querySelector('[data-testid="score-canvas"]').addEventListener("pointerup", () => {
      const start = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__releasePaintMs = performance.now() - start;
      }));
    }, { once: true });
  });
  await touch("touchEnd", []);
  await page.waitForFunction(() => document.querySelectorAll("[data-note]").length > 0);
  assert(await page.locator("[data-stroke]").count() === 1, "Multitouch created extra strokes");
  assert(await page.locator(".draft-stroke").count() === 0, "Draft survived release");
  await page.waitForFunction(() => window.__releasePaintMs !== null);
  const releasePaintMs = await page.evaluate(() => window.__releasePaintMs);
  await page.waitForFunction(() => {
    const stored = JSON.parse(localStorage.getItem("picture-score:project:v1") || "{}");
    return stored.strokes?.length === 1;
  });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("picture-score:project:v1")));
  assert(stored.strokes[0].points.length > 20, "Touch samples were lost");
  assert(Math.abs(stored.strokes[0].points[0].x - 100) < 1, "Incorrect input coordinates");
  assert(Math.abs(stored.strokes[0].points.at(-1).x - 850) < 2, "Last touch point was lost");

  // Cancellation rolls back only the in-flight gesture and leaves history usable.
  await touch("touchStart", [p(0.2, 0.2)]);
  await touch("touchMove", [p(0.4, 0.2)]);
  await touch("touchCancel", []);
  assert(await page.locator("[data-stroke]").count() === 1, "Cancellation changed committed drawing");
  assert(await page.locator(".draft-stroke").count() === 0, "Cancelled draft stuck");
  await page.getByRole("button", { name: "Undo — 元に戻す", exact: true }).click();
  assert(await page.locator("[data-stroke]").count() === 0, "Undo did not remove full gesture");

  // Horizontal touch stroke: dozens of visible notes, one performed sustain.
  await touch("touchStart", [p(0.1, 0.55)]);
  for (let i = 1; i <= 30; i++) await touch("touchMove", [p(0.1 + 0.8 * i / 30, 0.55)]);
  await touch("touchEnd", []);
  await page.waitForFunction(() => document.querySelector('[data-testid="interpretation-count"]').dataset.playCount === "1");
  const horizontal = await stats();
  assert(horizontal.visual > 30, "Horizontal source points were thinned visually");
  await page.screenshot({ path: "output/playwright/v02-touch.png", fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile horizontal overflow");

  // Genuine offline synthesis and MIDI share the same interpreted score.
  const audio = await page.evaluate(async () => {
    const { createVisualNotes, createMusic } = await import("/src/music/score.ts");
    const { renderAudio } = await import("/src/music/audio.ts");
    const source = [{ id: "qa", points: [
      { x: 50, y: 210, pressure: 0.5, time: 0 }, { x: 950, y: 210, pressure: 0.5, time: 100 },
    ] }];
    const score = createMusic(createVisualNotes(source, 1), 120, false, 1);
    const wav = await renderAudio(score, "Soft Synth");
    const bytes = new DataView(await wav.arrayBuffer());
    let peak = 0, energy = 0, n = 0;
    for (let at = 44 + 44100 * 4 * 2; at < 44 + 44100 * 4 * 6; at += 4) {
      const sample = bytes.getInt16(at, true) / 32768;
      peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; n++;
    }
    return { notes: score.playNotes.length, size: wav.size, peak, rms: Math.sqrt(energy / n) };
  });
  assert(audio.notes === 1 && audio.rms > 0.001 && audio.peak < 0.98, "Sustain silent or clipped");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: "output/playwright/v02-tablet.png", fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Tablet horizontal overflow");
  return { drawing, balance, music, horizontal, releasePaintMs, audio };
}
