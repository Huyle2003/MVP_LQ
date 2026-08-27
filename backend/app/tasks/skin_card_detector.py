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

    Combines four signals:
    1. Top border strength — horizontal edge at the card's top edge (Sobel Y)
    2. Card texture — standard deviation inside each card (detailed art = high std)
    3. Gap cleanness — low edge response in gap regions between cards
    4. "Above" quietness — the strip just above y should be comparatively
       plain/background. Without this, a card's BOTTOM edge scores just as
       well as its TOP edge (both are strong horizontal lines with detailed
       content on one side) and the search can lock onto the wrong one —
       this term breaks that tie by rejecting positions where what's above y
       is itself already detailed (i.e. still inside the card).
    """
    h, w = gray.shape[:2]

    border_score = 0.0
    texture_score = 0.0
    gap_penalty = 0.0
    above_texture_penalty = 0.0
    valid_cards = 0
    valid_gaps = 0
    ABOVE_STRIP_HEIGHT = 16

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

        # ── 4. "Above" quietness — disambiguate top edge vs bottom edge ──
        above_top = max(0, y - ABOVE_STRIP_HEIGHT)
        above_region = gray[above_top:y, cx:cx + scw]
        if above_region.size > 0:
            above_texture_penalty += float(np.std(above_region))

    if valid_cards == 0:
        return -999.0

    avg_border = border_score / valid_cards
    avg_texture = texture_score / valid_cards
    avg_gap_penalty = gap_penalty / valid_gaps if valid_gaps > 0 else 0.0
    avg_above_penalty = above_texture_penalty / valid_cards

    # Combined score: strong border + rich texture - messy gaps - detailed
    # content already above y (which would mean y is a bottom edge, not top)
    return avg_border * 2.0 + avg_texture * 0.8 - avg_gap_penalty * 1.5 - avg_above_penalty * 0.8


# How much better a lower (further down) candidate must score before it's
# allowed to steal the match from an earlier, topmost-so-far candidate. Since
# the scan runs top-to-bottom, without this a secondary strong feature below
# the real target (e.g. the circular button icons under a kill-notification
# banner) can outscore the target itself and steal the match — this bias
# keeps the topmost "good enough" position instead of always taking the
# single highest-scoring one.
Y_MATCH_IMPROVEMENT_RATIO = 0.04


def _is_meaningfully_better(new_score: float, best_score: float) -> bool:
    if best_score <= -999.0:
        return True
    margin = max(1.0, abs(best_score) * Y_MATCH_IMPROVEMENT_RATIO)
    return new_score > best_score + margin


def detect_skin_cards(
    image_bytes: bytes,
    card_width: int = 325,
    card_height: int = 515,
    gap_x: int = 25,
    row_count: int = 1,
    count_per_row: int = 5,
    start_x: int = 702,
    search_start_ratio: float = SKIP_TOP_RATIO,
    search_end_ratio: float = 1.0,
) -> tuple[list[CardBox], int, int]:
    """Detect skin cards (or any similarly-laid-out row of cards, e.g. kill
    notification banners) using fixed X and AI-scored Y.

    With known card dimensions and fixed start_x, slides a window
    vertically to find the Y position with the strongest edge response
    across the full card row width. search_start_ratio/search_end_ratio
    bound where in the image (as a fraction of height) that Y search
    happens — narrowing this speeds up the search and avoids false
    matches outside the region the caller knows the row lives in.

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
    search_start_y = int(h * search_start_ratio)
    search_end_y = min(h - sch, int(h * search_end_ratio))
    if search_end_y <= search_start_y:
        search_end_y = h - sch
        search_start_y = int(h * SKIP_TOP_RATIO)

    # Pass 1: coarse search (step=2) for approximate Y
    best_score = -9999.0
    best_y = search_start_y

    for y in range(search_start_y, search_end_y, 2):
        score = _score_y_position(gray, sobel_y, y, sx, scw, sch, sgap, count_per_row)
        if _is_meaningfully_better(score, best_score):
            best_score = score
            best_y = y

    # Pass 2: fine search (±6px around best_y, step=1)
    fine_start = max(search_start_y, best_y - 6)
    fine_end = min(search_end_y, best_y + 6)
    for y in range(fine_start, fine_end, 1):
        score = _score_y_position(gray, sobel_y, y, sx, scw, sch, sgap, count_per_row)
        if _is_meaningfully_better(score, best_score):
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


@dataclass
class RefineContext:
    """Precomputed grayscale + gradient maps for one image.

    Built once per image and reused across every row/column refinement —
    otherwise each refine call would re-run cvtColor + two Sobels over the
    full screenshot, which at ~3.6M pixels per pass adds up fast when a batch
    of screenshots each needs one row plus several column refinements.
    """
    gray: np.ndarray
    sobel_x: np.ndarray
    sobel_y: np.ndarray


