# Intranet PDF editor

Open `/pdf_tools/editor` on the running PDF Tools service. Standalone operation is
supported; no portal, cloud account, OCR engine, certificate service, Node runtime,
or browser CDN is required in production.

## Using the workspace

1. **Open PDF** imports a document; you can also drop PDF files onto the
   workspace. Opening another PDF (or **Insert PDF**) inserts its pages after the
   current page. The left sidebar selects pages; drag cards or use Up / Down to
   reorder. The **Current page** tools (Rotate, Duplicate, Extract, Delete, Add
   blank page) operate on the current page. Deletion can be undone. Rotation
   rotates the entire page, including added marks.
2. **Text** places a new text box. Edit its content, font, size, color and geometry
   on the right, then Apply changes. The Properties panel only shows the fields
   that apply to the selected object or active tool. Line breaks are supported; text must fit its
   box. Drag a selected object to move it, or drag its lower-right handle to resize.
3. **Highlight** lets you select existing text or drag an area. **Comment** places
   a note, with its content listed in the right sidebar. Notes and highlights are
   exported as standard PDF annotations. Existing saved PDF notes are displayed
   read-only and preserved; use a project file to keep new notes editable here.
4. **Draw**, **Box** and **Line** add colored markup. Their appearance is merged
   into PDF page content on export. Boxes/highlights do not remove content and
   must never be used as redaction.
5. **Image** opens a PNG/JPEG. **Signature** opens a pad: draw with a mouse, pen
   or finger (black or blue ink), or choose *Upload image instead*. A drawn
   signature is trimmed and placed as a transparent PNG, and signatures used in
   the session can be placed again from the pad. Click the page to place it. Move it,
   resize it with the handle (preserving aspect ratio), or set exact dimensions
   in Properties. Transparency is retained. A transparent PNG signature works
   best; a JPEG's existing background is preserved. The image becomes ordinary
   PDF content on export. There is no certificate or cryptographic signing.
   With an object selected, **Duplicate** (Ctrl/⌘ D) makes a copy, **All pages**
   repeats it at the same position on every other page in one undoable step
   (useful for initials), Ctrl/⌘ C and V copy it onto another page, and the arrow
   keys nudge it by 1 pt (Shift: 10 pt).
6. **Edit existing** shows green targets for supported text. Select one, enter a
   replacement and Apply. The server replaces the actual PDF text object and
   renders the resulting PDF back into the preview. Unsupported objects are not
   targets. Replacements that overflow are rejected, leaving the original intact.
7. **Find in document** searches textual pages, added text and comments. Find next
   cycles through matching pages. Matching original text spans are emphasized in
   the viewer. Scanned images cannot be searched without OCR, which is excluded.
8. **Download PDF** creates the finished document; **Extract page** downloads only
   the current page, including its edits. **Save project** downloads an editable
   `.pdfproject` containing source PDFs, images, notes, page order and text edits.
   **Open project** restores it, including in a fresh browser tab. **Close**
   clears the document, images, history and clipboard from the tab.
9. **Keyboard shortcuts**: V Select, T Text, E Edit existing, H Highlight,
   C Comment, D Draw, B Box, L Line, Del delete, Esc cancel, +/− or Ctrl+scroll zoom,
   arrows nudge, Ctrl/⌘ D duplicate, Ctrl/⌘ C / V copy and paste,
   PgUp/PgDn change page, Ctrl/⌘ Z undo (Shift or Ctrl+Y to redo), Ctrl/⌘ S save
   project, Ctrl/⌘ O open. The list is also under *Keyboard shortcuts* in the
   editor's right panel.

Undo/redo is bounded to 60 states. Keyboard shortcuts: Ctrl/Command Z, Shift Z for
redo, Ctrl/Command S to download a project, V for selection, Escape to cancel image
placement or a gesture, and Delete for a selected added object. Text fields retain
their usual keyboard behavior.

## Privacy and persistence

The browser holds the working project in memory. Inspection, existing-text
preview and export upload document bytes to this intranet server for transient
processing. There is no server-side document library or automatic persistent
draft storage. The web server/framework may spool multipart uploads to temporary
files while a request is processed; normal request cleanup removes these.
Operators should apply their usual temporary-storage policy.

Reloading/closing the tab loses unsaved edits. The unsaved-changes indicator and
browser warning are reminders, not durable recovery. Download a project regularly.
Project files contain original PDFs and signature images: treat them as private
documents. Nothing is sent to an external service by the editor. Exported PDFs
retain underlying content and existing annotations; this is not a sanitizer.

