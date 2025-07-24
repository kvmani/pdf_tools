from io import BytesIO

from flask import render_template, request, jsonify

from .base import BaseController
from ..services.extract_service import ExtractService


class ExtractController(BaseController):
    def __init__(self):
        super().__init__('extract', __name__)
        self.service = ExtractService()

    def register(self):
        bp = self.blueprint

        @bp.route('/extract', methods=['GET'])
        def form():
            return render_template('extract.html')

        @bp.route('/extract', methods=['POST'])
        def extract():
            file = request.files.get('file')
            range_str = request.form.get('range', 'all')
            if not file:
                return jsonify({"success": False, "error": "No file uploaded"}), 400
            try:
                output = self.service.process(BytesIO(file.read()), range_str)
                data = output.getvalue()
                return jsonify({"success": True, "data": data.hex()})
            except Exception as exc:
                return jsonify({"success": False, "error": str(exc)}), 400

extract_bp = ExtractController().blueprint
