// Browser regression: closing the share dialog returns focus to what opened it, in the same task.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:4175";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4175", "--strictPort"], {
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

// Mark the opener, close, then read focus immediately: no frame may pass with focus elsewhere.
async function expectFocusReturns(page, opener, close, label) {
  await opener.evaluate((element) => { element.dataset.shareOpener = "true"; });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "音つきで、届けよう。" });
  await dialog.waitFor();
  await close(dialog);
  const focus = await page.evaluate(() => ({
    onOpener: document.activeElement?.dataset.shareOpener === "true",
    active: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 24) || document.activeElement?.tagName,
  }));
  assert.ok(focus.onOpener, `${label}: focus went to "${focus.active}" instead of the share opener`);
  assert.equal(await dialog.count(), 0, `${label}: the share dialog must be closed`);
  await opener.evaluate((element) => { delete element.dataset.shareOpener; });
}

const closeButton = (dialog) => dialog.getByRole("button", { name: "共有を閉じる" }).click();
const escape = (dialog) => dialog.press("Escape");

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    localStorage.clear();
    const { saveArtwork } = await import("/src/library/store.ts");
    const { emptyProject } = await import("/src/music/project.ts");
    const { exampleStrokes } = await import("/src/music/examples.ts");
    await saveArtwork({ ...emptyProject(), title: "フォーカスのうた", strokes: exampleStrokes("wave") }, null);
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  // Sketchbook: close button and Escape.
  await page.getByRole("button", { name: "作品帳", exact: true }).click();
  const libraryShare = page.getByRole("article", { name: "フォーカスのうた", exact: true }).getByRole("button", { name: "音つきで共有", exact: true });
  await expectFocusReturns(page, libraryShare, closeButton, "Sketchbook close button");
  await expectFocusReturns(page, libraryShare, escape, "Sketchbook Escape");

  // Studio: More save options → Share with sound. The menu closes, so focus returns to its toggle.
  await page.getByRole("button", { name: "スタジオ", exact: true }).click();
  await page.getByRole("button", { name: "波", exact: true }).click();
  const more = page.getByRole("button", { name: "ほかの保存方法", exact: true });
  await more.click();
  await more.evaluate((element) => { element.dataset.shareOpener = "true"; });
  await page.getByRole("button", { name: "音つきで共有", exact: true }).click();
  const studioDialog = page.getByRole("dialog", { name: "音つきで、届けよう。" });
  await studioDialog.waitFor();
  await closeButton(studioDialog);
  assert.ok(await page.evaluate(() => document.activeElement?.dataset.shareOpener === "true"), "Studio: focus must return to More save options");
  await more.evaluate((element) => { delete element.dataset.shareOpener; });

  // Done! dialog: share opens above it and closing returns to its Share button.
  await page.locator(".finish-button").click();
  await page.locator(".finish-dialog button[type=submit]").click();
  await page.getByRole("heading", { name: "作品帳に残したよ。" }).waitFor();
  await expectFocusReturns(page, page.locator(".finish-dialog").getByRole("button", { name: "音つきで共有", exact: true }), escape, "Done! dialog Escape");
  assert.ok(await page.locator(".finish-dialog").isVisible(), "closing share must keep the Done! dialog open");

  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS: closing share returns focus to its opener immediately (Sketchbook, Studio, Done!).");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
