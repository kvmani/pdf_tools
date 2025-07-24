"""Base classes for Flask controllers."""

from flask import Blueprint, current_app


class BaseController:
    """Common functionality for all controllers."""

    def __init__(self, name: str, import_name: str) -> None:
        """Create and register a Flask :class:`Blueprint`."""

        self.blueprint = Blueprint(name, import_name)
        self.register()

    def register(self) -> None:
        """Register all routes on ``self.blueprint``."""

        raise NotImplementedError

    def _max_content_length(self) -> int:
        """Return the maximum allowed content length in bytes."""

        return current_app.config.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)
