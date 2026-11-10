# Editor dependencies and local assets

The application remains under its existing MIT license. Third-party components
retain their own terms; ship their notices with redistributed artifacts.

| Component | Use | License / evidence |
|---|---|---|
| PDF.js / pdfjs-dist 6.5.438 | Browser rendering, text layer and fonts | Apache-2.0; `app/static/vendor/pdfjs/LICENSE` |
| PDF.js standard fonts / codecs | Local font and image support | Individual notices in `standard_fonts/` and `wasm/` |
| Lucide static icons 1.68.0 | Icons on all pages (subset sprite built from the verified tarball) | ISC / included upstream notices; `app/static/vendor/lucide/LICENSE` |
| pypdfium2 5.14.0 / PDFium | Qualified native text-object editing | Permissive licenses and bundled third-party terms; retain wheel license inventory |
| ReportLab 4.x | Text, image and vector composition | BSD-style terms in the installed distribution |
| pypdf 6.x | Existing page operations and PDF annotations | BSD-3-Clause terms in the installed distribution |

`PROVENANCE.json` beside each browser bundle records its npm package, version,
tarball URL and SHA-512 integrity. The tarballs were verified against npm integrity
before vendoring. All necessary browser assets are served from the intranet. The runtime uses the
official `legacy/build` modules (same verified tarball and version) to provide
compatibility polyfills for older office browsers, including Chrome 134.

Existing Flask/Pillow/pdf2image/WTForms/Waitress/Prometheus dependencies retain their
existing licenses. No PyMuPDF, commercial PDF SDK, OCR engine or certificate service
has been added. No proprietary EmbedPDF/CloudPDF/Stirling editor is used.

When refreshing assets, verify the new package checksum, preserve component notices,
review browser compatibility and rerun offline browser/export tests. Do not copy an
unversioned CDN script into the application or disable TLS/integrity checks.
