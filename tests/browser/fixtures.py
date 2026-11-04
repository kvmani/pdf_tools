"""Generate fictional, redistributable browser-test documents and signature art."""
import sys
from pathlib import Path
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1]); root.mkdir(parents=True, exist_ok=True)
cv = canvas.Canvas(str(root / 'sample.pdf'), pagesize=(595, 842))
for page in range(3):
    cv.setFillColorRGB(.09, .25, .22); cv.rect(0, 740, 595, 102, fill=1, stroke=0)
    cv.setFillColorRGB(.75, .85, .7); cv.setFont('Helvetica', 10)
    cv.drawString(48, 800, 'NORTHFIELD / INTERNAL COMMUNICATION')
    cv.setFillColorRGB(1, 1, .96); cv.setFont('Times-Roman', 30)
    cv.drawString(48, 762, ['Project review', 'Meeting notes', 'Next steps'][page])
    cv.setFillColorRGB(.12, .25, .22); cv.setFont('Helvetica', 12)
    lines = ['Original text', 'Quarterly facilities improvement plan',
             'Prepared for the operations team', '',
             'Please review the proposed schedule and share your comments.',
             'The maintenance window begins on Monday at 09:00.',
             'All teams will receive a reminder before work starts.', '',
             'Budget and equipment requests are attached for reference.',
             'Thank you for helping keep our shared spaces in good order.']
    for i, line in enumerate(lines):
        cv.drawString(48, 690-i*25, line)
    cv.setStrokeColorRGB(.75, .81, .76); cv.line(48, 250, 547, 250)
    cv.setFont('Helvetica', 10); cv.drawString(48, 230, 'Reviewed by'); cv.drawString(350, 230, 'Date')
    cv.setFillColorRGB(.45, .52, .46); cv.setFont('Helvetica', 9)
    cv.drawString(48, 35, 'INTERNAL USE ONLY'); cv.drawRightString(547, 35, f'{page+1} / 3'); cv.showPage()
cv.save()
im = Image.new('RGBA', (500, 150), (255, 255, 255, 0)); draw = ImageDraw.Draw(im)
try:
    font = ImageFont.truetype('DejaVuSerif-Italic.ttf', 64)
except OSError:
    font = ImageFont.load_default(size=64)
draw.text((10, 20), 'A. Rivera', font=font, fill=(24, 47, 76, 255))
draw.line([(20, 110), (130, 95), (300, 108), (430, 90)], fill=(24, 47, 76, 255), width=3)
im.save(root / 'signature.png')
