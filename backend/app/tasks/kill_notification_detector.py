"""Locate kill-notification banners in a Lien Quan "Hiệu ứng th.báo" screenshot.

The banner is a fixed-size element at a fixed offset inside a hero card:

    card row top ──┬─ +0     card artwork starts
                   ├─ +375   banner top      ← what we crop
                   ├─ +483   banner bottom
                   └─ +687   next card row top

so all that has to be found is one card row's top edge — see tasks/card_grid.py,
which does that (and handles scrolled screenshots and spurious edges).

The generic skin-card detector is deliberately NOT used here: it searches for
the best-scoring Y, and in these screenshots the card's own top edge outscores
the banner (flat page background above it, versus detailed artwork above the
banner), so it reliably locks onto the wrong line.

Offsets measured from 17 real 2796x1290 screenshots; verified to find all 68
banners across them, including scrolled ones.
"""

from dataclasses import dataclass

import cv2
import numpy as np

from app.tasks.card_grid import CardGrid

BANNER_OFFSET = 375      # card row top -> banner top
BANNER_HEIGHT = 108
DEFAULT_COLUMNS = 4


@dataclass
class BannerBox:
    x: int
    y: int
    width: int
    height: int


def detect_kill_notification_banners(
    image_bytes: bytes,
    count_per_row: int = DEFAULT_COLUMNS,
) -> tuple[list[BannerBox], int, int]:
    """Return (boxes, image_width, image_height) for the banners in the first
    (topmost) card row. Columns whose card slot is empty are skipped, so a row
    with fewer than count_per_row cards yields only the ones that exist."""
    array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Không thể đọc ảnh")

    grid = CardGrid(img)
    if grid.row_top is None:
        return [], grid.width, grid.height

    offset = int(round(BANNER_OFFSET * grid.fy))
    height = int(round(BANNER_HEIGHT * grid.fy))
    y = grid.row_top + offset
    if y < 0 or y + height > grid.height:
        return [], grid.width, grid.height

    boxes: list[BannerBox] = []
    for i in range(count_per_row):
        x = grid.column_x(i)
        if x < 0 or x + grid.col_width > grid.width:
            continue
        if grid.is_empty_slot(x, y, grid.col_width, height):
            continue
        boxes.append(BannerBox(x=x, y=y, width=grid.col_width, height=height))

    return boxes, grid.width, grid.height
