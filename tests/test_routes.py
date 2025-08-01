import io
from flask import url_for


def test_health_endpoint(client):
    resp = client.get('/pdf_tools/health')
    assert resp.status_code == 200
    assert resp.get_json() == {"status": "ok"}


def test_metrics_endpoint(client):
    resp = client.get('/pdf_tools/metrics')
    assert resp.status_code == 200
    assert b'pdf_tools_request_total' in resp.data


def test_merge_route(client, sample_pdf):
    data = {
        'file0': (io.BytesIO(sample_pdf), 'a.pdf'),
        'range_file0': 'all',
    }
    resp = client.post('/pdf_tools/merge', data=data, content_type='multipart/form-data')
    assert resp.status_code == 200
    assert resp.get_json()['success'] is True


def test_extract_route(client, sample_pdf):
    data = {
        'file': (io.BytesIO(sample_pdf), 'a.pdf'),
        'range': '1',
    }
    resp = client.post('/pdf_tools/extract', data=data, content_type='multipart/form-data')
    assert resp.status_code == 200
    assert resp.get_json()['success'] is True
