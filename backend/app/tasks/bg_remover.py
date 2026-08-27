"""Automatic background removal for a single cropped image.

Kill-notification banners have an irregular (wing/feather-shaped) outline —
they don't fill the rectangle they're cropped into, so the corners of the
crop are reliably background pixels. We flood-fill outward from all four
corners using a color-distance tolerance (like a "magic wand" tool), which
only clears pixels actually *connected* to the background — unlike a naive
global color-threshold, this can't punch a transparent hole in the middle of
the artwork even if some inner pixel happens to share the background color.
"""
import cv2
import numpy as np


def remove_background_flood_fill(image_bytes: bytes, tolerance: int = 24) -> bytes:
    img_array = np.frombuffer(image_bytes, np.uint8)
    bgr = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Không thể đọc ảnh")

    h, w = bgr.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    diff = (tolerance, tolerance, tolerance)
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]

    for sx, sy in seeds:
        if mask[sy + 1, sx + 1] == 0:
            cv2.floodFill(
                bgr.copy(),
                mask,
                (sx, sy),
                (0, 0, 0),
                loDiff=diff,
                upDiff=diff,
                flags=4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8),
            )

    fill_mask = mask[1:-1, 1:-1]  # 255 where flooded (background), 0 where kept
    alpha = 255 - fill_mask
    # Feather the mask edges so the cutout isn't jagged/aliased.
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)

    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha

    success, buf = cv2.imencode(".png", bgra)
    if not success:
        raise ValueError("Không thể mã hoá ảnh PNG")
    return buf.tobytes()
