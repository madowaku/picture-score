import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const button = (page, name) => page.getByRole('button', { name, exact: true });
const state = page => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('picture-score:sketchbook');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    const rows = await new Promise((resolve, reject) => {
      const request = db.transaction('artworks').objectStore('artworks').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return { project: localStorage.getItem('picture-score:project:v1'), garden: localStorage.getItem('picture-score:garden:v1'), rows };
  } finally { db.close(); }
});

export async function videoRecovery(browser, out) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  context.setDefaultTimeout(12000);
  const page = await context.newPage(), errors = [], results = [], files = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:4173/');
    await button(page, 'スタジオ').click();
    await button(page, '波').click();
    await button(page, '音の設定').click();
    await page.getByRole('combobox', { name: 'テンポ', exact: true }).selectOption('140');
    await button(page, '音の設定を閉じる').click();
    await button(page, 'できた！').click();
    await page.locator('#finish-name').fill('受入 / Cloud song');
    await button(page, '作品帳に残す').click();
    await page.getByRole('heading', { name: '作品帳に残したよ。' }).waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('picture-score:project:v1') || '{}').title === '受入 / Cloud song');
    const before = await state(page);
    await button(page, '音つきで共有').click();
    // Test-only observation/injection. Audio rendering, Canvas and successful recording stay native.
    const supported = await page.evaluate(() => {
      const NativeRecorder = MediaRecorder, NativeAudio = AudioContext;
      const capture = HTMLCanvasElement.prototype.captureStream;
      const timer = window.setTimeout.bind(window);
      window.__qa = { mode: '', contexts: [], streams: [], recorders: [], urls: new Set() };
      window.AudioContext = class extends NativeAudio { constructor(...args) { super(...args); window.__qa.contexts.push(this); } };
      HTMLCanvasElement.prototype.captureStream = function(...args) {
        const stream = capture.apply(this, args); window.__qa.streams.push(stream); return stream;
      };
      window.MediaRecorder = class extends NativeRecorder {
        constructor(...args) {
          if (window.__qa.mode === 'constructor') throw new DOMException('QA encoder unavailable', 'NotSupportedError');
          super(...args); window.__qa.recorders.push(this);
        }
        start(...args) {
          if (window.__qa.mode === 'empty') { timer(() => this.onstop?.(new Event('stop')), 20); return; }
          super.start(...args);
          if (window.__qa.mode === 'error') timer(() => this.onerror?.(new Event('error')), 100);
        }
      };
      window.setTimeout = (fn, ms, ...args) => timer(fn, window.__qa.mode === 'timeout' && ms === 60000 ? 100 : ms, ...args);
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); window.__qa.urls.add(url); return url; };
      URL.revokeObjectURL = url => { window.__qa.urls.delete(url); revoke(url); };
      return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']
        .map(mime => ({ mime, supported: NativeRecorder.isTypeSupported(mime) }));
    });
    async function released() {
      await page.waitForFunction(() => window.__qa.contexts.every(c => c.state === 'closed') &&
        window.__qa.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')) &&
        window.__qa.recorders.every(r => r.state === 'inactive'));
    }
    async function generate() {
      await button(page, '音つき動画をつくる').click();
      await page.getByRole('button', { name: /動画を保存/ }).waitFor({ timeout: 45000 });
      await released();
      await page.locator('video').evaluate(async video => {
        await video.play();
        await new Promise(resolve => video.addEventListener('timeupdate', resolve, { once: true }));
        video.pause();
        if (video.currentTime <= 0 || video.error) throw Error('Generated video did not play');
      });
    }
    for (const mode of ['constructor', 'error', 'empty', 'timeout', 'cancel', 'hidden', 'close']) {
      await page.evaluate(mode => { window.__qa.mode = mode; }, mode);
      await button(page, '音つき動画をつくる').click();
      if (['cancel', 'hidden', 'close'].includes(mode)) {
        await page.waitForFunction(() => window.__qa.recorders.some(r => r.state === 'recording'));
        if (mode === 'cancel') await button(page, '作成をやめる').click();
        if (mode === 'close') {
          await button(page, '共有を閉じる').click();
          assert.equal(await button(page, '音つきで共有').evaluate(el => el === document.activeElement), true);
          await button(page, '音つきで共有').click();
        }
        if (mode === 'hidden') await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      await button(page, '音つき動画をつくる').waitFor();
      if (!['cancel', 'close'].includes(mode)) await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('video').count(), 0, `${mode}: partial video exposed`);
      assert.equal(await page.getByRole('button', { name: /動画を保存/ }).count(), 0);
      await released();
      await page.evaluate(() => { window.__qa.mode = ''; delete document.hidden; });
      // A real successful retry after EVERY fault prevents a stuck-state false positive.
      await generate();
      await button(page, '共有を閉じる').click();
      await page.waitForFunction(() => window.__qa.urls.size === 0);
      assert.deepEqual(await state(page), before, `${mode}: saved creation changed`);
      results.push({ mode, retry: 'native recording/playback PASS', tracksEnded: true, contextsClosed: true, urlsReleased: true });
      await button(page, '音つきで共有').click();
    }
    for (const shape of ['square', 'portrait']) {
      if (shape === 'portrait') await page.getByRole('button', { name: /縦長/ }).click();
      await page.locator('.share-stage canvas').screenshot({ path: `${out}/${shape}-puchi-preview.png` });
      await generate();
      const metadata = await page.locator('video').evaluate(v => ({ width: v.videoWidth, height: v.videoHeight, duration: v.duration }));
      assert.equal(metadata.width, 720); assert.equal(metadata.height, shape === 'square' ? 720 : 1280);
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /動画を保存/ }).click()]);
      const filename = `${out}/${shape}.${download.suggestedFilename().split('.').at(-1)}`;
      await download.saveAs(filename);
      files.push({ filename, ...metadata });
    }
    await button(page, '共有を閉じる').click();
    await page.waitForFunction(() => window.__qa.urls.size === 0);
    assert.deepEqual(errors, []);
    return { supported, faults: results, files, runtimeErrors: errors };
  } finally { await context.close(); }
}

