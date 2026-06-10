"""AI-powered skin card detection with fixed card dimensions and fixed X.

Given known card size (width, height), gap, row count, cards per row,
and a fixed start X, the detector uses edge-density scoring to find the
optimal starting Y position in the image, then returns the full grid.
"""

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class CardBox:
    """A detected card bounding box in original image coordinates."""
    x: int
    y: int
    width: int
    height: int


# ─── Search thresholds ──────────────────────────────────
SKIP_TOP_RATIO = 0.02           # skip topmost 2% of image height
EDGE_THRESHOLD = 30             # Canny lower threshold
EDGE_THRESHOLD_MAX = 120        # Canny upper threshold
RESIZE_MAX_DIM = 1600           # resize to max 1600px for processing
TOP_BORDER_HEIGHT = 4           # height of the top border region to check
SOBEL_KERNEL = 3


def _score_y_position(
    gray: np.ndarray,
    sobel_y: np.ndarray,
    y: int,
    sx: int,
    scw: int,
    sch: int,
    sgap: int,
    count: int,
) -> float:
    """Score a Y position using multi-signal analysis.

    Combines three signals:
    1. Top border strength — horizontal edge at the card's top edge (Sobel Y)
    2. Card texture — standard deviation inside each card (detailed art = high std)
    3. Gap cleanness — low edge response in gap regions between cards
    """
    h, w = gray.shape[:2]

    border_score = 0.0
    texture_score = 0.0
    gap_penalty = 0.0
    valid_cards = 0
    valid_gaps = 0

    for i in range(count):
        cx = sx + i * (scw + sgap)
        if cx + scw > w or y + sch > h:
            continue
        valid_cards += 1

        # ── 1. Top border strength ──────────────────────────
        # The top border of a card is a strong horizontal edge (line)
        top_strip = sobel_y[y:y + TOP_BORDER_HEIGHT, cx:cx + scw]
        if top_strip.size > 0:
            border_score += float(np.mean(top_strip))

        # ── 2. Card interior texture ────────────────────────
        # Card artwork has high variance (std) in pixel intensity
        card_region = gray[y:y + sch, cx:cx + scw]
        if card_region.size > 0:
            texture_score += float(np.std(card_region))

        # ── 3. Gap cleanness (between this card and next) ───
        if i < count - 1:
            gx = cx + scw
            if gx + sgap <= w and y + sch <= h:
                gap_region = gray[y:y + sch, gx:gx + sgap]
                gap_edges = sobel_y[y:y + sch, gx:gx + sgap]
                if gap_region.size > 0:
                    # Gap should be uniform (low std) and have few edges
                    gap_std = float(np.std(gap_region))
                    gap_edge_mean = float(np.mean(gap_edges))
                    # Penalize gaps with high edge or high texture
                    gap_penalty += gap_edge_mean + gap_std * 0.3
                    valid_gaps += 1

    if valid_cards == 0:
        return -999.0

    avg_border = border_score / valid_cards
    avg_texture = texture_score / valid_cards
    avg_gap_penalty = gap_penalty / valid_gaps if valid_gaps > 0 else 0.0

    # Combined score: strong border + rich texture - messy gaps
    return avg_border * 2.0 + avg_texture * 0.8 - avg_gap_penalty * 1.5


def detect_skin_cards(
    image_bytes: bytes,
    card_width: int = 325,
    card_height: int = 515,
    gap_x: int = 25,
    row_count: int = 1,
    count_per_row: int = 5,
    start_x: int = 702,
) -> tuple[list[CardBox], int, int]:
    """Detect skin cards using fixed X and AI-scored Y.

    With known card dimensions and fixed start_x, slides a window
    vertically to find the Y position with the strongest edge response
    across the full card row width.

    Returns (boxes, original_width, original_height).
    Always returns exactly count_per_row boxes when possible.
    """
    # ── Decode ──────────────────────────────────────────
    img_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Không thể đọc ảnh")

    orig_h, orig_w = img.shape[:2]

    # ── Resize for faster processing ────────────────────
    scale = 1.0
    if max(orig_w, orig_h) > RESIZE_MAX_DIM:
        scale = RESIZE_MAX_DIM / max(orig_w, orig_h)
        new_w = int(orig_w * scale)
        new_h = int(orig_h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        new_w, new_h = orig_w, orig_h

    # Scale dimensions to resized image
    scw = int(card_width * scale)
    sch = int(card_height * scale)
    sgap = int(gap_x * scale)
    sx = int(start_x * scale)

    # ── Grayscale + Sobel Y-gradient ────────────────────
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=SOBEL_KERNEL)
    sobel_y = np.abs(sobel_y)

    h, w = img.shape[:2]

    # Total row span in pixels
    total_row_width = count_per_row * scw + (count_per_row - 1) * sgap
    row_end_x = min(sx + total_row_width, w)

    # ── Search Y only (two-pass) ───────────────────────
    search_start_y = int(h * SKIP_TOP_RATIO)
    search_end_y = h - sch

    # Pass 1: coarse search (step=2) for approximate Y
    best_score = -9999.0
    best_y = search_start_y

    for y in range(search_start_y, search_end_y, 2):
        score = _score_y_position(gray, sobel_y, y, sx, scw, sch, sgap, count_per_row)
        if score > best_score:
            best_score = score
            best_y = y

    # Pass 2: fine search (±6px around best_y, step=1)
    fine_start = max(search_start_y, best_y - 6)
    fine_end = min(search_end_y, best_y + 6)
    for y in range(fine_start, fine_end, 1):
        score = _score_y_position(gray, sobel_y, y, sx, scw, sch, sgap, count_per_row)
        if score > best_score:
            best_score = score
            best_y = y

    # ── Generate grid in ORIGINAL coordinates ──────────
    # Use exact math, NOT scaled coords, to avoid rounding errors

    # Fine-tune Y: shift down by 2px to compensate for glow/shadow
    # above the card that shifts the Sobel edge response upward
    best_y = min(best_y + 2, h - sch)

    best_y_orig = round(best_y / scale)

    boxes: list[CardBox] = []
    for row in range(row_count):
        for col in range(count_per_row):
            cx = start_x + col * (card_width + gap_x)
            cy = best_y_orig + row * (card_height + gap_x)
            if cx + card_width <= orig_w and cy + card_height <= orig_h:
                boxes.append(CardBox(cx, cy, card_width, card_height))

    return boxes, orig_w, orig_h
