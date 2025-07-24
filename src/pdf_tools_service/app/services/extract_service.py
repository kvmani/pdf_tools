from io import BytesIO
from typing import List

from PyPDF2 import PdfReader, PdfWriter
from pdf2image import convert_from_bytes
from pdf2image.pdf2image import PDFInfoNotInstalledError
from PIL import Image

from .base import PDFService
from ..utils.pdf_parser import PDFPageParser


class ExtractService(PDFService):
    """Service to extract pages from a PDF."""

    def process(
        self,
        file_stream: BytesIO,
        range_str: str,
        *,
        as_images: bool = False,
        preview: bool = False,
    ) -> BytesIO | List[BytesIO]:
        """Extract a range of pages from ``file_stream``.

        Parameters
        ----------
        as_images:
            When ``True`` return list of PNG images instead of a PDF.
        preview:
            When ``True`` populate ``self.preview_images`` with PNG images of
            the extracted pages.
        """

        reader = PdfReader(file_stream)
        parser = PDFPageParser()
        pages = parser.parse(range_str, len(reader.pages))
        self.preview_images = []

        if as_images or preview:
            images: List[BytesIO] = []
            for page_num in pages:
                try:
                    img = convert_from_bytes(
                        file_stream.getvalue(), first_page=page_num, last_page=page_num
                    )[0]
                except (PDFInfoNotInstalledError, OSError):
                    img = Image.new("RGB", (200, 200), color="white")
                buf = BytesIO()
                img.save(buf, format="PNG")
                buf.seek(0)
                if as_images:
                    images.append(BytesIO(buf.getvalue()))
                self.preview_images.append(BytesIO(buf.getvalue()))
            if as_images:
                return images

        writer = PdfWriter()
        for page_num in pages:
            writer.add_page(reader.pages[page_num - 1])

        output = BytesIO()
        writer.write(output)
        output.seek(0)
        return output
