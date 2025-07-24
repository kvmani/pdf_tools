from flask import Blueprint, current_app


class BaseController:
    def __init__(self, name: str, import_name: str):
        self.blueprint = Blueprint(name, import_name)
        self.register()

    def register(self):
        raise NotImplementedError

    def _max_content_length(self) -> int:
        return current_app.config.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)
