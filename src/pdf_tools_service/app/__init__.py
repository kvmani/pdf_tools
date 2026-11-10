"""Application factory for the PDF Tools service."""

from __future__ import annotations

import json
import os
from io import BytesIO
from flask import Flask, Blueprint, Response, current_app, make_response, render_template, jsonify, request, url_for
from .._version import __version__
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
from .controllers.editor_controller import editor_bp
from .controllers.split_controller import split_bp
from .controllers.stamp_controller import stamp_bp
from .services.metrics import request_latency, request_count, metrics_response

pdf_tools_bp.register_blueprint(merge_bp)
pdf_tools_bp.register_blueprint(extract_bp)
pdf_tools_bp.register_blueprint(editor_bp)
pdf_tools_bp.register_blueprint(split_bp)
pdf_tools_bp.register_blueprint(stamp_bp)


@pdf_tools_bp.after_request
def _module_scripts_are_javascript(response: Response) -> Response:
    """Serve .mjs as JavaScript whatever the host's MIME table says.

    Windows MIME registries can label .mjs as text/plain, and browsers refuse a
    module script of that type (nosniff), so the editor never starts. Registered
    on the blueprint, not the standalone app, so it also holds when the ML Server
    portal mounts these routes in-process.
    """
    if request.endpoint == "pdf_tools.static" and request.path.endswith(".mjs"):
        response.mimetype = "text/javascript"
    return response


@pdf_tools_bp.context_processor
def _tool_context() -> dict:
    """Values every PDF Tools page needs: version, upload limit and portal link."""
    portal_url = current_app.config.get("PDF_TOOLS_PORTAL_URL")
    if not portal_url and "main.home" in current_app.view_functions:
        # Mounted inside the ML Server portal: offer a way back to its home page.
        portal_url = url_for("main.home")
    return {
        "pdf_tools_version": __version__,
        "pdf_tools_max_upload": current_app.config.get("MAX_CONTENT_LENGTH") or 0,
        "pdf_tools_portal_url": portal_url,
    }


@pdf_tools_bp.route("/")
def index() -> str:
    """Render the landing page."""
    return render_template("pdf_index.html")


@pdf_tools_bp.route("/help")
def help_page() -> str:
    """Explain page algorithms, inputs, privacy, and operational limits."""
    response = make_response(render_template("pdf_help.html"))
    # MathJax lays out equations with a stylesheet it injects at runtime, so this
    # page (static, no user content) permits inline styles. Other pages do not.
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self'; "
        "frame-ancestors 'self'"
    )
    return response


@pdf_tools_bp.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "tool_id": "pdf-tools", "version": __version__})


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
        response.headers.setdefault("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'")
        if request.path.startswith(("/pdf_tools/metadata", "/pdf_tools/editor")):
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    app.register_blueprint(pdf_tools_bp)

    # ✅ Add root route for testing
    @app.route("/")
    def root():
        return "✅ PDF Tools Service is running!"

    return app


app = create_app()
