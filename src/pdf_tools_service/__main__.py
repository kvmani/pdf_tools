import os

from .app import create_app

app = create_app(os.getenv("PDF_TOOLS_CONFIG"))

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    app.run(host=host, port=port)
