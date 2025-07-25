import io
import pytest
from flask import Flask

from pdf_tools_service.app import create_app


@pytest.fixture
def app() -> Flask:
    return create_app()


@pytest.fixture
def client(app):
    return app.test_client()


def create_pdf(pages: int = 1, height: int = 72) -> bytes:
    from PyPDF2 import PdfWriter

    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=72, height=height)
    buffer = io.BytesIO()
    writer.write(buffer)
    buffer.seek(0)
    return buffer.read()


@pytest.fixture
def sample_pdf() -> bytes:
    return create_pdf(3)


def create_pdf_custom_height(height: int) -> bytes:
    return create_pdf(1, height=height)
