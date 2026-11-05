# Changelog

## [0.3.0] - 2026-11-05

Requires two new Python packages in the deployed environment, declared in
`pyproject.toml`: `pypdfium2==5.14.0` (binary wheel) and `reportlab>=4.4,<5`.
Both must be available from the office package mirror.

- Privacy: **Close** in the editor and **Start over** on the tool pages clear every
  file, image and setting from the browser tab in one step.
- Merge: rotate each document by 90° steps before merging.
- Extract: choose **Keep selected pages** or **Remove selected pages**.
- Pages show the PDF Tools version and the server's upload limit; oversized files
  are refused in the browser with a clear message; `/pdf_tools/health` reports the
  version from `pdf_tools_service/_version.py`.
- Inside the ML Server portal, an **All tools** link returns to the portal home.
- Clearer tooltips on Save project, Open project and Download PDF.
- Fixed: Help page equations were mis-laid-out on the standalone server because its
  security policy blocked MathJax's stylesheet.
- PDF Editor (new since 0.2.0): text, comments, highlights, drawings, images,
  page organisation, qualified existing-text replacement, undo/redo and editable
  `.pdfproject` copies.

- New **Split PDF** tool (`/pdf_tools/split`): equal parts, one file per page or
  custom groups, previewed with thumbnails and downloaded as one ZIP.
- New **Page numbers & watermark** tool (`/pdf_tools/stamp`): four number formats,
  six positions, start number, size and page range, plus a diagonal watermark with
  adjustable strength and a live preview. Correct on rotated and cropped pages.
- Editor: draw-a-signature pad with session reuse; duplicate, copy to all pages,
  copy/paste between pages, arrow-key nudging and Ctrl+scroll zoom.
- `npm run test:browser` also runs `tests/browser/features.cjs`.

- One shared design system (`theme.css`) across the home, merge, extract, help and
  editor pages, with a sticky navigation bar and bundled Lucide icons everywhere.
- Merge: clickable multi-file drop zone, compact document rows with thumbnails,
  labelled page ranges and a live document/page/size summary. Thumbnails now render.
- Extract: visual page picker synced with the typed range, browser-side range
  validation, and working PNG export (rendered locally and downloaded as a ZIP).
- Editor: context-aware properties panel, single-key tool shortcuts, drop-to-open,
  background thumbnails, grouped page tools, tablet and phone layouts.
- Fixed: vendored PDF.js `build/` files were excluded by `.gitignore`, so fresh
  checkouts could not render PDFs.

## 0.2.0 — 2026-08-23

- Migrated from deprecated PyPDF2 imports to maintained `pypdf` 6.x.
- Added a scientific in-app guide and SVG page-transformation workflow.
- Added versioned health metadata, production security headers, no-store
  metadata responses, and a Waitress-backed `pdf-tools` entry point.
- Included the default JSON configuration in built wheels so clean installations start without
  relying on a source-checkout file.
- Preserved the `/pdf_tools/*` blueprint contract used by the portal.

## 0.1.0

- Initial standalone and mountable PDF merge/extraction service.
