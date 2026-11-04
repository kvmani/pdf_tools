import io
import zipfile

import pypdfium2
import pytest
from pypdf import PdfReader, PdfWriter

from conftest import create_pdf
from pdf_tools_service.app.services.split_service import SplitService
from pdf_tools_service.app.services.stamp_service import StampService


def letter_pdf(pages=3, rotation=0):
    writer = PdfWriter()
    for _ in range(pages):
        page = writer.add_blank_page(width=612, height=792)
        if rotation:
            page.rotate(rotation)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


@pytest.mark.parametrize("mode,value,expected", [
    ("every", "2", [[1, 2], [3, 4], [5]]),
    ("each", "", [[1], [2], [3], [4], [5]]),
    ("ranges", "1-2; 4 ; 3,5", [[1, 2], [4], [3, 5]]),
])
def test_split_plans(mode, value, expected):
    parts = SplitService().process(io.BytesIO(create_pdf(5)), mode, value)
    assert [pages for pages, _ in parts] == expected
    assert [len(PdfReader(stream).pages) for _, stream in parts] == [len(g) for g in expected]


@pytest.mark.parametrize("mode,value,message", [
    ("every", "0", "at least one page"),
    ("every", "two", "how many pages"),
    ("ranges", "1-2; 9", "Group “9”"),
    ("ranges", " ; ", "at least one group"),
    ("sideways", "", "how to split"),
])
def test_split_rejects_bad_requests(mode, value, message):
    with pytest.raises(ValueError, match=message):
        SplitService().process(io.BytesIO(create_pdf(5)), mode, value)


def test_split_route_returns_named_zip(client):
    response = client.post('/pdf_tools/split', data={
        'file': (io.BytesIO(create_pdf(5)), 'Quarterly report.pdf'), 'mode': 'every', 'value': '2',
    }, content_type='multipart/form-data')
    assert response.status_code == 200
    assert response.mimetype == 'application/zip'
    assert 'Quarterly-report-split.zip' in response.headers['Content-Disposition']
    bundle = zipfile.ZipFile(io.BytesIO(response.data))
    assert bundle.namelist() == [
        'Quarterly-report-part-1-pages-1-2.pdf',
        'Quarterly-report-part-2-pages-3-4.pdf',
        'Quarterly-report-part-3-page-5.pdf',
    ]
    assert len(PdfReader(io.BytesIO(bundle.read(bundle.namelist()[2]))).pages) == 1


def test_split_route_reports_errors(client):
    bad = client.post('/pdf_tools/split', data={
        'file': (io.BytesIO(create_pdf(2)), 'a.pdf'), 'mode': 'ranges', 'value': '5'},
        content_type='multipart/form-data')
    assert bad.status_code == 400 and 'between 1 and 2' in bad.get_json()['error']


def text_of(data):
    return [page.extract_text() for page in PdfReader(io.BytesIO(data)).pages]


def test_stamp_numbers_selected_pages():
    out = StampService().process(io.BytesIO(letter_pdf(3)), number_format='page_of', pages='2-3', start=1)
    texts = text_of(out.getvalue())
    assert 'Page' not in texts[0]
    assert 'Page 1 of 2' in texts[1] and 'Page 2 of 2' in texts[2]


def test_stamp_watermark_and_formats():
    out = StampService().process(io.BytesIO(letter_pdf(2)), number_format='n_of', start=5,
                                 watermark='DRAFT', watermark_opacity=0.2)
    texts = text_of(out.getvalue())
    assert '5 / 6' in texts[0] and '6 / 6' in texts[1]
    assert all('DRAFT' in t for t in texts)


@pytest.mark.parametrize("kwargs,message", [
    ({"numbers": False}, "page numbers, a watermark"),
    ({"watermark": "機密"}, "Western European"),
    ({"number_format": "roman"}, "format"),
    ({"position": "middle"}, "position"),
    ({"font_size": 200}, "Font size"),
    ({"pages": "4"}, "out of range"),
])
def test_stamp_rejects_bad_options(kwargs, message):
    with pytest.raises(ValueError, match=message):
        StampService().process(io.BytesIO(letter_pdf(3)), **kwargs)


def ink_rows(data, page_index=0):
    """Return (top_band_ink, bottom_band_ink) of the rendered, visibly oriented page."""
    pdf = pypdfium2.PdfDocument(data)
    try:
        image = pdf[page_index].render(scale=1).to_pil().convert('L')
    finally:
        pdf.close()
    width, height = image.size
    def ink(box):
        return sum(image.crop(box).histogram()[:128])
    return ink((0, 0, width, 60)), ink((0, height - 60, width, height)), image.size


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_stamp_numbers_follow_visible_orientation(rotation):
    out = StampService().process(io.BytesIO(letter_pdf(1, rotation)), number_format='page', font_size=18,
                                 position='bottom-center')
    top, bottom, size = ink_rows(out.getvalue())
    assert bottom > 20 and top == 0
    assert size == ((792, 612) if rotation in (90, 270) else (612, 792))


def test_stamp_route(client):
    response = client.post('/pdf_tools/stamp', data={
        'file': (io.BytesIO(letter_pdf(2)), 'memo.pdf'), 'numbers': '1', 'number_format': 'page',
        'position': 'top-right', 'start': '3', 'font_size': '11', 'use_watermark': '1',
        'watermark': 'CONFIDENTIAL', 'watermark_opacity': '20'}, content_type='multipart/form-data')
    assert response.status_code == 200 and 'memo-stamped.pdf' in response.headers['Content-Disposition']
    texts = text_of(response.data)
    assert 'Page 3' in texts[0] and 'Page 4' in texts[1] and 'CONFIDENTIAL' in texts[0]
    bad = client.post('/pdf_tools/stamp', data={'file': (io.BytesIO(letter_pdf(1)), 'm.pdf'),
                      'numbers': '1', 'start': 'x'}, content_type='multipart/form-data')
    assert bad.status_code == 400 and 'number' in bad.get_json()['error']


def test_new_tool_pages_render(client):
    for path, text in [('/pdf_tools/split', b'Split a PDF'), ('/pdf_tools/stamp', b'Page numbers')]:
        response = client.get(path)
        assert response.status_code == 200 and text in response.data
    home = client.get('/pdf_tools/').data
    assert b'/pdf_tools/split' in home and b'/pdf_tools/stamp' in home
