const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const fixture=fs.mkdtempSync('/tmp/pdf-editor-browser-');
const shots=process.env.SCREENSHOT_DIR || path.resolve('docs/screenshots');
fs.mkdirSync(shots,{recursive:true});
execFileSync('.venv/bin/python',['tests/browser/fixtures.py',fixture]);
const base=process.env.EDITOR_URL || 'http://127.0.0.1:8001/pdf_tools/editor';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1500,height:1100}});
 const errors=[],external=[]; await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==new URL(base).origin){external.push(u.href);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(base);await page.screenshot({path:path.join(shots,'01-editor-empty.png'),fullPage:true});await page.locator('#pdf-input').setInputFiles(path.join(fixture,'sample.pdf'));await page.waitForSelector('#paper[data-ready]');
 // Wait until the page canvas and editing layer have finished re-rendering.
async function settled(){await page.waitForSelector('#paper[data-ready]:not([data-rendering])');}
async function clickPoint(x,y){const b=await page.locator('#paper').boundingBox();await page.mouse.click(b.x+x,b.y+y);}
 await page.locator('[data-tool="text"]').click();await clickPoint(48,420);await page.locator('#object-text').fill('Reviewed for internal circulation');await page.locator('#font-size').fill('12');await page.locator('#apply').click();await page.waitForTimeout(200);
 assert.match(await page.locator('#notice').innerText(),/Changes applied/);
 await page.locator('[data-tool="comment"]').click();await clickPoint(480,260);await page.locator('#object-text').fill('Please confirm the maintenance window with the facilities team.');await page.locator('#apply').click();
 await page.locator('[data-tool="highlight"]').click();const span=page.locator('#text-layer span').filter({hasText:'The maintenance window begins'}).first();const b=await span.boundingBox();await page.mouse.move(b.x+1,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width-1,b.y+b.height/2,{steps:15});await page.mouse.up();await page.waitForTimeout(300);
 assert.equal(await page.locator('#marks rect[opacity]').count(),1,'text selection creates a highlight');
 await page.locator('[data-tool="rectangle"]').click();await page.locator('#color').fill('#176655');
 const paper=await page.locator('#paper').boundingBox();await page.mouse.move(paper.x+43,paper.y+412);await page.mouse.down();await page.mouse.move(paper.x+255,paper.y+455,{steps:8});await page.mouse.up();
 assert.equal(await page.locator('#marks .annotation').count(),4);
 await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelectorAll('#marks .annotation').length===3);await page.locator('#redo').click();await page.waitForFunction(()=>document.querySelectorAll('#marks .annotation').length===4);
 await page.locator('[data-tool="ink"]').click();await page.mouse.move(paper.x+340,paper.y+420);await page.mouse.down();await page.mouse.move(paper.x+370,paper.y+430,{steps:8});await page.mouse.move(paper.x+395,paper.y+410,{steps:8});await page.mouse.up();
 await page.locator('[data-tool="line"]').click();await page.mouse.move(paper.x+340,paper.y+450);await page.mouse.down();await page.mouse.move(paper.x+420,paper.y+450,{steps:8});await page.mouse.up();
 await page.locator('[data-tool="select"]').click();await page.locator('#comments button').click();
 await page.screenshot({path:path.join(shots,'02-editor-annotations.png'),fullPage:true});
 await page.locator('#image-input').setInputFiles(path.join(fixture,'signature.png'));await page.waitForTimeout(200);await clickPoint(48,620);await page.locator('#object-w').fill('180');await page.locator('#object-h').fill('54');await page.locator('#apply').click();await page.locator('#delete-object').click();
 await page.locator('#signature').click();await page.locator('#image-input').setInputFiles(path.join(fixture,'signature.png'));await page.waitForTimeout(200);await clickPoint(48,650);await page.locator('#object-w').fill('160');await page.locator('#object-h').fill('48');await page.locator('#apply').click();
 await settled();const placed=await page.locator('#marks image').last().boundingBox();await page.mouse.move(placed.x+placed.width/2,placed.y+placed.height/2);await page.mouse.down();await page.mouse.move(placed.x+placed.width/2+20,placed.y+placed.height/2-10,{steps:8});await page.mouse.up();await page.waitForFunction(()=>Number(document.querySelector('#object-x').value)===68);
 await settled();const handle=await page.locator('#marks .resize-handle').boundingBox();await page.mouse.move(handle.x+4,handle.y+4);await page.mouse.down();await page.mouse.move(handle.x+24,handle.y+14,{steps:8});await page.mouse.up();await page.waitForFunction(()=>Number(document.querySelector('#object-w').value)===180);
 await page.screenshot({path:path.join(shots,'03-editor-signature.png'),fullPage:true});
 await page.locator('[data-tool="edit"]').click();await page.locator('[data-edit]').first().waitFor();
 // Find the qualified object corresponding to Original text (native object index differs by document).
 const response=await context.request.post(base+'/inspect',{multipart:{file:{name:'sample.pdf',mimeType:'application/pdf',buffer:require('fs').readFileSync(path.join(fixture,'sample.pdf'))}}});const info=await response.json();const item=info.pages[0].editable.find(t=>t.text==='Original text');
 await page.locator(`[data-edit="${item.index}"]`).click();await page.locator('#object-text').fill('New text');await page.locator('#apply').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Existing text replaced'),{timeout:10000});await page.waitForTimeout(400);
 console.log('edit notice',await page.locator('#notice').innerText());
 await page.screenshot({path:path.join(shots,'04-editor-text-edit.png'),fullPage:true});
 await page.locator('#search-query').fill('Budget');await page.locator('#find-next').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Found on page'));
 const [project]=await Promise.all([page.waitForEvent('download'),page.locator('#save-project').click()]);await project.saveAs(path.join(fixture,'document.pdfproject'));
 const [pdf]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);await pdf.saveAs(path.join(fixture,'edited.pdf'));
 console.log(execFileSync('.venv/bin/python',['tests/browser/verify_export.py',path.join(fixture,'edited.pdf')],{encoding:'utf8'}).trim());
 const reopened=await context.newPage();reopened.on('pageerror',e=>errors.push(e.message));await reopened.goto(base);await reopened.locator('#pdf-input').setInputFiles(path.join(fixture,'edited.pdf'));await reopened.waitForSelector('#paper[data-ready]');assert.match(await reopened.locator('#comments').innerText(),/facilities team/);await reopened.close();
 const recovered=await context.newPage();recovered.on('pageerror',e=>errors.push(e.message));await recovered.goto(base);await recovered.locator('#project-input').setInputFiles(path.join(fixture,'document.pdfproject'));await recovered.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Project restored'));assert.equal(await recovered.locator('#page-count').innerText(),'3');await recovered.close();
 await page.waitForTimeout(300);await page.locator('#project-input').setInputFiles(path.join(fixture,'document.pdfproject'));await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Project restored'));assert.equal(await page.locator('#comments button').count(),1);
 await page.locator('#duplicate').click();assert.equal(await page.locator('#page-count').innerText(),'4');await page.locator('#undo').click();assert.equal(await page.locator('#page-count').innerText(),'3');await page.locator('#redo').click();assert.equal(await page.locator('#page-count').innerText(),'4');await page.locator('#rotate').click();await page.waitForTimeout(500);await page.screenshot({path:path.join(shots,'05-editor-page-controls.png'),fullPage:true});
 await page.locator('#move-up').click();assert.equal(await page.locator('#page-label').innerText(),'Page 1 of 4');await page.locator('#blank').click();assert.equal(await page.locator('#page-count').innerText(),'5');await page.locator('#remove-page').click();assert.equal(await page.locator('#page-count').innerText(),'4');
 const [extracted]=await Promise.all([page.waitForEvent('download'),page.locator('#extract').click()]);await extracted.saveAs(path.join(fixture,'extracted.pdf'));execFileSync('.venv/bin/python',['-c',`from pypdf import PdfReader; assert len(PdfReader(${JSON.stringify(path.join(fixture,'extracted.pdf'))}).pages)==1`]);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS browser flow, no external requests or JS errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
