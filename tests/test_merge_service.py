from io import BytesIO

from pdf_tools_service.app.services.merge_service import MergeService
import pytest

from conftest import create_pdf_custom_height


def test_merge_two_pdfs(sample_pdf):
    service = MergeService()
    files = [(BytesIO(sample_pdf), 'all'), (BytesIO(sample_pdf), '1')]
    output = service.process(files)
    assert isinstance(output, BytesIO)
    assert len(output.getvalue()) > 0


def test_merge_invalid_range(sample_pdf):
    service = MergeService()
    files = [(BytesIO(sample_pdf), '10')]
    with pytest.raises(ValueError):
        service.process(files)


def test_merge_reorder_and_filename():
    service = MergeService()
    pdf_a = BytesIO(create_pdf_custom_height(72))
    pdf_b = BytesIO(create_pdf_custom_height(100))
    files = [(pdf_a, 'all'), (pdf_b, 'all')]
    output = service.process(files, order=[1, 0], output_name="result.pdf")
    from PyPDF2 import PdfReader
    reader = PdfReader(output)
    first_page = reader.pages[0]
    assert float(first_page.mediabox.height) == 100
    assert len(reader.pages) == 2
    assert service.output_name == "result.pdf"
