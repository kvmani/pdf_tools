document.addEventListener('DOMContentLoaded', () => {
    const filesDiv = document.getElementById('files');
    const addBtn = document.getElementById('add-file');
    const form = document.getElementById('merge-form');
    if (!filesDiv || !addBtn || !form) return;

    const MAX_FILES = 10;
    const dropZone = document.getElementById('merge-drop-zone');
    const picker = document.getElementById('merge-picker');
    const summary = document.getElementById('merge-summary');
    const submitButton = form.querySelector('button[type="submit"]');
    const submitLabel = submitButton.querySelector('span') || submitButton;
    const metadataUrl = form.dataset.metadataUrl;
    const iconUrl = document.body.dataset.icons || '';
    let progressTimer = null;

    const icon = name => `<svg class="icon" aria-hidden="true"><use href="${iconUrl}#${name}"></use></svg>`;
    const isPdf = file => file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return 'Unknown size';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function renumber() {
        const items = [...filesDiv.children];
        items.forEach((item, idx) => {
            item.querySelector('input[type="file"]').name = `file${idx}`;
            item.querySelector('.range-input').name = `range_file${idx}`;
            item.querySelector('.file-number').textContent = `Document ${idx + 1}`;
            item.querySelector('.up').disabled = idx === 0;
            item.querySelector('.down').disabled = idx === items.length - 1;
        });
        addBtn.disabled = items.length >= MAX_FILES;
        if (dropZone) dropZone.classList.toggle("compact", items.length > 0);
        const bytes = items.reduce((sum, item) => sum + (item._file?.size || 0), 0);
        const pages = items.reduce((sum, item) => sum + Number(item.dataset.pageCount || 0), 0);
        summary.textContent = items.length
            ? `${items.length} ${items.length === 1 ? 'document' : 'documents'}${pages ? ` · ${pages} pages` : ''} · ${formatBytes(bytes)}`
            : 'No documents added yet';
    }

    function showFormError(message) {
        let box = document.getElementById('workspace-error');
        if (!box) {
            box = document.createElement('div');
            box.id = 'workspace-error';
            box.className = 'workspace-error';
            box.setAttribute('role', 'alert');
            form.prepend(box);
        }
        box.textContent = message;
        box.hidden = false;
    }

    function clearFormError() {
        const box = document.getElementById('workspace-error');
        if (box) box.hidden = true;
    }

    function startProgress(label, estimatedSeconds) {
        let box = document.getElementById('job-progress');
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
            const remaining = Math.max(0, estimatedSeconds - elapsed);
            bar.style.width = `${Math.min(92, Math.round((elapsed / estimatedSeconds) * 92))}%`;
            detail.textContent = remaining ? `Elapsed ${elapsed}s · about ${remaining}s remaining` : `Elapsed ${elapsed}s · taking a little longer than estimated…`;
        };
        tick();
        progressTimer = window.setInterval(tick, 1000);
    }

    function finishProgress(message) {
        if (progressTimer) window.clearInterval(progressTimer);
        progressTimer = null;
        const box = document.getElementById('job-progress');
        if (!box) return;
        box.querySelector('.progress-bar').style.width = '100%';
        box.querySelector('.progress-detail').textContent = message;
    }

    async function loadMetadata(item, file) {
        const metadata = item.querySelector('.metadata');
        item.dataset.metadataState = 'loading';
        item.classList.remove('is-invalid');
        metadata.classList.remove('error');
        metadata.textContent = `${formatBytes(file.size)} · reading page count…`;
        const body = new FormData(); body.append('file', file, file.name);
        try {
            const response = await fetch(metadataUrl, {method: 'POST', body});
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.error || 'This file could not be read as a PDF.');
            metadata.textContent = `${formatBytes(data.size_bytes)} · ${data.page_count} ${data.page_count === 1 ? 'page' : 'pages'}`;
            item.dataset.pageCount = data.page_count;
            item.dataset.metadataState = 'ready';
        } catch (error) {
            item.dataset.metadataState = 'invalid';
            item.classList.add('is-invalid');
            metadata.classList.add('error');
            metadata.textContent = error.message || 'This file could not be read as a PDF.';
        }
        renumber();
    }

    function renderPreview(preview, file) {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                await window.pdfReady;
                const task = window.loadPDFDocument(new Uint8Array(reader.result));
                const pdf = await task.promise;
                const page = await pdf.getPage(1);
                const base = page.getViewport({scale: 1});
                const viewport = page.getViewport({scale: 144 / Math.max(base.width, base.height)});
                preview.width = viewport.width; preview.height = viewport.height;
                await page.render({canvasContext: preview.getContext('2d'), viewport}).promise;
                task.destroy();
            } catch (error) {
                preview.replaceWith(Object.assign(document.createElement('span'), {className: 'helper', textContent: 'No preview'}));
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function addFile(file) {
        const wrapper = document.createElement('div');
        wrapper.className = 'file-item'; wrapper.draggable = true; wrapper._file = file;
        wrapper.innerHTML = `<span class="drag-handle" title="Drag to reorder" aria-hidden="true">${icon('grip-vertical')}</span>
            <div class="file-preview"><canvas class="pdf-preview" aria-label="First page preview"></canvas></div>
            <div class="file-details"><span class="file-number">Document</span><span class="filename"></span><span class="metadata">Checking…</span><span class="rotation-note" hidden></span><input type="file" accept="application/pdf" hidden></div>
            <div class="file-range"><label>Pages</label><input class="input range-input" type="text" value="all" placeholder="all, or e.g. 1-3, 6"></div>
            <div class="file-actions"><button type="button" class="btn btn-ghost rotate" title="Rotate 90° clockwise" aria-label="Rotate 90 degrees clockwise">${icon('rotate-cw')}</button><button type="button" class="btn btn-ghost up" title="Move up" aria-label="Move up">${icon('arrow-up')}</button><button type="button" class="btn btn-ghost down" title="Move down" aria-label="Move down">${icon('arrow-down')}</button><button type="button" class="btn btn-ghost btn-danger remove" title="Remove" aria-label="Remove">${icon('x')}</button></div>`;
        const id = `range-${Math.random().toString(36).slice(2)}`;
        wrapper.querySelector('.file-range label').htmlFor = id;
        wrapper.querySelector('.range-input').id = id;
        wrapper.querySelector('.filename').textContent = file.name;
        wrapper.querySelector('.filename').title = file.name;
        const input = wrapper.querySelector('input[type="file"]');
        const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
        filesDiv.appendChild(wrapper);
        renumber();
        loadMetadata(wrapper, file);
        renderPreview(wrapper.querySelector('.pdf-preview'), file);
    }

    function addFiles(list) {
        clearFormError();
        const files = [...list];
        const limit = Number(document.body.dataset.maxUpload) || 0;
        let used = [...filesDiv.children].reduce((sum, item) => sum + (item._file?.size || 0), 0);
        const pdfs = [], oversized = [];
        for (const file of files.filter(isPdf)) {
            if (limit && used + file.size > limit) { oversized.push(file.name); continue; }
            used += file.size; pdfs.push(file);
        }
        if (oversized.length) {
            showFormError(`Not added: ${oversized.join(', ')}. All documents in one merge must total at most ${formatBytes(limit)} on this server.`);
            if (!pdfs.length) return;
        }
        const room = MAX_FILES - filesDiv.children.length;
        pdfs.slice(0, room).forEach(addFile);
        if (oversized.length) return; // the size message above takes priority
        const skipped = files.length - pdfs.length;
        if (pdfs.length > room) showFormError(`Up to ${MAX_FILES} documents can be merged at once. ${pdfs.length - room} file(s) were not added.`);
        else if (skipped) showFormError(`${skipped} file(s) were skipped because they are not PDFs.`);
    }

    addBtn.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => { addFiles(picker.files); picker.value = ''; });
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
        ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
        dropZone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
    }
    filesDiv.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        const item = event.target.closest('.file-item');
        if (!button || !item) return;
        if (button.classList.contains('up') && item.previousElementSibling) filesDiv.insertBefore(item, item.previousElementSibling);
        if (button.classList.contains('down') && item.nextElementSibling) filesDiv.insertBefore(item.nextElementSibling, item);
        if (button.classList.contains('remove')) item.remove();
        if (button.classList.contains('rotate')) {
            const turn = (Number(item.dataset.rotation || 0) + 90) % 360;
            item.dataset.rotation = turn;
            item.querySelector('.file-preview').dataset.rotation = turn;
            const note = item.querySelector('.rotation-note');
            note.textContent = turn ? `Rotated ${turn}°` : '';
            note.hidden = !turn;
        }
        renumber();
    });
    filesDiv.addEventListener('dragstart', event => { const item = event.target.closest('.file-item'); if (item) { item.classList.add('is-dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'reorder'); } });
    filesDiv.addEventListener('dragend', event => { const item = event.target.closest('.file-item'); if (item) item.classList.remove('is-dragging'); renumber(); });
    filesDiv.addEventListener('dragover', event => { event.preventDefault(); const moving = filesDiv.querySelector('.file-item.is-dragging'); const target = event.target.closest('.file-item'); if (!moving || !target || moving === target) return; const rect = target.getBoundingClientRect(); filesDiv.insertBefore(moving, event.clientY < rect.top + rect.height / 2 ? target : target.nextSibling); });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        clearFormError();
        const items = [...filesDiv.children];
        if (!items.length) {
            showFormError('Add at least one PDF before merging.');
            return;
        }
        if (items.some(item => item.dataset.metadataState === 'invalid')) {
            showFormError('Remove the unreadable file or replace it with a valid, unlocked PDF before merging.');
            return;
        }
        if (items.some(item => item.dataset.metadataState === 'loading')) {
            showFormError('Please wait while the PDF files are checked.');
            return;
        }
        const formData = new FormData(form);
        items.forEach((item, idx) => {
            formData.set(`file${idx}`, item._file);
            formData.set(`range_file${idx}`, item.querySelector('.range-input').value.trim() || 'all');
            formData.set(`rotate_file${idx}`, item.dataset.rotation || '0');
        });
        formData.set('order', items.map((_, idx) => idx).join(','));
        const totalBytes = items.reduce((sum, item) => sum + item._file.size, 0);
        const totalPages = items.reduce((sum, item) => sum + Number(item.dataset.pageCount || 1), 0);
        const estimatedSeconds = Math.max(4, Math.ceil(totalBytes / (10 * 1024 * 1024) + totalPages / 200));
        submitButton.disabled = true;
        submitLabel.textContent = 'Merging…';
        startProgress('Merging PDFs — your files are being processed locally.', estimatedSeconds);
        try {
            const response = await fetch(form.action, {method: 'POST', body: formData});
            const contentType = response.headers.get('content-type') || '';
            if (!response.ok || !contentType.includes('application/pdf')) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'The PDFs could not be merged. Check the files and try again.');
            }
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = form.querySelector('[name="output_name"]').value || 'merged.pdf';
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            finishProgress('Complete — your download should begin now.');
        } catch (error) {
            finishProgress('The merge stopped. See the message above for the next step.');
            showFormError(error.message || 'The PDFs could not be merged. Check the files and try again.');
        } finally {
            submitButton.disabled = false;
            submitLabel.textContent = 'Merge and download';
        }
    });
    renumber();
});
