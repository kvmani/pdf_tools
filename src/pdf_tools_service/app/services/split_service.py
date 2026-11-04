"""Split one PDF into several PDFs."""

from __future__ import annotations

from io import BytesIO
from typing import List, Tuple

from pypdf import PdfWriter

from .base import PDFService
from ..utils.errors import read_pdf
from ..utils.pdf_parser import PDFPageParser

MAX_PARTS = 200


class SplitService(PDFService):
    """Split a PDF into parts: every N pages, one file per page, or custom groups."""

    def plan(self, mode: str, value: str, total: int) -> List[List[int]]:
        """Return the one-based page groups for each output file."""

        if mode == "each":
            groups = [[n] for n in range(1, total + 1)]
        elif mode == "every":
            try:
                size = int(str(value).strip())
            except ValueError:
                raise ValueError("Enter how many pages each part should have.") from None
            if size < 1:
                raise ValueError("Each part needs at least one page.")
            groups = [list(range(start, min(start + size, total + 1))) for start in range(1, total + 1, size)]
        elif mode == "ranges":
            parser = PDFPageParser()
            parts = [part.strip() for part in str(value).split(";") if part.strip()]
            if not parts:
                raise ValueError("Enter at least one group, for example 1-3; 4-6.")
            groups = []
            for part in parts:
                try:
                    groups.append(parser.parse(part, total))
                except ValueError as exc:
                    raise ValueError(f"Group “{part}”: {exc}. Pages must be between 1 and {total}.") from None
        else:
            raise ValueError("Choose how to split the PDF.")
        if len(groups) > MAX_PARTS:
            raise ValueError(f"This would create {len(groups)} files; the limit is {MAX_PARTS}.")
        return groups

    def process(self, file_stream: BytesIO, mode: str, value: str = "", filename: str = "This file") -> List[Tuple[List[int], BytesIO]]:
        """Return ``(pages, pdf_stream)`` pairs, one for each output part."""

        reader = read_pdf(file_stream, filename)
        result = []
        for group in self.plan(mode, value, len(reader.pages)):
            writer = PdfWriter()
            for page_num in group:
                writer.add_page(reader.pages[page_num - 1])
            output = BytesIO()
            writer.write(output)
            output.seek(0)
            result.append((group, output))
        return result
