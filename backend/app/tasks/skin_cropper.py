import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

# ─── Base config (for 2560px wide image) ──────────────────
BASE_WIDTH = 2560
BASE_XS = [699, 1049, 1399, 1749, 2099]
BASE_SKIN_WIDTH = 330
BASE_SKIN_HEIGHT = 522
# Offset from the bottom edge of a "Sở hữu" text
# to the top of the skin card.  Derived from the old project:
# offset = 604 - template_height
BASE_OFFSET_TOP = 604

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
TEMPLATE_PATH = TEMPLATE_DIR / "sohuu.png"


def _load_template() -> Optional[tuple[cv2.typing.MatLike, int, int]]:
    """Load the 'Sở hữu' template image.

    Returns (template_gray, th, tw) or None if not found.
    """
    if not TEMPLATE_PATH.exists():
        return None
    tmpl = cv2.imread(str(TEMPLATE_PATH))
    if tmpl is None:
        return None
    tmpl_gray = cv2.cvtColor(tmpl, cv2.COLOR_BGR2GRAY)
    th, tw = tmpl_gray.shape[:2]
    return tmpl_gray, th, tw


def _scale_config(img_width: int):
    """Scale crop parameters based on actual image width vs base width."""
    scale = img_width / BASE_WIDTH
    skin_w = int(BASE_SKIN_WIDTH * scale)
    skin_h = int(BASE_SKIN_HEIGHT * scale)
    xs = [int(x * scale) for x in BASE_XS]
    offset = int(BASE_OFFSET_TOP * scale)
    return skin_w, skin_h, xs, offset


def _group_rows(points, y_threshold=80):
    """Group template match points by rows based on Y coordinate."""
    if not points:
        return []
    points = sorted(points, key=lambda p: p[1])
    rows = []
    for point in points:
        added = False
        for row in rows:
            avg_y = sum(p[1] for p in row) / len(row)
            if abs(point[1] - avg_y) <= y_threshold:
                row.append(point)
                added = True
                break
        if not added:
            rows.append([point])
    return rows


def crop_skin_cards(
    image_bytes: bytes,
    owned_only: bool = False,
    match_threshold: float = 0.55,
    owned_threshold: float = 0.45,
) -> list[bytes]:
    """Crop skin cards from a shop screenshot using template matching.

    Uses the 'Sở hữu' template to locate skin card rows, then crops
    each card at the pre-defined X positions.

    Parameters:
    - image_bytes: Raw image file bytes
    - owned_only: If True, only crop cards where 'Sở hữu' text is detected
    - match_threshold: Threshold for row detection (0-1)
    - owned_threshold: Threshold for owned card detection (0-1)

    Returns list of PNG bytes, one per card.
    """
    # Decode image
    img_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Không thể đọc ảnh")

    h, w = img.shape[:2]
    skin_w, skin_h, xs, offset = _scale_config(w)

    # Load template
    template_data = _load_template()
    if template_data is None:
        raise FileNotFoundError(
            f"Không tìm thấy file template 'sohuu.png' tại {TEMPLATE_PATH}. "
            "Vui lòng đặt file ảnh template trong thư mục backend/app/templates/"
        )
    tmpl_gray, th, tw = template_data

    # Scan lower half for "Sở hữu" text
    roi_start = int(h * 0.45)
    roi = img[roi_start:h, :]
    roi_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    result = cv2.matchTemplate(roi_gray, tmpl_gray, cv2.TM_CCOEFF_NORMED)
    loc = np.where(result >= match_threshold)
    points = list(zip(loc[1], loc[0]))

    # Deduplicate nearby points
    filtered = []
    for x, y in points:
        duplicate = False
        for fx, fy in filtered:
            if abs(x - fx) < 80 and abs(y - fy) < 40:
                duplicate = True
                break
        if not duplicate:
            filtered.append((x, y))
    points = filtered

    if not points:
        raise ValueError(
            "Không tìm thấy mốc 'Sở hữu' để xác định hàng skin trong ảnh. "
            "Vui lòng kiểm tra lại ảnh chụp."
        )

    # Group by rows
    rows = _group_rows(points, y_threshold=80)

    results: list[bytes] = []

    for row in rows:
        y_mid = int(sum(p[1] for p in row) / len(row))
        # Convert back to full-image coordinates (undo ROI offset)
        y_mid += roi_start
        top = y_mid - offset

        if top < 0 or top + skin_h > h:
            continue

        for x in xs:
            if x < 0 or x + skin_w > w:
                continue

            should_crop = True

            if owned_only:
                # Check if "Sở hữu" appears near the bottom of this card
                check_roi = img[
                    top + skin_h - 20 : top + skin_h + 140,
                    x : x + skin_w,
                ]
                if check_roi.size == 0:
                    continue
                check_gray = cv2.cvtColor(check_roi, cv2.COLOR_BGR2GRAY)
                res = cv2.matchTemplate(check_gray, tmpl_gray, cv2.TM_CCOEFF_NORMED)
                score = np.max(res)
                should_crop = score > owned_threshold

            if should_crop:
                crop = img[top : top + skin_h, x : x + skin_w]
                if crop.shape[0] != skin_h or crop.shape[1] != skin_w:
                    continue

                success, buf = cv2.imencode(".png", crop)
                if success:
                    results.append(buf.tobytes())

    return results
