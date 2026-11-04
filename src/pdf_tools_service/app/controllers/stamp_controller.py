"""HTTP endpoints for adding page numbers and watermarks."""

from io import BytesIO
import re

from flask import jsonify, render_template, request, send_file

from .base import BaseController
from ..services.stamp_service import StampService
from ..utils.errors import user_error


def _number(name, default, cast=float):
    value = request.form.get(name, "")
    if value == "":
        return default
    try:
        return cast(value)
    except ValueError:
        raise ValueError(f"Enter a number for {name.replace('_', ' ')}.") from None


class StampController(BaseController):
    """Controller providing routes for page numbering and watermarking."""

    def __init__(self) -> None:
        super().__init__("stamp", __name__)

    def register(self) -> None:
        bp = self.blueprint
        service = StampService()

        @bp.route('/stamp', methods=['GET'])
        def form():
            return render_template("pdf_stamp.html")

        @bp.route('/stamp', methods=['POST'])
        def stamp():
            file = request.files.get("file")
            if not file:
                return jsonify({"success": False, "error": "No file uploaded"}), 400
            try:
                name = file.filename or "This file"
                output = service.process(
                    BytesIO(file.read()),
                    numbers=request.form.get("numbers") == "1",
                    number_format=request.form.get("number_format", "page_of"),
                    position=request.form.get("position", "bottom-center"),
                    start=_number("start", 1, int),
                    font_size=_number("font_size", 10),
                    pages=request.form.get("pages", "all").strip() or "all",
                    watermark=request.form.get("watermark") if request.form.get("use_watermark") == "1" else None,
                    watermark_opacity=_number("watermark_opacity", 15) / 100,
                    filename=name,
                )
                stem = re.sub(r"\.pdf$", "", name, flags=re.I)
                stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-.") or "document"
                return send_file(output, mimetype="application/pdf", as_attachment=True,
                                 download_name=f"{stem[:80]}-stamped.pdf")
            except Exception as exc:
                return jsonify({"success": False, "error": user_error(exc)}), 400


stamp_bp = StampController().blueprint
