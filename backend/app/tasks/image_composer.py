from io import BytesIO
from PIL import Image


def compose_images(
    background_bytes: bytes,
    overlay_bytes: bytes,
    x: int,
    y: int,
    width: int,
    opacity: float,
) -> bytes:
    background = Image.open(BytesIO(background_bytes)).convert("RGBA")
    overlay = Image.open(BytesIO(overlay_bytes)).convert("RGBA")

    ratio = width / overlay.width
    height = int(overlay.height * ratio)
    overlay = overlay.resize((width, height))

    if opacity < 1:
        alpha = overlay.getchannel("A")
        alpha = alpha.point(lambda value: int(value * opacity))
        overlay.putalpha(alpha)

    background.alpha_composite(overlay, dest=(x, y))

    output = BytesIO()
    background.convert("RGB").save(output, format="PNG")
    return output.getvalue()
