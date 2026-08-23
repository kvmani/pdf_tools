"""Safe, user-facing error handling for PDF input and processing."""

from __future__ import annotations

import logging
from typing import BinaryIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

LOGGER = logging.getLogger(__name__)


class InvalidPDFError(ValueError):
    """Raised when an uploaded file cannot be read as a normal PDF."""


def read_pdf(stream: BinaryIO, filename: str = "This file") -> PdfReader:
    """Read a PDF and convert parser failures into an actionable message."""

    try:
        stream.seek(0)
        if stream.read(5) != b"%PDF-":
            raise InvalidPDFError(
                f"{filename} is not a readable PDF. It may be mislabeled, incomplete, "
                "or exported in another format. Choose a valid PDF file."
            )
        stream.seek(0)
        reader = PdfReader(stream)
        if reader.is_encrypted:
            raise InvalidPDFError(
                f"{filename} is password-protected. Upload an unlocked PDF to continue."
            )
        if not reader.pages:
            raise InvalidPDFError(f"{filename} does not contain any readable pages.")
        return reader
    except InvalidPDFError:
        raise
    except (PdfReadError, UnicodeDecodeError, OSError, ValueError, TypeError) as exc:
        LOGGER.info("Rejected unreadable PDF %s: %s", filename, type(exc).__name__)
        raise InvalidPDFError(
            f"{filename} is not a readable PDF. It may be mislabeled, incomplete, "
            "or exported in another format. Choose a valid PDF file."
        ) from exc


def user_error(exc: Exception) -> str:
    """Return a safe message for expected input errors without leaking internals."""

    if isinstance(exc, InvalidPDFError):
        return str(exc)
    if isinstance(exc, ValueError):
        return str(exc)
    LOGGER.exception("Unexpected PDF processing failure", exc_info=exc)
    return "We could not process this PDF. Check the file and try again."