export async function languageAndAccessibility(browser, out) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.setDefaultTimeout(12000);
  const page = await context.newPage(), errors = [], audits = [], layouts = [];
  page.on('pageerror', e => errors.push(e.message));
  const language = () => page.getByRole('combobox', { name: 'Language / 言語' });
  const nav = () => page.locator('.product-bottom-nav');
  async function audit(name) {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    audits.push({ name, violations: result.violations, incomplete: result.incomplete });
  }
  try {
    await page.goto('http://127.0.0.1:5173/');
    await button(page, 'スタジオ').click();
    await button(page, '波').click();
    const title = '私の波 / My wave';
    await page.getByRole('textbox', { name: '作品名', exact: true }).fill(title);
    await page.waitForFunction(title => JSON.parse(localStorage.getItem('picture-score:project:v1')).title === title, title);
    const before = await page.evaluate(() => localStorage.getItem('picture-score:project:v1'));
    const paths = await page.locator('.source-strokes path').evaluateAll(els => els.map(el => el.getAttribute('d')));
    await button(page, 'PLAY — 絵を演奏する').click();
    await language().selectOption('en');
    await button(page, 'STOP — Stop playback').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await button(page, 'STOP — Stop playback').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('picture-score:project:v1')), before);
    assert.deepEqual(await page.locator('.source-strokes path').evaluateAll(els => els.map(el => el.getAttribute('d'))), paths);
    await button(page, 'Done!').click();
    await button(page, 'Save to sketchbook').click();
    await page.getByRole('heading', { name: 'Safe in your sketchbook.' }).waitFor();
    await button(page, 'Plant in garden').click();
    await button(page, 'Place here').click();
    await button(page, 'Pause garden').waitFor();
    await language().selectOption('ja');
    await button(page, '音を休める').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('picture-score:garden:v1') || '{}').objects?.length === 1);
    const saved = await state(page);
    for (const locale of ['ja', 'en']) {
      await language().selectOption(locale);
      const names = locale === 'ja' ? ['ホーム', 'スタジオ', '作品帳', 'ガーデン'] : ['Home', 'Studio', 'Sketchbook', 'Garden'];
      for (const [width, height] of [[320, 568], [360, 480], [390, 844], [844, 390], [1280, 900]]) {
        await page.setViewportSize({ width, height });
        for (const name of names) {
          const target = nav().getByRole('button', { name, exact: true });
          await target.click();
          assert.equal(await target.getAttribute('aria-current'), 'page');
          assert.equal(await page.locator('html').getAttribute('lang'), locale);
          const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
          assert.ok(size.scroll <= size.width, `${locale} ${name} ${width}: horizontal overflow`);
          assert.equal(await target.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'Navigation covered');
          if (width === 390) {
            await page.screenshot({ path: `${out}/${locale}-${names.indexOf(name)}-mobile.png`, fullPage: true });
            await audit(`${locale}/${name}`);
          }
        }
        layouts.push({ locale, width, height, surfaces: names });
      }
      await nav().getByRole('button', { name: names[1], exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: locale === 'ja' ? '作品名' : 'Artwork title', exact: true }).inputValue(), title);
      await button(page, locale === 'ja' ? 'ほかの保存方法' : 'More save options').click();
      await button(page, locale === 'ja' ? '音つきで共有' : 'Share with sound').click();
      const dialog = page.locator('.share-dialog');
      await audit(`${locale}/share-dialog`);
      await dialog.getByRole('button').first().focus();
      for (let i = 0; i < 18; i++) {
        await page.keyboard.press(i < 9 ? 'Tab' : 'Shift+Tab');
        // Native <dialog> may cycle through browser chrome (activeElement=body).
        // It must never reach an interactive element in the background document.
        assert.equal(await page.evaluate(() => document.activeElement === document.body || document.querySelector('.share-dialog').contains(document.activeElement)), true, 'Focus reached background content');
      }
      assert.ok(!(await page.locator('#share-caption').inputValue()).includes('127.0.0.1'));
      await page.keyboard.press('Escape');
      assert.equal(await button(page, locale === 'ja' ? 'ほかの保存方法' : 'More save options').evaluate(el => el === document.activeElement), true);
      assert.deepEqual(await state(page), saved, 'Language/navigation changed saved work');
      await page.reload();
      assert.equal(await page.locator('html').getAttribute('lang'), locale, 'Preference lost on reload');
      await nav().getByRole('button', { name: names[3], exact: true }).click();
    }
    // Preserve #64 with inspectable stills at an actual sounding note and later playhead.
    const frames = await page.evaluate(async () => {
      const { createVideoPainter } = await import('/src/share/painter.ts');
      const { projectMusic } = await import('/src/music/arrangement.ts');
      const project = JSON.parse(localStorage.getItem('picture-score:project:v1'));
      const music = projectMusic(project), canvas = document.createElement('canvas');
      const paint = createVideoPainter(canvas, project, music, 'square');
      return [null, music.playNotes[0].beat * 60 / project.tempo + .06, 3].map(seconds => {
        paint(seconds); return { seconds, png: canvas.toDataURL('image/png').split(',')[1] };
      });
    });
    for (let i = 0; i < frames.length; i++) await writeFile(`${out}/painter-${i}.png`, Buffer.from(frames[i].png, 'base64'));
    assert.deepEqual(errors, []);
    await writeFile(`${out}/axe.json`, JSON.stringify(audits, null, 2));
    // Findings stay visible in the report; a green browser job is not WCAG certification.
    return { layouts, languagePreservesWork: true, playbackContinues: true, keyboardModal: true,
      accessibility: audits.map(a => ({ name: a.name, violations: a.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), incomplete: a.incomplete.length })) };
  } finally { await context.close(); }
}

