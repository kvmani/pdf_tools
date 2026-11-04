"""Stateless PDF editor. All geometry uses the visible page, in points, top-left.

Original bytes are immutable. Export replays a validated manifest. PDFium access
is serialized because its native API is not thread-safe, including across docs.
"""
from __future__ import annotations

import ctypes
from contextlib import closing
import math
import re
from io import BytesIO
from threading import RLock

import pypdfium2 as pdfium
import pypdfium2.raw as raw
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.annotations import Highlight, Text
from pypdf.generic import ArrayObject, FloatObject, RectangleObject
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from ..utils.errors import read_pdf

NATIVE_LOCK = RLock()
MAX_PAGES = 200
MAX_MARKS = 2000
MAX_IMAGE_PIXELS = 16_000_000
FONTS = {"Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique",
         "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic",
         "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"}


def number(value, low=-10000, high=10000):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError("Invalid or out-of-range editor coordinates.")
    return float(value)


def integer(value, low, high):
    if type(value) is not int or not low <= value <= high:
        raise ValueError("Invalid page, source or object reference.")
    return value


def text(value, limit=4000):
    if not isinstance(value, str) or len(value) > limit or any(ord(c) < 32 and c not in '\n\t' for c in value):
        raise ValueError("Text is too long or contains unsupported control characters.")
    return value


