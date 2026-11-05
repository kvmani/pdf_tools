from io import BytesIO
from typing import Iterable, Tuple, List, Optional

from pypdf import PdfWriter

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
        rotations: Optional[List[int]] | None = None,
    ) -> BytesIO:
        """Merge PDFs into a single stream.

        Parameters
        ----------
        files:
            Iterable of ``(BytesIO, range_str)`` pairs where ``range_str``
            denotes the user-supplied page range.
        rotations:
            Optional clockwise rotation in degrees (0, 90, 180 or 270) for each
            file, in the same order as ``files``; applied to all its pages.
        """

        writer = PdfWriter()
        parser = PDFPageParser()
        file_list = list(files)
        turns = list(rotations or [0] * len(file_list))
        if len(turns) != len(file_list) or any(t not in (0, 90, 180, 270) for t in turns):
            raise ValueError("Rotation must be 0, 90, 180 or 270 degrees for each document.")
        if order:
            file_list = [file_list[i] for i in order]
            turns = [turns[i] for i in order]

        for entry, turn in zip(file_list, turns):
            file_stream, range_str = entry[:2]
            filename = entry[2] if len(entry) > 2 else "This file"
            reader = read_pdf(file_stream, filename)
            pages = parser.parse(range_str, len(reader.pages))
            for page_num in pages:
                page = writer.add_page(reader.pages[page_num - 1])
                if turn:
                    page.rotate(turn)

        output = BytesIO()
        writer.write(output)
        output.seek(0)
        self.output_name = output_name or "merged.pdf"
        return output
