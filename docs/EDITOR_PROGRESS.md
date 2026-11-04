# PDF editor working ledger

## Accepted scope and working agreement

An offline intranet browser editor: annotations, text/area highlighting, comments,
new text, images and pasted signature images, ink/lines/boxes, page insertion,
deletion, reordering, rotation, duplication and extraction, undo/redo, search,
PDF export and portable project backups. Existing-text editing is intentionally
restricted to simple standard-font objects. No OCR or certificate signing.

The user explicitly requires milestone commits pushed continuously to `main`,
with this ledger maintained for resumption. See the root `AGENTS.md`. Never
force-push or overwrite concurrent work. Record blockers and partial work here.

## Milestone status

1. [complete] Scope and persistence agreement: `5bc155c`, pushed to main.
2. [complete] Validated inspection/export backend: `8e7d751`, pushed to main.
3. [complete] Offline browser editor, icons, history and recovery: `d673552`, pushed.
4. [complete] Expanded browser/geometry/export/recovery checks, offline wheel
   installation, screenshot gallery, user/admin guide and dependency notices.
   The final validation/documentation commit contains this ledger update.
5. [complete] UI/usability review (2026-11-04), pushed to main in small commits:
   - `e9a9fd6` fix: vendored PDF.js `build/` was ignored by `.gitignore`
     (`build/` → `/build/`); restored pdfjs-dist 6.5.438 files, integrity verified.
   - `83f5ce5` shared design system `static/theme.css`, sticky nav with active page,
     `_macros.html` icon macro, new home page; Lucide sprite extended (54 icons)
     from the same verified 1.68.0 tarball.
   - `e8742f4` merge redesign (multi-file drop zone, rows with thumbnails, labelled
     ranges, summary). Thumbnails previously never rendered (`pdf.destroy` is not
     a PDF.js 6 API; use `loadingTask.destroy()`).
   - `4be6c53` extract: thumbnail page picker synced with the range field, client
     range validation mirroring `PDFPageParser`, PNG export rendered with PDF.js in
     the browser and zipped (store-only writer in `extract.js`). The server's
     `preview`/`as_images` API is unchanged but no longer used by the page.
   - `7a2f347` editor: theme, full-height layout, context-aware properties panel
     (`markFields`/`toolFields` in `editor.js`), shortcuts, drop-to-open,
     background thumbnails, responsive layouts, `#paper[data-rendering]` flag; the
     browser test waits on it (`settled()`) before measuring placed objects.
   - `49848b9` help page and workflow SVG recoloured to the shared palette.
   - Final commit: regenerated gallery (11 screenshots) and docs.
   Checks: 54 pytest cases pass; `tests/browser/editor.cjs` passes repeatedly with
   no external requests or JS errors; ad-hoc Playwright checks covered merge
   download (5 pages from 3 + `1-2`), extract PDF/ZIP/range errors, and no
   horizontal scrolling at 390px and 1024px.
6. [complete] Feature round 2 (2026-11-04), pushed to main:
   - `2d71099` Split tool (`services/split_service.py`, `/pdf_tools/split`, ZIP
     output, 200-part limit) and Page numbers & watermark tool
     (`services/stamp_service.py`, `/pdf_tools/stamp`). Stamp overlays are drawn in
     visible (post-/Rotate) coordinates via `_display_transform`, honouring the crop
     box; verified by rendering at 0/90/180/270°. Shared `js/tool_page.js` and
     `_file_step.html`. Tests: `tests/test_split_stamp.py`.
   - `7006efc` editor signature pad (`openSignaturePad`, trimmed transparent PNG,
     session reuse), duplicate / All pages / copy-paste / arrow nudge /
     Ctrl+scroll zoom. New `tests/browser/features.cjs`; `npm run test:browser`
     runs both browser suites.
   - Final commit: docs, help limits, gallery (15 screenshots), distinct Split icon.
   Checks: 78 pytest cases; both browser suites pass with no external requests or
   JS errors.
   Ideas not yet done: optional dark theme; per-document rotation in Merge;
   editing PDF metadata (title/author); reordering pages in Split by drag.

## Current architecture

- Workspace: `/pdf_tools/editor`. Stateless multipart APIs:
  `/pdf_tools/editor/inspect` and `/pdf_tools/editor/export`.
