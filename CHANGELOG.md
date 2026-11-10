# Changelog

## [0.3.1] - 2026-11-10

### Fixed

- **PDF Editor did not open files in Chrome 134** (the office browser): "Choose a
  PDF", "Open PDF" and drag-and-drop did nothing, and a dropped file opened in a
  new tab. PDF.js 6.5's modern build uses JavaScript features newer than Chrome
  134 (`Uint8Array.prototype.toHex` and others); the editor now loads the official
  PDF.js **legacy** build of the same version, which supplies them. Verified in
  Chrome for Testing 134.0.6998.35, over plain HTTP, mounted in the ML Server
  portal: both buttons, drag-and-drop, export and every other tool.
- `.mjs` files are served as JavaScript whatever the host's MIME table says, now
  also when the portal mounts these routes in-process (previously only in the
  standalone app).

### Added

- If the editor ever fails to start, a red notice says so on the page, naming the
  errors and what the browser received for each file the editor needs, instead of
  leaving buttons that silently do nothing.

## [0.3.0] - 2026-11-05

### Deployment

- Requires two new Python packages, declared in `pyproject.toml`:
  `pypdfium2==5.14.0` (binary wheel) and `reportlab>=4.4,<5`. Both must be
  available from the office package mirror.
- `/pdf_tools/health` reports the version from `pdf_tools_service/_version.py`,
  and every page shows it in the footer.
- Inside the ML Server portal, an **All tools** link returns to the portal home.
- Verified mounted in the ML Server portal under its security policy: PDF.js falls
  back to its JavaScript image decoders where WebAssembly is not permitted.

### New

- **PDF Editor** at `/pdf_tools/editor`: text, comments, highlights, drawings,
  images, drawn or uploaded signature images, page organisation, qualified
  existing-text replacement, undo/redo and editable `.pdfproject` copies.
  Context-aware properties, keyboard shortcuts, drop-to-open, duplicate, copy to
  all pages, copy/paste between pages, arrow-key nudging and Ctrl+scroll zoom.
- **Split PDF** at `/pdf_tools/split`: equal parts, one file per page or custom
  groups, previewed with thumbnails and downloaded as one ZIP.
- **Page numbers & watermark** at `/pdf_tools/stamp`: four number formats, six
  positions, start number, size and page range, plus a diagonal watermark with
  adjustable strength and a live preview. Correct on rotated and cropped pages.

### Improved

- One shared, modern design across all pages, with navigation that marks the
  current page and bundled Lucide icons.
- Merge: multi-file drop zone, document rows with thumbnails, labelled page
  ranges, per-document rotation and a live document/page/size summary.
- Extract: visual page picker synced with the typed range, **Keep** or **Remove**
  selected pages, and PNG export rendered in the browser and zipped.
- Privacy: **Close** in the editor and **Start over** on the tool pages clear every
  file, image and setting from the browser tab in one step.
- Oversized files are refused in the browser with a clear message, and footers
  state the server's upload limit.
- Clearer tooltips on Save project, Open project and Download PDF.

### Fixed

- Vendored PDF.js `build/` files were excluded by `.gitignore`, so fresh checkouts
  could not render PDFs.
- Merge thumbnails never rendered.
- Extract's preview and image options returned data that the page discarded.
- Help page equations were mis-laid-out on the standalone server because its
  security policy blocked MathJax's stylesheet.

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
