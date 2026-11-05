// Browser checks for the tool pages and the editor's signature pad / object tools.
// Start the service first (see docs/PDF_EDITOR.md), then: node tests/browser/features.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const fixture = fs.mkdtempSync('/tmp/pdf-tools-features-');
execFileSync('.venv/bin/python', ['tests/browser/fixtures.py', fixture]);
const root = (process.env.EDITOR_URL || 'http://127.0.0.1:8001/pdf_tools/editor').replace(/\/editor\/?$/, '');
const sample = path.join(fixture, 'sample.pdf');
const py = code => execFileSync('.venv/bin/python', ['-c', code]).toString().trim();

(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
  const errors = [], external = [];
  await context.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin !== new URL(root).origin) { external.push(u.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const save = async (click, name) => { const [d] = await Promise.all([page.waitForEvent('download'), click()]); const file = path.join(fixture, name); await d.saveAs(file); return file; };
  const submit = () => page.locator('button[type=submit]').click();

  // Merge: two documents, second limited to pages 1-2.
  await page.goto(`${root}/merge`);
  await page.locator('#merge-picker').setInputFiles([sample, sample]);
  await page.waitForFunction(() => [...document.querySelectorAll('.file-item')].every(i => i.dataset.metadataState === 'ready'));
  await page.locator('.range-input').nth(1).fill('1-2');
  await page.locator('.file-item').nth(1).locator('.rotate').click();
  assert.equal(await page.locator('.file-item').nth(1).locator('.rotation-note').innerText(), 'Rotated 90°');
  let file = await save(submit, 'merged.pdf');
  assert.equal(py(`from pypdf import PdfReader; print([p.rotation for p in PdfReader(${JSON.stringify(file)}).pages])`), '[0, 0, 0, 90, 90]');
  // Start over clears the page.
  await page.locator('[data-reset]').click();
  await page.waitForLoadState('load');
  assert.equal(await page.locator('.file-item').count(), 0);
  console.log('PASS merge with rotation, start over');

  // Extract: thumbnail selection drives the range; PNG export produces a ZIP.
  await page.goto(`${root}/extract`);
  await page.locator('#extract-file').setInputFiles(sample);
  await page.waitForFunction(() => document.querySelectorAll('.page-thumb canvas').length === 3);
  await page.locator('.page-thumb').nth(2).click();
  assert.equal(await page.inputValue('#page-range'), '1, 3');
  file = await save(submit, 'extracted.pdf');
  assert.equal(py(`from pypdf import PdfReader; print(len(PdfReader(${JSON.stringify(file)}).pages))`), '2');
  await page.locator('input[value=png]').check({force: true});
  file = await save(submit, 'pages.zip');
  assert.equal(py(`import zipfile; print(len(zipfile.ZipFile(${JSON.stringify(file)}).namelist()))`), '2');
  // Remove mode: drop page 2, keep pages 1 and 3.
  await page.locator('input[value=pdf]').check({force: true});
  await page.locator('input[value=remove]').check({force: true});
  await page.locator('#page-range').fill('2');
  assert.match(await page.locator('#selection-count').innerText(), /1 page removed · 2 pages kept/);
  file = await save(submit, 'removed.pdf');
  assert.equal(py(`from pypdf import PdfReader; print(len(PdfReader(${JSON.stringify(file)}).pages))`), '2');
  await page.locator('#page-range').fill('1-3');
  await submit();
  assert.match(await page.locator('#workspace-error').innerText(), /remove every page/);
  console.log('PASS extract keep, remove and PNG');

  // Oversized files are refused in the browser, before upload, when the server sets a limit.
  await page.goto(`${root}/split`);
  assert.match(await page.locator('.site-footer').innerText(), /PDF Tools v\d+\.\d+\.\d+/);
  const limit = Number(await page.evaluate(() => document.body.dataset.maxUpload)) || 0;
  if (limit) {
    const big = path.join(fixture, 'big.pdf');
    fs.writeFileSync(big, Buffer.concat([fs.readFileSync(sample), Buffer.alloc(limit + 1024, 32)]));
    await page.locator('input[name=file]').setInputFiles(big);
    assert.match(await page.locator('.workspace-error').innerText(), /accepts up to/);
    console.log('PASS upload limit message');
  }

  // Split into custom groups.
  await page.goto(`${root}/split`);
  await page.locator('input[name=file]').setInputFiles(sample);
  await page.waitForFunction(() => document.querySelectorAll('.part-card').length > 0);
  await page.locator('#groups').fill('1; 2-3');
  await page.waitForFunction(() => document.getElementById('plan-summary').textContent.startsWith('2 files'));
  file = await save(submit, 'split.zip');
  assert.equal(py(`import zipfile; print(zipfile.ZipFile(${JSON.stringify(file)}).namelist())`), "['sample-part-1-page-1.pdf', 'sample-part-2-pages-2-3.pdf']");
  console.log('PASS split');

  // Stamp: numbers and a watermark chosen from the suggestions.
  await page.goto(`${root}/stamp`);
  await page.locator('input[name=file]').setInputFiles(sample);
  await page.waitForSelector('#preview-canvas:not([hidden])');
  await page.locator('[data-word=DRAFT]').click();
  assert.equal(await page.locator('#preview-watermark').innerText(), 'DRAFT');
  file = await save(submit, 'stamped.pdf');
  const stamped = py(`from pypdf import PdfReader; print(all('DRAFT' in p.extract_text() and f'Page {i+1} of 3' in p.extract_text() for i, p in enumerate(PdfReader(${JSON.stringify(file)}).pages)))`);
  assert.equal(stamped, 'True');
  console.log('PASS stamp');

  // Editor: draw a signature, place it, nudge, duplicate, copy to all pages, paste, export.
  await page.goto(`${root}/editor`);
  await page.locator('#pdf-input').setInputFiles(sample);
  await page.waitForSelector('#paper[data-ready]');
  const settled = () => page.waitForSelector('#paper[data-ready]:not([data-rendering])');
  await page.locator('#signature').click();
  const pad = await page.locator('#signature-pad').boundingBox();
  await page.mouse.move(pad.x + 60, pad.y + pad.height * 0.7); await page.mouse.down();
  for (let i = 1; i <= 24; i++) await page.mouse.move(pad.x + 60 + i * 14, pad.y + pad.height * (0.7 - 0.25 * Math.sin(i / 3)));
  await page.mouse.up();
  await page.locator('#sig-use').click();
  await page.waitForFunction(() => document.getElementById('notice').textContent.includes('place the signature'));
  const paper = await page.locator('#paper').boundingBox();
  await page.mouse.click(paper.x + 60, paper.y + 640);
  await settled();
  assert.equal(await page.locator('#marks image').count(), 1);
  const x0 = Number(await page.inputValue('#object-x'));
  await page.keyboard.press('Shift+ArrowRight'); await page.keyboard.press('ArrowRight');
  await settled();
  assert.equal(Number(await page.inputValue('#object-x')), x0 + 11);
  await page.keyboard.press('Control+d'); await settled();
  assert.equal(await page.locator('#marks image').count(), 2);
  await page.keyboard.press('Control+z'); await settled();
  const placed = await page.locator('#marks image').boundingBox();
  await page.mouse.click(placed.x + placed.width / 2, placed.y + placed.height / 2); await settled();
  await page.locator('#copy-all-pages').click(); await settled();
  assert.match(await page.locator('#notice').innerText(), /Copied to 2 other pages/);
  await page.keyboard.press('Control+c');
  await page.locator('#next').click(); await settled();
  assert.equal(await page.locator('#marks image').count(), 1);
  await page.keyboard.press('Control+v'); await settled();
  assert.equal(await page.locator('#marks image').count(), 2);
  const before = await page.locator('#zoom-label').innerText();
  await page.mouse.move(paper.x + 200, paper.y + 200);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control');
  assert.notEqual(await page.locator('#zoom-label').innerText(), before);
  // Reopening the pad offers the signature again.
  await page.locator('#signature').click();
  assert.equal(await page.locator('#recent-list .recent-item').count(), 1);
  await page.keyboard.press('Escape');
  file = await save(() => page.locator('#export').click(), 'signed.pdf');
  // Count placed image objects (an image reused on a page is embedded only once).
  const images = py(`import pypdfium2 as p, pypdfium2.raw as r; d = p.PdfDocument(${JSON.stringify(file)}); print([sum(1 for _ in pg.get_objects(filter=[r.FPDF_PAGEOBJ_IMAGE], max_depth=4)) for pg in d])`);
  assert.equal(images, '[1, 2, 1]');
  console.log('PASS editor signature pad, nudge, duplicate, copy to all pages, paste and zoom');
  // Close clears everything from the tab.
  await page.locator('#close-doc').click();
  await page.waitForFunction(() => document.getElementById('page-count').textContent === '0');
  assert.match(await page.locator('#notice').innerText(), /Nothing from it remains/);
  assert.equal(await page.locator('#empty').isVisible(), true);
  console.log('PASS editor close');

  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log('PASS feature checks, no external requests or JS errors');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
