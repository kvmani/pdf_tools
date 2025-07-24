# PDF Tools Service

PDF Tools Service provides simple browser-based utilities for working with PDFs. It offers merging and page extraction capabilities through a lightweight Flask application. The service can run standalone or be integrated with the [ml_server](https://github.com/kvmani/ml_server) project.

## Features

- **Merge** any number of PDFs with optional page ranges, custom output filenames and drag‑and‑drop reordering.
- **Extract** selected pages from one PDF into a new document or export them as images. Optional previews help confirm page selection.
- Minimal HTML interface served by Flask.
- JSON responses so the tools can also be called programmatically.

## Installation

```bash
python3 -m venv venv
source venv/bin/activate
pip install -e .
```

## Usage

Start the server using the provided script:

```bash
./src/pdf_tools_service/run.sh
```

The server listens on `http://localhost:8000`. Navigate to `/merge` or `/extract` to use the tools. When used alongside `ml_server`, point requests to the same endpoints.

## Development

The original documentation describing the project structure and configuration lives in [src/pdf_tools_service/README.md](src/pdf_tools_service/README.md). New features should include matching tests under `tests/`.

## License

This project is released under the MIT License.
