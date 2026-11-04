# PDF editor working ledger

## Goal and accepted scope

An offline intranet browser editor: annotations, highlighting, comments, new text,
images and pasted signature images, freehand ink, page insertion/deletion/reordering/
rotation/duplication/extraction, undo/redo, and PDF export. Existing text editing is
restricted to a documented set of simple standard-font objects. No OCR or
cryptographic signatures. No required external services or browser CDNs.

The user requires milestone commits pushed continuously to `main`, with this ledger
maintained so future sessions can resume. See `AGENTS.md`.

## Milestones

1. [complete] Record scope, persistence agreement and implementation plan.
2. [in progress] Validated document inspection/export API, native text-edit adapter,
   page operations, annotations and image/signature embedding; backend tests.
3. [pending] Offline browser workspace, editing tools, history, page tools and export.
4. [pending] Browser end-to-end checks, offline asset audit, user/admin documentation.

## Architecture decision

Use the established PDF.js renderer with a custom lightweight SVG editor layer,
rather than adding an unvalidated full framework. Bundle a supported PDF.js release
and its worker/resources. Keep pypdf for composition and standard annotations;
ReportLab supplies new text/vector/image overlays. PDFium/pypdfium2 is reserved for
strictly qualified existing-text objects, with serialized native access. No OCR or
new service processes. The browser sends original sources plus an explicit edit
manifest for stateless, in-memory export; files are not persisted on the server.

## Validation baseline

Before implementation: 31 tests passed during onboarding; live health, merge,
extraction and image conversion checks passed. Working tree clean. Remote `main`
and local starting commit: `4fbe4d7`.

## Resume here

Implement milestone 2, then update this file with actual results and commit/push.
Use `/workspace/pdf_tools`, `.venv/bin/python -m pytest -q`. The initial branch was
`work`; `main` now tracks `origin/main`. Never force-push. Research from the prior
session is at `/workspace/pdf-editor-research/RESEARCH.md` when available; this
ledger and repository documentation must remain sufficient without that folder.

## Known boundaries to verify

- Existing text: only simple horizontal, unembedded Helvetica/Times/Courier objects;
  enforce text length/font support and reject unsupported layouts.
- Correct geometry for cropped and rotated pages is required in preview and export.
- Standard PDF annotations must survive reopening; signature images must be ordinary
  embedded page content.
- Server processing is transient. Unsaved browser edits are lost on reload unless
  the user explicitly downloads a project backup; implement a portable project file.
- Current upload limit is 10 MiB. Preserve bounded processing and clear error messages.
