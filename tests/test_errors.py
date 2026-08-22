from io import BytesIO

import pytest

from pdf_tools_service.app.utils import errors


def test_read_pdf_rejects_encrypted_and_empty_documents(monkeypatch):
    class EncryptedReader:
        is_encrypted = True

    monkeypatch.setattr(errors, "PdfReader", lambda stream: EncryptedReader())
    with pytest.raises(errors.InvalidPDFError, match="password-protected"):
        errors.read_pdf(BytesIO(b"%PDF-ignored"), "locked.pdf")

    class EmptyReader:
        is_encrypted = False
        pages = []

    monkeypatch.setattr(errors, "PdfReader", lambda stream: EmptyReader())
    with pytest.raises(errors.InvalidPDFError, match="readable pages"):
        errors.read_pdf(BytesIO(b"%PDF-ignored"), "empty.pdf")


def test_user_error_does_not_expose_unexpected_exception_details():
    assert errors.user_error(ValueError("invalid page range")) == "invalid page range"
    assert errors.user_error(RuntimeError("secret implementation detail")) == (
        "We could not process this PDF. Check the file and try again."
    )
