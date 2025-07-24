document.addEventListener('DOMContentLoaded', () => {
    const filesDiv = document.getElementById('files');
    const addBtn = document.getElementById('add-file');

    function addFileInput() {
        const idx = filesDiv.children.length;
        const wrapper = document.createElement('div');
        wrapper.className = 'file-item';
        wrapper.innerHTML = `<input type="file" name="file${idx}" required>
            <input type="text" name="range_file${idx}" value="all" placeholder="Page range">
            <button type="button" class="up">&#8593;</button>
            <button type="button" class="down">&#8595;</button>`;
        filesDiv.appendChild(wrapper);
    }

    if (addBtn) {
        addBtn.addEventListener('click', addFileInput);
        addFileInput();
    }

    filesDiv.addEventListener('click', (e) => {
        const item = e.target.closest('.file-item');
        if (!item) return;
        if (e.target.classList.contains('up') && item.previousElementSibling) {
            filesDiv.insertBefore(item, item.previousElementSibling);
        } else if (e.target.classList.contains('down') && item.nextElementSibling) {
            filesDiv.insertBefore(item.nextElementSibling, item);
        }
    });

    document.getElementById('merge-form')?.addEventListener('submit', () => {
        const order = [];
        Array.from(filesDiv.children).forEach((item, idx) => {
            const fileInput = item.querySelector('input[type="file"]');
            const rangeInput = item.querySelector('input[type="text"]');
            fileInput.name = `file${idx}`;
            rangeInput.name = `range_file${idx}`;
            order.push(idx);
        });
        const orderField = document.createElement('input');
        orderField.type = 'hidden';
        orderField.name = 'order';
        orderField.value = order.join(',');
        document.getElementById('merge-form').appendChild(orderField);
    });
});
