document.addEventListener('DOMContentLoaded', () => {
    const filesDiv = document.getElementById('files');
    const addBtn = document.getElementById('add-file');
    const form = document.getElementById('merge-form');
    if (!filesDiv || !addBtn || !form) return;

    const dropZone = document.getElementById('merge-drop-zone');
    const metadataUrl = form.dataset.metadataUrl;
    let activeRequest = null;
    let progressTimer = null;
    if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf_tools/static/js/pdf.worker.min.js';

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return 'Unknown size';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function renumber() {
        [...filesDiv.children].forEach((item, idx) => {
            item.querySelector('input[type="file"]').name = `file${idx}`;
            item.querySelector('input[type="text"]').name = `range_file${idx}`;
            item.querySelector('.file-number').textContent = `Document ${idx + 1}`;
        });
        addBtn.disabled = filesDiv.children.length >= 10;
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
            detail.textContent = remaining ? `Elapsed ${elapsed}s · estimated time remaining: about ${remaining}s` : `Elapsed ${elapsed}s · taking a little longer than estimated…`;
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
    }

    function attachFile(item, file) {
        if (!file || file.type !== 'application/pdf') return;
        const input = item.querySelector('input[type="file"]');
        const preview = item.querySelector('.pdf-preview');
        item.querySelector('.filename').textContent = file.name;
        item._metadataPromise = loadMetadata(item, file);
        input.files = (() => { const transfer = new DataTransfer(); transfer.items.add(file); return transfer.files; })();
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                if (!window.pdfjsLib) throw new Error('PDF renderer unavailable');
                const pdf = await window.pdfjsLib.getDocument({data: reader.result}).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({scale: 1.15});
                const scale = Math.min(1, 360 / viewport.width);
                const scaled = page.getViewport({scale: scale * 1.15});
                preview.width = scaled.width; preview.height = scaled.height;
                await page.render({canvasContext: preview.getContext('2d'), viewport: scaled}).promise;
            } catch (error) {
                preview.getContext('2d').clearRect(0, 0, preview.width, preview.height);
                const context = preview.getContext('2d'); context.font = '14px system-ui'; context.fillStyle = '#667784'; context.fillText('Preview unavailable', 18, 30);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function addFileInput(file) {
        const wrapper = document.createElement('div');
        wrapper.className = 'file-item'; wrapper.draggable = true;
        wrapper.innerHTML = `<div class="file-preview"><span class="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">⠿</span><canvas class="pdf-preview" aria-label="First page preview"></canvas></div>
            <div class="file-details"><strong class="file-number">Document</strong><span class="filename">Choose a PDF</span><span class="metadata">No file selected</span><input type="file" accept="application/pdf" required>
            <input type="text" value="all" placeholder="Page range">
            </div><div class="file-actions"><button type="button" class="small-button up" title="Move up">↑</button><button type="button" class="small-button down" title="Move down">↓</button><button type="button" class="small-button remove" title="Remove">Remove</button></div>`;
        filesDiv.appendChild(wrapper);
        const input = wrapper.querySelector('input[type="file"]'); input.addEventListener('change', () => attachFile(wrapper, input.files[0]));
        if (file) attachFile(wrapper, file);
        renumber();
    }

    addBtn.addEventListener('click', addFileInput);
    addFileInput(); addFileInput();
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
        ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
        dropZone.addEventListener('drop', event => [...event.dataTransfer.files].filter(file => file.type === 'application/pdf').forEach(file => addFileInput(file)));
    }
    filesDiv.addEventListener('click', (event) => {
        const item = event.target.closest('.file-item');
        if (!item) return;
        if (event.target.classList.contains('up') && item.previousElementSibling) filesDiv.insertBefore(item, item.previousElementSibling);
        if (event.target.classList.contains('down') && item.nextElementSibling) filesDiv.insertBefore(item.nextElementSibling, item);
        if (event.target.classList.contains('remove') && filesDiv.children.length > 1) item.remove();
        renumber();
    });
    filesDiv.addEventListener('dragstart', event => { const item = event.target.closest('.file-item'); if (item) { item.classList.add('is-dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'reorder'); } });
    filesDiv.addEventListener('dragend', event => { const item = event.target.closest('.file-item'); if (item) item.classList.remove('is-dragging'); });
    filesDiv.addEventListener('dragover', event => { event.preventDefault(); const moving = filesDiv.querySelector('.file-item.is-dragging'); const target = event.target.closest('.file-item'); if (!moving || !target || moving === target) return; const rect = target.getBoundingClientRect(); filesDiv.insertBefore(moving, event.clientY < rect.top + rect.height / 2 ? target : target.nextSibling); renumber(); });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        clearFormError();
        const items = [...filesDiv.children];
        if (items.some(item => !item.querySelector('input[type="file"]').files.length)) {
            showFormError('Choose a PDF for every document card before merging.');
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
            formData.set(`file${idx}`, item.querySelector('input[type="file"]').files[0]);
            formData.set(`range_file${idx}`, item.querySelector('input[type="text"]').value || 'all');
        });
        formData.set('order', items.map((_, idx) => idx).join(','));
        const totalBytes = items.reduce((sum, item) => sum + item.querySelector('input[type="file"]').files[0].size, 0);
        const totalPages = items.reduce((sum, item) => sum + Number(item.dataset.pageCount || 1), 0);
        const estimatedSeconds = Math.max(4, Math.ceil(totalBytes / (10 * 1024 * 1024) + totalPages / 200));
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Merging…';
        startProgress('Merging PDFs — your files are being processed locally.', estimatedSeconds);
        try {
            activeRequest = fetch(form.action, {method: 'POST', body: formData});
            const response = await activeRequest;
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
            URL.revokeObjectURL(link.href);
            finishProgress('Complete — your download should begin now.');
        } catch (error) {
            finishProgress('The merge stopped. See the message above for the next step.');
            showFormError(error.message || 'The PDFs could not be merged. Check the files and try again.');
        } finally {
            activeRequest = null;
            submitButton.disabled = false;
            submitButton.textContent = 'Merge and download →';
        }
    });
});
