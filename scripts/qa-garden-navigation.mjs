// Browser regression: Garden edits must survive HOME navigation before the 250ms debounce.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:4173";
const gardenKey = "picture-score:garden:v1";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => { output += chunk.toString(); });
}
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Vite exited early: " + output);
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch { /* Vite is starting. */ }
    await sleep(100);
  }
  throw new Error("Vite did not start: " + output);
}

async function listenerX(page) {
  return page.locator(".garden-listener").evaluate((element) => parseFloat(element.style.left));
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  // Select tabs by label: the shell has HOME / STUDIO / SKETCHBOOK / GARDEN.
  const tab = (label) => page.locator(".product-bottom-nav button").filter({ hasText: label });
  const gardenTab = tab(/ガーデン|Garden/), homeTab = tab(/ホーム|Home/);
  await gardenTab.click();
  await page.locator(".garden-listener").waitFor({ state: "visible" });
  const before = await listenerX(page);
  assert.equal(before, 50, "the empty Garden starts with its listener at 50%");

  // Freeze browser timers so the debounced writer cannot mask a missing unmount flush.
  await page.clock.pauseAt(new Date());
  await page.locator(".garden-listener").focus();
  await page.keyboard.press("ArrowRight");
  let moved = before;
  for (let attempt = 0; attempt < 30; attempt++) {
    moved = await listenerX(page);
    if (moved > before) break;
    await sleep(20);
  }
  assert.ok(moved > before, "keyboard input must move the listener");
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), gardenKey), null,
    "the 250ms debounced writer must still be pending");

  await homeTab.click(); // HOME unmounts GardenView without pagehide.
  await page.locator('[data-surface="home"]').waitFor();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), gardenKey);
  assert.ok(saved, "HOME navigation must flush the pending Garden state");
  assert.ok(Math.abs(saved.listener.x * 100 - moved) < 0.01, "HOME must save the latest listener position");

  await page.clock.resume();
  await gardenTab.click();
  await page.locator(".garden-listener").waitFor({ state: "visible" });
  assert.ok(Math.abs(await listenerX(page) - moved) < 0.01, "reopening Garden must restore the edit");

  await page.reload({ waitUntil: "domcontentloaded" });
  await gardenTab.click();
  await page.locator(".garden-listener").waitFor({ state: "visible" });
  assert.ok(Math.abs(await listenerX(page) - moved) < 0.01, "reload must restore the edit");
  console.log("PASS: pending Garden edit survives HOME, reentry, and reload.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
