"""HTTP endpoints for extracting pages from PDFs."""

from io import BytesIO

from flask import render_template, request, jsonify, send_file

from .base import BaseController
from ..services.extract_service import ExtractService
from ..utils.errors import user_error


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

            return render_template("pdf_extract.html")

        @bp.route('/extract', methods=['POST'])
        def extract():
            """Handle extraction requests and return pages as hex string."""

            file = request.files.get("file")
            range_str = request.form.get("range", "all")
            as_images = request.form.get("as_images") == "1"
            preview = request.form.get("preview") == "1"
            if not file:
                return (
                    jsonify({"success": False, "error": "No file uploaded"}),
                    400,
                )
            try:
                output = self.service.process(
                    BytesIO(file.read()), range_str, as_images=as_images, preview=preview,
                    filename=file.filename or "This file"
                )
                if as_images:
                    data = [img.getvalue().hex() for img in output]
                    resp = {"success": True, "images": data}
                else:
                    if not preview:
                        return send_file(
                            output,
                            mimetype="application/pdf",
                            as_attachment=True,
                            download_name="extracted_pages.pdf",
                        )
                    data = output.getvalue()
                    resp = {"success": True, "data": data.hex()}
                if preview:
                    resp["preview"] = [img.getvalue().hex() for img in self.service.preview_images]
                return jsonify(resp)
            except Exception as exc:
                return jsonify({"success": False, "error": user_error(exc)}), 400

extract_bp = ExtractController().blueprint