- Custom SVG editing layer on locally bundled PDF.js 6.5.438. Full worker, font,
  CMap and WASM resources ship with the wheel. Lucide 1.68.0 SVG icons are bundled
  with license and SHA-512 provenance. No production Node/npm dependency.
- pypdf composes pages and standard annotations; ReportLab embeds text, image/
  signature and vector overlays. All coordinates are source-visible page points,
  top-left. Page rotation rotates original content and added marks together.
- pypdfium2 5.14.0 modifies qualified existing text objects. A process-wide lock
  serializes all native document access; handles are explicitly closed.
- Original sources are immutable. Browser state stores edits independently for
  duplicated pages. An export replays the validated manifest in memory.
- `.pdfproject` stores originals, images and edit state. Restoration validates the
  project with the server before replacing current work. Uploaded content is not
  retained as a server document library; multipart temporary spooling can occur.

## Evidence from current validation

- **54 Python tests passed** (31 baseline plus 23 editor cases).
- Existing text is actually replaced, with independent pypdf extraction confirming
  new text and absence of original text. Overflow, stale object references,
  non-ASCII replacements, invalid coordinates/images/manifests are rejected.
- Rendered placement checks pass on cropped pages at 0/90/180/270 degrees; added
  page rotation rotates added content. Duplicate pages have independent edits.
- Browser flow passes using Chromium and Playwright 1.62.1, with all non-origin
  requests blocked and zero JavaScript errors. It exercises text selection and
  highlighting, comments, text insertion, boxes/lines/ink, image placement,
  direct signature dragging and proportional resizing, qualified text replacement,
  search, export, fresh-tab project recovery, repeated restoration, PDF reopening,
  duplicate/blank/delete/move/rotate/extract page controls and undo/redo.
- Independent checks of the browser's downloaded PDF verify replacement text,
  added text, embedded images and standard highlight/comment annotations.
- Reopened final PDFs show saved comments; the original merge preview was also
  checked with the upgraded PDF.js renderer.
- A wheel plus runtime dependencies was built in
  `/workspace/pdf-editor-release/wheelhouse`. A fresh virtual environment installed
  it with `--no-index`, then passed editor asset, inspection and export checks.
  This bundle targets the current Linux x86_64 / Python 3.12 environment; build a
  matching bundle for other targets. It is outside the checkout, not in Git.
- Five real UI screenshots are tracked in `docs/screenshots/` with a gallery.
  Fixtures and signature artwork are fictional and generated by the tests.

## Resume / reproduce

Use `/workspace/pdf_tools` and read `docs/PDF_EDITOR.md` first.

```bash
.venv/bin/python -m pytest -q
HOST=127.0.0.1 PORT=8001 .venv/bin/pdf-tools
# In another shell; development only:
npm ci --ignore-scripts
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

`EDITOR_URL` and `SCREENSHOT_DIR` can override browser-test destinations.
The current test service was started on port 8001; do not assume it survives a
new task. Initial onboarding also started a service on port 8000; restart the
appropriate development service to load updated code/templates. No service was
published or deployed to the user's intranet by these development checks.

Note: in this container Chromium is at `/opt/pw-browsers/chromium`
(`CHROMIUM_PATH=/opt/pw-browsers/chromium`). Waitress caches templates; restart the
service after template edits.

All requested implementation milestones are complete. Next work should start
from user UI feedback or a representative internal-document compatibility case.
Do not silently broaden text eligibility or add OCR/certificate dependencies.
Fetch main, inspect status, make a focused change, test, update this ledger, commit
and push. Research outside the checkout is optional; these docs are sufficient.

## Intentional boundaries

- Existing text: direct, horizontal, unembedded Helvetica/Times/Courier-family
  single-line objects; printable ASCII replacements must fit. No paragraph reflow.
- New text: standard fonts and Western European characters, no external font fetch.
- Interactive/signed forms, password protection and nonstandard UserUnit pages are
  rejected explicitly. Page-composition export does not preserve document-level
  outlines, attachments or interactive navigation. Original page annotations remain.
- Saved PDF notes are displayed read-only. Use project backups to resume fully
  editable added objects. Exported images/signatures become normal page content.
- Unsaved tab contents are not durable: download a project regularly. No automatic
  browser/server persistence. Project files include private source/signature data.
- 10 MiB combined upload limit, 200 pages, 20 PDFs, 100 images, 2,000 marks. See the
  guide for pixel/stroke limits and supported file types.
- Highlights/boxes are not redaction. Signature images are ordinary visual marks.
