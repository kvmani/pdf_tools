import io
from contextlib import closing
import json

import pytest
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from reportlab.pdfgen import canvas

from pdf_tools_service.app.services.editor_service import export_document, inspect_document


def document():
    out = io.BytesIO()
    cv = canvas.Canvas(out, pagesize=(400, 300))
    cv.setFont('Helvetica', 16)
    cv.drawString(40, 240, 'Original text')
    cv.showPage()
    cv.drawString(40, 240, 'Second page')
    cv.save()
    return out.getvalue()


def spec(**kwargs):
    return dict(source=0, page=0, rotation=0, marks=[], **kwargs)


def export(pages, assets=None, data=None):
    return export_document([data or document()], assets or {}, {'version': 1, 'pages': pages})


def test_editor_inspection_and_real_replacement():
    data = document()
    info = inspect_document(data)
    item = info['pages'][0]['editable'][0]
    assert item['text'] == 'Original text'
    page = spec()
    page['textEdits'] = [dict(index=item['index'], original=item['text'], text='New text')]
    result = PdfReader(export([page, spec()], data=data))
    assert 'New text' in result.pages[0].extract_text()
    assert 'Original text' not in result.pages[0].extract_text()
    assert 'Original text' in result.pages[1].extract_text()


@pytest.mark.parametrize('replacement', ['A replacement much longer than the original', 'हिन्दी', 'two\nlines'])
def test_text_replacement_rejects_unsupported_or_overflowing_text(replacement):
    item = inspect_document(document())['pages'][0]['editable'][0]
    page = spec()
    page['textEdits'] = [dict(index=item['index'], original=item['text'], text=replacement)]
    with pytest.raises(ValueError):
        export([page])


def test_stale_text_reference_is_rejected():
    page = spec()
    page['textEdits'] = [dict(index=0, original='wrong', text='new')]
    with pytest.raises(ValueError, match='cannot be safely edited'):
        export([page])


def test_page_order_duplicate_blank_and_rotation():
    second = spec(); second['page'] = 1; second['rotation'] = 90
    result = PdfReader(export([second, {'source': None, 'width': 595, 'height': 842}, spec(), spec()]))
    assert len(result.pages) == 4
    assert 'Second page' in result.pages[0].extract_text()
    assert result.pages[0].rotation == 90
    assert result.pages[1].mediabox.width == 595
    assert 'Original text' in result.pages[3].extract_text()


def test_annotations_signature_and_text_are_saved():
    img = io.BytesIO(); Image.new('RGBA', (40, 20), (0, 0, 0, 128)).save(img, 'PNG')
    page = spec()
    page['marks'] = [
        dict(type='highlight', x=35, y=45, w=110, h=20, color='#ffee00'),
        dict(type='comment', x=300, y=30, w=24, h=24, text='Please review'),
        dict(type='signature', x=40, y=200, w=80, h=40, asset='asset-1'),
        dict(type='text', x=40, y=100, w=200, h=30, size=16, text='Added text'),
        dict(type='ink', x=10, y=10, w=50, h=50, points=[[10, 10], [60, 60]]),
    ]
    page = PdfReader(export([page], {'asset-1': img.getvalue()})).pages[0]
    assert 'Added text' in page.extract_text()
    assert len(page.images) == 1
    annots = [ref.get_object() for ref in page['/Annots']]
    assert {a['/Subtype'] for a in annots} == {'/Highlight', '/Text'}
    assert annots[1]['/Contents'] == 'Please review'


@pytest.mark.parametrize('rotation', [0, 90, 180, 270])
def test_cropped_rotated_page_overlay_matches_visible_coordinates(rotation):
    # Render final output to independently verify the coordinate transform.
    import pypdfium2 as pdfium
    writer = PdfWriter(); page = writer.add_blank_page(400, 300)
    page.cropbox = RectangleObject((50, 40, 350, 240)); page.rotate(rotation)
    data = io.BytesIO(); writer.write(data)
    item = spec(); item['marks'] = [dict(type='rectangle', x=10, y=15, w=30, h=20, color='#ff0000', stroke=4)]
    result = export([item], data=data.getvalue()).getvalue()
    with pdfium.PdfDocument(result) as doc:
        with closing(doc[0]) as p:
            bitmap = p.render(scale=1)
            im = bitmap.to_pil()
            pixel = im.getpixel((10, 25))
            assert pixel[0] > 200 and pixel[1] < 80 and pixel[2] < 80
            bitmap.close()


