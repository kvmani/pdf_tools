import io
from pypdf import PdfReader


def test_health_endpoint(client):
    resp = client.get('/pdf_tools/health')
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok", "tool_id": "pdf-tools", "version": "0.2.0"}


def test_scientific_help_and_security_headers(client):
    response = client.get('/pdf_tools/help')
    assert response.status_code == 200
    assert b'pdf-workflow.svg' in response.data
    assert response.headers['X-Content-Type-Options'] == 'nosniff'


def test_metrics_endpoint(client):
    resp = client.get('/pdf_tools/metrics')
    assert resp.status_code == 200
    assert b'pdf_tools_request_total' in resp.data


def test_workspace_pages_and_metadata_missing_file(client):
    assert b'Merge PDFs' in client.get('/pdf_tools/').data
    merge_page = client.get('/pdf_tools/merge')
    assert merge_page.status_code == 200
    assert b'file size and page count' in merge_page.data
    assert b'Drag a card by its handle' in merge_page.data
    extract_page = client.get('/pdf_tools/extract')
    assert extract_page.status_code == 200
    assert b'Extract pages' in extract_page.data
    response = client.post('/pdf_tools/metadata')
    assert response.status_code == 400
    assert response.get_json()['error'] == 'No file uploaded'


def test_merge_route(client, sample_pdf):
    data = {
        'file0': (io.BytesIO(sample_pdf), 'a.pdf'),
        'range_file0': 'all',
    }
    resp = client.post('/pdf_tools/merge', data=data, content_type='multipart/form-data')
    assert resp.status_code == 200
    assert resp.mimetype == 'application/pdf'
    assert len(PdfReader(io.BytesIO(resp.data)).pages) == 3


def test_extract_route(client, sample_pdf):
    data = {
        'file': (io.BytesIO(sample_pdf), 'a.pdf'),
        'range': '1',
    }
    resp = client.post('/pdf_tools/extract', data=data, content_type='multipart/form-data')
    assert resp.status_code == 200
    assert resp.mimetype == 'application/pdf'
    assert len(PdfReader(io.BytesIO(resp.data)).pages) == 1


def test_routes_return_structured_errors(client):
    assert client.post('/pdf_tools/merge', data={}, content_type='multipart/form-data').status_code == 400
    assert client.post('/pdf_tools/extract', data={}, content_type='multipart/form-data').status_code == 400
    bad_merge = client.post('/pdf_tools/merge', data={'file0': (io.BytesIO(b'bad'), 'bad.pdf')}, content_type='multipart/form-data')
    assert bad_merge.status_code == 400
    bad_extract = client.post('/pdf_tools/extract', data={'file': (io.BytesIO(b'bad'), 'bad.pdf'), 'range': '1'}, content_type='multipart/form-data')
    assert bad_extract.status_code == 400
