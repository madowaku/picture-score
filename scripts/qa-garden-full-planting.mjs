// Browser regression: planting from Done! into a full Garden never loses or silently replaces a work.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:4174";
const gardenKey = "picture-score:garden:v1";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4174", "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { output += chunk.toString(); });
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Vite exited early: " + output);
    try { if ((await fetch(base)).ok) return; } catch { /* Vite is starting. */ }
    await sleep(100);
  }
  throw new Error("Vite did not start: " + output);
}

// Twelve works around the edges, leaving the centre (the default planting spot) free.
async function seedFullGarden(page) {
  await page.evaluate(async (key) => {
    const { emptyGarden, makeObject } = await import("/src/garden/gardenState.ts");
    const { emptyProject } = await import("/src/music/project.ts");
    const { exampleStrokes } = await import("/src/music/examples.ts");
    const kinds = ["heart", "wave", "cat"];
    const spots = [[.15, .15], [.38, .15], [.62, .15], [.85, .15], [.15, .72], [.38, .72], [.62, .72], [.85, .72], [.15, .88], [.38, .88], [.62, .88], [.85, .88]];
    const garden = emptyGarden();
    garden.objects = spots.map(([x, y], index) => makeObject({ ...emptyProject(), title: `庭の作品${index + 1}`, strokes: exampleStrokes(kinds[index % 3]) }, { x, y }, `fixture-${index + 1}`));
    localStorage.setItem(key, JSON.stringify(garden));
  }, gardenKey);
}

const storedGarden = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), gardenKey);
const sketchbook = (page) => page.evaluate(async () => (await import("/src/library/store.ts")).listArtworks());
const tapCentre = async (page, locator) => {
  await locator.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

async function drawAndOpenDone(page, title) {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator(".home-primary").click();
  const box = await page.locator(".score-canvas").boundingBox();
  await page.mouse.move(box.x + box.width * .15, box.y + box.height * .6);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + box.width * (.15 + i * .03), box.y + box.height * (.6 - Math.sin(i / 4) * .2));
  await page.mouse.up();
  await page.locator(".finish-button").click();
  await page.locator("#finish-name").fill(title);
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  // 1. Full Garden: Done! warns, planting makes room only by an explicit choice, and removal can be undone.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await seedFullGarden(page);
    const before = await storedGarden(page);
    await drawAndOpenDone(page, "満杯の庭へ");
    assert.match(await page.locator(".finish-dialog").innerText(), /12作品でいっぱい/, "Done! must say the Garden is full before planting");
    await page.locator(".finish-plant").click();
    await page.locator(".garden-ghost").waitFor();
    assert.equal((await sketchbook(page)).filter((work) => work.project.title === "満杯の庭へ").length, 1,
      "the new work must already be kept in the sketchbook");
    assert.match(await page.locator(".garden-bottom [role=status]").innerText(), /休ませる作品/, "the full Garden must explain how to make room");

    await tapCentre(page, page.locator(".garden-ghost"));
    await sleep(400);
    assert.deepEqual((await storedGarden(page)).objects.map((o) => o.id), before.objects.map((o) => o.id),
      "tapping a full Garden must not plant, remove or replace anything");

    await tapCentre(page, page.locator('[data-object="fixture-6"]'));
    await page.locator(".garden-selection").getByRole("button", { name: "庭から取り除く" }).click();
    await page.getByRole("button", { name: "元に戻す" }).waitFor();
    await sleep(400);
    assert.equal((await storedGarden(page)).objects.length, 11, "the chosen work is removed only after the explicit choice");

    await page.getByRole("button", { name: "元に戻す" }).click();
    await sleep(400);
    const restored = await storedGarden(page);
    assert.deepEqual(restored.objects.map((o) => o.id), before.objects.map((o) => o.id), "undo must restore the same work in the same order");
    assert.deepEqual(restored.objects[5].world, before.objects[5].world, "undo must restore the same position");

    await tapCentre(page, page.locator('[data-object="fixture-6"]'));
    await page.locator(".garden-selection").getByRole("button", { name: "庭から取り除く" }).click();
    await page.getByRole("button", { name: "ここに置く" }).click();
    await page.locator(".garden-listen").filter({ hasText: "音を休める" }).waitFor();
    await sleep(400);
    const after = await storedGarden(page);
    assert.equal(after.objects.length, 12);
    assert.ok(after.objects.some((o) => o.title === "満杯の庭へ"), "the new work must be planted");
    assert.ok(!after.objects.some((o) => o.id === "fixture-6"), "only the work the user chose was removed");
    assert.equal(after.objects.filter((o) => o.id.startsWith("fixture-")).length, 11, "every other work stays");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // 2. Full Garden: stopping the placement keeps the drawing in Studio and leaves the Garden untouched.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await seedFullGarden(page);
    const before = await storedGarden(page);
    await drawAndOpenDone(page, "あとで植える");
    await page.locator(".finish-plant").click();
    await page.locator(".garden-ghost").waitFor();
    await page.getByRole("button", { name: "配置をやめる" }).click();
    await page.locator(".product-bottom-nav button").filter({ hasText: /スタジオ|Studio/ }).click();
    await page.locator(".score-canvas path[data-stroke]").first().waitFor();
    assert.deepEqual((await storedGarden(page)).objects.map((o) => o.id), before.objects.map((o) => o.id), "cancelling must not change the Garden");
    assert.equal((await sketchbook(page)).filter((work) => work.project.title === "あとで植える").length, 1, "the work stays in the sketchbook");
    await context.close();
  }
  // 3. Touch phone: a tap chooses a work to rest; cancelling the placement brings it back.
  {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await seedFullGarden(page);
    const before = await storedGarden(page);
    await drawAndOpenDone(page, "タッチで植える");
    await page.locator(".finish-plant").tap();
    await page.locator(".garden-ghost").waitFor();
    const artwork = page.locator('[data-object="fixture-2"]');
    await artwork.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const box = await artwork.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.locator(".garden-selection").getByRole("button", { name: "庭から取り除く" }).tap();
    await page.getByRole("button", { name: "元に戻す" }).waitFor();
    await page.getByRole("button", { name: "配置をやめる" }).tap();
    await sleep(400);
    assert.deepEqual((await storedGarden(page)).objects.map((o) => o.id), before.objects.map((o) => o.id),
      "cancelling after resting a work must bring it back");
    await context.close();
  }
  console.log("PASS: a full Garden never loses or silently replaces a work; room is made only by an undoable choice.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
