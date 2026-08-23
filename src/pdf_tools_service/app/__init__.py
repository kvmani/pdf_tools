"""Application factory for the PDF Tools service."""

from __future__ import annotations

import json
import os
from io import BytesIO
from flask import Flask, Blueprint, Response, render_template, jsonify, request
from .utils.errors import read_pdf, user_error


DEFAULT_CONFIG = os.path.join(os.path.dirname(__file__), "..", "config.json")

# parent blueprint exported for integration with other apps
pdf_tools_bp = Blueprint(
    "pdf_tools",
    __name__,
    url_prefix="/pdf_tools",
    template_folder="templates",
    static_folder="static",
)

from .controllers.merge_controller import merge_bp
from .controllers.extract_controller import extract_bp
from .services.metrics import request_latency, request_count, metrics_response

pdf_tools_bp.register_blueprint(merge_bp)
pdf_tools_bp.register_blueprint(extract_bp)


@pdf_tools_bp.route("/")
def index() -> str:
    """Render the landing page."""
    return render_template("pdf_index.html")


@pdf_tools_bp.route("/help")
def help_page() -> str:
    """Explain page algorithms, inputs, privacy, and operational limits."""
    return render_template("pdf_help.html")


@pdf_tools_bp.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "tool_id": "pdf-tools", "version": "0.2.0"})


@pdf_tools_bp.route("/metadata", methods=["POST"])
def metadata():
    """Return lightweight metadata for a PDF selected in the browser."""
    uploaded = request.files.get("file")
    if not uploaded:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
    try:
        raw = uploaded.read()
        reader = read_pdf(BytesIO(raw), uploaded.filename or "This file")
        return jsonify({
            "success": True,
            "filename": uploaded.filename or "document.pdf",
            "size_bytes": len(raw),
            "page_count": len(reader.pages),
        })
    except Exception as exc:
        return jsonify({"success": False, "error": user_error(exc)}), 400


@pdf_tools_bp.route("/metrics")
def metrics():
    return metrics_response()


def _load_config(path: str) -> dict:
    """Load JSON configuration applying environment overrides."""
    with open(path) as cfg:
        config = json.load(cfg)

    prefix = "PDFTOOLS_"
    for key, value in os.environ.items():
        if not key.startswith(prefix):
            continue
        parts = key[len(prefix):].lower().split("__")
        dest = config
        for part in parts[:-1]:
            dest = dest.setdefault(part, {})
        try:
            dest[parts[-1]] = json.loads(value)
        except Exception:
            dest[parts[-1]] = value

    return config


def create_app(config_path: str | None = None) -> Flask:
    """Create and configure the Flask application."""
    config_path = config_path or os.getenv("PDF_TOOLS_CONFIG", DEFAULT_CONFIG)

    app = Flask(__name__)
    app.config.update(_load_config(config_path))

    @app.before_request
    def _start_timer():
        from flask import g, request
        import time
        g._metric_path = request.path
        g._metric_start = time.time()

    @app.after_request
    def _end_timer(response: Response):
        from flask import g, request
        if hasattr(g, "_metric_start") and hasattr(g, "_metric_path"):
            import time
            duration = time.time() - g._metric_start
            request_latency.labels(g._metric_path).observe(duration)
            request_count.labels(g._metric_path, response.status_code).inc()
        else:
            request_count.labels(request.path, response.status_code).inc()
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'")
        if request.path.startswith("/pdf_tools/metadata"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    app.register_blueprint(pdf_tools_bp)

    # ✅ Add root route for testing
    @app.route("/")
    def root():
        return "✅ PDF Tools Service is running!"

    return app


app = create_app()