@pytest.mark.parametrize('mark', [
    dict(type='image', x=1, y=1, asset='asset-missing'),
    dict(type='text', x=float('nan'), y=1, text='bad'),
    dict(type='text', x=390, y=1, w=100, text='outside'),
    dict(type='text', x=1, y=1, w=10, h=10, text='too long', size=16),
    dict(type='unknown', x=1, y=1),
])
def test_rejects_invalid_marks(mark):
    page = spec(); page['marks'] = [mark]
    with pytest.raises(ValueError):
        export([page])


def test_editor_http_export_and_invalid_inputs(client):
    response = client.post('/pdf_tools/editor/inspect', data={'file': (io.BytesIO(document()), 'test.pdf')})
    assert response.status_code == 200
    assert response.json['page_count'] == 2
    assert response.headers['Cache-Control'] == 'no-store'
    response = client.post('/pdf_tools/editor/export', data={
        'sources': (io.BytesIO(document()), 'test.pdf'),
        'manifest': json.dumps({'version': 1, 'pages': [spec()]}),
    })
    assert response.status_code == 200
    assert len(PdfReader(io.BytesIO(response.data)).pages) == 1
    assert client.post('/pdf_tools/editor/export', data={'manifest': '{}'}).status_code == 400
    assert client.post('/pdf_tools/editor/inspect').status_code == 400
    assert client.post('/pdf_tools/editor/inspect', data={'file': (io.BytesIO(b'bad'), 'bad.pdf')}).status_code == 400


def test_blank_document_without_source_pdf():
    output = export_document([], {}, {'version': 1, 'pages': [
        {'source': None, 'marks': [dict(type='text', text='A new document', x=30, y=30, w=200, h=30)]}
    ]})
    assert 'A new document' in PdfReader(output).pages[0].extract_text()


def test_page_rotation_also_rotates_added_content():
    import pypdfium2 as pdfium
    page = spec(); page['rotation'] = 90
    page['marks'] = [dict(type='rectangle', x=10, y=15, w=30, h=20, color='#ff0000', stroke=4)]
    with pdfium.PdfDocument(export([page]).getvalue()) as doc:
        with closing(doc[0]) as p:
            bitmap = p.render(scale=1)
            image = bitmap.to_pil()
            assert image.size == (300, 400)
            red = image.getpixel((300-25, 10))
            assert red[0] > 200 and red[1] < 80
            bitmap.close()


def test_existing_annotations_survive_editing_and_duplication():
    page = spec(); page['marks'] = [dict(type='comment', x=20, y=20, w=24, h=24, text='Original note')]
    data = export([page]).getvalue()
    result = PdfReader(export([spec(), spec()], data=data))
    assert all(p['/Annots'][0].get_object()['/Contents'] == 'Original note' for p in result.pages)


def test_corrupt_signature_image_and_missing_sources_are_rejected():
    page = spec(); page['marks'] = [dict(type='signature', x=10, y=10, w=50, h=25, asset='asset-1')]
    with pytest.raises(ValueError, match='image could not be read'):
        export([page], {'asset-1': b'not a real image'})
    with pytest.raises(ValueError):
        export_document([], {}, {'version': 1, 'pages': [spec()]})


def test_form_documents_are_rejected_explicitly():
    from pypdf.generic import ArrayObject, DictionaryObject, NameObject
    writer = PdfWriter(); writer.add_blank_page(400, 300)
    writer._root_object[NameObject('/AcroForm')] = DictionaryObject({NameObject('/Fields'): ArrayObject()})
    stream = io.BytesIO(); writer.write(stream)
    with pytest.raises(ValueError, match='forms are not supported'):
        inspect_document(stream.getvalue())


def test_workspace_has_offline_assets_and_controls(client):
    response = client.get('/pdf_tools/editor')
    assert response.status_code == 200
    assert b'data-tool="highlight"' in response.data
    assert b'id="signature"' in response.data
    assert b'cdn.' not in response.data
    assert client.get('/pdf_tools/static/vendor/lucide/icons.svg').status_code == 200
    worker = client.get('/pdf_tools/static/vendor/pdfjs/build/pdf.worker.mjs')
    assert worker.status_code == 200
    assert 'javascript' in worker.mimetype
