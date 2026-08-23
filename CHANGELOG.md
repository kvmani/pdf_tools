# Changelog

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
