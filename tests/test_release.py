"""Release metadata stays consistent: the release workflow refuses mismatches."""
import pathlib
import re
import tomllib

from pdf_tools_service._version import __version__

ROOT = pathlib.Path(__file__).resolve().parents[1]


def test_pyproject_matches_version_literal():
    with (ROOT / "pyproject.toml").open("rb") as handle:
        assert tomllib.load(handle)["project"]["version"] == __version__


def test_changelog_has_a_section_for_this_version():
    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    assert re.search(rf"^## \[?{re.escape(__version__)}\]?", text, re.MULTILINE)


def test_pages_show_version_and_help_allows_mathjax_styles(client):
    assert f"v{__version__}".encode() in client.get("/pdf_tools/").data
    help_page = client.get("/pdf_tools/help")
    assert "style-src 'self' 'unsafe-inline'" in help_page.headers["Content-Security-Policy"]
    assert "unsafe-inline" not in client.get("/pdf_tools/merge").headers["Content-Security-Policy"]
