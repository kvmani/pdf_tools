from io import BytesIO

from pdf_tools_service.app.services.merge_service import MergeService
import pytest


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
