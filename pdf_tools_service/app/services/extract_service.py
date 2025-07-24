from io import BytesIO

from PyPDF2 import PdfReader, PdfWriter

from .base import PDFService
from ..utils.pdf_parser import PDFPageParser


class ExtractService(PDFService):
    """Service to extract pages from a PDF."""

    def process(self, file_stream: BytesIO, range_str: str) -> BytesIO:
        """Extract a range of pages from ``file_stream``."""

        reader = PdfReader(file_stream)
        parser = PDFPageParser()
        pages = parser.parse(range_str, len(reader.pages))
        writer = PdfWriter()

        for page_num in pages:
            writer.add_page(reader.pages[page_num - 1])

        output = BytesIO()
        writer.write(output)
        output.seek(0)
        return output
