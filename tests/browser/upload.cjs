// Run with the standalone service on port 8001. office.test is deliberately
// untrusted HTTP: localhost would hide secure-context deployment differences.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const fixture = fs.mkdtempSync('/tmp/pdf-upload-');
execFileSync('.venv/bin/python', ['tests/browser/fixtures.py', fixture]);
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP office.test 127.0.0.1']});
  try {
    for (const olderAPIs of [false, true]) {
      const context = await browser.newContext();
      if (olderAPIs) await context.addInitScript(() => {
        // APIs absent in Chrome 134. Legacy PDF.js must supply its own fallbacks.
        delete Map.prototype.getOrInsertComputed;
        delete Uint8Array.fromBase64;
        delete Uint8Array.prototype.toBase64;
        delete globalThis.Float16Array;
        delete Math.sumPrecise;
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const base = 'http://office.test:8001/pdf_tools/editor/';
      for (const id of ['empty-open', 'open']) {
        await page.goto(base);
        assert.equal(await page.evaluate(() => isSecureContext), false);
        const chooser = page.waitForEvent('filechooser');
        await page.locator('#' + id).click();
        await (await chooser).setFiles(path.join(fixture, 'sample.pdf'));
        await page.waitForSelector('#paper[data-ready]:not([data-rendering])');
        assert.equal(await page.locator('#page-count').innerText(), '3');
        assert.equal(page.url(), base);
      }
      await page.goto(base);
      const transfer = await page.evaluateHandle(bytes => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(bytes)], 'dropped.pdf', {type:'application/pdf'}));
        return dt;
      }, [...fs.readFileSync(path.join(fixture, 'sample.pdf'))]);
      await page.locator('#work-area').dispatchEvent('dragenter', {dataTransfer:transfer});
      await page.locator('#work-area').dispatchEvent('dragover', {dataTransfer:transfer});
      await page.locator('#work-area').dispatchEvent('drop', {dataTransfer:transfer});
      await page.waitForSelector('#paper[data-ready]:not([data-rendering])');
      assert.equal(await page.locator('#page-count').innerText(), '3');
      assert.equal(page.url(), base);
      assert.equal(context.pages().length, 1);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS HTTP chooser buttons and drag/drop; older APIs=${olderAPIs}`);
    }
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exit(1);});