## Supported limits

- 200 pages per source/project, 20 source PDFs, 100 images, 2,000 added marks per
  export, 5,000 points per stroke. Upload requests remain subject to Flask's
  existing **10 MiB combined request limit**, including PDFs, images and manifest.
- PNG/JPEG images only; at most 16 million decoded pixels. Browser image selection
  additionally limits individual files to 5 MiB. Very large documents may require
  smaller sources/images or an administrator-reviewed upload-limit change.
- New text: standard Helvetica/Times/Courier families, 6–96 pt, Western European
  Windows-1252 characters. No bundled multilingual shaping/font editor.
- Existing text: direct, horizontal, unembedded standard-font single-line objects,
  4–96 pt. Replacement is printable ASCII and must fit the original bounding width.
  Embedded/subset fonts, scanned text, outlines, rotated text runs and nested form
  objects are deliberately excluded. A supported target is not paragraph reflow.
- Password-protected, interactive/signed-form PDFs, nonstandard page units and
  oversized page dimensions are rejected. Work on an unlocked, unsigned, flattened
  copy when appropriate. Original document outlines, attachments and interactive
  navigation are not part of this page-composition workflow; use originals for
  those capabilities. Native page annotations are retained.
- Reopening a final PDF permits new edits and inspection of saved notes, but
  embedded images/new text are no longer separate editor objects. Use the project
  backup for fully editable layers. Existing saved notes are read-only in this UI.
- No OCR, redaction, document conversion, certificate signing, persistent shared
  collaboration or AI service is introduced.

## Install and run

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e . pytest
HOST=127.0.0.1 PORT=8000 .venv/bin/pdf-tools
```

Python 3.12 is the validated runtime. Use a current Chromium/Edge or Firefox with
ES modules and WebAssembly. Runtime frontend resources are vendored: PDF.js
6.5.438 (worker, CMaps, standard fonts, WASM and viewer CSS), plus a Lucide SVG icon
sprite. Node/npm is only a development test prerequisite. The editor needs no
Poppler or Tesseract executable; older image-extraction features are separate.

The native PDFium library is bundled in its platform-specific wheel. Install the
wheel matching the intranet server's OS/architecture. A process-wide lock serializes
all PDFium document access under threaded Waitress; PDFium is not thread-safe.
The editor uses no persistent native document handles between requests.

Existing `PDF_TOOLS_CONFIG` configuration remains supported. Keep sensible upload,
memory, reverse-proxy and processing limits. The editor endpoints return no-store
headers. Serve over internal HTTPS when available and retain the supplied CSP;
`wasm-unsafe-eval` is used for local WASM, without permitting general script eval.

## Offline installation bundle

On a connected staging machine matching the target OS/architecture/Python:

```bash
python3 -m pip wheel . --wheel-dir /path/to/wheelhouse
# Transfer wheelhouse through the organization's normal approved process.
# On the disconnected target:
python3 -m venv .venv
.venv/bin/python -m pip install --no-index --find-links /path/to/wheelhouse pdf_tools_service
```

The application wheel includes the browser assets and package configuration.
Keep the wheelhouse, Git commit, package versions, checksums and third-party
notices with each deployment. No npm install runs on the disconnected server.
For OS-level provisioning, supply Python and the target system prerequisites via
the organization's existing offline OS packages/image.

## Verification and screenshots

```bash
.venv/bin/python -m pytest -q
# Development only; package-lock.json pins the browser runner:
npm ci --ignore-scripts
# Start the service on 127.0.0.1:8001 separately, then:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

`npm run test:browser` runs `tests/browser/editor.cjs` (the full editor flow) and
`tests/browser/features.cjs` (merge, extract, split, stamp, the signature pad and
object duplication/copy tools).

`EDITOR_URL` changes the test URL; `SCREENSHOT_DIR` changes its output directory.
The test creates fictional PDFs and signature artwork, blocks all non-origin
browser requests, exercises editing/export/recovery/page tools, and independently
checks the resulting PDF with pypdf. Use a system Chromium or provision a browser
through the normal development setup. Production does not need Playwright.

The [screenshot gallery](screenshots/README.md) shows actual browser controls, not
mockups. See [EDITOR_PROGRESS.md](EDITOR_PROGRESS.md) and the root `AGENTS.md` for
the required continuous commit/push workflow and resumption instructions.

