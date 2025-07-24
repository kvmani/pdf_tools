"""HTTP endpoints for extracting pages from PDFs."""

from io import BytesIO

from flask import render_template, request, jsonify

from .base import BaseController
from ..services.extract_service import ExtractService


class ExtractController(BaseController):
    """Controller providing routes for page extraction."""

    def __init__(self) -> None:
        """Create the controller and underlying :class:`ExtractService`."""

        super().__init__("extract", __name__)
        self.service = ExtractService()

    def register(self) -> None:
        """Register ``/extract`` routes on the controller blueprint."""

        bp = self.blueprint

        @bp.route('/extract', methods=['GET'])
        def form():
            """Render the extraction form page."""

            return render_template("extract.html")

        @bp.route('/extract', methods=['POST'])
        def extract():
            """Handle extraction requests and return pages as hex string."""

            file = request.files.get("file")
            range_str = request.form.get("range", "all")
            as_images = bool(request.form.get("as_images"))
            preview = bool(request.form.get("preview"))
            if not file:
                return (
                    jsonify({"success": False, "error": "No file uploaded"}),
                    400,
                )
            try:
                output = self.service.process(
                    BytesIO(file.read()), range_str, as_images=as_images, preview=preview
                )
                if as_images:
                    data = [img.getvalue().hex() for img in output]
                    resp = {"success": True, "images": data}
                else:
                    data = output.getvalue()
                    resp = {"success": True, "data": data.hex()}
                if preview:
                    resp["preview"] = [img.getvalue().hex() for img in self.service.preview_images]
                return jsonify(resp)
            except Exception as exc:
                return jsonify({"success": False, "error": str(exc)}), 400

extract_bp = ExtractController().blueprint
