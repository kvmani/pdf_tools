document.addEventListener('DOMContentLoaded', () => {
    const filesDiv = document.getElementById('files');
    const addBtn = document.getElementById('add-file');
    const form = document.getElementById('merge-form');
    if (!filesDiv || !addBtn || !form) return;

    const dropZone = document.getElementById('merge-drop-zone');
    const metadataUrl = form.dataset.metadataUrl;
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

    async function loadMetadata(item, file) {
        const metadata = item.querySelector('.metadata');
        metadata.textContent = `${formatBytes(file.size)} · reading page count…`;
        const body = new FormData(); body.append('file', file, file.name);
        try {
            const response = await fetch(metadataUrl, {method: 'POST', body});
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Metadata unavailable');
            metadata.textContent = `${formatBytes(data.size_bytes)} · ${data.page_count} ${data.page_count === 1 ? 'page' : 'pages'}`;
            item.dataset.pageCount = data.page_count;
        } catch (error) { metadata.textContent = `${formatBytes(file.size)} · metadata unavailable`; }
    }

    function attachFile(item, file) {
        if (!file || file.type !== 'application/pdf') return;
        const input = item.querySelector('input[type="file"]');
        const preview = item.querySelector('.pdf-preview');
        item.querySelector('.filename').textContent = file.name;
        loadMetadata(item, file);
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
    form.addEventListener('submit', event => { if ([...filesDiv.querySelectorAll('input[type="file"]')].some(input => !input.files.length)) { event.preventDefault(); alert('Choose a PDF for every document card before merging.'); } });
    form.addEventListener('submit', () => {
        const order = [];
        [...filesDiv.children].forEach((item, idx) => {
            item.querySelector('input[type="file"]').name = `file${idx}`;
            item.querySelector('input[type="text"]').name = `range_file${idx}`;
            order.push(idx);
        });
        const orderField = document.createElement('input');
        orderField.type = 'hidden'; orderField.name = 'order'; orderField.value = order.join(',');
        form.appendChild(orderField);
    });
});
