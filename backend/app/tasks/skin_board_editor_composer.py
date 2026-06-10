from dataclasses import dataclass
from io import BytesIO
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

from app.tasks.skin_board_composer import (
    apply_overlay,
    build_horizontal_row,
    resize_by_height,
)


@dataclass
class EditorComposeItem:
    skin_bytes: bytes
    use_button: bool = False
    button_bytes: Optional[bytes] = None
    use_kill_notification: bool = False
    kill_notification_bytes: Optional[bytes] = None
    compose_mode: str = "inside_skin"
    button_position: str = "center_pct_75"
    button_width_ratio: float = 0.35
    kill_notification_position: str = "center_pct_50"
    kill_notification_width_ratio: float = 1.0


@dataclass
class EditorSkinRowData:
    """Skin row rendering data."""
    skin_bytes_list: list  # list of bytes, each is a skin with overlays applied
    x: int = 0
    y: int = 0
    skin_height: int = 320
    skin_gap: int = 0
    border_size: int = 5
    border_padding: int = 4
    border_color: str = "#ffffff"
    scale: float = 1.0
    z_index: int = 5
    align: str = "left"
    stretch_fit: bool = False


@dataclass
class EditorExtraImageData:
    """An extra overlay image from catalogue."""
    image_bytes: bytes
    x: int = 0
    y: int = 0
    width: int = 180
    height: int = 0  # 0 = auto (keep ratio)
    scale: float = 1.0
    border_size: int = 0
    border_padding: int = 0
    border_color: str = "#ffffff"
    opacity: float = 1.0
    rotation: float = 0.0
    z_index: int = 10


@dataclass
class EditorCountedImageTextData:
    font_size: int = 32
    font_color: str = "#ffffff"
    stroke_color: str = "#000000"
    stroke_width: int = 2
    position: str = "bottom_right"
    offset_x: int = -4
    offset_y: int = -4


@dataclass
class EditorCountedImageLayerData:
    """A counted image layer with quantity text."""
    image_bytes: bytes
    counted_image_id: Optional[str] = None
    quantity: int = 0
    x: int = 0
    y: int = 0
    width: int = 90
    border_size: int = 2
    border_color: str = "#ffffff"
    opacity: float = 1.0
    z_index: int = 20
    text: EditorCountedImageTextData = None

    def __post_init__(self):
        if self.text is None:
            self.text = EditorCountedImageTextData()


@dataclass
class EditorRenderOptions:
    """Top-level editor render options."""
    skin_row: EditorSkinRowData
    skin_placement: str = "inside_background"
    wr_placement: str = "inside_background"
    merged: bool = False
    section_gap: int = 0
    background_color: str = "#000000"
    win_rate_row: Optional[EditorSkinRowData] = None
    extra_images: list = None  # list[EditorExtraImageData]
    counted_image_layers: list = None  # list[EditorCountedImageLayerData]
    overflow_mode: str = "crop"

    def __post_init__(self):
        if self.extra_images is None:
            self.extra_images = []
        if self.counted_image_layers is None:
            self.counted_image_layers = []


