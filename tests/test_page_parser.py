import pytest

from pdf_tools_service.app.utils.pdf_parser import PDFPageParser


def test_parse_all():
    parser = PDFPageParser()
    assert parser.parse('all', 5) == [1, 2, 3, 4, 5]


def test_parse_range_list():
    parser = PDFPageParser()
    assert parser.parse('1-2,4', 4) == [1, 2, 4]


def test_invalid_format():
    parser = PDFPageParser()
    with pytest.raises(ValueError):
        parser.parse('a-b', 5)


def test_out_of_bounds():
    parser = PDFPageParser()
    with pytest.raises(ValueError):
        parser.parse('10', 5)
