document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('split-form');
    if (!form) return;
    const {parseRange, stem} = window.PdfToolPage;
    const grid = document.getElementById('part-grid');
    const summary = document.getElementById('plan-summary');
    const everyInput = document.getElementById('every-n');
    const groupsInput = document.getElementById('groups');
    const page = window.PdfToolPage.setup({form, onFile: () => { if (page.state.pageCount > 1) everyInput.value = Math.max(1, Math.ceil(page.state.pageCount / 2)); update(); }});
    const MAX_PARTS = 200;
    let thumbToken = 0;

    const mode = () => form.querySelector('input[name="mode"]:checked').value;
    const value = () => mode() === 'every' ? everyInput.value : mode() === 'ranges' ? groupsInput.value : '';
    const describe = pages => pages.length === 1 ? `Page ${pages[0]}` : pages.every((n, i) => i === 0 || n === pages[i - 1] + 1) ? `Pages ${pages[0]}–${pages.at(-1)}` : `${pages.length} pages`;

    // Same rules as SplitService.plan on the server.
    function plan(total) {
        if (mode() === 'each') return Array.from({length: total}, (_, i) => [i + 1]);
        if (mode() === 'every') {
            const size = Number(everyInput.value);
            if (!Number.isInteger(size) || size < 1) throw new Error('Each part needs at least one page.');
            const groups = [];
            for (let start = 1; start <= total; start += size) groups.push(Array.from({length: Math.min(size, total - start + 1)}, (_, i) => start + i));
            return groups;
        }
        const parts = groupsInput.value.split(';').map(p => p.trim()).filter(Boolean);
        if (!parts.length) throw new Error('Enter at least one group, for example 1-3; 4-6.');
        return parts.map(part => { try { return parseRange(part, total); } catch (error) { throw new Error(`Group “${part}”: ${error.message}`); } });
    }

    async function update() {
        const total = page.state.pageCount;
        grid.replaceChildren();
        if (!total) { summary.textContent = 'Choose a PDF to see the files that will be created.'; return; }
        let groups;
        try { groups = plan(total); } catch (error) { summary.textContent = error.message; summary.classList.add('error'); return; }
        summary.classList.remove('error');
        if (groups.length > MAX_PARTS) { summary.textContent = `This would create ${groups.length} files; the limit is ${MAX_PARTS}.`; summary.classList.add('error'); return; }
        summary.textContent = `${groups.length} ${groups.length === 1 ? 'file' : 'files'} will be created from ${total} pages.`;
        const shown = groups.slice(0, 24);
        for (const [index, pages] of shown.entries()) {
            const card = document.createElement('div');
            card.className = 'part-card';
            const canvas = document.createElement('canvas');
            const thumb = document.createElement('div'); thumb.className = 'part-thumb'; thumb.append(canvas);
            const label = document.createElement('strong'); label.textContent = `Part ${index + 1}`;
            const meta = document.createElement('span'); meta.textContent = describe(pages);
            card.append(thumb, label, meta); card.dataset.first = pages[0];
            grid.append(card);
        }
        if (groups.length > shown.length) {
            const more = document.createElement('div'); more.className = 'part-card more';
            more.textContent = `+ ${groups.length - shown.length} more`;
            grid.append(more);
        }
        const mine = ++thumbToken;
        for (const card of grid.querySelectorAll('.part-card[data-first]')) {
            if (mine !== thumbToken) return;
            await page.renderPage(Number(card.dataset.first), card.querySelector('canvas'), 160).catch(() => {});
        }
    }

    form.addEventListener('change', event => { if (event.target.name === 'mode') update(); });
    everyInput.addEventListener('input', () => { form.querySelector('input[value="every"]').checked = true; update(); });
    everyInput.addEventListener('focus', () => { form.querySelector('input[value="every"]').checked = true; });
    groupsInput.addEventListener('input', () => { form.querySelector('input[value="ranges"]').checked = true; update(); });
    groupsInput.addEventListener('focus', () => { form.querySelector('input[value="ranges"]').checked = true; update(); });

    form.addEventListener('submit', event => {
        event.preventDefault();
        page.message('');
        if (!page.state.file) { page.message('Choose a PDF to split.'); return; }
        if (page.state.pageCount) {
            try { if (plan(page.state.pageCount).length > MAX_PARTS) throw new Error(`The limit is ${MAX_PARTS} files.`); }
            catch (error) { page.message(error.message); return; }
        }
        const body = new FormData();
        body.append('file', page.state.file, page.state.file.name);
        body.append('mode', mode());
        body.append('value', value());
        page.submit({body, expect: 'application/zip', filename: `${stem(page.state.file.name)}-split.zip`, label: 'Splitting your PDF on the intranet server.', busyLabel: 'Splitting…'});
    });
});
