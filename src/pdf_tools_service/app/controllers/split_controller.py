"""HTTP endpoints for splitting a PDF into several files."""

from io import BytesIO
import re
import zipfile

from flask import jsonify, render_template, request, send_file

from .base import BaseController
from ..services.split_service import SplitService
from ..utils.errors import user_error


def _stem(filename: str) -> str:
    stem = re.sub(r"\.pdf$", "", filename or "document", flags=re.I)
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-.") or "document"
    return stem[:80]


def _label(pages):
    return f"page-{pages[0]}" if len(pages) == 1 else f"pages-{pages[0]}-{pages[-1]}"


class SplitController(BaseController):
    """Controller providing routes for PDF splitting."""

    def __init__(self) -> None:
        super().__init__("split", __name__)

    def register(self) -> None:
        bp = self.blueprint
        service = SplitService()

        @bp.route('/split', methods=['GET'])
        def form():
            return render_template("pdf_split.html")

        @bp.route('/split', methods=['POST'])
        def split():
            file = request.files.get("file")
            if not file:
                return jsonify({"success": False, "error": "No file uploaded"}), 400
            try:
                name = file.filename or "This file"
                parts = service.process(BytesIO(file.read()), request.form.get("mode", "every"),
                                        request.form.get("value", ""), filename=name)
                stem = _stem(name)
                archive = BytesIO()
                with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
                    width = len(str(len(parts)))
                    for index, (pages, stream) in enumerate(parts, 1):
                        bundle.writestr(f"{stem}-part-{index:0{width}d}-{_label(pages)}.pdf", stream.getvalue())
                archive.seek(0)
                return send_file(archive, mimetype="application/zip", as_attachment=True,
                                 download_name=f"{stem}-split.zip")
            except Exception as exc:
                return jsonify({"success": False, "error": user_error(exc)}), 400


split_bp = SplitController().blueprint
