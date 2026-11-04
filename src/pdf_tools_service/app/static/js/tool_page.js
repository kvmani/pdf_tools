// Shared behaviour for single-PDF tool pages (split, stamp): choosing a file,
// reading it locally with PDF.js, status messages, progress and downloads.
window.PdfToolPage = (() => {
    const formatBytes = bytes => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    const isPdf = f => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    const stem = name => (name || 'document').replace(/\.pdf$/i, '');

    function setup({form, onFile}) {
        const input = form.querySelector('input[type="file"][name="file"]');
        const drop = form.querySelector('[data-drop]');
        const chip = form.querySelector('[data-chip]');
        const state = {file: null, doc: null, task: null, pageCount: 0};
        let token = 0, timer = null;

        function message(text) {
            let box = form.querySelector('.workspace-error');
            if (!box) {
                box = document.createElement('div');
                box.className = 'workspace-error';
                box.setAttribute('role', 'alert');
                form.prepend(box);
            }
            box.textContent = text || '';
            box.hidden = !text;
        }

        async function choose(file) {
            if (!file) return;
            if (!isPdf(file)) { message('Choose a PDF file.'); return; }
            message('');
            const mine = ++token;
            const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
            if (state.task) state.task.destroy();
            Object.assign(state, {file, doc: null, task: null, pageCount: 0});
            chip.querySelector('[data-name]').textContent = file.name;
            const meta = chip.querySelector('[data-meta]');
            meta.textContent = `${formatBytes(file.size)} · reading pages…`;
            drop.hidden = true; chip.hidden = false;
            try {
                await window.pdfReady;
                const task = window.loadPDFDocument(new Uint8Array(await file.arrayBuffer()));
                const doc = await task.promise;
                if (mine !== token) { task.destroy(); return; }
                Object.assign(state, {task, doc, pageCount: doc.numPages});
                meta.textContent = `${formatBytes(file.size)} · ${doc.numPages} ${doc.numPages === 1 ? 'page' : 'pages'}`;
            } catch (error) {
                if (mine !== token) return;
                meta.textContent = `${formatBytes(file.size)} · could not be read`;
                message('This file could not be opened. It may be damaged or password protected.');
            }
            onFile?.(state);
        }

        input.addEventListener('change', () => choose(input.files[0]));
        chip.querySelector('[data-change]').addEventListener('click', () => input.click());
        ['dragenter', 'dragover'].forEach(name => form.addEventListener(name, event => { event.preventDefault(); drop.classList.add('is-dragging'); }));
        ['dragleave', 'drop'].forEach(name => form.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('is-dragging'); }));
        form.addEventListener('drop', event => choose(event.dataTransfer.files[0]));

        function progress(label, estimate) {
            let box = form.querySelector('.job-progress');
            if (!box) {
                box = document.createElement('div');
                box.className = 'job-progress';
                box.setAttribute('role', 'status');
                form.prepend(box);
            }
            const started = Date.now();
            box.hidden = false;
            box.innerHTML = '<strong></strong><div class="progress-track"><div class="progress-bar"></div></div><span class="progress-detail"></span>';
            box.querySelector('strong').textContent = label;
            const bar = box.querySelector('.progress-bar'), detail = box.querySelector('.progress-detail');
            const tick = () => {
                const elapsed = Math.floor((Date.now() - started) / 1000);
                bar.style.width = `${Math.min(92, Math.round((elapsed / estimate) * 92))}%`;
                detail.textContent = elapsed < estimate ? `Elapsed ${elapsed}s · about ${estimate - elapsed}s remaining` : `Elapsed ${elapsed}s · taking a little longer than estimated…`;
            };
            tick(); window.clearInterval(timer); timer = window.setInterval(tick, 1000);
            return text => { window.clearInterval(timer); bar.style.width = '100%'; detail.textContent = text; };
        }

        // POST the form data and download the response, reporting server errors.
        async function submit({body, expect, filename, label, busyLabel}) {
            const button = form.querySelector('button[type="submit"]');
            const span = button.querySelector('span') || button;
            const idle = span.textContent;
            const done = progress(label, Math.max(4, Math.ceil(state.file.size / (5 * 1024 * 1024))));
            button.disabled = true; span.textContent = busyLabel;
            try {
                const response = await fetch(form.action, {method: 'POST', body});
                const type = response.headers.get('content-type') || '';
                if (!response.ok || !type.includes(expect)) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'The file could not be processed. Check it and try again.');
                }
                const link = document.createElement('a');
                link.href = URL.createObjectURL(await response.blob());
                link.download = filename;
                link.click();
                setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                done('Complete — your download should begin now.');
            } catch (error) {
                message(error.message);
                done('Stopped. See the message above for the next step.');
            } finally {
                button.disabled = false; span.textContent = idle;
            }
        }

        async function renderPage(number, canvas, maxSide) {
            const page = await state.doc.getPage(number);
            const base = page.getViewport({scale: 1});
            const viewport = page.getViewport({scale: maxSide / Math.max(base.width, base.height)});
            canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
            await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
            return canvas;
        }

        return {state, message, submit, renderPage};
    }

    // Mirrors PDFPageParser on the server: "all", or comma-separated pages and ranges.
    function parseRange(text, total) {
        const value = String(text || '').trim();
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

    return {setup, parseRange, formatBytes, stem};
})();
