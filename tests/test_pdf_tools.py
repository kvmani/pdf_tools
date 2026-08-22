from io import BytesIO

from PyPDF2 import PdfReader, PdfWriter

from pdf_tools_service.app import create_app


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


def test_metadata_reports_size_pages_dimensions_and_document_info():
    response = pdf_client().post('/pdf_tools/metadata', data={'file': (make_pdf(3, 'Research Pack', 'Dr K V Mani Krishna'), 'pack.pdf')}, content_type='multipart/form-data')
    payload = response.get_json()
    assert response.status_code == 200
    assert payload['success'] is True
    assert payload['filename'] == 'pack.pdf'
    assert payload['page_count'] == 3
    assert payload['size_bytes'] > 0
    assert payload['title'] == 'Research Pack'
    assert payload['author'] == 'Dr K V Mani Krishna'
    assert payload['first_page_size'] == {'width': 72.0, 'height': 144.0}


def test_metadata_rejects_missing_and_invalid_files():
    assert pdf_client().post('/pdf_tools/metadata').status_code == 400
    bad = pdf_client().post('/pdf_tools/metadata', data={'file': (BytesIO(b'not pdf'), 'bad.pdf')}, content_type='multipart/form-data')
    assert bad.status_code == 400


def test_merge_preserves_uploaded_order_and_ranges():
    response = pdf_client().post('/pdf_tools/merge', data={
        'file0': (make_pdf(2), 'first.pdf'), 'range_file0': '2',
        'file1': (make_pdf(3), 'second.pdf'), 'range_file1': '1-2',
        'order': '1,0', 'output_name': 'pack.pdf',
    }, content_type='multipart/form-data')
    assert response.status_code == 200
    assert 'pack.pdf' in response.headers['Content-Disposition']
    assert len(PdfReader(BytesIO(response.data)).pages) == 3


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