export async function offlineRestart(chromium, out, stopServer) {
  // A real browser process restart with the same throwaway profile, not just reload.
  const profile = await mkdtemp(`${out}/offline-profile-`);
  let context;
  const errors = [];
  try {
    context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 390, height: 844 } });
    let page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
    assert.equal(manifest.display, 'standalone');
    await button(page, 'スタジオ').click();
    const box = await page.locator('.score-canvas').boundingBox();
    await page.mouse.move(box.x + box.width * .2, box.y + box.height * .4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .6, { steps: 20 });
    await page.mouse.up();
    await button(page, 'できた！').click();
    await page.locator('#finish-name').fill('再起動のうた');
    await page.locator('.finish-plant').click();
    await button(page, 'ここに置く').click();
    await button(page, '音を休める').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('picture-score:garden:v1') || '{}').objects?.length === 1 &&
      JSON.parse(localStorage.getItem('picture-score:project:v1') || '{}').title === '再起動のうた');
    const saved = await state(page);
    assert.equal(saved.rows.length, 1);
    assert.equal(JSON.parse(saved.garden).objects.length, 1);
    await context.close(); context = null;
    await stopServer();
    context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 390, height: 844 } });
    await context.setOffline(true);
    page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto('http://127.0.0.1:4173/');
    assert.equal(response.fromServiceWorker(), true, 'Restart must load from SW');
    assert.deepEqual(await state(page), saved, 'Restart changed draft/library/Garden');
    await button(page, '作品帳').click();
    await page.getByRole('article', { name: '再起動のうた', exact: true }).waitFor();
    await button(page, 'ガーデン').click();
    assert.equal(await page.locator('.garden-artwork[data-object]').count(), 1);
    await button(page, 'スタジオ').click();
    await button(page, 'PLAY — 絵を演奏する').click();
    await button(page, 'STOP — 再生を止める').click();
    const count = await page.locator('.source-strokes path').count();
    const draw = await page.locator('.score-canvas').boundingBox();
    await page.mouse.move(draw.x + draw.width * .25, draw.y + draw.height * .7);
    await page.mouse.down(); await page.mouse.move(draw.x + draw.width * .7, draw.y + draw.height * .3, { steps: 12 }); await page.mouse.up();
    assert.equal(await page.locator('.source-strokes path').count(), count + 1);
    await button(page, 'できた！').click();
    await button(page, '作品帳を更新').click();
    await page.getByRole('heading', { name: '作品帳に残したよ。' }).waitFor();
    await button(page, '音つきで共有').click();
    await button(page, '音つき動画をつくる').click();
    await page.getByRole('button', { name: /動画を保存/ }).waitFor({ timeout: 45000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /動画を保存/ }).click()]);
    await download.saveAs(`${out}/offline.${download.suggestedFilename().split('.').at(-1)}`);
    await page.screenshot({ path: `${out}/offline-restarted.png`, fullPage: true });
    await page.goto('http://127.0.0.1:4173/privacy.html');
    await page.getByRole('heading', { name: 'プライバシーと保存について', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    return { serverStopped: true, browserProcessRestarted: true, serviceWorkerResponse: true,
      draftLibraryGardenPreserved: true, offlineDrawSaveVideoPrivacy: true,
      limitation: 'Desktop persistent profile, not Android launcher/standalone or production-origin update.' };
  } finally { await context?.close(); }
}
