from io import BytesIO

from flask import g, make_response
from PyPDF2 import PdfReader, PdfWriter

from pdf_tools_service.app import _load_config, create_app
from pdf_tools_service.app.controllers.base import BaseController
from pdf_tools_service.app.services.base import PDFService


def make_pdf(pages=2, title=None, author=None):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=72, height=144)
    if title:
        writer.add_metadata({"/Title": title, "/Author": author or ""})
    output = BytesIO()
    writer.write(output)
    output.seek(0)
    return output


def pdf_client():
    return create_app().test_client()


def test_application_root_config_overrides_and_abstract_contracts(monkeypatch, tmp_path):
    assert b'PDF Tools Service is running' in pdf_client().get('/').data
    config_file = tmp_path / 'config.json'
    config_file.write_text('{"limit": 1}', encoding='utf-8')
    monkeypatch.setenv('PDFTOOLS_LIMIT', '2')
    monkeypatch.setenv('PDFTOOLS_FLAG', 'true')
    monkeypatch.setenv('PDFTOOLS_NESTED__VALUE', 'plain-text')
    assert _load_config(str(config_file)) == {'limit': 2, 'flag': True, 'nested': {'value': 'plain-text'}}
    with __import__('pytest').raises(NotImplementedError):
        BaseController('coverage-only', __name__)
    with __import__('pytest').raises(NotImplementedError):
        PDFService.process(object())
    app = create_app()
    with app.test_request_context('/'):
        assert BaseController.__new__(BaseController)._max_content_length() == 10 * 1024 * 1024
        g.__dict__.clear()
        assert app.after_request_funcs[None][0](make_response('ok')).status_code == 200


def test_metadata_reports_only_size_and_page_count():
    response = pdf_client().post('/pdf_tools/metadata', data={'file': (make_pdf(3, 'Research Pack', 'Dr K V Mani Krishna'), 'pack.pdf')}, content_type='multipart/form-data')
    payload = response.get_json()
    assert response.status_code == 200
    assert payload['success'] is True
    assert payload['filename'] == 'pack.pdf'
    assert payload['page_count'] == 3
    assert payload['size_bytes'] > 0
    assert set(payload) == {'success', 'filename', 'size_bytes', 'page_count'}


def test_metadata_rejects_missing_and_invalid_files():
    assert pdf_client().post('/pdf_tools/metadata').status_code == 400
    bad = pdf_client().post('/pdf_tools/metadata', data={'file': (BytesIO(b'not pdf'), 'bad.pdf')}, content_type='multipart/form-data')
    assert bad.status_code == 400
    java_serialized = pdf_client().post('/pdf_tools/metadata', data={'file': (BytesIO(b'\xac\xed\x00\x05ur\x00\x13'), 'misnamed.pdf')}, content_type='multipart/form-data')
    assert java_serialized.status_code == 400
    assert java_serialized.get_json()['error'] == (
        'misnamed.pdf is not a readable PDF. It may be mislabeled, incomplete, '
        'or exported in another format. Choose a valid PDF file.'
    )
    malformed_pdf = pdf_client().post('/pdf_tools/metadata', data={'file': (BytesIO(b'%PDF-1.4\nnot valid'), 'malformed.pdf')}, content_type='multipart/form-data')
    assert malformed_pdf.status_code == 400
    assert malformed_pdf.get_json()['error'].startswith('malformed.pdf is not a readable PDF.')


def test_merge_preserves_uploaded_order_and_ranges():
    response = pdf_client().post('/pdf_tools/merge', data={
        'file0': (make_pdf(2), 'first.pdf'), 'range_file0': '2',
        'file1': (make_pdf(3), 'second.pdf'), 'range_file1': '1-2',
        'order': '1,0', 'output_name': 'pack.pdf',
    }, content_type='multipart/form-data')
    assert response.status_code == 200
    assert 'pack.pdf' in response.headers['Content-Disposition']
    assert len(PdfReader(BytesIO(response.data)).pages) == 3


def test_merge_rejects_mislabeled_binary_with_actionable_error():
    response = pdf_client().post('/pdf_tools/merge', data={
        'file0': (BytesIO(b'\xac\xed\x00\x05ur\x00\x13'), 'ACK485547880280726.pdf'),
        'range_file0': 'all',
    }, content_type='multipart/form-data')
    assert response.status_code == 400
    assert response.get_json()['error'].startswith(
        'ACK485547880280726.pdf is not a readable PDF.'
    )


def test_extract_pdf_preview_and_image_modes_return_expected_contracts():
    pdf = make_pdf(2).getvalue()
    preview = pdf_client().post('/pdf_tools/extract', data={'file': (BytesIO(pdf), 'input.pdf'), 'range': '1', 'preview': '1'}, content_type='multipart/form-data')
    assert preview.status_code == 200
    assert preview.get_json()['success'] is True
    assert preview.get_json()['preview']
    images = pdf_client().post('/pdf_tools/extract', data={'file': (BytesIO(pdf), 'input.pdf'), 'range': '1', 'as_images': '1'}, content_type='multipart/form-data')
    assert images.status_code == 200
    assert images.get_json()['success'] is True
    assert images.get_json()['images']
