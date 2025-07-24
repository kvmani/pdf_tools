import re
from typing import List


class PDFPageParser:
    RANGE_RE = re.compile(r"^(\d+(?:-\d+)?)(,\d+(?:-\d+)?)*$", re.ASCII)

    def parse(self, range_str: str, total_pages: int) -> List[int]:
        if not range_str or range_str.lower() == "all":
            return list(range(1, total_pages + 1))

        if not self.RANGE_RE.match(range_str.replace(' ', '')):
            raise ValueError("Invalid range format")

        pages = []
        for part in range_str.split(','):
            part = part.strip()
            if '-' in part:
                start, end = map(int, part.split('-', 1))
                if start < 1 or end > total_pages or start > end:
                    raise ValueError("Invalid page range")
                pages.extend(range(start, end + 1))
            else:
                num = int(part)
                if num < 1 or num > total_pages:
                    raise ValueError("Page number out of range")
                pages.append(num)
        return pages
