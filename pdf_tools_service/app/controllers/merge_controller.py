"""HTTP endpoints for merging PDF files."""

from io import BytesIO
from typing import List, Tuple

from flask import render_template, request, jsonify

from .base import BaseController
from ..services.merge_service import MergeService


class MergeController(BaseController):
    """Controller providing routes for PDF merging."""

    def __init__(self) -> None:
        """Create the controller and underlying :class:`MergeService`."""

        super().__init__("merge", __name__)
        self.service = MergeService()

    def register(self) -> None:
        """Register ``/merge`` routes on the controller blueprint."""

        bp = self.blueprint

        @bp.route('/merge', methods=['GET'])
        def form():
            """Render the merge form page."""

            return render_template("merge.html")

        @bp.route('/merge', methods=['POST'])
        def merge():
            """Handle merge requests and return merged PDF as hex string."""

            files: List[Tuple[BytesIO, str]] = []
            try:
                for file_key in request.files:
                    file = request.files[file_key]
                    range_key = f"range_{file_key}"
                    range_str = request.form.get(range_key, "all")
                    if not file:
                        continue
                    files.append((BytesIO(file.read()), range_str))
                output = self.service.process(files)
                data = output.getvalue()
                return jsonify({"success": True, "data": data.hex()})
            except Exception as exc:
                return jsonify({"success": False, "error": str(exc)}), 400

merge_bp = MergeController().blueprint
