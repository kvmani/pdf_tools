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
            """Handle merge requests and return merged PDF as downloadable file."""

            files: List[Tuple[BytesIO, str]] = []
            idx = 0
            try:
                while True:
                    file = request.files.get(f"file{idx}")
                    if not file:
                        break
                    range_str = request.form.get(f"range_file{idx}", "all")
                    files.append((BytesIO(file.read()), range_str))
                    idx += 1

                order_param = request.form.get("order")
                order = [int(x) for x in order_param.split(",")] if order_param else None
                output_name = request.form.get("output_name", "merged.pdf")
                output = self.service.process(files, order=order, output_name=output_name)

                from flask import send_file
                output.seek(0)
                return send_file(
                    output,
                    mimetype="application/pdf",
                    as_attachment=True,
                    download_name=self.service.output_name
                )

            except Exception as exc:
                return jsonify({"success": False, "error": str(exc)}), 400
merge_bp = MergeController().blueprint
