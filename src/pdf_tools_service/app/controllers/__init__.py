from .merge_controller import merge_bp
from .extract_controller import extract_bp  # If similar to merge_bp

from flask import Blueprint


pdf_tools_bp = Blueprint(
    "pdf_tools",  # 👈 This name MUST match your url_for() prefix
    __name__,
    template_folder="templates",
    static_folder="static"
)
# Register merge blueprint under /merge
pdf_tools_bp.register_blueprint(merge_bp)

# Similarly for extract, if you have it
# from .extract_controller import extract_bp
pdf_tools_bp.register_blueprint(extract_bp)

