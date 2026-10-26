// Measures the first-time path from HOME to hearing a drawing in the Garden.
// The planting tap targets the ghost drawing, where the person actually taps.
// Counts taps/clicks, strokes, typing, scrolls needed to reach a control, and surface changes.
// Usage: node scripts/measure-draw-to-garden.mjs [baseUrl]   (start `npm run dev` first)
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:5173/";
const devices = {
  pc: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "small-phone": { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

async function session(browser, device) {
  const context = await browser.newContext(devices[device]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const log = { taps: 0, strokes: 0, typing: 0, scrolls: 0, surfaces: [], steps: [], scrolledFor: [] };
  const surface = () => page.evaluate(() => document.querySelector(".product-root")?.dataset.surface ?? "?");
  const note = async (step) => {
    const now = await surface();
    if (log.surfaces.at(-1) !== now) log.surfaces.push(now);
    log.steps.push(step);
  };
  const reach = async (locator, step) => {
    await locator.waitFor({ state: "visible" });
    // Let app-driven smooth scrolling settle before judging what the person can see.
    let last = NaN, still = 0;
    for (let i = 0; i < 40 && still < 5; i++) {
      const top = await locator.evaluate((element) => element.getBoundingClientRect().top);
      still = top === last ? still + 1 : 0;
      last = top; await page.waitForTimeout(80);
    }
    const visible = await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const nav = document.querySelector(".product-bottom-nav")?.getBoundingClientRect().top ?? innerHeight;
      return rect.top >= 0 && rect.bottom <= Math.min(innerHeight, nav) + 1;
    });
    if (!visible) { log.scrolls++; log.scrolledFor.push(step); await locator.scrollIntoViewIfNeeded(); }
  };
  const tap = async (locator, step) => {
    await reach(locator, step);
    if (devices[device].hasTouch) await locator.tap(); else await locator.click();
    log.taps++; await note(step);
  };
  // The ghost ignores pointer events; the Garden field under it receives the planting tap.
  const tapAt = async (locator, step) => {
    await reach(locator, step);
    const box = await locator.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (devices[device].hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    log.taps++; await note(step);
  };
  const draw = async (step) => {
    const canvas = page.locator(".score-canvas");
    await reach(canvas, step);
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .12, box.y + box.height * .6);
    await page.mouse.down();
    for (let i = 1; i <= 24; i++) await page.mouse.move(box.x + box.width * (.12 + i * .03), box.y + box.height * (.6 - Math.sin(i / 4) * .25));
    await page.mouse.up();
    log.strokes++; await note(step);
  };
  const heard = async () => {
    const started = Date.now();
    await page.locator(".garden-listen").filter({ hasText: /音を休める|Pause/ }).waitFor({ timeout: 8000 });
    return Date.now() - started;
  };
  await page.goto(base);
  await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase("picture-score:sketchbook"); });
  await page.reload();
  await note("home");
  return { page, log, errors, tap, tapAt, draw, heard, close: () => context.close() };
}

const flows = {
  // Today's shortest path: draw, then the small "place in garden" control under the controls.
  direct: async (s) => {
    await s.tap(s.page.locator(".home-primary"), "start drawing");
    await s.draw("draw");
    await s.tap(s.page.locator(".place-garden"), "place in garden");
    await s.tapAt(s.page.locator(".garden-ghost"), "tap to plant");
  },
  // The celebratory path: Done! → name → save, then find the garden control after closing.
  done: async (s) => {
    await s.tap(s.page.locator(".home-primary"), "start drawing");
    await s.draw("draw");
    await s.tap(s.page.locator(".finish-button"), "done");
    await s.page.locator("#finish-name").fill("はじめての音"); s.log.typing++;
    await s.tap(s.page.locator(".finish-dialog button[type=submit]"), "save to sketchbook");
    const plant = s.page.locator(".finish-dialog").getByRole("button", { name: /庭に植える|Plant in garden/ });
    if (await plant.count()) {
      await s.tap(plant, "plant in garden");
    } else {
      await s.tap(s.page.locator(".finish-back"), "keep drawing");
      await s.tap(s.page.locator(".place-garden"), "place in garden");
    }
    if (await s.page.getByTestId("garden-field").locator(".garden-ghost").count())
      await s.tapAt(s.page.locator(".garden-ghost"), "tap to plant");
  },
};

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const device of Object.keys(devices)) for (const [name, run] of Object.entries(flows)) {
    const s = await session(browser, device);
    try {
      await run(s);
      const waitMs = await s.heard();
      const { taps, strokes, typing, scrolls, surfaces, scrolledFor } = s.log;
      results.push({ device, flow: name, actions: taps + strokes + typing + scrolls, taps, strokes, typing, scrolls,
        screens: surfaces.join(" → "), scrolledFor: scrolledFor.join(", "), soundAfterLastTapMs: waitMs, errors: s.errors.length });
    } catch (error) {
      results.push({ device, flow: name, failed: String(error.message).split("\n")[0], steps: s.log.steps.join(" → ") });
    } finally { await s.close(); }
  }
} finally { await browser.close(); }
console.table(results);
