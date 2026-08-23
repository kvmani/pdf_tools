/* Offline MathJax configuration for PDF Tools.
 *
 * PDF Tools runs on a closed office intranet, so MathJax is vendored under
 * app/static/vendor/mathjax/ and never contacts a CDN. This file must be loaded
 * *before* tex-chtml-full.js; the bundled component ships every TeX extension,
 * so no package is ever fetched lazily at render time.
 */

/* Marking the document as "pending" here (rather than in the stylesheet) means a
 * missing or blocked MathJax bundle degrades to readable raw TeX instead of an
 * invisible equation block. The class is removed once typesetting finishes. */
document.documentElement.classList.add('mathjax-pending');

window.MathJax = {
  tex: {
    inlineMath: [
      ['\\(', '\\)']
    ],
    displayMath: [
      ['\\[', '\\]']
    ],
    processEscapes: true,
    tags: 'none'
  },
  chtml: {
    // Match the surrounding body text so equations sit on the page instead of
    // floating above it, and keep long display equations scrollable.
    scale: 1.0,
    matchFontHeight: true,
    displayAlign: 'center',
    displayIndent: '0'
    // fontURL is deliberately not set: MathJax derives it from the directory of
    // the loaded bundle, so the same file works standalone and when the service
    // is mounted under a prefix. Hardcoding it breaks one of those two modes.
  },
  options: {
    // Only typeset explicitly marked containers; the rest of the page (file
    // names, page ranges, user text) must never be reinterpreted as TeX.
    processHtmlClass: 'mathjax',
    ignoreHtmlClass: '.*',
    enableMenu: false
  },
  startup: {
    typeset: true,
    pageReady: function () {
      return window.MathJax.startup.defaultPageReady().then(function () {
        document.documentElement.classList.remove('mathjax-pending');
        document.documentElement.classList.add('mathjax-ready');
      });
    }
  }
};
