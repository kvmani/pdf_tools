# Intranet Deployment

This service can run stand alone or as a blueprint under the `ml_server`
application.

## Standalone testing

```bash
./src/pdf_tools_service/setup.sh
./src/pdf_tools_service/run.sh
```

Visit `http://localhost:8000/pdf_tools/merge` to test the interface.

## Using with ml_server

Import `create_app` from `pdf_tools_service.app` and register the
`pdf_tools` blueprint on the main Flask app:

```python
from pdf_tools_service.app import pdf_tools_bp
app.register_blueprint(pdf_tools_bp)
```

Configuration can be overridden via environment variables prefixed with
`PDFTOOLS_` or by setting `PDF_TOOLS_CONFIG` to a config file path.

Health checks are available at `/pdf_tools/health` and Prometheus metrics at
`/pdf_tools/metrics`.
