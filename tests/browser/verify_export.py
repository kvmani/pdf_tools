"""Verify browser-generated PDF semantics using an independent parser."""
import sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
assert len(reader.pages) == 3
page = reader.pages[0]
value = page.extract_text()
assert 'New text' in value and 'Original text' not in value
assert 'Reviewed for internal circulation' in value
assert len(page.images) >= 1
annots = [ref.get_object() for ref in page['/Annots']]
assert any(a['/Subtype'] == '/Highlight' for a in annots)
assert any(a['/Subtype'] == '/Text' and 'facilities team' in a['/Contents'] for a in annots)
print('PASS exported PDF: replacement, new text, embedded signature/image, highlight and comment')
