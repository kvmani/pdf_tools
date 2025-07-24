from abc import ABC, abstractmethod
from io import BytesIO


class PDFService(ABC):
    """Base service defining interface for PDF operations."""

    @abstractmethod
    def process(self, *args, **kwargs) -> BytesIO:
        """Process input PDF(s) and return a BytesIO of the result."""
        raise NotImplementedError
