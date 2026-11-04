document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('stamp-form');
    if (!form) return;
    const {parseRange, stem} = window.PdfToolPage;
    const $ = id => document.getElementById(id);
    const field = name => form.elements[name];
    const formats = {page_of: (n, t) => `Page ${n} of ${t}`, page: n => `Page ${n}`, n_of: (n, t) => `${n} / ${t}`, n: n => `${n}`};
    const page = window.PdfToolPage.setup({form, onFile: () => { previewIndex = 0; update(); }});
    let previewIndex = 0, renderToken = 0, renderedPage = 0;

    function selection() {
        const total = page.state.pageCount;
        if (!total) return [];
        return [...new Set(parseRange(field('pages').value, total))];
    }

    async function update() {
        const watermarkOn = field('use_watermark').checked, numbersOn = field('numbers').checked;
        form.querySelectorAll('.toggle-section').forEach(section => section.classList.toggle('is-off', !section.querySelector('.switch input').checked));
        $('opacity-value').textContent = `${field('watermark_opacity').value}%`;
        const total = page.state.pageCount;
        if (!total) return;
        let pages;
        try { pages = selection(); field('pages').setCustomValidity(''); page.message(''); }
        catch (error) { page.message(error.message); return; }
        if (!pages.length) return;
        previewIndex = Math.max(0, Math.min(previewIndex, pages.length - 1));
        const pageNumber = pages[previewIndex];
        $('preview-label').textContent = `Page ${pageNumber} of ${total}`;
        $('preview-prev').disabled = previewIndex === 0;
        $('preview-next').disabled = previewIndex === pages.length - 1;

        const canvas = $('preview-canvas');
        if (renderedPage !== pageNumber) {
            const mine = ++renderToken;
            const scratch = document.createElement('canvas');
            await page.renderPage(pageNumber, scratch, 520);
            if (mine !== renderToken) return;
            canvas.width = scratch.width; canvas.height = scratch.height;
            canvas.getContext('2d').drawImage(scratch, 0, 0);
            renderedPage = pageNumber;
            canvas.hidden = false;
            form.querySelector('.preview-empty').hidden = true;
        }
        // Scale on-screen overlays from PDF points to the preview's displayed size.
        const pdfPage = await page.state.doc.getPage(pageNumber);
        const points = pdfPage.getViewport({scale: 1});
        const scale = canvas.clientWidth / points.width;
        const start = Number(field('start').value) || 0;
        const number = $('preview-number');
        number.hidden = !numbersOn;
        number.textContent = formats[field('number_format').value](start + previewIndex, start + pages.length - 1);
        number.style.fontSize = `${(Number(field('font_size').value) || 10) * scale}px`;
        number.dataset.position = form.querySelector('input[name="position"]:checked').value;
        number.style.setProperty('--margin', `${28 * scale}px`);
        const mark = $('preview-watermark');
        mark.hidden = !watermarkOn || !field('watermark').value.trim();
        mark.textContent = field('watermark').value.trim();
        mark.style.opacity = Number(field('watermark_opacity').value) / 100;
        const diagonal = Math.hypot(canvas.clientWidth, canvas.clientHeight);
        mark.style.fontSize = '100px';
        const width = mark.scrollWidth || 1;
        mark.style.fontSize = `${Math.min(160 * scale, 100 * diagonal * 0.75 / width)}px`;
        mark.style.transform = `translate(-50%, -50%) rotate(${-Math.atan2(canvas.clientHeight, canvas.clientWidth)}rad)`;
    }

    // Adjusting a setting in a switched-off section switches that section on.
    const enableSection = target => { const section = target.closest('.toggle-section'); const toggle = section?.querySelector('.switch input'); if (toggle && target !== toggle && target.closest('.settings-grid')) toggle.checked = true; };
    form.addEventListener('input', event => { if (event.target.type !== 'file') { enableSection(event.target); update(); } });
    form.addEventListener('focusin', event => { if (event.target.matches('input[type=text]')) { enableSection(event.target); update(); } });
    form.addEventListener('change', event => { if (event.target.type !== 'file') update(); });
    form.querySelectorAll('[data-word]').forEach(chip => chip.addEventListener('click', () => { field('watermark').value = chip.dataset.word; field('use_watermark').checked = true; update(); }));
    $('preview-prev').addEventListener('click', () => { previewIndex--; update(); });
    $('preview-next').addEventListener('click', () => { previewIndex++; update(); });
    window.addEventListener('resize', () => update());

    form.addEventListener('submit', event => {
        event.preventDefault();
        page.message('');
        if (!page.state.file) { page.message('Choose a PDF first.'); return; }
        if (!field('numbers').checked && !(field('use_watermark').checked && field('watermark').value.trim())) { page.message('Turn on page numbers, a watermark, or both.'); return; }
        try { selection(); } catch (error) { page.message(error.message); field('pages').focus(); return; }
        const body = new FormData(form);
        body.set('file', page.state.file, page.state.file.name);
        page.submit({body, expect: 'application/pdf', filename: `${stem(page.state.file.name)}-stamped.pdf`, label: 'Stamping your PDF on the intranet server.', busyLabel: 'Applying…'});
    });
    update();
});
