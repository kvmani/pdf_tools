import {pdfjs, loadDocument} from './pdf_runtime.js';

const $ = id => document.getElementById(id);
const api = document.body.dataset.api;
const ns = 'http://www.w3.org/2000/svg';
const clone = value => structuredClone(value);
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let sources = [], assets = {}, pages = [], active = 0, tool = 'select', selected = null;
let undo = [], redo = [], zoom = 1, dirty = false, busy = false, pendingImage = null;
let viewport = null, baseWidth = 595, baseHeight = 842, generation = 0, rendering = Promise.resolve();
let gesture = null, draggedPage = null, textLayer = null, assetKind = 'image';
let previewCache = new Map();
let existingAnnotations = [], sourceViewport = null;
const help = {
    select: 'Click an object to adjust it. Drag to move; use the corner handle to resize.',
    text: 'Click the page to place a text box, then edit its text and size here.',
    edit: 'Click a green text box. Only simple standard-font English text is editable; replacements must fit.',
    highlight: 'Select text to highlight it, or drag an empty area for an area highlight.',
    comment: 'Click anywhere to place a comment, then enter your note and apply.',
    ink: 'Draw on the page with your mouse, stylus or touch. Color and line width apply to new strokes.',
    rectangle: 'Drag to draw an outline. Boxes are not redaction.',
    line: 'Drag to draw a line. Adjust its color and width here.'
};

