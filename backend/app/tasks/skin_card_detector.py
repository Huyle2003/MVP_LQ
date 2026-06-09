"""OpenCV-based skin card detection.

Detects skin card regions in a shop screenshot by finding rectangular
contours with aspect ratios typical of skin cards, then applying
Non-Maximum Suppression to eliminate duplicates.
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


# ─── Default thresholds ──────────────────────────────────
MIN_SKIN_WIDTH_RATIO = 0.06      # card width must be >= 6% of image width
MAX_SKIN_WIDTH_RATIO = 0.20      # card width must be <= 20% of image width
MIN_SKIN_HEIGHT_RATIO = 0.20     # card height must be >= 20% of image height
MAX_SKIN_HEIGHT_RATIO = 0.60     # card height must be <= 60% of image height
MIN_ASPECT_RATIO = 1.3           # h/w minimum
MAX_ASPECT_RATIO = 2.8           # h/w maximum
NMS_IOU_THRESHOLD = 0.3          # IoU threshold for NMS
SKIP_LEFT_RATIO = 0.15           # skip boxes with x < 15% of image width
SKIP_TOP_RATIO = 0.08            # skip boxes with y < 8% of image height
RESIZE_MAX_DIM = 1200             # resize to max 1200px for processing


def _nms(boxes: list[CardBox], iou_threshold: float) -> list[CardBox]:
    """Non-Maximum Suppression – remove overlapping boxes."""
    if not boxes:
        return []

    # Convert to array of [x, y, x2, y2]
    rects = np.array([[b.x, b.y, b.x + b.width, b.y + b.height] for b in boxes], dtype=np.float32)
    scores = np.array([b.width * b.height for b in boxes], dtype=np.float32)

    indices = cv2.dnn.NMSBoxes(
        bboxes=rects.tolist(),
        scores=scores.tolist(),
        score_threshold=0.0,
        nms_threshold=iou_threshold,
    )

    if isinstance(indices, tuple):
        indices = indices[0]
    if isinstance(indices, np.ndarray):
        indices = indices.flatten()

    return [boxes[int(i)] for i in indices]


def detect_skin_cards(
    image_bytes: bytes,
    min_card_width: int | None = None,
    min_card_height: int | None = None,
    max_card_width: int | None = None,
    max_card_height: int | None = None,
) -> tuple[list[CardBox], int, int]:
    """Detect skin card bounding boxes in a shop screenshot.

    Uses edge detection + contour finding + aspect-ratio filtering.

    Returns (boxes, original_width, original_height).
    If no cards found, returns empty list.
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

    # ── Grayscale + blur ────────────────────────────────
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # ── Edge detection ──────────────────────────────────
    edges = cv2.Canny(blurred, 30, 100)

    # ── Morphology to close card borders ────────────────
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    dilated = cv2.dilate(closed, kernel, iterations=1)

    # ── Find contours ───────────────────────────────────
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # ── Compute thresholds based on resized image size ──
    h, w = img.shape[:2]

    min_w_abs = min_card_width or int(w * MIN_SKIN_WIDTH_RATIO)
    max_w_abs = max_card_width or int(w * MAX_SKIN_WIDTH_RATIO)
    min_h_abs = min_card_height or int(h * MIN_SKIN_HEIGHT_RATIO)
    max_h_abs = max_card_height or int(h * MAX_SKIN_HEIGHT_RATIO)
    skip_left = int(w * SKIP_LEFT_RATIO)
    skip_top = int(h * SKIP_TOP_RATIO)

    candidates: list[CardBox] = []

    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)

        # Skip menu area (left side)
        if x < skip_left:
            continue
        # Skip top bar
        if y < skip_top:
            continue
        # Size filters
        if cw < min_w_abs or cw > max_w_abs:
            continue
        if ch < min_h_abs or ch > max_h_abs:
            continue
        # Must be portrait orientation
        if ch <= cw:
            continue
        # Aspect ratio filter
        ratio = ch / cw
        if ratio < MIN_ASPECT_RATIO or ratio > MAX_ASPECT_RATIO:
            continue

        # Map back to original coordinates
        orig_x = int(x / scale)
        orig_y = int(y / scale)
        orig_cw = int(cw / scale)
        orig_ch = int(ch / scale)

        candidates.append(CardBox(orig_x, orig_y, orig_cw, orig_ch))

    # ── NMS ─────────────────────────────────────────────
    boxes = _nms(candidates, NMS_IOU_THRESHOLD)

    # Sort by y then x (row-major order)
    boxes.sort(key=lambda b: (b.y, b.x))

    return boxes, orig_w, orig_h
