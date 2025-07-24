# PDF Tools Service

PDF Tools Service is a lightweight Flask application that runs entirely on an
intranet. It exposes browser based tools for merging multiple PDFs and
extracting pages from a single PDF. The service is designed as a drop-in
component for the [`ml_server`](https://github.com/kvmani/ml_server) project but
can operate standalone.

## Features

- **Merge** any number of PDFs and optionally specify page ranges for each
  upload.
- **Extract** selected pages from one PDF into a new document.
- Simple HTML interface with drag‑and‑drop file inputs.
- RESTful JSON responses so the service can be called from other
  applications.

## Architecture

The application follows a small blueprint-based layout:

```
app/
  controllers/    # HTTP route handlers
  services/       # Business logic for PDF operations
  utils/          # Shared utilities (page range parsing)
  templates/      # Jinja2 templates for web UI
  static/         # CSS and JavaScript assets
```

Each controller uses a corresponding service object to keep I/O and logic
separated. `config.json` contains all configurable values such as the Flask
`SECRET_KEY` and allowed upload size.

## Configuration

Edit `config.json` to tune runtime settings:

- `SECRET_KEY` – Flask secret key.
- `MAX_CONTENT_LENGTH` – maximum request size in bytes. This protects the
  service from excessively large uploads.

## Setup and Usage

```bash
# install dependencies (Python 3.12 recommended)
./setup.sh

# start the development server on http://localhost:8000
./run.sh
```

Navigate to `/merge` or `/extract` in your browser to use the tools. The web
forms POST to `/merge` and `/extract` respectively and return a JSON response
containing the resulting PDF data as a hex encoded string.

### Developer Setup

It is recommended to create a Python virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Running Tests

```bash
export PYTHONPATH=..
pytest -q
```

All controllers, services and utilities have accompanying unit tests. Adding new
features should include corresponding tests.

### Intranet Deployment

See `deployment_intranet.md` for steps required to run the service in an offline
environment. In short you need a local package mirror for dependencies and
should run the service behind `gunicorn` bound to the intranet interface.

## License

This project is released under the MIT License.
