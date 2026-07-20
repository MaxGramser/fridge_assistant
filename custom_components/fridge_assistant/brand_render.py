"""Brand artwork for Fridge Assistant — the app icon + wordmark.

Pure Pillow, no Home Assistant imports, so it can be run anywhere Pillow is
available::

    python3 brand_render.py            # writes icon/logo PNGs next to this file

The icon is a blue "squircle" badge with a clean white fridge glyph, matching
the panel's accent (#007AFF). Everything is drawn at 4x and downscaled for
crisp anti-aliased edges. Corners are transparent (RGBA).
"""

from __future__ import annotations

import io
import os
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_DIR = os.path.join(os.path.dirname(__file__), "data", "fonts")

try:  # Pillow >= 9.1
    _LANCZOS = Image.Resampling.LANCZOS
except AttributeError:  # pragma: no cover - old Pillow
    _LANCZOS = Image.LANCZOS

SS = 4  # supersampling factor

# Palette (matches the panel accent).
BLUE_TOP = (56, 156, 255)
BLUE_BOT = (0, 118, 255)
BLUE_TOP_DARK = (34, 116, 216)
BLUE_BOT_DARK = (0, 86, 194)
INK = (28, 28, 30)
DETAIL = (0, 110, 245)          # fridge seam/handles on the white body
DETAIL_DARK = (0, 92, 210)


def _lerp(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def _font(name: str, size: int):
    try:
        return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
    except OSError:  # pragma: no cover - fallback
        return ImageFont.load_default()


def _vertical_gradient(w: int, h: int, top, bot) -> Image.Image:
    grad = Image.new("RGB", (1, h))
    px = grad.load()
    for y in range(h):
        px[0, y] = _lerp(top, bot, y / max(1, h - 1))
    return grad.resize((w, h))


def _fridge_glyph(d: ImageDraw.ImageDraw, box, detail, body=(255, 255, 255, 255)):
    """Draw a white fridge with a seam + two handles inside ``box`` (RGBA draw)."""
    fx, fy, fw, fh = box
    fr = int(fw * 0.14)
    d.rounded_rectangle([fx, fy, fx + fw, fy + fh], radius=fr, fill=body)
    # Door seam ~40% down.
    seam_y = fy + int(fh * 0.40)
    lw = max(2, int(fw * 0.045))
    d.rectangle([fx, seam_y - lw // 2, fx + fw, seam_y + lw // 2], fill=detail)
    # Two handles near the right opening edge (fridge above, freezer below).
    hw = max(2, int(fw * 0.05))
    hx = fx + fw - int(fw * 0.20)
    d.rounded_rectangle(
        [hx, seam_y - int(fh * 0.22), hx + hw, seam_y - int(fh * 0.06)],
        radius=hw, fill=detail,
    )
    d.rounded_rectangle(
        [hx, seam_y + int(fh * 0.06), hx + hw, seam_y + int(fh * 0.22)],
        radius=hw, fill=detail,
    )


def render_icon(size: int = 512, dark: bool = False) -> Image.Image:
    """The app icon: rounded blue badge + white fridge, transparent corners."""
    W = size * SS
    top = BLUE_TOP_DARK if dark else BLUE_TOP
    bot = BLUE_BOT_DARK if dark else BLUE_BOT
    detail = (DETAIL_DARK if dark else DETAIL) + (255,)

    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))

    # Badge: gradient clipped to a rounded-square mask.
    pad = int(W * 0.055)
    radius = int(W * 0.235)
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [pad, pad, W - pad, W - pad], radius=radius, fill=255
    )
    badge = _vertical_gradient(W, W, top, bot).convert("RGBA")
    img.paste(badge, (0, 0), mask)

    # Soft top highlight for a little depth.
    hl = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse(
        [pad, pad - int(W * 0.28), W - pad, int(W * 0.40)],
        fill=(255, 255, 255, 34),
    )
    img = Image.alpha_composite(img, Image.composite(
        hl, Image.new("RGBA", (W, W), (0, 0, 0, 0)), mask))

    # Fridge geometry.
    fw = int(W * 0.40)
    fh = int(W * 0.56)
    fx = (W - fw) // 2
    fy = int(W * 0.205)

    # Drop shadow under the fridge.
    shadow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [fx, fy + int(W * 0.02), fx + fw, fy + fh + int(W * 0.02)],
        radius=int(fw * 0.14), fill=(0, 30, 74, 105),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(W * 0.018))
    img = Image.alpha_composite(img, shadow)

    _fridge_glyph(ImageDraw.Draw(img), (fx, fy, fw, fh), detail)
    return img.resize((size, size), _LANCZOS)


def render_logo(height: int = 256, dark: bool = False) -> Image.Image:
    """Horizontal wordmark: small icon + 'Fridge Assistant', tightly trimmed."""
    H = height * SS  # supersampled; downscaled to ``height`` at the end
    icon = render_icon(H, dark).convert("RGBA")

    word1, word2 = "Fridge", "Assistant"
    font = _font("DejaVuSans-Bold.ttf", int(H * 0.34))
    ink = (255, 255, 255) if dark else INK
    accent = (94, 178, 255) if dark else BLUE_BOT

    tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    gap = int(H * 0.06)
    w1 = tmp.textlength(word1 + " ", font=font)
    w2 = tmp.textlength(word2, font=font)
    text_w = int(w1 + w2)
    pad_r = int(H * 0.10)

    total_w = H + gap + text_w + pad_r
    img = Image.new("RGBA", (total_w, H), (0, 0, 0, 0))
    img.alpha_composite(icon, (0, 0))
    d = ImageDraw.Draw(img)
    _, top, _, bottom = d.textbbox((0, 0), word1, font=font)
    ty = (H - (bottom - top)) // 2 - top
    tx = H + gap
    d.text((tx, ty), word1 + " ", font=font, fill=ink)
    d.text((tx + w1, ty), word2, font=font, fill=accent)
    return img.resize((max(1, round(total_w / SS)), height), _LANCZOS)


# --- dev hook: render a named asset to PNG bytes ---------------------------
def render_asset_png(spec: dict[str, Any]) -> bytes:
    """Dispatch used by the export pipeline. ``spec`` carries _brand/_size/_dark."""
    kind = spec.get("_brand")
    dark = bool(spec.get("_dark"))
    size = int(spec.get("_size") or 512)
    if kind == "logo":
        img = render_logo(size, dark)
    else:
        img = render_icon(size, dark)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


if __name__ == "__main__":  # pragma: no cover
    render_icon(512).save("icon@2x.png")
    render_icon(256).save("icon.png")
    render_icon(512, dark=True).save("dark_icon@2x.png")
    render_icon(256, dark=True).save("dark_icon.png")
    render_logo(512).save("logo@2x.png")
    render_logo(256).save("logo.png")
    render_logo(512, dark=True).save("dark_logo@2x.png")
    render_logo(256, dark=True).save("dark_logo.png")
    print("wrote brand assets")
