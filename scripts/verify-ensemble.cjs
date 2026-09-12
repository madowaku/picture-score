// Dedicated QA session only:
// npx @playwright/cli -s=ensemble run-code --filename scripts/verify-ensemble.cjs
async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() => {
    localStorage.removeItem("picture-score:garden:v1");
    localStorage.removeItem("picture-score:project:v1");
    localStorage.setItem("picture-score:language", "ja");
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  // Observe the actual UI transport, without adding a production-only testing API.
  await page.evaluate(async () => {
    const moduleURL = performance.getEntriesByType("resource").find((entry) =>
      new URL(entry.name).pathname === "/src/garden/gardenTransport.ts").name;
    const { GardenTransport } = await import(moduleURL);
    const prototype = GardenTransport.prototype;
    const start = prototype.start, emit = prototype.emit, applyPlan = prototype.applyPlan, sounding = prototype.isSounding;
    window.ensembleQA = { starts: 0, peakVoices: 0, plans: [], events: [], firstAudible: {}, restore: () => {
      prototype.start = start; prototype.emit = emit; prototype.applyPlan = applyPlan;
      prototype.isSounding = sounding;
    } };
    prototype.isSounding = function (id) {
      const result = sounding.call(this, id);
      if (result) window.ensembleQA.firstAudible[id] ??= performance.now();
      return result;
    };
    prototype.start = function (...args) {
      window.ensembleQA.starts++; window.ensembleQA.engine = this;
      if (!this.ensembleLifeObserved) {
        this.ensembleLifeObserved = true;
        const observer = this.onLifeEvent;
        this.onLifeEvent = event => {
          observer?.(event);
          if (event && ['note','sustain-start','tap'].includes(event.type)) window.ensembleQA.firstAudible[event.objectId] ??= performance.now();
        };
      }
      return start.apply(this, args);
    };
    prototype.applyPlan = function (...args) {
      window.ensembleQA.plans.push(args[0]);
      return applyPlan.apply(this, args);
    };
    prototype.emit = function (lane, notes, layer, at, seconds) {
      emit.call(this, lane, notes, layer, at, seconds);
      window.ensembleQA.peakVoices = Math.max(window.ensembleQA.peakVoices, lane.voices.size);
      if (notes.length) window.ensembleQA.events.push({ id: lane.object.id, layer, at, notes });
    };
  });
  const nav = page.locator(".space-nav"), field = page.getByTestId("garden-field");
  let placed = 0;
  for (const [title, x] of [["波 A", .3], ["波 B", .78]]) {
    await nav.getByRole("button", { name: "DRAW", exact: true }).click();
    await page.getByRole("button", { name: "波", exact: true }).click();
    await page.getByRole("textbox", { name: "作品名" }).fill(title);
    await page.getByRole("button", { name: "庭に置く", exact: true }).click();
    const box = await field.boundingBox();
    await field.click({ position: { x: box.width * x, y: box.height * .4 } });
    await page.waitForFunction((count) => {
      const objects = document.querySelectorAll(".garden-artwork[data-object]");
      return objects.length === count && objects[count - 1].hasAttribute("data-life");
    }, ++placed);
    assert(await page.locator(".garden-artwork[data-object]").last().evaluate((el) =>
      performance.now() - window.ensembleQA.firstAudible[el.dataset.object] < 1000), "inhabitant response was not synchronized with first sound");
  }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("picture-score:garden:v1") || "{}").objects?.length === 2);
  const sources = () => page.evaluate(() => JSON.parse(localStorage.getItem("picture-score:garden:v1")).objects.map((o) => ({
    project: o.project, strokeIR: o.strokeIR, scoreIR: o.scoreIR, musicIR: o.musicIR,
  })));
  const before = await sources();
  await page.evaluate(() => {
    const q = window.ensembleQA;
    q.originalClock = q.engine.startTime; q.originalContext = q.engine.ctx;
    q.startCount = q.starts;
    q.buses = [...q.engine.lanes.values()].map((lane) => [lane.gain, lane.free, lane.ensemble]);
    q.listener = JSON.stringify(q.engine.state.listener);
  });
  const b = page.locator(".garden-artwork[data-object]").nth(1);
  const drag = async (x) => {
    await field.scrollIntoViewIfNeeded();
    const box = await field.boundingBox(), rect = await b.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * x, box.y + box.height * .4, { steps: 24 });
    await page.mouse.up();
  };
  const started = Date.now();
  let previousBeat = 0;
  // 20–30 seconds of real pointer movement while the actual app keeps playing.
  for (let i = 0; i < 10; i++) {
    const near = i % 2 === 0;
    await drag(near ? .38 : .78);
    await page.waitForFunction((near) => near ? !!document.querySelector('[data-relation="call-response"]') :
      !document.querySelector("[data-relation]"), near);
    await page.waitForTimeout(1900);
    const state = await page.evaluate(() => {
      const q = window.ensembleQA;
      return {
        beat: q.engine.beat, clock: q.engine.startTime === q.originalClock,
        sameContext: q.engine.ctx === q.originalContext, starts: q.starts === q.startCount,
        listener: JSON.stringify(q.engine.state.listener) === q.listener,
        buses: [...q.engine.lanes.values()].every((lane, i) => [lane.gain, lane.free, lane.ensemble].every((bus, j) => bus === q.buses[i][j])),
      };
    });
    assert(state.beat > previousBeat && state.clock && state.sameContext && state.starts && state.listener && state.buses, "drag restarted audio, rebuilt buses, or moved listener");
    previousBeat = state.beat;
  }
  const dragSeconds = (Date.now() - started) / 1000;
  await drag(.38);
  await page.waitForFunction(() => document.querySelector('[data-relation="call-response"]'));
  assert((await page.locator(".ensemble-status").innerText()).includes("交代で歌っている"), "duet status missing");
  await page.screenshot({ path: "output/playwright/ensemble-desktop.png", fullPage: true });
  await page.getByRole("combobox", { name: "Language / 言語" }).selectOption("en");
  assert((await page.locator(".ensemble-status").innerText()).includes("taking turns"), "English relation status missing");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/playwright/ensemble-mobile.png", fullPage: true });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await field.scrollIntoViewIfNeeded();
  const box = await field.boundingBox(), rect = await b.boundingBox();
  const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  await touch("touchStart", [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }]);
  await touch("touchMove", [{ x: box.x + box.width * .8, y: box.y + box.height * .4, id: 1 }]);
  await touch("touchEnd", []);
  await page.waitForFunction(() => !document.querySelector("[data-relation]"));
  const listener = page.getByRole("button", { name: "Listening position. Drag or use arrow keys to move" });
  await listener.focus(); await listener.press("ArrowLeft");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "mobile overflow");
  await page.getByRole("button", { name: "Pause garden", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".garden-artwork.audible"));
  await page.waitForTimeout(350);
  assert(JSON.stringify(before) === JSON.stringify(await sources()), "moving or arranging mutated source IR");
  const live = await page.evaluate(() => {
    const q = window.ensembleQA;
    const result = { starts: q.starts, peakVoices: q.peakVoices, plans: q.plans.length,
      quantized: q.plans.every(Number.isInteger), events: q.events.length,
      stopped: !q.engine.running && q.engine.lanes.size === 0 };
    q.restore(); return result;
  });
  assert(live.quantized && live.stopped && live.peakVoices <= 48, "scheduler is unbounded or not quantized");
  await page.reload();
  await nav.getByRole("button", { name: "GARDEN", exact: true }).click();
  assert(await page.locator(".garden-artwork[data-object]").count() === 2, "v0.1 persistence failed");
  assert(JSON.stringify(before) === JSON.stringify(await sources()), "reload changed IR");
  await nav.getByRole("button", { name: "DRAW", exact: true }).click();
  assert(await page.getByTestId("score-canvas").isVisible(), "DRAW return failed");
  assert(!errors.length, "browser errors: " + errors.join("; "));
  return { dragSeconds, live, mobile: "390x844 touch", sourcePreserved: true, errors };
}
