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

## Deployment modes

PDF Tools is standalone by default: install this repository and run its own Flask web app without
`ml_server` or any other platform repository. The `ml_server` portal is an optional integration
layer that may mount the blueprint or link to the standalone service; it is not required for PDF
Tools development, testing, or deployment.

## Usage

Start the server using the provided script:

```bash
./src/pdf_tools_service/run.sh
```

The server listens on `http://HOST:PORT` (default `0.0.0.0:8000`). Navigate to
`/pdf_tools/merge` or `/pdf_tools/extract` to use the tools. When integrated
with `ml_server`, mount the blueprint under the same prefix.

For production, install the repository and use the Waitress entry point rather
than Flask's development server:

```bash
python -m pip install -e .
HOST=127.0.0.1 PORT=8000 pdf-tools
```

Verify `/pdf_tools/health` and `/pdf_tools/help` before switching reverse-proxy
traffic. Keep upload limits at both the proxy and Flask layers. Roll back by
reinstalling the previously pinned release and restarting the service.

Configuration is loaded from `src/pdf_tools_service/config.json` by default. A
different path can be provided using the `PDF_TOOLS_CONFIG` environment
variable or as the first argument to `run.sh` and `setup.sh`.

## Development

The original documentation describing the project structure and configuration lives in [src/pdf_tools_service/README.md](src/pdf_tools_service/README.md). New features should include matching tests under `tests/`.

For intranet deployment details see [docs/INTRANET_DEPLOYMENT.md](docs/INTRANET_DEPLOYMENT.md).

## License

This project is released under the MIT License.
