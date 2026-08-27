"""Locate skin button icons in a Lien Quan "Nút" screenshot.

Same principle as the kill-notification banner detector: the button is a
fixed-size element at a fixed position inside a hero card, and the cards sit
on a fixed-pitch grid, so finding one card row's top edge (tasks/card_grid.py)
is enough to place every button in the row.

    card row top ──┬─ +0     card artwork starts
                   ├─ +445   button icon CENTRE   ← +189 from the card's left
                   └─ +687   next card row top

The icon is a circle roughly 85px across sitting in a ~116px slot. A 100px
box is cropped around its centre: large enough that no icon's artwork is
clipped, tight enough not to drag in much of the card art behind it.

Offsets measured from 18 real 2796x1290 screenshots (Hough-circle fit on each
card's icon gave centre offsets of 189±2 x and 445±2 y).
"""

from dataclasses import dataclass

import cv2
import numpy as np

from app.tasks.card_grid import CardGrid

BUTTON_CENTER_X = 189    # card left edge -> icon centre
BUTTON_CENTER_Y = 445    # card row top   -> icon centre
BUTTON_SIZE = 100
DEFAULT_COLUMNS = 4


@dataclass
class ButtonBox:
    x: int
    y: int
    width: int
    height: int


def detect_skin_buttons(
    image_bytes: bytes,
    count_per_row: int = DEFAULT_COLUMNS,
) -> tuple[list[ButtonBox], int, int]:
    """Return (boxes, image_width, image_height) for the button icons in the
    first (topmost) card row. Empty card slots are skipped."""
    array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Không thể đọc ảnh")

    grid = CardGrid(img)
    if grid.row_top is None:
        return [], grid.width, grid.height

    size = int(round(BUTTON_SIZE * grid.fy))
    center_y = grid.row_top + int(round(BUTTON_CENTER_Y * grid.fy))
    y = center_y - size // 2
    if y < 0 or y + size > grid.height:
        return [], grid.width, grid.height

    boxes: list[ButtonBox] = []
    for i in range(count_per_row):
        center_x = grid.column_x(i) + int(round(BUTTON_CENTER_X * grid.fx))
        x = center_x - size // 2
        if x < 0 or x + size > grid.width:
            continue
        # Skip unused card slots — but probe the whole card column, since the
        # icon area alone can be low-variance for a flat, single-colour icon.
        if grid.is_empty_slot(grid.column_x(i), y, grid.col_width, size):
            continue
        boxes.append(ButtonBox(x=x, y=y, width=size, height=size))

    return boxes, grid.width, grid.height
