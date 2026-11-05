document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('extract-form');
    if (!form) return;
    const $ = id => document.getElementById(id);
    const input = $('extract-file');
    const drop = $('extract-drop');
    const chip = $('extract-chip');
    const grid = $('page-grid');
    const rangeInput = $('page-range');
    const countLabel = $('selection-count');
    const button = form.querySelector('button[type="submit"]');
    const buttonLabel = button.querySelector('span') || button;
    const iconUrl = document.body.dataset.icons || '';
    let file = null, pdfTask = null, pdfDoc = null, pageCount = 0, selected = new Set(), loadToken = 0, timer = null;

    const formatBytes = bytes => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    const isPdf = f => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));

    function message(text) {
        let box = $('workspace-error');
        if (!box) {
            box = document.createElement('div');
            box.id = 'workspace-error';
            box.className = 'workspace-error';
            box.setAttribute('role', 'alert');
            form.prepend(box);
        }
        box.textContent = text;
        box.hidden = !text;
    }

    // Mirrors PDFPageParser on the server: "all", or comma-separated pages and
    // inclusive ranges, kept in the order typed.
    function parseRange(text, total) {
        const value = text.trim();
        if (!value || value.toLowerCase() === 'all') return Array.from({length: total}, (_, i) => i + 1);
        if (!/^(\d+(-\d+)?)(,\d+(-\d+)?)*$/.test(value.replace(/\s/g, ''))) throw new Error('Use page numbers and ranges such as 1-3, 6.');
        const pages = [];
        for (const part of value.replace(/\s/g, '').split(',')) {
            const [start, end = start] = part.split('-').map(Number);
            if (start < 1 || end > total || start > end) throw new Error(`Pages must be between 1 and ${total}.`);
            for (let n = start; n <= end; n++) pages.push(n);
        }
        return pages;
    }

    function formatRange(pages) {
        const sorted = [...pages].sort((a, b) => a - b), parts = [];
        for (let i = 0; i < sorted.length; i++) {
            const start = sorted[i];
            while (sorted[i + 1] === sorted[i] + 1) i++;
            parts.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
        }
        return parts.join(', ');
    }

    function paintSelection() {
        for (const thumb of grid.children) thumb.setAttribute('aria-pressed', String(selected.has(Number(thumb.dataset.page))));
        countLabel.textContent = pageCount ? `${selected.size} of ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} selected` : '';
    }

    function syncFromRange() {
        if (!pageCount) return;
        try {
            selected = new Set(parseRange(rangeInput.value, pageCount));
            rangeInput.setCustomValidity('');
            message('');
        } catch (error) {
            rangeInput.setCustomValidity(error.message);
            selected = new Set();
        }
        paintSelection();
    }

    function setSelection(pages) {
        selected = new Set(pages);
        rangeInput.value = selected.size === pageCount && pageCount > 1 ? `1-${pageCount}` : formatRange(selected);
        rangeInput.setCustomValidity('');
        message('');
        paintSelection();
    }

    async function renderThumbs(token) {
        for (let n = 1; n <= pageCount && token === loadToken; n++) {
            const page = await pdfDoc.getPage(n);
            if (token !== loadToken) return;
            const base = page.getViewport({scale: 1});
            const viewport = page.getViewport({scale: 220 / Math.max(base.width, base.height)});
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width; canvas.height = viewport.height;
            await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
            grid.children[n - 1]?.querySelector('.thumb-placeholder')?.replaceWith(canvas);
        }
    }

    async function chooseFile(next) {
        if (!next) return;
        if (!isPdf(next)) { message('Choose a PDF file.'); return; }
        const limit = Number(document.body.dataset.maxUpload) || 0;
        if (limit && next.size > limit) { message(`This file is ${formatBytes(next.size)}; this server accepts up to ${formatBytes(limit)} per upload. Split it or reduce its size first.`); return; }
        message('');
        const token = ++loadToken;
        file = next;
        const transfer = new DataTransfer(); transfer.items.add(next); input.files = transfer.files;
        if (pdfTask) pdfTask.destroy();
        pdfTask = null; pdfDoc = null; pageCount = 0; grid.replaceChildren();
        $('chip-name').textContent = next.name;
        $('chip-meta').textContent = `${formatBytes(next.size)} · reading pages…`;
        drop.hidden = true; chip.hidden = false; $('page-empty').hidden = true;
        try {
            await window.pdfReady;
            pdfTask = window.loadPDFDocument(new Uint8Array(await next.arrayBuffer()));
            pdfDoc = await pdfTask.promise;
            if (token !== loadToken) return;
            pageCount = pdfDoc.numPages;
        } catch (error) {
            if (token !== loadToken) return;
            $('chip-meta').textContent = `${formatBytes(next.size)} · could not be read`;
            message('This file could not be opened. It may be damaged or password protected.');
            $('page-empty').hidden = false;
            return;
        }
        $('chip-meta').textContent = `${formatBytes(next.size)} · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
        for (let n = 1; n <= pageCount; n++) {
            const thumb = document.createElement('button');
            thumb.type = 'button'; thumb.className = 'page-thumb'; thumb.dataset.page = n;
            thumb.setAttribute('aria-label', `Page ${n}`);
            thumb.innerHTML = `<span class="thumb-placeholder"></span><span class="check"><svg class="icon" aria-hidden="true"><use href="${iconUrl}#check"></use></svg></span><span>Page ${n}</span>`;
            grid.append(thumb);
        }
        syncFromRange();
        renderThumbs(token).catch(() => {});
    }

    input.addEventListener('change', () => chooseFile(input.files[0]));
    $('change-file').addEventListener('click', () => input.click());
    ['dragenter', 'dragover'].forEach(name => form.addEventListener(name, event => { event.preventDefault(); drop.classList.add('is-dragging'); }));
    ['dragleave', 'drop'].forEach(name => form.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('is-dragging'); }));
    form.addEventListener('drop', event => chooseFile(event.dataTransfer.files[0]));
    grid.addEventListener('click', event => {
        const thumb = event.target.closest('.page-thumb');
        if (!thumb) return;
        const n = Number(thumb.dataset.page);
        const next = new Set(selected);
        next.has(n) ? next.delete(n) : next.add(n);
        setSelection(next);
    });
    $('select-all').addEventListener('click', () => pageCount && setSelection(Array.from({length: pageCount}, (_, i) => i + 1)));
    $('select-none').addEventListener('click', () => { if (pageCount) { selected = new Set(); rangeInput.value = ''; paintSelection(); } });
    rangeInput.addEventListener('input', syncFromRange);

    function startProgress(label, estimate) {
        let box = $('job-progress');
        if (!box) {
            box = document.createElement('div');
            box.id = 'job-progress';
            box.className = 'job-progress';
            box.setAttribute('role', 'status');
            form.prepend(box);
        }
        const started = Date.now();
        box.hidden = false;
        box.innerHTML = `<strong>${label}</strong><div class="progress-track"><div class="progress-bar"></div></div><span class="progress-detail"></span>`;
        const bar = box.querySelector('.progress-bar');
        const detail = box.querySelector('.progress-detail');
        const tick = () => {
            const elapsed = Math.floor((Date.now() - started) / 1000);
            const remaining = Math.max(0, estimate - elapsed);
            bar.style.width = `${Math.min(92, Math.round((elapsed / estimate) * 92))}%`;
            detail.textContent = remaining ? `Elapsed ${elapsed}s · about ${remaining}s remaining` : `Elapsed ${elapsed}s · taking a little longer than estimated…`;
        };
        tick();
        timer = window.setInterval(tick, 1000);
        return {
            set(fraction, text) { window.clearInterval(timer); bar.style.width = `${Math.round(fraction * 100)}%`; detail.textContent = text; },
            done(text) { window.clearInterval(timer); bar.style.width = '100%'; detail.textContent = text; }
        };
    }

    function download(blob, name) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    const baseName = () => (file?.name || 'document').replace(/\.pdf$/i, '');

    async function exportImages(pages, progress) {
        const files = [];
        for (const [i, n] of pages.entries()) {
            progress.set(i / pages.length, `Rendering page ${n} (${i + 1} of ${pages.length})…`);
            const page = await pdfDoc.getPage(n);
            const viewport = page.getViewport({scale: 150 / 72});
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({canvasContext: ctx, viewport}).promise;
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            files.push({name: `${baseName()}-page-${String(n).padStart(3, '0')}.png`, bytes: new Uint8Array(await blob.arrayBuffer())});
        }
        if (files.length === 1) download(new Blob([files[0].bytes], {type: 'image/png'}), files[0].name);
        else download(zipStore(files), `${baseName()}-pages.zip`);
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        message('');
        if (!file) { message('Choose a PDF before extracting pages.'); return; }
        let pages;
        try { pages = pageCount ? parseRange(rangeInput.value, pageCount) : null; }
        catch (error) { message(error.message); rangeInput.focus(); return; }
        if (pages && !pages.length) { message('Select at least one page.'); return; }
        const asImages = form.querySelector('input[name="output"]:checked')?.value === 'png';
        if (asImages && !pdfDoc) { message('This PDF could not be opened for image export.'); return; }
        const estimate = Math.max(4, Math.ceil(file.size / (10 * 1024 * 1024)) + (asImages ? Math.ceil(pages.length / 4) : 0));
        const progress = startProgress(asImages ? 'Creating page images in your browser.' : 'Extracting pages — your file is being processed locally.', estimate);
        button.disabled = true;
        buttonLabel.textContent = 'Extracting…';
        try {
            if (asImages) {
                await exportImages(pages, progress);
            } else {
                const body = new FormData();
                body.append('file', file, file.name);
                body.append('range', rangeInput.value.trim() || 'all');
                const response = await fetch(form.action, {method: 'POST', body});
                const contentType = response.headers.get('content-type') || '';
                if (!response.ok || !contentType.includes('application/pdf')) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'The pages could not be extracted. Check the PDF and page range.');
                }
                download(await response.blob(), `${baseName()}-extracted.pdf`);
            }
            progress.done('Complete — your download should begin now.');
        } catch (error) {
            message(error.message || 'The pages could not be extracted. Check the PDF and page range.');
            progress.done('The extraction stopped. See the message above for the next step.');
        } finally {
            button.disabled = false;
            buttonLabel.textContent = 'Extract and download';
        }
    });

    // Minimal uncompressed ZIP writer (PNG data is already compressed).
    function zipStore(entries) {
        const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
        const crc32 = bytes => { let c = 0xFFFFFFFF; for (const b of bytes) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
        const encoder = new TextEncoder(), chunks = [], central = [];
        let offset = 0;
        for (const entry of entries) {
            const name = encoder.encode(entry.name), crc = crc32(entry.bytes), size = entry.bytes.length;
            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(12, 33, true);
            local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true); local.setUint16(26, name.length, true);
            chunks.push(local, name, entry.bytes);
            const record = new DataView(new ArrayBuffer(46));
            record.setUint32(0, 0x02014b50, true); record.setUint16(4, 20, true); record.setUint16(6, 20, true); record.setUint16(14, 33, true);
            record.setUint32(16, crc, true); record.setUint32(20, size, true); record.setUint32(24, size, true);
            record.setUint16(28, name.length, true); record.setUint32(42, offset, true);
            central.push(record, name);
            offset += 30 + name.length + size;
        }
        const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
        end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
        return new Blob([...chunks, ...central, end], {type: 'application/zip'});
    }
});