for (const button of document.querySelectorAll('[data-icon]')) {
    const svg = document.createElementNS(ns, 'svg');
    for (const [key, value] of Object.entries({class: 'icon', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'})) svg.setAttribute(key, value);
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', new URL(`../vendor/lucide/icons.svg#${button.dataset.icon}`, import.meta.url).href);
    svg.append(use); button.prepend(svg);
}
function notify(message, mode = '') { $('notice').textContent = message; $('notice').className = `notice ${mode}`; }
function fail(error) { notify(error.message || String(error), 'error'); }
function current() { return pages[active]; }
function snapshot() { return {pages: clone(pages), active}; }
function remember() { undo.push(snapshot()); if (undo.length > 60) undo.shift(); redo = []; dirty = true; }
function mutate(fn) { if (busy) return; remember(); fn(); selected = null; refresh(); }
function selectedMark() { return selected?.kind === 'mark' ? current()?.marks.find(m => m.id === selected.id) : null; }
function chooseTool(next) {
    tool = next; selected = null;
    for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
    $('paper').classList.toggle('selecting', tool === 'highlight');
    $('tool-help').textContent = help[tool];
    if (tool === 'highlight') $('color').value = '#ffdd44';
    drawMarks(); properties();
}
function history(direction) {
    if (busy) return;
    const from = direction === 'undo' ? undo : redo, to = direction === 'undo' ? redo : undo;
    if (!from.length) return;
    to.push(snapshot()); const previous = from.pop(); pages = previous.pages; active = previous.active;
    dirty = true; selected = null; refresh();
}
function refresh() {
    active = Math.max(0, Math.min(active, pages.length - 1));
    $('empty').hidden = pages.length > 0; $('page-wrap').hidden = !pages.length;
    $('page-count').textContent = pages.length;
    $('page-label').textContent = pages.length ? `Page ${active + 1} of ${pages.length}` : 'No document';
    $('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
    $('save-state').textContent = dirty ? 'Unsaved changes · Save a project to resume' : 'Project saved / no unsaved changes';
    $('undo').disabled = !undo.length || busy; $('redo').disabled = !redo.length || busy;
    for (const id of ['export','save-project','extract','duplicate','remove-page','rotate','move-up','move-down','previous','next']) $(id).disabled = !pages.length || busy;
    drawPageList(); properties();
    const token = ++generation;
    // Serialize canvas rendering; PDF.js forbids concurrent renders into a canvas.
    rendering = rendering.catch(() => {}).then(() => token === generation ? renderPage(token) : undefined).catch(fail);
}
function drawPageList() {
    $('pages').replaceChildren();
    pages.forEach((page, index) => {
        const card = document.createElement('button'); card.className = `page-card ${index === active ? 'active' : ''}`;
        card.draggable = true; card.dataset.pageId = page.id;
        card.setAttribute('aria-label', `Page ${index + 1}${index === active ? ', current page' : ''}`);
        const image = document.createElement('img'); image.className = 'mini'; image.alt = '';
        if (page.thumb) image.src = page.thumb;
        const title = document.createElement('span'); title.textContent = `Page ${index + 1}`;
        const subtitle = document.createElement('small'); subtitle.textContent = page.source === null ? 'Blank page' : sources[page.source]?.name || 'PDF';
        title.append(subtitle); card.append(image, title);
        card.onclick = () => { if (!busy) { active = index; selected = null; refresh(); } };
        card.ondragstart = e => { draggedPage = index; e.dataTransfer.setData('text/plain', String(index)); };
        card.ondragover = e => e.preventDefault();
        card.ondrop = e => { e.preventDefault(); if (draggedPage !== null && draggedPage !== index) mutate(() => { const [p] = pages.splice(draggedPage, 1); pages.splice(index, 0, p); active = index; }); draggedPage = null; };
        $('pages').append(card);
    });
}
async function responseOrError(response) {
    if (!response.ok) {
        let message = response.status === 413 ? 'This request exceeds the server upload limit (10 MiB by default). Use smaller PDFs/images.' : `Request failed (${response.status}).`;
        try { message = (await response.json()).error || message; } catch { /* HTML error response */ }
        throw new Error(message);
    }
    return response;
}
async function requestExport(specs) {
    const form = new FormData(); form.append('manifest', JSON.stringify({version: 1, pages: specs.map(({thumb,thumbRotation,...p})=>p)}));
    sources.forEach(source => form.append('sources', new Blob([source.bytes], {type: 'application/pdf'}), source.name));
    for (const [key, asset] of Object.entries(assets)) form.append(key, new Blob([asset.bytes], {type: asset.mime}), asset.name);
    return responseOrError(await fetch(`${api}/export`, {method: 'POST', body: form}));
}
async function openFiles(files) {
    if (busy || !files.length) return;
    busy = true; notify('Opening and inspecting document…', 'busy'); refresh();
    const loaded = [];
    try {
        if (sources.length + files.length > 20) throw new Error('A project supports up to 20 PDF sources.');
        for (const file of files) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const form = new FormData(); form.append('file', new Blob([bytes]), file.name);
            const info = await (await responseOrError(await fetch(`${api}/inspect`, {method: 'POST', body: form}))).json();
            const doc = await loadDocument(bytes.slice()).promise;
            loaded.push({name: file.name, bytes, info, doc});
        }
        if (pages.length + loaded.reduce((n, s) => n+s.info.page_count, 0) > 200) throw new Error('A project supports up to 200 pages.');
        remember(); const position = pages.length ? active + 1 : 0; const additions = [];
        for (const source of loaded) {
            const sourceIndex = sources.push(source)-1;
            for (let i = 0; i < source.info.page_count; i++) additions.push({id: uid(), source: sourceIndex, page: i, rotation: 0, marks: [], textEdits: []});
        }
        pages.splice(position, 0, ...additions); active = position;
        $('document-name').textContent = sources[0].name;
        notify('Document opened. Choose a tool to begin. Save a project backup to keep editable changes.');
    } catch (error) { for (const s of loaded) if (!sources.includes(s)) await s.doc.loadingTask.destroy(); fail(error); }
    finally { busy = false; refresh(); }
}
async function renderPage(token) {
    if (!current()) return;
    const model = current(); let pdfPage = null;
    textLayer?.cancel(); textLayer = null; existingAnnotations=[]; sourceViewport=null; $('text-layer').replaceChildren();
    let baseViewport;
    if (model.source !== null) {
        pdfPage = await sources[model.source].doc.getPage(model.page+1);
        baseViewport = pdfPage.getViewport({scale: 1}); sourceViewport=baseViewport;
        existingAnnotations=await pdfPage.getAnnotations({intent:'display'});
        baseWidth = baseViewport.width; baseHeight = baseViewport.height;
        if (model.textEdits.length) {
            const key = JSON.stringify([model.source, model.page, model.textEdits]);
            if (!previewCache.has(key)) {
                const response = await requestExport([{...model, marks: [], rotation: 0}]);
                const doc = await loadDocument(new Uint8Array(await response.arrayBuffer())).promise;
                previewCache.set(key, doc);
                if (previewCache.size > 12) { const oldest = previewCache.keys().next().value; await previewCache.get(oldest).loadingTask.destroy(); previewCache.delete(oldest); }
            }
            pdfPage = await previewCache.get(key).getPage(1);
        }
        viewport = pdfPage.getViewport({scale: zoom, rotation: (pdfPage.rotate+model.rotation)%360});
    } else {
        baseWidth = model.width; baseHeight = model.height;
        viewport = {width: (model.rotation%180 ? baseHeight : baseWidth)*zoom, height: (model.rotation%180 ? baseWidth : baseHeight)*zoom};
    }
    if (token !== generation) return;
    const cv = $('pdf-canvas'); const ratio = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.floor(viewport.width*ratio); cv.height = Math.floor(viewport.height*ratio);
    cv.style.width = `${viewport.width}px`; cv.style.height = `${viewport.height}px`;
    $('paper').style.width = `${viewport.width}px`; $('paper').style.height = `${viewport.height}px`;
    const context = cv.getContext('2d');
    if (pdfPage) {
        await pdfPage.render({canvasContext: context, viewport, transform: [ratio,0,0,ratio,0,0]}).promise;
        if (token !== generation) return;
        const content = await pdfPage.getTextContent();
        textLayer = new pdfjs.TextLayer({textContentSource: content, container: $('text-layer'), viewport});
        await textLayer.render();
    } else { context.fillStyle = 'white'; context.fillRect(0,0,cv.width,cv.height); }
    if (token !== generation) return;
    if (!model.thumb || model.thumbRotation !== model.rotation) {
        const mini = document.createElement('canvas'); mini.width = 80; mini.height = 106;
        mini.getContext('2d').drawImage(cv,0,0,80,106); model.thumb = mini.toDataURL(); model.thumbRotation = model.rotation; drawPageList();
    }
    drawMarks(); $('paper').dataset.ready = model.id;
}
function element(tag, attrs = {}, content) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (content !== undefined) node.textContent = content;
    return node;
}
function drawMarks() {
    const svg = $('marks'); svg.replaceChildren(); if (!current()) return;
    const page = current(), r = page.rotation;
    svg.setAttribute('viewBox', `0 0 ${r%180 ? baseHeight : baseWidth} ${r%180 ? baseWidth : baseHeight}`);
    const group = element('g', {transform: {0:'',90:`translate(${baseHeight} 0) rotate(90)`,180:`translate(${baseWidth} ${baseHeight}) rotate(180)`,270:`translate(0 ${baseWidth}) rotate(270)`}[r]}); svg.append(group);
    for (const annotation of existingAnnotations) {
        if (!sourceViewport || !annotation.rect) continue;
        const a=sourceViewport.convertToViewportPoint(annotation.rect[0],annotation.rect[1]);
        const b=sourceViewport.convertToViewportPoint(annotation.rect[2],annotation.rect[3]);
        const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]);
        if(annotation.subtype==='Highlight'&&!annotation.hasAppearance) group.append(element('rect',{x,y,width:w,height:h,fill:annotation.color?`rgb(${[...annotation.color].join(',')})`:'#ffdd44',opacity:.32,'pointer-events':'none'}));
        if(annotation.subtype==='Text') { const note=element('g',{'pointer-events':'none'});note.append(element('rect',{x,y,width:24,height:24,fill:'#fff0b3',stroke:'#b89136',rx:3}),element('text',{x:x+5,y:y+17,fill:'#8b6227','font-size':15},'≡'));group.append(note); }
    }
    for (const mark of page.marks) {
        const node = element('g', {class: 'annotation', 'data-id': mark.id}); const c = mark.color || '#183b56';
        if (mark.type === 'text') {
            const txt = element('text', {x: mark.x, y: mark.y+mark.size, fill: c, 'font-size':mark.size,
                'font-family': mark.font.startsWith('Times') ? 'Times New Roman,serif' : mark.font.startsWith('Courier') ? 'Courier New,monospace' : 'Arial,sans-serif',
                'font-weight':mark.font.includes('Bold') ? 'bold' : 'normal'});
            mark.text.split('\n').forEach((line,i) => txt.append(element('tspan', {x:mark.x,dy:i ? mark.size*1.2 : 0},line))); node.append(txt);
        } else if (mark.type === 'image' || mark.type === 'signature') {
            node.append(element('image', {x:mark.x,y:mark.y,width:mark.w,height:mark.h,href:assets[mark.asset]?.url,preserveAspectRatio:'none'}));
        } else if (mark.type === 'highlight') {
            node.append(element('rect', {x:mark.x,y:mark.y,width:mark.w,height:mark.h,fill:c,opacity:.32}));
        } else if (mark.type === 'comment') {
            node.append(element('rect', {x:mark.x,y:mark.y,width:mark.w,height:mark.h,fill:'#fff0b3',stroke:'#b89136',rx:3}));
            node.append(element('text',{x:mark.x+5,y:mark.y+17,fill:'#8b6227','font-size':15},'≡'));
        } else if (mark.type === 'rectangle') node.append(element('rect',{x:mark.x,y:mark.y,width:mark.w,height:mark.h,fill:'none',stroke:c,'stroke-width':mark.stroke}));
        else node.append(element('polyline',{points:mark.points.map(p => p.join(',')).join(' '),fill:'none',stroke:c,'stroke-width':mark.stroke,'stroke-linecap':'round','stroke-linejoin':'round'}));
        // A transparent hit target makes thin strokes and text easy to select.
        node.append(element('rect',{x:mark.x,y:mark.y,width:mark.w,height:mark.h,fill:'transparent'}));
        group.append(node);
        if (selected?.id === mark.id) {
            group.append(element('rect',{class:'selected-box',x:mark.x-2,y:mark.y-2,width:mark.w+4,height:mark.h+4}));
            group.append(element('rect',{class:'resize-handle','data-resize':mark.id,x:mark.x+mark.w-4,y:mark.y+mark.h-4,width:8,height:8}));
        }
    }
    if (tool === 'edit' && page.source !== null) {
        const source = sources[page.source], info = source.info.pages[page.page];
        const originalPage = source.doc.getPage(page.page+1);
        originalPage.then(p => {
            if (current()?.id !== page.id || tool !== 'edit' || !group.isConnected) return;
            const v = p.getViewport({scale:1});
            for (const item of info.editable) {
                const b = [...v.convertToViewportPoint(...item.bounds.slice(0,2)), ...v.convertToViewportPoint(...item.bounds.slice(2,4))];
                group.append(element('rect',{class:'editable-text','data-edit':item.index,x:Math.min(b[0],b[2]),y:Math.min(b[1],b[3]),width:Math.abs(b[2]-b[0]),height:Math.abs(b[3]-b[1])}));
            }
        }).catch(fail);
    }
    $('comments').replaceChildren();
    for (const mark of page.marks.filter(m => m.type === 'comment')) {
        const b = document.createElement('button'); b.className = 'comment-card'; b.textContent = mark.text;
        b.onclick = () => { selected = {kind:'mark',id:mark.id}; chooseSelection(); }; $('comments').append(b);
    }
    for(const annotation of existingAnnotations.filter(a=>a.subtype==='Text')){const p=document.createElement('p');p.className='comment-card';p.textContent=`Saved PDF note: ${annotation.contentsObj?.str || ''}`;$('comments').append(p);}
    if (!$('comments').children.length) { const p = document.createElement('p'); p.className='helper';p.textContent='No comments on this page.';$('comments').append(p); }
}
function chooseSelection() { drawMarks(); properties(); }
function properties() {
    const mark = selectedMark();
    $('properties-title').textContent = selected?.kind === 'edit' ? 'Replace existing text' : mark ? `${mark.type[0].toUpperCase()+mark.type.slice(1)} properties` : 'Tool properties';
    $('apply').disabled = !selected || busy;
    $('delete-object').disabled = !mark || busy;
    for (const key of ['x','y','w','h']) { $(`object-${key}`).value = mark ? Math.round(mark[key]*10)/10 : ''; $(`object-${key}`).disabled = !mark || mark.type==='ink' || mark.type==='line'; }
    if (selected?.kind === 'edit') {
        const edit = current().textEdits.find(e => e.index === selected.item.index);
        $('object-text').value = edit?.text ?? selected.item.text;
    } else if (mark) {
        $('object-text').value = mark.text || ''; $('color').value = mark.color || '#183b56';
        $('font-size').value = mark.size || 16; $('font').value=mark.font || 'Helvetica'; $('stroke').value=mark.stroke || 2;
    }
}
function eventPoint(e) {
    const box = $('paper').getBoundingClientRect();
    const x = (e.clientX-box.left)/zoom, y = (e.clientY-box.top)/zoom;
    const r = current()?.rotation || 0;
    const p = {0:[x,y],90:[y,baseHeight-x],180:[baseWidth-x,baseHeight-y],270:[baseWidth-y,x]}[r];
    return [Math.max(0,Math.min(baseWidth,p[0])),Math.max(0,Math.min(baseHeight,p[1]))];
}
function styleDefaults() { return {color:$('color').value,size:Number($('font-size').value)||16,font:$('font').value,stroke:Number($('stroke').value)||2}; }
function addMark(mark) { remember(); current().marks.push({id:uid(),...styleDefaults(),...mark}); selected={kind:'mark',id:current().marks.at(-1).id}; refresh(); }
$('paper').addEventListener('pointerdown', e => {
    if (!current() || busy || e.button !== 0) return;
    const point = eventPoint(e), [x,y] = point;
    const edit = e.target.closest('[data-edit]');
    if (edit && tool === 'edit') {
        const item=sources[current().source].info.pages[current().page].editable.find(t => t.index===Number(edit.dataset.edit));
        selected={kind:'edit',item}; properties(); $('object-text').focus(); return;
    }
    if (tool === 'highlight' && e.target.closest('.textLayer span')) return;
    if (pendingImage) {
        const w=Math.min(180,baseWidth-x),h=Math.min(w/pendingImage.ratio,baseHeight-y);
        if (w<5 || h<5) return;
        const mark={type:pendingImage.kind,asset:pendingImage.key,x,y,w:Math.min(w,h*pendingImage.ratio),h};
        pendingImage=null;chooseTool('select');addMark(mark);notify('Image placed. Drag it or use the corner handle to resize.');return;
    }
    const target=e.target.closest('[data-id]'), resize=e.target.closest('[data-resize]');
    if (tool==='select') {
        const id=resize?.dataset.resize || target?.dataset.id;
        selected=id ? {kind:'mark',id} : null; chooseSelection();
        if (id) { gesture={mode:resize?'resize':'move',start:point,before:snapshot(),mark:clone(selectedMark()),moved:false}; $('paper').setPointerCapture(e.pointerId); }
        return;
    }
    if (tool==='text' || tool==='comment') {
        if (baseWidth-x<30 || baseHeight-y<30) return;
        addMark({type:tool,x,y,w:Math.min(tool==='text'?220:24,baseWidth-x),h:Math.min(tool==='text'?50:24,baseHeight-y),text:tool==='text'?'Your text':'Add a comment'});
        $('object-text').focus();$('object-text').select(); return;
    }
    if (['ink','rectangle','line','highlight'].includes(tool)) {
        gesture={mode:'draw',start:point,before:snapshot(),points:[point],mark:{id:uid(),...styleDefaults(),type:tool,x,y,w:1,h:1}};
        current().marks.push(gesture.mark);selected=null;$('paper').setPointerCapture(e.pointerId);e.preventDefault();
    }
});
$('paper').addEventListener('pointermove', e => {
    if (!gesture) return;
    const [x,y]=eventPoint(e),g=gesture;
    if (g.mode==='draw') {
        const mark=g.mark; if (g.points.length<5000) g.points.push([x,y]);
        const pts=tool==='line'?[g.start,[x,y]]:g.points;
        const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
        mark.x=Math.min(...xs);mark.y=Math.min(...ys);mark.w=Math.max(.1,Math.max(...xs)-mark.x);mark.h=Math.max(.1,Math.max(...ys)-mark.y);
        mark.points=pts;
    } else {
        const mark=selectedMark();if (!mark) return;
        const dx=x-g.start[0],dy=y-g.start[1];
        if (Math.abs(dx)+Math.abs(dy)>1) g.moved=true;
        if (g.mode==='move') {
            mark.x=Math.max(0,Math.min(baseWidth-mark.w,g.mark.x+dx));mark.y=Math.max(0,Math.min(baseHeight-mark.h,g.mark.y+dy));
            if (mark.points) mark.points=g.mark.points.map(p=>[p[0]+mark.x-g.mark.x,p[1]+mark.y-g.mark.y]);
        } else {
            mark.w=Math.max(5,Math.min(baseWidth-mark.x,g.mark.w+dx));mark.h=Math.max(5,Math.min(baseHeight-mark.y,g.mark.h+dy));
            if (mark.type==='image' || mark.type==='signature') {const ratio=g.mark.w/g.mark.h;mark.w=Math.min(mark.w,mark.h*ratio);mark.h=mark.w/ratio;}
            if (mark.points) mark.points=g.mark.points.map(p=>[mark.x+(p[0]-mark.x)*mark.w/g.mark.w,mark.y+(p[1]-mark.y)*mark.h/g.mark.h]);
        }
    }
    drawMarks();
});
function endGesture(cancel=false) {
    if (!gesture) return;
    const g=gesture;gesture=null;
    if (cancel || (g.mode==='draw' && g.mark.w+g.mark.h<4)) {pages=g.before.pages;active=g.before.active;refresh();return;}
    if (g.mode==='draw' || g.moved) {undo.push(g.before);if(undo.length>60)undo.shift();redo=[];dirty=true;}
    if (g.mode==='draw') selected={kind:'mark',id:g.mark.id};
    refresh();
}
$('paper').addEventListener('pointerup',()=>endGesture());
$('paper').addEventListener('pointercancel',()=>endGesture(true));
$('paper').addEventListener('mouseup', () => {
    if (tool!=='highlight' || gesture || busy) return;
    const selection=window.getSelection();if(!selection.rangeCount || selection.isCollapsed || !$('text-layer').contains(selection.anchorNode)) return;
    const rects=[...selection.getRangeAt(0).getClientRects()].filter(r=>r.width>1&&r.height>1);
    const label=selection.toString().slice(0,4000);const box=$('paper').getBoundingClientRect();
    const marks=rects.map(r=>{
        const a=eventPoint({clientX:r.left,clientY:r.top}),b=eventPoint({clientX:r.right,clientY:r.bottom});
        return {id:uid(),type:'highlight',color:$('color').value,text:label,x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),w:Math.abs(b[0]-a[0]),h:Math.abs(b[1]-a[1])};
    }).filter(m=>m.w>.1&&m.h>.1);
    if(marks.length){remember();current().marks.push(...marks);selection.removeAllRanges();refresh();notify('Text highlighted. Highlights remain standard PDF annotations in the downloaded PDF.');}
});
async function applyProperties() {
    if (!selected || busy) return;
    if (selected.kind==='edit') {
        const item=selected.item,value=$('object-text').value;
        if(!/^[\x20-\x7e]{1,500}$/.test(value)) return fail(new Error('Use a single line of printable English/ASCII text.'));
        const candidate=clone(current()); candidate.textEdits=candidate.textEdits.filter(e=>e.index!==item.index);
        if(value!==item.text) candidate.textEdits.push({index:item.index,original:item.text,text:value});
        busy=true;notify('Checking and replacing the actual PDF text…','busy');
        try{await requestExport([{...candidate,marks:[]}]);remember();current().textEdits=candidate.textEdits;selected=null;notify('Existing text replaced. The preview is rendered from the modified PDF, not a cover-up.');}
        catch(error){fail(error);}finally{busy=false;refresh();}return;
    }
    const mark=selectedMark();if(!mark)return;
    const next={...mark,...styleDefaults(),text:$('object-text').value};
    if(!['ink','line'].includes(mark.type))for(const key of ['x','y','w','h'])next[key]=Number($(`object-${key}`).value);
    if(![next.x,next.y,next.w,next.h].every(Number.isFinite)||next.x<0||next.y<0||next.w<=0||next.h<=0||next.x+next.w>baseWidth+.01||next.y+next.h>baseHeight+.01)return fail(new Error('Keep the object inside the page with a positive width and height.'));
    if(next.type==='text'){
        const cv=document.createElement('canvas').getContext('2d');cv.font=`${next.font.includes('Bold')?'bold ':''}${next.size}px ${next.font.startsWith('Times')?'Times New Roman':next.font.startsWith('Courier')?'Courier New':'Arial'}`;
        if(next.text.split('\n').some(l=>cv.measureText(l).width>next.w+1)||next.text.split('\n').length*next.size*1.2>next.h+1)return fail(new Error('Text does not fit. Enlarge the box or reduce its font size.'));
    }
    remember();Object.assign(mark,next);refresh();notify('Changes applied.');
}
$('apply').onclick=applyProperties;
function deleteSelected(){if(selectedMark())mutate(()=>{current().marks=current().marks.filter(m=>m.id!==selected.id);});}
$('delete-object').onclick=deleteSelected;
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>chooseTool(b.dataset.tool);
for(const id of ['open','add-pdf','empty-open'])$(id).onclick=()=>{if(!busy)$('pdf-input').click();};
$('pdf-input').onchange=e=>{openFiles([...e.target.files]);e.target.value='';};
$('undo').onclick=()=>history('undo');$('redo').onclick=()=>history('redo');
$('blank').onclick=()=>mutate(()=>{pages.splice(pages.length?active+1:0,0,{id:uid(),source:null,width:595,height:842,rotation:0,marks:[],textEdits:[]});if(pages.length>1)active++;});
$('duplicate').onclick=()=>{if(current())mutate(()=>{pages.splice(active+1,0,{...clone(current()),id:uid()});active++;});};
$('remove-page').onclick=()=>{if(current()&&confirm('Delete this page from the working document? You can undo this.'))mutate(()=>pages.splice(active,1));};
$('rotate').onclick=()=>{if(current())mutate(()=>{current().rotation=(current().rotation+90)%360;});};
for(const [id,delta] of [['move-up',-1],['move-down',1]])$(id).onclick=()=>{if(current()&&active+delta>=0&&active+delta<pages.length)mutate(()=>{const [p]=pages.splice(active,1);active+=delta;pages.splice(active,0,p);});};
for(const [id,delta] of [['previous',-1],['next',1]])$(id).onclick=()=>{if(!busy&&active+delta>=0&&active+delta<pages.length){active+=delta;selected=null;refresh();}};
for(const [id,factor] of [['zoom-in',1.2],['zoom-out',1/1.2]])$(id).onclick=()=>{zoom=Math.max(.25,Math.min(2.5,zoom*factor));refresh();};
$('fit').onclick=()=>{const width=current()?.rotation%180?baseHeight:baseWidth;zoom=Math.max(.25,Math.min(2,($('work-area').clientWidth-65)/width));refresh();};
for(const [id,kind] of [['image','image'],['signature','signature']])$(id).onclick=()=>{if(!current())return notify('Open a PDF or add a blank page first.');assetKind=kind;$('image-input').click();};
$('image-input').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{
        if(Object.keys(assets).length>=100||file.size>5*1024*1024)throw new Error('Choose a PNG/JPEG image smaller than 5 MiB.');
        if(!['image/png','image/jpeg'].includes(file.type))throw new Error('Use a PNG or JPEG image.');
        const bytes=new Uint8Array(await file.arrayBuffer()),url=URL.createObjectURL(new Blob([bytes],{type:file.type}));
        const image=new Image();image.src=url;await image.decode();
        if(image.naturalWidth*image.naturalHeight>16_000_000){URL.revokeObjectURL(url);throw new Error('Image exceeds 16 million pixels.');}
        const key=`asset-${uid()}`;assets[key]={bytes,url,mime:file.type,name:file.name};pendingImage={key,ratio:image.naturalWidth/image.naturalHeight,kind:assetKind};chooseTool('select');notify(`Click the page to place your ${assetKind==='signature'?'signature image':'image'}. Its original background is preserved; transparent PNG works best.`);
    }catch(error){fail(error);}
};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}
async function exportPDF(single=false){
    if(!current()||busy)return;busy=true;notify('Preparing your PDF…','busy');refresh();
    try{const response=await requestExport(single?[current()]:pages);download(await response.blob(),single?'extracted-page.pdf':'edited.pdf');notify('PDF downloaded. Save a project too if you want to resume editing later.');}
    catch(error){fail(error);}finally{busy=false;refresh();}
}
$('export').onclick=()=>exportPDF();$('extract').onclick=()=>exportPDF(true);
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
function fromB64(value){const s=atob(value);return Uint8Array.from(s,c=>c.charCodeAt(0));}
$('save-project').onclick=()=>{
    if(!pages.length||busy)return;
    const project={format:'pdf-tools-project',version:1,pages:pages.map(({thumb,thumbRotation,...p})=>p),sources:sources.map(s=>({name:s.name,data:b64(s.bytes)})),assets:Object.fromEntries(Object.entries(assets).map(([k,a])=>[k,{name:a.name,mime:a.mime,data:b64(a.bytes)}]))};
    download(new Blob([JSON.stringify(project)],{type:'application/json'}),'document.pdfproject');dirty=false;refresh();notify('Project downloaded, including original documents and images. Keep it private; open it here to resume.');
};
$('restore').onclick=()=>{if(!busy)$('project-input').click();};
$('project-input').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file||busy)return;
    if(dirty&&!confirm('Replace the current workspace? Save a project first if you need to keep it.'))return;
    busy=true;const staged=[],newAssets={};notify('Restoring project…','busy');
    try{
        if(file.size>35*1024*1024)throw new Error('Project is too large (35 MiB maximum).');
        const project=JSON.parse(await file.text());
        if(project.format!=='pdf-tools-project'||project.version!==1||!Array.isArray(project.pages)||!project.pages.length||project.pages.length>200||!Array.isArray(project.sources)||project.sources.length>20||!project.assets||Object.keys(project.assets).length>100)throw new Error('Unsupported project format.');
        for(const source of project.sources){const bytes=fromB64(source.data);const form=new FormData();form.append('file',new Blob([bytes]),source.name);const info=await(await responseOrError(await fetch(`${api}/inspect`,{method:'POST',body:form}))).json();const doc=await loadDocument(bytes.slice()).promise;staged.push({name:String(source.name),bytes,info,doc});}
        for(const [key,a]of Object.entries(project.assets)){if(!key.startsWith('asset-')||!['image/png','image/jpeg'].includes(a.mime))throw new Error('Invalid project image.');const bytes=fromB64(a.data);newAssets[key]={name:String(a.name),mime:a.mime,bytes,url:URL.createObjectURL(new Blob([bytes],{type:a.mime}))};}
        // Validate the complete untrusted project through the same server export path
        // before replacing a working workspace or rendering user-supplied markup.
        const form=new FormData();form.append('manifest',JSON.stringify({version:1,pages:project.pages}));staged.forEach(s=>form.append('sources',new Blob([s.bytes]),s.name));for(const[k,a]of Object.entries(newAssets))form.append(k,new Blob([a.bytes]),a.name);
        await responseOrError(await fetch(`${api}/export`,{method:'POST',body:form}));
        ++generation;await rendering.catch(()=>{});textLayer?.cancel();
        for(const s of sources)await s.doc.loadingTask.destroy();for(const a of Object.values(assets))URL.revokeObjectURL(a.url);for(const d of previewCache.values())await d.loadingTask.destroy();previewCache.clear();
        sources=staged;assets=newAssets;pages=project.pages.map(p=>({...p,id:uid(),textEdits:p.textEdits||[],marks:p.marks.map(m=>({...m,id:uid()}))}));active=0;selected=null;undo=[];redo=[];dirty=false;
        $('document-name').textContent=file.name;notify('Project restored. Your pages, comments and images are editable again.');
    }catch(error){for(const s of staged)if(!sources.includes(s))await s.doc.loadingTask.destroy();for(const a of Object.values(newAssets))if(!Object.values(assets).includes(a))URL.revokeObjectURL(a.url);fail(error);}
    finally{busy=false;refresh();}
};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea,select'))return;
    if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');}if(e.key.toLowerCase()==='s'){e.preventDefault();$('save-project').click();}return;}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();}
    if(e.key==='Escape'){pendingImage=null;endGesture(true);chooseTool('select');}
    if(e.key.toLowerCase()==='v')chooseTool('select');
});
refresh();
