import json
import os
from flask import Flask, render_template


DEFAULT_CONFIG = os.path.join(os.path.dirname(__file__), '..', 'config.json')


def create_app(config_path: str = DEFAULT_CONFIG) -> Flask:
    app = Flask(__name__)
    with open(config_path) as cfg:
        config = json.load(cfg)
    app.config.update(config)

    from .controllers.merge_controller import merge_bp
    from .controllers.extract_controller import extract_bp

    app.register_blueprint(merge_bp)
    app.register_blueprint(extract_bp)

    @app.route('/')
    def index():
        return render_template('index.html')

    return app

app = create_app()
