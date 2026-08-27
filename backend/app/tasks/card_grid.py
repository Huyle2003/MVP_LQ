"""Locating the hero-card grid in a Lien Quan "Hiệu ứng" screenshot.

Both the kill-notification banner and the button icon are fixed-size elements
at fixed offsets inside a hero card, and the cards sit on a fixed-pitch grid.
So both croppers reduce to the same problem: find one card row's top edge.

That edge is an unambiguous signal — the page background above a card row has
near-zero horizontal variance, and the card's first pixel row is a strong
horizontal gradient.

Two things make it less trivial than it sounds, and both are handled here:

* **Spurious tops.** Text and other UI inside the card area can also produce a
  flat→edge transition. Rather than trusting the first one found, the real
  grid is taken to be whichever candidate has the most other candidates
  sitting a whole number of pitches away from it.

* **Scrolling.** When the page is scrolled, the topmost visible card row is
  clipped, so its detected "top" is just where the viewport cuts it — locally
  indistinguishable from a real row top. What gives it away is the spacing:
  two real rows are exactly one pitch apart, so when the first two aren't, the
  first one is clipped and its true (partly off-screen) position is derived
  from the second.

Constants were measured on 2796x1290 screenshots and are stored as ratios of
that reference, so other resolutions of the same UI still work.
"""

import cv2
import numpy as np

REF_WIDTH = 2796
REF_HEIGHT = 1290

ROW_PITCH = 687          # vertical distance between consecutive card rows
COL_X0 = 765             # left edge of the first card column
COL_STRIDE = 435.33      # horizontal distance between consecutive columns
COL_WIDTH = 378          # card content width

PITCH_TOLERANCE = 25
FLAT_STD = 8.0           # horizontal std below this = flat page background
EDGE_MIN = 120.0         # Sobel-Y strength that counts as a card's top edge
SEARCH_TOP = 255         # skip the header/tab bar above the card grid


class CardGrid:
    """Resolved grid geometry for one screenshot, in that image's pixels."""

    def __init__(self, image_bgr: np.ndarray):
        self.image = image_bgr
        h, w = image_bgr.shape[:2]
        self.height, self.width = h, w
        self.fy = h / REF_HEIGHT
        self.fx = w / REF_WIDTH

        self.pitch = int(round(ROW_PITCH * self.fy))
        self.x0 = COL_X0 * self.fx
        self.stride = COL_STRIDE * self.fx
        self.col_width = int(round(COL_WIDTH * self.fx))

        self.gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        tops = _row_tops(
            self.gray,
            int(round(self.x0)),
            int(round(self.x0 + self.col_width)),
            int(round(SEARCH_TOP * self.fy)),
        )
        self.row_top = _anchor_row_top(tops, self.pitch)

    def column_x(self, index: int) -> int:
        return int(round(self.x0 + index * self.stride))

    def is_empty_slot(self, x: int, y: int, w: int, h: int) -> bool:
        """An unused card slot is flat page background."""
        region = self.gray[y:y + h, x:x + w]
        return region.size == 0 or float(region.std()) < FLAT_STD


def _row_tops(gray: np.ndarray, probe_x0: int, probe_x1: int, search_top: int) -> list[int]:
    col = gray[:, probe_x0:probe_x1]
    std = col.std(axis=1)
    sobel_y = np.abs(cv2.Sobel(col, cv2.CV_64F, 0, 1, ksize=3)).mean(axis=1)
    flat = std < FLAT_STD

    tops: list[int] = []
    for y in range(search_top, len(flat) - 5):
        if flat[y] and not flat[y + 1] and sobel_y[y + 1:y + 5].max() > EDGE_MIN:
            if not tops or (y + 1) - tops[-1] > 40:
                tops.append(y + 1)
    return tops


def _anchor_row_top(tops: list[int], pitch: int) -> int | None:
    if not tops:
        return None

    def on_grid(value: int, base: int) -> bool:
        return any(abs(value - (base + k * pitch)) <= PITCH_TOLERANCE for k in range(-4, 5))

    # Drop spurious tops (text/UI inside a card also produces a flat->edge
    # transition) by keeping only those consistent with the best-supported
    # grid. Fall back to the raw list when that leaves too little to compare.
    base = max(tops, key=lambda b: sum(1 for t in tops if on_grid(t, b)))
    grid = [t for t in tops if on_grid(t, base)]
    ref = grid if len(grid) >= 2 else tops

    if len(ref) >= 2 and abs((ref[1] - ref[0]) - pitch) <= PITCH_TOLERANCE:
        return ref[0]           # first row sits at a real grid position
    if len(ref) >= 2:
        return ref[1] - pitch   # first row is clipped by scrolling — derive it
    return ref[0]
