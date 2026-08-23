import os

from .app import create_app

app = create_app(os.getenv("PDF_TOOLS_CONFIG"))


def main() -> None:
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    from waitress import serve
    serve(app, host=host, port=port, threads=4)


if __name__ == "__main__":
    main()