def color(value):
    if not isinstance(value, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise ValueError("Choose a valid RGB color.")
    return tuple(int(value[i:i+2], 16) / 255 for i in (1, 3, 5))


def load_source(data):
    reader = read_pdf(BytesIO(data))
    if len(reader.pages) > MAX_PAGES:
        raise ValueError(f"The editor supports up to {MAX_PAGES} pages per source.")
    if reader.trailer['/Root'].get('/AcroForm'):
        raise ValueError("Interactive or signed forms are not supported by this editor. Use an unsigned, flattened copy.")
    for page in reader.pages:
        if page.get('/UserUnit', 1) != 1:
            raise ValueError("Nonstandard PDF page units are not supported. Export a standard PDF copy first.")
        if max(float(page.cropbox.width), float(page.cropbox.height)) > 10000:
            raise ValueError("This page is too large for the editor.")
    return reader


def _wide(value):
    data = value.encode('utf-16-le') + b'\0\0'
    return (ctypes.c_ushort * (len(data) // 2)).from_buffer_copy(data)


def _eligible_objects(page):
    """Only direct, horizontal, unembedded standard-font single-line objects."""
    result = []
    with closing(page.get_textpage()) as tp:
        for index in range(raw.FPDFPage_CountObjects(page)):
            obj = raw.FPDFPage_GetObject(page, index)
            if raw.FPDFPageObj_GetType(obj) != raw.FPDF_PAGEOBJ_TEXT:
                continue
            matrix = raw.FS_MATRIX()
            if not raw.FPDFPageObj_GetMatrix(obj, ctypes.byref(matrix)):
                continue
            if abs(matrix.b) > .001 or abs(matrix.c) > .001 or matrix.a <= 0 or matrix.d <= 0:
                continue
            font = raw.FPDFTextObj_GetFont(obj)
            if not font or raw.FPDFFont_GetIsEmbedded(font) != 0:
                continue
            size = raw.FPDFTextObj_GetFontSize(obj, ctypes.byref(size_out := ctypes.c_float()))
            n = raw.FPDFFont_GetBaseFontName(font, None, 0)
            buf = ctypes.create_string_buffer(n)
            raw.FPDFFont_GetBaseFontName(font, buf, n)
            name = buf.value.decode('ascii', errors='replace')
            if name not in FONTS or not size or not 4 <= size_out.value <= 96:
                continue
            count = raw.FPDFTextObj_GetText(obj, tp, None, 0)
            if count < 4 or count > 1002:
                continue
            chars = (ctypes.c_ushort * ((count + 1)//2))()
            raw.FPDFTextObj_GetText(obj, tp, chars, count)
            value = bytes(chars).decode('utf-16-le').rstrip('\0')
            if not value or not all(32 <= ord(c) <= 126 for c in value):
                continue
            coords = [ctypes.c_float() for _ in range(4)]
            if not raw.FPDFPageObj_GetBounds(obj, *(ctypes.byref(c) for c in coords)):
                continue
            result.append({'index': index, 'text': value, 'font': name,
                           'size': size_out.value, 'bounds': [c.value for c in coords]})
    return result


def inspect_document(data):
    reader = load_source(data)
    with NATIVE_LOCK, pdfium.PdfDocument(data) as doc:
        pages = []
        for i, source in enumerate(reader.pages):
            with closing(doc[i]) as page:
                pages.append({'crop': list(map(float, source.cropbox)),
                              'rotation': source.rotation % 360,
                              'editable': _eligible_objects(page)})
    return {'pages': pages, 'page_count': len(pages)}


def _apply_text_edits(data, changes):
    if not changes:
        return data
    with NATIVE_LOCK, pdfium.PdfDocument(data) as doc:
        for page_index, edits in changes.items():
            with closing(doc[page_index]) as page:
                eligible = {o['index']: o for o in _eligible_objects(page)}
                for edit in edits:
                    idx = integer(edit.get('index'), 0, 100000)
                    old = eligible.get(idx)
                    if not old or edit.get('original') != old['text']:
                        raise ValueError("This text cannot be safely edited. Only simple standard-font text is supported.")
                    value = text(edit.get('text'), 500)
                    if not value or not all(32 <= ord(c) <= 126 for c in value):
                        raise ValueError("Existing-text replacement supports a single line of printable English/ASCII text.")
                    obj = raw.FPDFPage_GetObject(page, idx)
                    if not raw.FPDFText_SetText(obj, _wide(value)):
                        raise ValueError("The PDF engine could not replace this text.")
                    bounds = [ctypes.c_float() for _ in range(4)]
                    raw.FPDFPageObj_GetBounds(obj, *(ctypes.byref(c) for c in bounds))
                    # Conservative: replacement cannot expand beyond its original text box.
                    if bounds[2].value > old['bounds'][2] + 1 or bounds[3].value > old['bounds'][3] + 1:
                        raise ValueError("Replacement is wider than the original text. Choose shorter text or add a new text box.")
                if not raw.FPDFPage_GenerateContent(page):
                    raise ValueError("The PDF engine could not save this text edit.")
        output = BytesIO()
        doc.save(output)
        return output.getvalue()


def _geometry(page, extra_rotation):
    x0, y0, x1, y1 = map(float, page.cropbox)
    w, h = x1-x0, y1-y0
    r = (page.rotation + extra_rotation) % 360
    if w <= 0 or h <= 0 or r not in (0, 90, 180, 270):
        raise ValueError("Unsupported page geometry.")
    # Map top-left visible page coordinates to original PDF coordinates.
    matrix = {0: (1, 0, 0, -1, x0, y1), 90: (0, 1, 1, 0, x0, y0),
              180: (-1, 0, 0, 1, x1, y0), 270: (0, -1, -1, 0, x1, y1)}[r]
    return (h, w, matrix) if r in (90, 270) else (w, h, matrix)


def _point(matrix, x, y):
    a, b, c, d, e, f = matrix
    return (a*x+c*y+e, b*x+d*y+f)


def _image(data):
    try:
        with Image.open(BytesIO(data)) as im:
            if im.format not in ('PNG', 'JPEG') or im.width*im.height > MAX_IMAGE_PIXELS:
                raise ValueError("Use a PNG/JPEG image of at most 16 million pixels.")
            im.load()
            return ImageReader(im.convert('RGBA'))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("This image could not be read. Use PNG or JPEG.") from exc


def export_document(sources, assets, manifest):
    if not isinstance(manifest, dict) or manifest.get('version') != 1:
        raise ValueError("Unsupported editor project version.")
    specs = manifest.get('pages')
    if not isinstance(specs, list) or not 1 <= len(specs) <= MAX_PAGES:
        raise ValueError(f"Choose between 1 and {MAX_PAGES} pages to export.")
    if not 0 <= len(sources) <= 20 or len(assets) > 100:
        raise ValueError("Too many source PDFs or images.")
    readers = [load_source(data) for data in sources]
    writer = PdfWriter()
    total_marks = 0
    image_cache = {}
    for spec in specs:
        if not isinstance(spec, dict):
            raise ValueError("Invalid page specification.")
        # Reopen the immutable source for each output occurrence. Duplicates can
        # have independent text edits, annotations and resources.
        source_index = spec.get('source')
        if source_index is None:
            page = writer.add_blank_page(number(spec.get('width', 595), 72, 2000),
                                         number(spec.get('height', 842), 72, 2000))
        else:
            integer(source_index, 0, len(sources)-1)
            page_index = integer(spec.get('page'), 0, len(readers[source_index].pages)-1)
            edits = spec.get('textEdits', [])
            if not isinstance(edits, list) or len(edits) > 200 or any(not isinstance(e, dict) for e in edits):
                raise ValueError("Too many or invalid text replacements.")
            data = _apply_text_edits(sources[source_index], {page_index: edits} if edits else {})
            reader = PdfReader(BytesIO(data))
            page = writer.add_page(reader.pages[page_index])
        rotation = integer(spec.get('rotation', 0), 0, 270)
        if rotation % 90:
            raise ValueError("Page rotation must be a multiple of 90 degrees.")
        # Marks are anchored in the source's visible coordinates. Rotating a
        # working page rotates original content and all its added marks together.
        width, height, matrix = _geometry(page, 0)
        page.rotate(rotation)
        marks = spec.get('marks', [])
        if not isinstance(marks, list) or any(not isinstance(m, dict) for m in marks):
            raise ValueError("Invalid page annotations.")
        total_marks += len(marks)
        if total_marks > MAX_MARKS:
            raise ValueError("This project has too many annotations.")
        overlay = BytesIO()
        cv = canvas.Canvas(overlay, pagesize=(width, height), pageCompression=1)
        for mark in marks:
            kind = mark.get('type')
            x, y = number(mark.get('x')), number(mark.get('y'))
            w, h = number(mark.get('w', 24), .1, 10000), number(mark.get('h', 24), .1, 10000)
            if x < 0 or y < 0 or x+w > width+1 or y+h > height+1:
                raise ValueError("An annotation extends beyond the page. Move or resize it first.")
            rgb = color(mark.get('color', '#183b56'))
            cv.setFillColorRGB(*rgb)
            cv.setStrokeColorRGB(*rgb)
            cv.setLineWidth(number(mark.get('stroke', 2), .25, 24))
            if kind == 'text':
                value = text(mark.get('text'))
                try:
                    value.encode('cp1252')
                except UnicodeEncodeError as exc:
                    raise ValueError("New text currently supports Western European characters. Use a supported font/language.") from exc
                font = mark.get('font', 'Helvetica')
                if font not in FONTS:
                    raise ValueError("Unsupported text font.")
                size = number(mark.get('size', 16), 6, 96)
                lines = value.splitlines() or ['']
                if any(cv.stringWidth(line, font, size) > w+1 for line in lines) or len(lines)*size*1.2 > h+1:
                    raise ValueError("Text does not fit its box. Enlarge the box or reduce the font size.")
                cv.setFont(font, size)
                for i, line in enumerate(lines):
                    cv.drawString(x, height-y-size-i*size*1.2, line)
            elif kind in ('image', 'signature'):
                key = mark.get('asset')
                if not isinstance(key, str) or key not in assets:
                    raise ValueError("An image is missing from the project.")
                if key not in image_cache:
                    image_cache[key] = _image(assets[key])
                cv.drawImage(image_cache[key], x, height-y-h, w, h, mask='auto')
            elif kind in ('highlight', 'comment'):
                points = [_point(matrix, px, py) for px, py in ((x, y), (x+w, y), (x, y+h), (x+w, y+h))]
                rect = (min(p[0] for p in points), min(p[1] for p in points),
                        max(p[0] for p in points), max(p[1] for p in points))
                if kind == 'highlight':
                    annot = Highlight(rect=rect, quad_points=ArrayObject([FloatObject(v) for p in points for v in p]),
                                      highlight_color=mark.get('color', '#ffdd44')[1:], printing=True)
                    if mark.get('text'):
                        from pypdf.generic import NameObject, TextStringObject
                        annot[NameObject('/Contents')] = TextStringObject(text(mark['text']))
                else:
                    annot = Text(rect=rect, text=text(mark.get('text')), flags=4)
                writer.add_annotation(page, annot)
            elif kind == 'rectangle':
                cv.rect(x, height-y-h, w, h, fill=0)
            elif kind in ('ink', 'line'):
                points = mark.get('points')
                if not isinstance(points, list) or not 2 <= len(points) <= 5000:
                    raise ValueError("A drawing must contain 2 to 5000 points.")
                path = cv.beginPath()
                for i, point in enumerate(points):
                    if not isinstance(point, list) or len(point) != 2:
                        raise ValueError("Invalid drawing points.")
                    px, py = number(point[0], 0, width), number(point[1], 0, height)
                    (path.moveTo if i == 0 else path.lineTo)(px, height-py)
                cv.drawPath(path)
            else:
                raise ValueError("Unsupported annotation tool.")
        cv.showPage()
        cv.save()
        # Overlay bottom-left -> screen top-left -> original PDF space.
        a, b, c, d, e, f = matrix
        transform = Transformation((a, b, -c, -d, c*height+e, d*height+f))
        page.merge_transformed_page(PdfReader(overlay).pages[0], transform)
    output = BytesIO()
    writer.write(output)
    output.seek(0)
    return output
