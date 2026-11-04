"""Add page numbers and/or a text watermark to every selected page."""

from __future__ import annotations

import math
import re
from io import BytesIO
from typing import Optional

from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from .base import PDFService
from ..utils.errors import read_pdf
from ..utils.pdf_parser import PDFPageParser

NUMBER_FORMATS = {
    "n": "{n}",
    "page": "Page {n}",
    "page_of": "Page {n} of {total}",
    "n_of": "{n} / {total}",
}
POSITIONS = {"bottom-center", "bottom-left", "bottom-right", "top-center", "top-left", "top-right"}
MARGIN = 28
_TEXT = re.compile(r"^[\x20-\x7e\xa0-\xff]+$")


def _display_transform(rotation: int, left: float, bottom: float, width: float, height: float):
    """Return a canvas matrix mapping upright display coordinates to page space.

    ``width`` and ``height`` are the unrotated crop-box size. Display coordinates
    have their origin at the visible bottom-left corner after /Rotate is applied.
    """

    return {
        0: (1, 0, 0, 1, left, bottom),
        90: (0, 1, -1, 0, left + width, bottom),
        180: (-1, 0, 0, -1, left + width, bottom + height),
        270: (0, -1, 1, 0, left, bottom + height),
    }[rotation]


class StampService(PDFService):
    """Overlay page numbers and watermarks using standard PDF fonts."""

    def process(
        self,
        file_stream: BytesIO,
        *,
        numbers: bool = True,
        number_format: str = "page_of",
        position: str = "bottom-center",
        start: int = 1,
        font_size: float = 10,
        pages: str = "all",
        watermark: Optional[str] = None,
        watermark_opacity: float = 0.15,
        filename: str = "This file",
    ) -> BytesIO:
        if number_format not in NUMBER_FORMATS:
            raise ValueError("Choose a supported page-number format.")
        if position not in POSITIONS:
            raise ValueError("Choose a supported page-number position.")
        if not 0 <= start <= 99999:
            raise ValueError("The first page number must be between 0 and 99999.")
        if not 6 <= font_size <= 48:
            raise ValueError("Font size must be between 6 and 48 pt.")
        if not 0.05 <= watermark_opacity <= 1:
            raise ValueError("Watermark opacity must be between 5% and 100%.")
        watermark = (watermark or "").strip() or None
        if watermark and (len(watermark) > 60 or not _TEXT.match(watermark)):
            raise ValueError("Use up to 60 Western European characters for the watermark.")
        if not numbers and not watermark:
            raise ValueError("Choose page numbers, a watermark, or both.")

        reader = read_pdf(file_stream, filename)
        selected = PDFPageParser().parse(pages or "all", len(reader.pages))
        order = {page: index for index, page in enumerate(dict.fromkeys(selected))}
        total = start + len(order) - 1
        writer = PdfWriter(clone_from=reader)
        for page_num, index in order.items():
            page = writer.pages[page_num - 1]
            box = page.cropbox
            left, bottom = float(box.left), float(box.bottom)
            width, height = float(box.width), float(box.height)
            rotation = (page.rotation or 0) % 360
            if rotation not in (0, 90, 180, 270):
                rotation = 0
            view_w, view_h = (height, width) if rotation in (90, 270) else (width, height)

            buffer = BytesIO()
            overlay = canvas.Canvas(buffer, pagesize=(left + width, bottom + height))
            overlay.transform(*_display_transform(rotation, left, bottom, width, height))
            if watermark:
                self._draw_watermark(overlay, watermark, view_w, view_h, watermark_opacity)
            if numbers:
                label = NUMBER_FORMATS[number_format].format(n=start + index, total=total)
                self._draw_number(overlay, label, position, view_w, view_h, font_size)
            overlay.showPage()
            overlay.save()
            buffer.seek(0)
            page.merge_page(PdfReader(buffer).pages[0])

        output = BytesIO()
        writer.write(output)
        output.seek(0)
        return output

    @staticmethod
    def _draw_number(c: canvas.Canvas, label: str, position: str, w: float, h: float, size: float) -> None:
        vertical, horizontal = position.split("-")
        y = MARGIN - size * 0.25 if vertical == "bottom" else h - MARGIN - size * 0.75
        c.setFont("Helvetica", size)
        c.setFillColorRGB(0.2, 0.2, 0.2)
        if horizontal == "left":
            c.drawString(MARGIN, y, label)
        elif horizontal == "right":
            c.drawRightString(w - MARGIN, y, label)
        else:
            c.drawCentredString(w / 2, y, label)

    @staticmethod
    def _draw_watermark(c: canvas.Canvas, text: str, w: float, h: float, opacity: float) -> None:
        angle = math.degrees(math.atan2(h, w))
        diagonal = math.hypot(w, h)
        size = max(12.0, min(160.0, diagonal * 0.75 / max(stringWidth(text, "Helvetica-Bold", 1), 1)))
        c.saveState()
        c.setFillColorRGB(0.45, 0.45, 0.45)
        c.setFillAlpha(opacity)
        c.translate(w / 2, h / 2)
        c.rotate(angle)
        c.setFont("Helvetica-Bold", size)
        c.drawCentredString(0, -size * 0.35, text)
        c.restoreState()
