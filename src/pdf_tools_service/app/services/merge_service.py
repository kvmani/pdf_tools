from io import BytesIO
from typing import Iterable, Tuple, List, Optional

from PyPDF2 import PdfWriter

from .base import PDFService
from ..utils.pdf_parser import PDFPageParser
from ..utils.errors import read_pdf


class MergeService(PDFService):
    """Service to merge PDF files."""

    def process(
        self,
        files: Iterable[Tuple[BytesIO, str] | Tuple[BytesIO, str, str]],
        order: Optional[List[int]] | None = None,
        output_name: str | None = None,
    ) -> BytesIO:
        """Merge PDFs into a single stream.

        Parameters
        ----------
        files:
            Iterable of ``(BytesIO, range_str)`` pairs where ``range_str``
            denotes the user-supplied page range.
        """

        writer = PdfWriter()
        parser = PDFPageParser()
        file_list = list(files)
        if order:
            file_list = [file_list[i] for i in order]

        for entry in file_list:
            file_stream, range_str = entry[:2]
            filename = entry[2] if len(entry) > 2 else "This file"
            reader = read_pdf(file_stream, filename)
            pages = parser.parse(range_str, len(reader.pages))
            for page_num in pages:
                writer.add_page(reader.pages[page_num - 1])

        output = BytesIO()
        writer.write(output)
        output.seek(0)
        self.output_name = output_name or "merged.pdf"
        return output
