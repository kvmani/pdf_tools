# Changelog

## Unreleased — 2026-11-04

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
