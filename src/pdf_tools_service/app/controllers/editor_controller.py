"""In-memory editor endpoints; no files, signatures or projects are persisted."""
import json

from flask import Blueprint, jsonify, render_template, request, send_file
from ..services.editor_service import export_document, inspect_document
from ..utils.errors import user_error

editor_bp = Blueprint('editor', __name__, url_prefix='/editor')


@editor_bp.get('')
@editor_bp.get('/')
def workspace():
    return render_template('pdf_editor.html')


@editor_bp.post('/inspect')
def inspect():
    uploaded = request.files.get('file')
    if not uploaded:
        return jsonify(error='Choose a PDF to open.'), 400
    try:
        return jsonify(inspect_document(uploaded.read()))
    except Exception as exc:
        return jsonify(error=user_error(exc)), 400


@editor_bp.post('/export')
def export():
    try:
        encoded = request.form.get('manifest', '')
        if len(encoded) > 2_000_000:
            raise ValueError('This project is too large.')
        try:
            manifest = json.loads(encoded)
        except (ValueError, TypeError) as exc:
            raise ValueError('The editor project is not valid JSON.') from exc
        sources = request.files.getlist('sources')
        assets = {name: file.read() for name, file in request.files.items() if name.startswith('asset-')}
        result = export_document([file.read() for file in sources], assets, manifest)
        return send_file(result, mimetype='application/pdf', as_attachment=True, download_name='edited.pdf')
    except Exception as exc:
        return jsonify(error=user_error(exc)), 400
