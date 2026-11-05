// "Start over": once a file is chosen, offer to clear the page completely.
// Navigating to the page afresh (rather than reloading) drops every file and
// value from memory and stops browsers restoring the old form fields.
document.addEventListener('DOMContentLoaded', () => {
    for (const button of document.querySelectorAll('[data-reset]')) {
        const form = button.closest('form');
        if (!form) continue;
        const show = () => { button.hidden = false; };
        form.addEventListener('change', event => { if (event.target.type === 'file') show(); });
        form.addEventListener('drop', show);
        button.addEventListener('click', () => window.location.replace(window.location.pathname));
    }
});
