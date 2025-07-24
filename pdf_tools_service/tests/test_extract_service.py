from io import BytesIO
import pytest

from pdf_tools_service.app.services.extract_service import ExtractService


def test_extract_pages(sample_pdf):
    service = ExtractService()
    output = service.process(BytesIO(sample_pdf), '2-3')
    assert isinstance(output, BytesIO)
    assert len(output.getvalue()) > 0


def test_extract_invalid_range(sample_pdf):
    service = ExtractService()
    with pytest.raises(ValueError):
        service.process(BytesIO(sample_pdf), '10-11')
