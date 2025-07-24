# PDF Tools Service

This Flask-based service provides PDF merging and page extraction functionality
through a browser interface. It is designed for integration with
[`ml_server`](https://github.com/kvmani/ml_server) and follows its structure
and development practices.

## Features

- Merge multiple PDFs with configurable page ranges for each file.
- Extract specific pages from a single PDF.
- Client-side previews of uploaded files.
- RESTful JSON endpoints for integration.

## Setup

```bash
./setup.sh
./run.sh
```

Read `deployment_intranet.md` for intranet deployment instructions.

