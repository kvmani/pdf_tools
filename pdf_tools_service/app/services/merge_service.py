from io import BytesIO
from typing import Iterable, Tuple

from PyPDF2 import PdfReader, PdfWriter

from .base import PDFService
from ..utils.pdf_parser import PDFPageParser


class MergeService(PDFService):
    """Service to merge PDF files."""

    def process(self, files: Iterable[Tuple[BytesIO, str]]) -> BytesIO:
        writer = PdfWriter()
        parser = PDFPageParser()

        for file_stream, range_str in files:
            reader = PdfReader(file_stream)
            pages = parser.parse(range_str, len(reader.pages))
            for page_num in pages:
                writer.add_page(reader.pages[page_num - 1])

        output = BytesIO()
        writer.write(output)
        output.seek(0)
        return output
