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


def test_extract_as_images(sample_pdf):
    service = ExtractService()
    images = service.process(BytesIO(sample_pdf), '1', as_images=True)
    assert isinstance(images, list)
    assert isinstance(images[0], BytesIO)


def test_extract_preview(sample_pdf):
    service = ExtractService()
    output = service.process(BytesIO(sample_pdf), '1', preview=True)
    assert isinstance(output, BytesIO)
    assert len(service.preview_images) == 1