def build_refine_context(image_bgr: np.ndarray) -> RefineContext:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    return RefineContext(
        gray=gray,
        sobel_x=np.abs(cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=SOBEL_KERNEL)),
        sobel_y=np.abs(cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=SOBEL_KERNEL)),
    )


def _score_left_edge(
    gray: np.ndarray,
    sobel_x: np.ndarray,
    x: int,
    y: int,
    box_width: int,
    box_height: int,
) -> float:
    """Score how well x looks like the left edge of card content: a strong
    vertical edge right at x, content (texture) just to its right, and
    comparative quiet (background/gap) just to its left. The left/right
    asymmetry is what lets this tell a true left edge apart from a right
    edge or from an edge belonging to the neighboring card."""
    h, w = gray.shape[:2]
    if x < 0 or y < 0 or x + box_width > w or y + box_height > h:
        return -999.0

    edge_strip = sobel_x[y:y + box_height, x:min(x + 2, w)]
    edge_score = float(np.mean(edge_strip)) if edge_strip.size > 0 else 0.0

    inside_w = min(box_width, 40)
    inside = gray[y:y + box_height, x:x + inside_w]
    inside_texture = float(np.std(inside)) if inside.size > 0 else 0.0

    quiet_w = 16
    quiet_start = max(0, x - quiet_w)
    outside = gray[y:y + box_height, quiet_start:x]
    outside_texture = float(np.std(outside)) if outside.size > 0 else 0.0

    return edge_score * 1.5 + inside_texture - outside_texture


def _score_top_edge(
    gray: np.ndarray,
    sobel_y: np.ndarray,
    x: int,
    y: int,
    box_width: int,
    box_height: int,
) -> float:
    """Vertical counterpart of _score_left_edge: a strong horizontal edge
    right at y, content (texture) just below it, and comparative quiet
    (background) just above it. The above/below asymmetry is what tells a
    true top edge apart from the card's own bottom edge."""
    h, w = gray.shape[:2]
    if x < 0 or y < 0 or x + box_width > w or y + box_height > h:
        return -999.0

    edge_strip = sobel_y[y:min(y + 2, h), x:x + box_width]
    edge_score = float(np.mean(edge_strip)) if edge_strip.size > 0 else 0.0

    inside_h = min(box_height, 40)
    inside = gray[y:y + inside_h, x:x + box_width]
    inside_texture = float(np.std(inside)) if inside.size > 0 else 0.0

    quiet_h = 16
    quiet_start = max(0, y - quiet_h)
    outside = gray[quiet_start:y, x:x + box_width]
    outside_texture = float(np.std(outside)) if outside.size > 0 else 0.0

    return edge_score * 1.5 + inside_texture - outside_texture


def refine_row_top_edge(
    ctx: RefineContext,
    x: int,
    y_guess: int,
    box_width: int,
    box_height: int,
    window: int = 24,
) -> int:
    """Nudge a row's top-edge guess to the strongest nearby top-edge signal,
    within ±window px — so a Start Y that's off by 10-20px still crops
    correctly instead of requiring pixel-exact input."""
    h = ctx.gray.shape[0]

    best_y = y_guess
    best_score = _score_top_edge(ctx.gray, ctx.sobel_y, x, y_guess, box_width, box_height)

    lo = max(0, y_guess - window)
    hi = min(h - box_height, y_guess + window)
    for y in range(lo, hi + 1):
        score = _score_top_edge(ctx.gray, ctx.sobel_y, x, y, box_width, box_height)
        if score > best_score:
            best_score = score
            best_y = y

    return best_y


def refine_column_left_edge(
    ctx: RefineContext,
    x_guess: int,
    y: int,
    box_width: int,
    box_height: int,
    window: int = 24,
) -> int:
    """Nudge a fixed-stride column guess to the strongest nearby left-edge
    signal, within ±window px. Real card rows are rarely spaced with
    perfectly uniform pixel gaps (screenshot scaling, engine rounding,
    etc.) — a fixed stride compounds that per-column error, so later
    columns in a row drift further and further off. This bounds each
    column's correction to a small local search around its own expected
    position instead."""
    w = ctx.gray.shape[1]

    best_x = x_guess
    best_score = _score_left_edge(ctx.gray, ctx.sobel_x, x_guess, y, box_width, box_height)

    # Plain argmax (no "prefer earlier" hysteresis, unlike the Y search) —
    # unlike top-vs-bottom for Y, there's no reason to prefer the left-most
    # candidate over the true edge just because it was scanned first, and
    # adding that bias let a neighboring card's own edge (which can score
    # deceptively high) win over the further-but-genuinely-better match.
    lo = max(0, x_guess - window)
    hi = min(w - box_width, x_guess + window)
    for x in range(lo, hi + 1):
        score = _score_left_edge(ctx.gray, ctx.sobel_x, x, y, box_width, box_height)
        if score > best_score:
            best_score = score
            best_x = x

    return best_x
