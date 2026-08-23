"""Guards for offline equation rendering and the general-purpose privacy copy."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "src" / "pdf_tools_service" / "app" / "static" / "vendor" / "mathjax"


def test_mathjax_bundle_is_vendored_for_offline_use() -> None:
    """The office intranet has no CDN access, so the bundle must ship with the service."""
    bundle = VENDOR / "tex-chtml-full.js"
    assert bundle.is_file()
    assert bundle.stat().st_size > 500_000
    assert (VENDOR / "LICENSE").is_file()

    fonts = sorted((VENDOR / "output" / "chtml" / "fonts" / "woff-v2").glob("*.woff"))
    assert len(fonts) >= 15


def test_vendored_assets_are_tracked_by_git() -> None:
    """Files present only on a developer's disk would not reach a deployment."""
    import subprocess

    tracked = subprocess.run(
        ["git", "ls-files", "src/pdf_tools_service/app/static/vendor/mathjax"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()

    assert any(name.endswith("tex-chtml-full.js") for name in tracked)
    assert sum(1 for name in tracked if name.endswith(".woff")) >= 15


def test_help_page_typesets_through_the_local_bundle(client) -> None:
    response = client.get("/pdf_tools/help")
    assert response.status_code == 200
    body = response.data.decode("utf-8")

    assert "vendor/mathjax/tex-chtml-full.js" in body
    assert "js/mathjax-config.js" in body
    assert "cdn.jsdelivr.net" not in body
    # Display maths is delimited for MathJax and explicitly marked for processing.
    assert body.count('class="help-equation mathjax"') == 3
    assert "\\[" in body
    # The old HTML-subscript approximation must not come back.
    assert "concat(P<sub>j</sub>" not in body


def test_help_page_states_the_general_purpose_privacy_position(client) -> None:
    body = client.get("/pdf_tools/help").data.decode("utf-8")

    assert "any PDF" in body
    assert "never leave the office network" in body or "never stored" in body
    assert "No personal information is collected" in body


def test_landing_page_is_not_described_as_scientific_pdf_only(client) -> None:
    body = client.get("/pdf_tools/").data.decode("utf-8")

    assert "Work with any PDF" in body
    assert "never leave the office network" in body
    # The navigation used to advertise a "Scientific help" page, which framed the
    # service as accepting only research documents.
    assert "Scientific help" not in body
