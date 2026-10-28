// Issue #65: cloud acceptance, never an Android/OS-share certification.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { videoRecovery, languageAndAccessibility, offlineRestart } from './qa-release-checks.mjs';

const out = 'output/playwright/release';
await mkdir(out, { recursive: true });
const report = {
  timestamp: new Date().toISOString(), sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  os: process.platform, node: process.version, ci: !!process.env.CI, run: process.env.GITHUB_RUN_ID ?? null,
  conditions: 'Desktop Chromium, isolated QA profiles, localhost. No deployment, Android device, OS share sheet or SNS.',
  releaseDecision: 'HOLD: Android, OS share/SNS and production-origin update are NOT TESTED. Review axe findings separately.',
  checks: [],
};
const servers = [];
async function serve(port, preview = false) {
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  servers.push(child);
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(`Server ${port} exited: ${log}`);
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) return child; } catch { /* starting */ }
    await sleep(100);
  }
  throw Error(`Server ${port} did not start: ${log}`);
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}
async function check(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    const status = detail?.acceptanceStatus ?? 'PASS';
    report.checks.push({ name, status, seconds: (Date.now() - start) / 1000, detail });
    console.log(`${status} ${name}: ${JSON.stringify(detail)}`);
  } catch (error) {
    report.checks.push({ name, status: 'FAIL', seconds: (Date.now() - start) / 1000, error: error.stack });
    console.error(`FAIL ${name}: ${error.stack}`);
    process.exitCode = 1;
  }
  await writeFile(`${out}/acceptance.json`, JSON.stringify(report, null, 2));
}
let browser;
try {
  await serve(5173);
  const preview = await serve(4173, true);
  browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  // Existing scripts are trusted repository code, not downloaded/evaluated content.
  // Each gets an isolated context; nested contexts are also created by the legacy scripts.
  const scripts = ['verify-sketchbook', 'verify-creation-flow', 'verify-product-backup',
    'verify-mobile-layout', 'verify-garden-touch', 'verify-share-edge-cases', 'verify-share-fallback'];
  for (const name of scripts) {
    if (process.env.QA_ONLY && !process.env.QA_ONLY.split(',').includes(name)) continue;
    await check(name, async () => {
      const context = await browser.newContext();
      context.setDefaultTimeout(12000);
      try {
        const page = await context.newPage();
        const run = runInThisContext(await readFile(`scripts/${name}.cjs`, 'utf8'), { filename: `${name}.cjs` });
        return await run(page) ?? { passed: true };
      } finally { await context.close(); }
    });
  }
  for (const [name, fn] of [['video-recovery', () => videoRecovery(browser, out)],
    ['language-a11y', () => languageAndAccessibility(browser, out)],
    ['offline-restart', () => offlineRestart(chromium, out, async () => {
      await stop(preview);
      await assert.rejects(fetch('http://127.0.0.1:4173/'), 'Preview server must really be stopped');
    })]]) {
    if (!process.env.QA_ONLY || process.env.QA_ONLY.split(',').includes(name)) await check(name, fn);
  }
} finally {
  await browser?.close();
  for (const server of servers) await stop(server);
  await writeFile(`${out}/acceptance.json`, JSON.stringify(report, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `## Release acceptance: HOLD\n\n${report.releaseDecision}\n\n| Check | Result |\n| --- | --- |\n` +
    report.checks.map(c => `| ${c.name} | ${c.status} |`).join('\n') + '\n\nArtifacts contain generated media, axe findings and exact runtime metadata. Green CI means the checks ran, not Android acceptance or WCAG compliance.\n');
}
