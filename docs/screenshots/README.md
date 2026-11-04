# PDF Tools UI review

Actual Chromium screenshots using generated, fictional internal paperwork and
signature artwork. Every page shares one design system (`static/theme.css`) and
uses locally bundled Lucide SVG icons. Editor shots (01–05) are regenerated with
`node tests/browser/editor.cjs` against the running test service; the other pages
were captured from the same service with the same fixtures.

## Home

![Home page with the three tools and privacy summary](06-home.png)

## Merge PDFs

![Merge workspace with two documents, thumbnails and page ranges](07-merge.png)

## Split PDF

![Split workspace with custom groups and part previews](12-split.png)

## Page numbers & watermark

![Stamp workspace with settings and live preview](13-stamp.png)

## Extract pages

![Extract workspace with a visual page picker and output choice](08-extract.png)

## Help and guide

![Help page with workflow diagram and privacy notes](09-help.png)

## Editor: empty workspace

![Empty editor with drop target and toolbar](01-editor-empty.png)

## Editor: highlights, markup and comments

![Text highlight, page markup and comment properties](02-editor-annotations.png)

## Editor: signature-image placement

![Signature image with placement and resizing controls](03-editor-signature.png)

## Editor: signature pad

![Drawing a signature in the editor's signature pad](14-editor-signature-pad.png)

## Editor: object actions

![Placed signature with Duplicate and All pages actions](15-editor-object-actions.png)

## Editor: limited existing-text editing

![Qualified existing text shown as green editing targets](04-editor-text-edit.png)

## Editor: page controls

![Restored project with a rotated, duplicated page](05-editor-page-controls.png)

## Phone layouts

![Home page on a phone](10-mobile-home.png) ![Editor on a phone](11-mobile-editor.png)
