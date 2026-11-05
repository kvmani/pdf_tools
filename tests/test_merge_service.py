from io import BytesIO

from pdf_tools_service.app.services.merge_service import MergeService
import pytest

from conftest import create_pdf_custom_height


def test_merge_two_pdfs(sample_pdf):
    service = MergeService()
    files = [(BytesIO(sample_pdf), 'all'), (BytesIO(sample_pdf), '1')]
    output = service.process(files)
    assert isinstance(output, BytesIO)
    assert len(output.getvalue()) > 0


def test_merge_invalid_range(sample_pdf):
    service = MergeService()
    files = [(BytesIO(sample_pdf), '10')]
    with pytest.raises(ValueError):
        service.process(files)


def test_merge_reorder_and_filename():
    service = MergeService()
    pdf_a = BytesIO(create_pdf_custom_height(72))
    pdf_b = BytesIO(create_pdf_custom_height(100))
    files = [(pdf_a, 'all'), (pdf_b, 'all')]
    output = service.process(files, order=[1, 0], output_name="result.pdf")
    from pypdf import PdfReader
    reader = PdfReader(output)
    first_page = reader.pages[0]
    assert float(first_page.mediabox.height) == 100
    assert len(reader.pages) == 2
    assert service.output_name == "result.pdf"


def test_merge_rotates_each_document(sample_pdf):
    from pypdf import PdfReader
    service = MergeService()
    output = service.process([(BytesIO(sample_pdf), '1-2'), (BytesIO(sample_pdf), '1')], rotations=[90, 0])
    assert [page.rotation for page in PdfReader(output).pages] == [90, 90, 0]
    reordered = service.process([(BytesIO(sample_pdf), '1'), (BytesIO(sample_pdf), '1')], order=[1, 0], rotations=[180, 0])
    assert [page.rotation for page in PdfReader(reordered).pages] == [0, 180]
    with pytest.raises(ValueError, match="Rotation"):
        service.process([(BytesIO(sample_pdf), '1')], rotations=[45])


def test_merge_route_accepts_rotation(client, sample_pdf):
    from pypdf import PdfReader
    response = client.post('/pdf_tools/merge', data={
        'file0': (BytesIO(sample_pdf), 'a.pdf'), 'range_file0': '1', 'rotate_file0': '270',
        'file1': (BytesIO(sample_pdf), 'b.pdf'), 'range_file1': '1'}, content_type='multipart/form-data')
    assert response.status_code == 200
    assert [page.rotation for page in PdfReader(BytesIO(response.data)).pages] == [270, 0]
    bad = client.post('/pdf_tools/merge', data={'file0': (BytesIO(sample_pdf), 'a.pdf'), 'rotate_file0': 'x'},
                      content_type='multipart/form-data')
    assert bad.status_code == 400 and 'Rotation' in bad.get_json()['error']
