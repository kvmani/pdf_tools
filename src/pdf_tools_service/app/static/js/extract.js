document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('extract-form');
    if (!form) return;
    const input = form.querySelector('input[type="file"]');
    const button = form.querySelector('button[type="submit"]');
    let timer = null;

    function showError(message) {
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

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!input.files.length) {
            showError('Choose a PDF before extracting pages.');
            return;
        }
        const file = input.files[0];
        const estimate = Math.max(4, Math.ceil(file.size / (10 * 1024 * 1024)));
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
        box.innerHTML = '<strong>Extracting pages — your file is being processed locally.</strong><div class="progress-track"><div class="progress-bar"></div></div><span class="progress-detail"></span>';
        const bar = box.querySelector('.progress-bar');
        const detail = box.querySelector('.progress-detail');
        const tick = () => {
            const elapsed = Math.floor((Date.now() - started) / 1000);
            const remaining = Math.max(0, estimate - elapsed);
            bar.style.width = `${Math.min(92, Math.round((elapsed / estimate) * 92))}%`;
            detail.textContent = remaining ? `Elapsed ${elapsed}s · estimated time remaining: about ${remaining}s` : `Elapsed ${elapsed}s · taking a little longer than estimated…`;
        };
        tick();
        timer = window.setInterval(tick, 1000);
        button.disabled = true;
        button.textContent = 'Extracting…';
        try {
            const response = await fetch(form.action, {method: 'POST', body: new FormData(form)});
            const contentType = response.headers.get('content-type') || '';
            if (!response.ok || (!contentType.includes('application/pdf') && !contentType.includes('application/json'))) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'The pages could not be extracted. Check the PDF and page range.');
            }
            if (contentType.includes('application/json')) {
                const data = await response.json();
                if (!data.success) throw new Error(data.error || 'The pages could not be extracted. Check the PDF and page range.');
                bar.style.width = '100%';
                detail.textContent = 'Complete — the requested preview is ready.';
                return;
            }
            const link = document.createElement('a');
            link.href = URL.createObjectURL(await response.blob());
            link.download = 'extracted_pages.pdf';
            link.click();
            URL.revokeObjectURL(link.href);
            bar.style.width = '100%';
            detail.textContent = 'Complete — your download should begin now.';
        } catch (error) {
            showError(error.message || 'The pages could not be extracted. Check the PDF and page range.');
            detail.textContent = 'The extraction stopped. See the message above for the next step.';
        } finally {
            window.clearInterval(timer);
            timer = null;
            button.disabled = false;
            button.textContent = 'Extract and download →';
        }
    });
});
