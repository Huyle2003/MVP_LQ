from dataclasses import dataclass
from io import BytesIO
from typing import Optional

from PIL import Image


# ─── Helpers ───────────────────────────────────────────────
def resize_by_height(image: Image.Image, target_height: int) -> Image.Image:
    """Resize image to target height, keeping aspect ratio."""
    ratio = target_height / image.height
    new_w = int(image.width * ratio)
    return image.resize((new_w, target_height), Image.LANCZOS)


def build_horizontal_row(
    images: list[Image.Image], gap: int = 0,
) -> tuple[Image.Image, int, int]:
    """Build a horizontal row from a list of images (same height). Returns (row_img, width, height)."""
    if not images:
        raise ValueError("No images to build row")
    h = images[0].height
    total_w = sum(img.width for img in images)
    if gap > 0 and len(images) > 1:
        total_w += gap * (len(images) - 1)
    canvas = Image.new("RGBA", (total_w, h), (0, 0, 0, 0))
    cx = 0
    for img in images:
        canvas.paste(img, (cx, 0), img if img.mode == "RGBA" else None)
        cx += img.width + gap
    return canvas, total_w, h


def _get_position(
    base_w: int, base_h: int,
    overlay_w: int, overlay_h: int,
    position: str, padding: int = 8,
) -> tuple[int, int]:
    if position == "top_left":
        return (padding, padding)
    elif position == "top_right":
        return (base_w - overlay_w - padding, padding)
    elif position == "bottom_left":
        return (padding, base_h - overlay_h - padding)
    elif position == "center":
        return ((base_w - overlay_w) // 2, (base_h - overlay_h) // 2)
    elif position.startswith("center_pct_"):
        try:
            pct = int(position.removeprefix("center_pct_"))
            pct = max(0, min(100, pct))
            y = int((base_h - overlay_h) * pct / 100)
            x = (base_w - overlay_w) // 2
            return (x, y)
        except (ValueError, AttributeError):
            return ((base_w - overlay_w) // 2, (base_h - overlay_h) // 2)
    else:
        return (base_w - overlay_w - padding, base_h - overlay_h - padding)


def apply_overlay(
    base: Image.Image,
    overlay: Image.Image,
    position: str = "bottom_right",
    width_ratio: float = 0.35,
    padding: int = 8,
) -> Image.Image:
    base = base.convert("RGBA")
    overlay = overlay.convert("RGBA")
    target_w = max(1, int(base.width * width_ratio))
    ratio = target_w / overlay.width
    target_h = int(overlay.height * ratio)
    overlay = overlay.resize((target_w, target_h), Image.LANCZOS)
    x, y = _get_position(base.width, base.height, overlay.width, overlay.height, position, padding)
    base.alpha_composite(overlay, (x, y))
    return base


# ─── Data classes ──────────────────────────────────────────
@dataclass
class SkinComposeItem:
    skin_bytes: bytes
    use_button: bool = False
    button_bytes: Optional[bytes] = None
    use_kill_notification: bool = False
    kill_notification_bytes: Optional[bytes] = None
    compose_mode: str = "inside_skin"
    button_position: str = "bottom_right"
    button_width_ratio: float = 0.35
    kill_notification_position: str = "top_left"
    kill_notification_width_ratio: float = 0.55
    skin_height: Optional[int] = None


@dataclass
class ComposeOptions:
    skin_target_height: int = 330
    skin_gap: int = 0
    skin_margin_top: int = 0
    gap_color: str = "#000000"
    background_mode: str = "fit_width"
    output_format: str = "PNG"
    win_rate_enabled: bool = False
    win_rate_position: str = "below_skin"
    win_rate_target_height: int = 330
    win_rate_gap: int = 0
    section_gap: int = 0
    # V2 fields
    v2_x: int = 870
    v2_y: int = 930
    v2_skin_height: int = 320
    v2_skin_gap: int = 0
    v2_border_padding: int = 4
    v2_border_size: int = 5
    v2_border_color: str = "#ffffff"
    v2_align: str = "left"
    v2_max_width: Optional[int] = None
    v2_overflow_mode: str = "shrink_to_fit"


# ─── Main compose ──────────────────────────────────────────
def _fill_area(canvas: Image.Image, x: int, y: int, w: int, h: int, color: str):
    """Fill a rectangular area on canvas with the given color."""
    if w <= 0 or h <= 0:
        return
    try:
        fill = Image.new("RGBA", (w, h), color)
        canvas.paste(fill, (x, y))
    except Exception:
        fill = Image.new("RGBA", (w, h), "#000000")
        canvas.paste(fill, (x, y))


def compose_skin_board(
    background_bytes: bytes,
    skin_items: list[SkinComposeItem],
    win_rate_images_bytes: Optional[list[bytes]] = None,
    opts: Optional[ComposeOptions] = None,
) -> bytes:
    """Compose a skin board with optional win rate row.

    Layout:
      - Top: background image (resized to fit widest row)
      - (optional) section_gap
      - Row of skin images (centered)
      - (optional) section_gap
      - Row of win rate images (centered, if enabled)
    """
    opts = opts or ComposeOptions()
    gap_color = opts.gap_color

    bg = Image.open(BytesIO(background_bytes)).convert("RGBA")

    # ── Process skins ────────────────────────────
    processed: list[Image.Image] = []
    for item in skin_items:
        skin = Image.open(BytesIO(item.skin_bytes)).convert("RGBA")
        skin = resize_by_height(skin, opts.skin_target_height)

        if item.use_button and item.button_bytes:
            btn_ov = Image.open(BytesIO(item.button_bytes)).convert("RGBA")
            skin = apply_overlay(skin, btn_ov, item.button_position, item.button_width_ratio)
        if item.use_kill_notification and item.kill_notification_bytes:
            ntf_ov = Image.open(BytesIO(item.kill_notification_bytes)).convert("RGBA")
            skin = apply_overlay(skin, ntf_ov, item.kill_notification_position, item.kill_notification_width_ratio)

        processed.append(skin)

    if not processed:
        raise ValueError("Không có ảnh skin nào để ghép")

    skin_row_img, skin_row_w, skin_row_h = build_horizontal_row(processed, opts.skin_gap)

    # ── Process win rate images ──────────────────
    wr_row_img = None
    wr_row_w = wr_row_h = 0
    if opts.win_rate_enabled and win_rate_images_bytes:
        wr_imgs = []
        for wr_bytes in win_rate_images_bytes:
            img = Image.open(BytesIO(wr_bytes)).convert("RGBA")
            img = resize_by_height(img, opts.win_rate_target_height)
            wr_imgs.append(img)
        if wr_imgs:
            wr_row_img, wr_row_w, wr_row_h = build_horizontal_row(wr_imgs, opts.win_rate_gap)

    # ── Determine output width ───────────────────
    output_width = skin_row_w
    if wr_row_img:
        output_width = max(output_width, wr_row_w)

    # Resize background to output_width
    if opts.background_mode == "fit_width":
        bg_ratio = output_width / bg.width
        bg_new_h = int(bg.height * bg_ratio)
        bg = bg.resize((output_width, bg_new_h), Image.LANCZOS)
    else:
        if bg.width < output_width:
            bg_ratio = output_width / bg.width
            bg_new_h = int(bg.height * bg_ratio)
            bg = bg.resize((output_width, bg_new_h), Image.LANCZOS)

    bg_w, bg_h = bg.size

    # ── Calculate canvas height ──────────────────
    canvas_h = bg_h + opts.skin_margin_top + skin_row_h
    if wr_row_img:
        canvas_h += opts.section_gap + wr_row_h

    canvas = Image.new("RGBA", (output_width, canvas_h), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0), bg if bg.mode == "RGBA" else None)

    # Fill skin row area
    row_area_h = opts.skin_margin_top + skin_row_h
    _fill_area(canvas, 0, bg_h, output_width, row_area_h, gap_color)

    # Paste skin row (centered)
    skin_y = bg_h + opts.skin_margin_top
    skin_offset_x = (output_width - skin_row_w) // 2
    canvas.paste(skin_row_img, (skin_offset_x, skin_y), skin_row_img if skin_row_img.mode == "RGBA" else None)

    # Paste win rate row
    if wr_row_img:
        wr_y = bg_h + opts.skin_margin_top + skin_row_h + opts.section_gap
        _fill_area(canvas, 0, wr_y, output_width, wr_row_h, gap_color)
        wr_offset_x = (output_width - wr_row_w) // 2
        canvas.paste(wr_row_img, (wr_offset_x, wr_y), wr_row_img if wr_row_img.mode == "RGBA" else None)

    # ── Output ───────────────────────────────────
    output = BytesIO()
    if opts.output_format.upper() == "JPEG":
        canvas.convert("RGB").save(output, format="JPEG", quality=95)
    else:
        canvas.convert("RGB").save(output, format="PNG")
    return output.getvalue()


# ═══════════════════════════════════════════════════════════
#  V2: Inside-background compose
# ═══════════════════════════════════════════════════════════

def add_border(
    image: Image.Image,
    border_size: int = 5,
    padding: int = 4,
    border_color: str = "#ffffff",
) -> Image.Image:
    """Add a coloured border with padding around an image."""
    iw, ih = image.size
    cw = iw + 2 * (padding + border_size)
    ch = ih + 2 * (padding + border_size)
    canvas = Image.new("RGBA", (cw, ch), border_color)
    # Inner area for the image (padding inside border)
    inner_x = border_size + padding
    inner_y = border_size + padding
    canvas.paste(image, (inner_x, inner_y), image if image.mode == "RGBA" else None)
    return canvas


def paste_overlay(
    background: Image.Image,
    overlay: Image.Image,
    x: int, y: int,
    overflow_mode: str = "shrink_to_fit",
) -> Image.Image:
    """Paste overlay onto background, handling overflow."""
    bg = background.copy()
    ow, oh = overlay.size
    bw, bh = bg.size

    if overflow_mode == "shrink_to_fit":
        # If overlay exceeds background width, scale it down
        if x + ow > bw:
            available_w = bw - x
            if available_w > 0 and ow > available_w:
                ratio = available_w / ow
                new_w = int(ow * ratio)
                new_h = int(oh * ratio)
                overlay = overlay.resize((new_w, new_h), Image.LANCZOS)
        if y + overlay.height > bh:
            available_h = bh - y
            if available_h > 0 and overlay.height > available_h:
                ratio = available_h / overlay.height
                new_w = int(overlay.width * ratio)
                new_h = int(overlay.height * ratio)
                overlay = overlay.resize((new_w, new_h), Image.LANCZOS)
        bg.paste(overlay, (x, y), overlay if overlay.mode == "RGBA" else None)
    elif overflow_mode == "allow":
        # Expand canvas if needed
        need_w = max(bw, x + ow)
        need_h = max(bh, y + oh)
        if need_w > bw or need_h > bh:
            new_bg = Image.new("RGBA", (need_w, need_h), (0, 0, 0, 0))
            new_bg.paste(bg, (0, 0))
            bg = new_bg
        bg.paste(overlay, (x, y), overlay if overlay.mode == "RGBA" else None)
    else:  # crop – just paste as-is, overflow gets cropped by canvas
        bg.paste(overlay, (x, y), overlay if overlay.mode == "RGBA" else None)
    return bg


def compose_skin_board_v2(
    background_bytes: bytes,
    skin_items: list[SkinComposeItem],
    opts: "ComposeOptions",
) -> bytes:
    """V2: Skin row is pasted *inside* the background image at (v2_x, v2_y) with optional border."""
    bg = Image.open(BytesIO(background_bytes)).convert("RGBA")

    # Process skins (same overlays as v1)
    processed: list[Image.Image] = []
    for item in skin_items:
        skin = Image.open(BytesIO(item.skin_bytes)).convert("RGBA")
        h = item.skin_height or (opts.v2_skin_height if hasattr(opts, 'v2_skin_height') and opts.v2_skin_height else opts.skin_target_height)
        skin = resize_by_height(skin, h)

        if item.use_button and item.button_bytes:
            btn = Image.open(BytesIO(item.button_bytes)).convert("RGBA")
            skin = apply_overlay(skin, btn, item.button_position, item.button_width_ratio)
        if item.use_kill_notification and item.kill_notification_bytes:
            ntf = Image.open(BytesIO(item.kill_notification_bytes)).convert("RGBA")
            skin = apply_overlay(skin, ntf, item.kill_notification_position, item.kill_notification_width_ratio)
        processed.append(skin)

    if not processed:
        raise ValueError("Không có ảnh skin nào để ghép")

    # Build horizontal row
    gap = getattr(opts, 'v2_skin_gap', 0)
    row_img, row_w, row_h = build_horizontal_row(processed, gap)

    # Handle alignment within v2_max_width
    max_w = getattr(opts, 'v2_max_width', None)
    align = getattr(opts, 'v2_align', 'left')
    if max_w and max_w > 0 and align == "center" and row_w < max_w:
        # Create a wider canvas for centering
        centered = Image.new("RGBA", (max_w, row_h), (0, 0, 0, 0))
        offset_x = (max_w - row_w) // 2
        centered.paste(row_img, (offset_x, 0), row_img if row_img.mode == "RGBA" else None)
        row_img = centered
        row_w = max_w

    # Add border
    border_size = getattr(opts, 'v2_border_size', 0)
    border_pad = getattr(opts, 'v2_border_padding', 0)
    border_color = getattr(opts, 'v2_border_color', "#ffffff")
    if border_size > 0:
        row_img = add_border(row_img, border_size, border_pad, border_color)

    # Paste inside background
    v2_x = getattr(opts, 'v2_x', 560)
    v2_y = getattr(opts, 'v2_y', 620)
    overflow = getattr(opts, 'v2_overflow_mode', 'shrink_to_fit')
    result = paste_overlay(bg, row_img, v2_x, v2_y, overflow)

    output = BytesIO()
    result.convert("RGB").save(output, format="PNG")
    return output.getvalue()