def _add_border(
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
    inner_x = border_size + padding
    inner_y = border_size + padding
    canvas.paste(image, (inner_x, inner_y), image if image.mode == "RGBA" else None)
    return canvas


def _apply_opacity(image: Image.Image, opacity: float) -> Image.Image:
    """Adjust image alpha channel by opacity factor."""
    if opacity >= 1.0:
        return image
    img = image.convert("RGBA")
    r, g, b, a = img.split()
    a = a.point(lambda x: int(x * opacity))
    return Image.merge("RGBA", (r, g, b, a))


def _paste_layer(
    background: Image.Image,
    overlay: Image.Image,
    x: int, y: int,
) -> Image.Image:
    """Paste overlay onto background with alpha compositing. Crops overflow."""
    bg = background.copy()
    bg.paste(overlay, (x, y), overlay if overlay.mode == "RGBA" else None)
    return bg


def _compose_skin_row_image(
    items: list[EditorComposeItem],
    sr: EditorSkinRowData,
) -> Image.Image:
    """Build and return the rendered skin row image."""
    processed: list[Image.Image] = []
    for item in items:
        skin = Image.open(BytesIO(item.skin_bytes)).convert("RGBA")
        skin = resize_by_height(skin, sr.skin_height)

        if item.use_button and item.button_bytes:
            btn = Image.open(BytesIO(item.button_bytes)).convert("RGBA")
            skin = apply_overlay(skin, btn, position=item.button_position, width_ratio=item.button_width_ratio)

        if item.use_kill_notification and item.kill_notification_bytes:
            ntf = Image.open(BytesIO(item.kill_notification_bytes)).convert("RGBA")
            skin = apply_overlay(skin, ntf, position=item.kill_notification_position, width_ratio=item.kill_notification_width_ratio)

        processed.append(skin)

    if not processed:
        raise ValueError("Không có ảnh skin nào để ghép")

    row_img, _, _ = build_horizontal_row(processed, sr.skin_gap)

    if sr.border_size > 0:
        row_img = _add_border(row_img, sr.border_size, sr.border_padding, sr.border_color)

    if sr.scale != 1.0 and sr.scale > 0:
        sw = int(row_img.width * sr.scale)
        sh = int(row_img.height * sr.scale)
        row_img = row_img.resize((sw, sh), Image.LANCZOS)

    return row_img


def compose_skin_board_editor_v2(
    background_bytes: bytes,
    items: list[EditorComposeItem],
    editor: EditorRenderOptions,
) -> bytes:
    """
    Unified render for v2 editor. Supports two skin_placement modes:
      - inside_background: skin row + extra images placed inside background canvas
      - below_background: background on top, skin row below, extra images anywhere
    All layers sorted by z_index, then pasted in order.
    """
    bg = Image.open(BytesIO(background_bytes)).convert("RGBA")
    sr = editor.skin_row

    # ── Build skin row image ──────────────────────
    row_img = None
    row_w = 0
    row_h = 0
    if items:
        print(f"[debug] composing skin row with {len(items)} items, skin_height={sr.skin_height}, gap={sr.skin_gap}, border={sr.border_size}, scale={sr.scale}")
        row_img = _compose_skin_row_image(items, sr)
        print(f"[debug] skin row size: {row_img.size}")
    else:
        print("[debug] NO ITEMS to compose skin row")

    # ── Build extra image layers ──────────────────
    extra_layers: list[tuple[int, Image.Image, int, int]] = []
    for ext in (editor.extra_images or []):
        ext_img = Image.open(BytesIO(ext.image_bytes)).convert("RGBA")
        if ext.height > 0:
            ext_img = ext_img.resize((ext.width, ext.height), Image.LANCZOS)
        else:
            ratio = ext.width / ext_img.width
            new_h = int(ext_img.height * ratio)
            ext_img = ext_img.resize((ext.width, new_h), Image.LANCZOS)
        if ext.scale != 1.0 and ext.scale > 0:
            sw = int(ext_img.width * ext.scale)
            sh = int(ext_img.height * ext.scale)
            ext_img = ext_img.resize((sw, sh), Image.LANCZOS)
        if ext.border_size > 0:
            cw = ext_img.width + 2 * (ext.border_padding + ext.border_size)
            ch = ext_img.height + 2 * (ext.border_padding + ext.border_size)
            canvas = Image.new("RGBA", (cw, ch), ext.border_color)
            ix = ext.border_size + ext.border_padding
            iy = ext.border_size + ext.border_padding
            canvas.paste(ext_img, (ix, iy), ext_img if ext_img.mode == "RGBA" else None)
            ext_img = canvas
        ext_img = _apply_opacity(ext_img, ext.opacity)
        if ext.rotation != 0:
            ext_img = ext_img.rotate(ext.rotation, expand=True, resample=Image.BICUBIC)
        extra_layers.append((ext.z_index, ext_img, ext.x, ext.y))

    # ── Build counted image layers ────────────────
    def _render_counted_layer(ci: EditorCountedImageLayerData) -> tuple[int, Image.Image, int, int]:
        img = Image.open(BytesIO(ci.image_bytes)).convert("RGBA")
        ratio = ci.width / img.width
        new_h = int(img.height * ratio)
        img = img.resize((ci.width, new_h), Image.LANCZOS)
        # Add border around image
        if ci.border_size > 0:
            img = _add_border(img, ci.border_size, 4, ci.border_color)
        img = _apply_opacity(img, ci.opacity)
        # Draw quantity text
        txt = ci.text
        if txt and ci.quantity > 0:
            draw = ImageDraw.Draw(img)
            font_size = txt.font_size
            font = None
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
            except Exception:
                try:
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
                except Exception:
                    font = ImageFont.load_default()
            qty_str = str(ci.quantity)
            # Position mapping
            anchors = {
                "bottom_right": "rb",
                "bottom_left": "lb",
                "top_right": "rt",
                "top_left": "lt",
                "center": "mm",
            }
            anchor = anchors.get(txt.position, "rb")
            offset_map = {
                "bottom_right": (img.width + txt.offset_x, img.height + txt.offset_y),
                "bottom_left": (txt.offset_x, img.height + txt.offset_y),
                "top_right": (img.width + txt.offset_x, txt.offset_y),
                "top_left": (txt.offset_x, txt.offset_y),
                "center": (img.width // 2, img.height // 2),
            }
            tx, ty = offset_map.get(txt.position, (img.width + txt.offset_x, img.height + txt.offset_y))
            draw.text(
                (tx, ty),
                qty_str,
                fill=txt.font_color,
                font=font,
                stroke_width=txt.stroke_width,
                stroke_fill=txt.stroke_color,
                anchor=anchor,
            )
        return (ci.z_index, img, ci.x, ci.y)

    for ci in (editor.counted_image_layers or []):
        extra_layers.append(_render_counted_layer(ci))

    # ── Build win_rate row if not merged ──────────
    wr_img = None
    wr_h = 0
    wr_row = editor.win_rate_row
    if wr_row and not editor.merged and wr_row.skin_bytes_list:
        # Build WR items from bytes list
        wr_items_compose: list[EditorComposeItem] = []
        for b in wr_row.skin_bytes_list:
            wr_items_compose.append(EditorComposeItem(skin_bytes=b))
        if wr_items_compose:
            wr_img = _compose_skin_row_image(wr_items_compose, wr_row)

    # ── Stretch fit ───────────────────────────────
    def _stretch(img, flag):
        if img and flag:
            return img.resize((bg.width, int(img.height * bg.width / img.width)), Image.LANCZOS)
        return img

    row_img = _stretch(row_img, editor.skin_placement == "below_background" and editor.skin_row.stretch_fit)
    wr_img = _stretch(wr_img, editor.win_rate_row and editor.wr_placement == "below_background" and editor.win_rate_row.stretch_fit) if wr_img else None

    print(f"[debug] render: skin_placement={editor.skin_placement}, wr_placement={editor.wr_placement}, merged={editor.merged}, row_img={'yes' if row_img else 'no'}, wr_img={'yes' if wr_img else 'no'}")
    # ── Determine canvas and compose layers ─────
    if editor.skin_placement == "below_background" or editor.wr_placement == "below_background" or editor.merged:
        # Compute total height for below-placement rows
        rr = row_img.size if row_img else (0, 0)
        ww = wr_img.size if wr_img else (0, 0)
        cw = max(bg.width, rr[0], ww[0])
        total_h = bg.height
        # Add skin row if below
        if editor.skin_placement == "below_background" and row_img:
            total_h += editor.section_gap + rr[1]
        # Add wr row if below
        if not editor.merged and editor.wr_placement == "below_background" and wr_img:
            total_h += editor.section_gap + ww[1]
        # If merged and below, single row
        if editor.merged and editor.skin_placement == "below_background" and row_img:
            total_h = bg.height + editor.section_gap + rr[1]

        canvas = Image.new("RGBA", (cw, total_h), editor.background_color)
        canvas.paste(bg, (0, 0), bg if bg.mode == "RGBA" else None)
        cur_y = bg.height

        all_layers = list(extra_layers)

        if row_img:
            if editor.skin_placement == "below_background" or editor.merged:
                sx = (cw - rr[0]) // 2 if sr.align == "center" else sr.x
                sy = cur_y + editor.section_gap
                cur_y = sy + rr[1]
                all_layers.append((sr.z_index, row_img, sx, sy))
            else:
                all_layers.append((sr.z_index, row_img, sr.x, sr.y))

        if wr_img and not editor.merged:
            wr_sr = editor.win_rate_row
            if editor.wr_placement == "below_background":
                wx = (cw - ww[0]) // 2 if wr_sr.align == "center" else wr_sr.x
                wy = cur_y + editor.section_gap
                all_layers.append((wr_sr.z_index, wr_img, wx, wy))
            else:
                all_layers.append((wr_sr.z_index, wr_img, wr_sr.x, wr_sr.y))

        all_layers.sort(key=lambda t: t[0])
        for _, l_img, lx, ly in all_layers:
            canvas = _paste_layer(canvas, l_img, lx, ly)
    else:
        # All inside_background: paste onto background directly
        if row_img and editor.skin_row.stretch_fit:
            row_img = row_img.resize((bg.width, int(row_img.height * bg.width / row_img.width)), Image.LANCZOS)
        canvas = bg.copy()
        all_layers = []
        if row_img:
            all_layers.append((sr.z_index, row_img, sr.x, sr.y))
        if wr_img and not editor.merged:
            wr_sr = editor.win_rate_row
            all_layers.append((wr_sr.z_index, wr_img, wr_sr.x, wr_sr.y))
        all_layers.extend(extra_layers)
        all_layers.sort(key=lambda t: t[0])
        for _, l_img, lx, ly in all_layers:
            canvas = _paste_layer(canvas, l_img, lx, ly)

    output = BytesIO()
    canvas.convert("RGB").save(output, format="PNG")
    return output.getvalue()
