"""Render a beautiful food label for the DYMO 99014 label.

Tested with a **DYMO LabelWriter 550** and **99014** labels (54 x 101 mm).

The label is rendered as a portrait PNG at the printer's native 300 dpi
(642 x 1192 px). This module is pure Pillow with no Home Assistant imports so
it can be exercised and previewed in isolation.
"""

from __future__ import annotations

import io
import os
from datetime import date, datetime
from typing import Any

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = os.path.join(os.path.dirname(__file__), "data", "fonts")

# --- 99014 geometry -------------------------------------------------------
# 54 x 101 mm, portrait, 300 dpi. CUPS media name = w154h286 (points).
DPI = 300
LABEL_W = 642
LABEL_H = 1192
LABEL_MEDIA = "w154h286"
LABEL_NAME = "99014"
PRINTER_NAME = "DYMO LabelWriter 550"

BLACK = 0
WHITE = 255

MONTHS = {
    "nl": ["", "jan", "feb", "mrt", "apr", "mei", "jun",
           "jul", "aug", "sep", "okt", "nov", "dec"],
    "en": ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
}

STRINGS = {
    "nl": {
        "code": "ITEMCODE",
        "added": "INGELEGD",
        "eat_before": "EET VOOR",
        "contents": "WAT ZIT ERIN",
        "servings": "HOEVEELHEID",
        "days_left": "nog {n} dagen",
        "one_day": "nog 1 dag",
        "today": "vandaag opeten!",
        "expired": "OVER DATUM",
        "expired_days": "{n} dagen over datum",
        "no_date": "geen datum",
        "brand": "FRIDGE ASSISTANT",
    },
    "en": {
        "code": "ITEM CODE",
        "added": "STORED",
        "eat_before": "EAT BEFORE",
        "contents": "WHAT'S INSIDE",
        "servings": "SERVINGS",
        "days_left": "{n} days left",
        "one_day": "1 day left",
        "today": "eat today!",
        "expired": "EXPIRED",
        "expired_days": "{n} days past date",
        "no_date": "no date",
        "brand": "FRIDGE ASSISTANT",
    },
}


# --- fonts -----------------------------------------------------------------
_FONT_CACHE: dict[tuple[str, int], Any] = {}


def _font(name: str, size: int):
    key = (name, size)
    cached = _FONT_CACHE.get(key)
    if cached is not None:
        return cached
    path = os.path.join(FONT_DIR, name)
    try:
        font = ImageFont.truetype(path, size)
    except OSError:
        font = ImageFont.load_default()
    _FONT_CACHE[key] = font
    return font


def sans(size: int):
    return _font("DejaVuSans.ttf", size)


def sans_bold(size: int):
    return _font("DejaVuSans-Bold.ttf", size)


def cond_bold(size: int):
    return _font("DejaVuSansCondensed-Bold.ttf", size)


def mono_bold(size: int):
    return _font("DejaVuSansMono-Bold.ttf", size)


# --- drawing helpers -------------------------------------------------------
def _text_size(draw, text, font):
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    return r - l, b - t, l, t


def _draw_text(draw, xy, text, font, fill=BLACK, anchor=None):
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)


def _draw_tracked(draw, xy, text, font, fill=BLACK, tracking=6, anchor_center=None):
    """Draw uppercase label text with manual letter-spacing (tracking)."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1 if text else 0)
    x, y = xy
    if anchor_center is not None:
        x = anchor_center - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking
    return total


def _fit_font(draw, text, font_factory, max_w, start, min_size=28, step=3):
    size = start
    while size > min_size:
        font = font_factory(size)
        if draw.textlength(text, font=font) <= max_w:
            return font, size
        size -= step
    return font_factory(min_size), min_size


def _wrap(draw, text, font, max_w, max_lines):
    words = str(text).split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
            if len(lines) == max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    # Ellipsize an overflowing final line.
    if len(lines) == max_lines and cur:
        last = lines[-1]
        remaining = len(" ".join(words)) > len(" ".join(lines))
        if remaining:
            while last and draw.textlength(last + "…", font=font) > max_w:
                last = last[:-1]
            lines[-1] = last.rstrip() + "…"
    return lines


# --- Code 39 barcode (self contained, scannable) ---------------------------
_C39 = {
    "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
    "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
    "8": "wnnwnnwnn", "9": "nnwwnnwnn", "A": "wnnnnwnnw", "B": "nnwnnwnnw",
    "C": "wnwnnwnnn", "D": "nnnnwwnnw", "E": "wnnnwwnnn", "F": "nnwnwwnnn",
    "G": "nnnnnwwnw", "H": "wnnnnwwnn", "I": "nnwnnwwnn", "J": "nnnnwwwnn",
    "K": "wnnnnnnww", "L": "nnwnnnnww", "M": "wnwnnnnwn", "N": "nnnnwnnww",
    "O": "wnnnwnnwn", "P": "nnwnwnnwn", "Q": "nnnnnnwww", "R": "wnnnnnwwn",
    "S": "nnwnnnwwn", "T": "nnnnwnwwn", "U": "wwnnnnnnw", "V": "nwwnnnnnw",
    "W": "wwwnnnnnn", "X": "nwnnwnnnw", "Y": "wwnnwnnnn", "Z": "nwwnwnnnn",
    "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "$": "nwnwnwnnn",
    "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn", "*": "nwnnwnwnn",
}


def _draw_barcode(draw, code, cx, top, height, narrow=3, ratio=3):
    """Draw a Code 39 barcode centred on ``cx``. Returns (width, bottom)."""
    payload = "*" + str(code).upper() + "*"
    wide = narrow * ratio
    # Compute total width first (for centring). 1 narrow gap between chars.
    def char_w(ch):
        return sum(wide if e == "w" else narrow for e in _C39[ch])
    total = sum(char_w(c) for c in payload) + narrow * (len(payload) - 1)
    x = cx - total / 2
    for i, ch in enumerate(payload):
        pattern = _C39.get(ch)
        if not pattern:
            continue
        bar = True  # patterns start with a bar, then alternate
        for e in pattern:
            w = wide if e == "w" else narrow
            if bar:
                draw.rectangle([x, top, x + w - 1, top + height], fill=BLACK)
            x += w
            bar = not bar
        if i < len(payload) - 1:
            x += narrow  # inter-character gap (space)
    return total, top + height


# --- date helpers ----------------------------------------------------------
def _parse(value):
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _fmt_date(d, lang):
    if d is None:
        return None
    months = MONTHS.get(lang, MONTHS["nl"])
    return f"{d.day} {months[d.month]} {d.year}"


# --- main entry ------------------------------------------------------------
def render_label(item: dict[str, Any], ctx: dict[str, Any] | None = None) -> Image.Image:
    """Render ``item`` into a 642x1192 grayscale label image."""
    ctx = ctx or {}
    lang = ctx.get("lang", "en")
    s = STRINGS.get(lang, STRINGS["en"])
    today = ctx.get("today") or date.today()
    if isinstance(today, str):
        today = _parse(today) or date.today()

    location_label = (ctx.get("location_label") or item.get("location") or "").upper()
    kind_label = (ctx.get("kind_label") or "").upper()

    img = Image.new("L", (LABEL_W, LABEL_H), WHITE)
    d = ImageDraw.Draw(img)

    MX = 34
    inner_w = LABEL_W - 2 * MX
    cx = LABEL_W // 2

    # Outer frame
    d.rounded_rectangle([12, 12, LABEL_W - 13, LABEL_H - 13],
                        radius=30, outline=BLACK, width=3)

    y = 40

    # 1) Location banner (inverted bar) --------------------------------------
    bar_h = 92
    d.rounded_rectangle([MX, y, LABEL_W - MX, y + bar_h], radius=20, fill=BLACK)
    # Compact banner text: first word of the localized label, so
    # "Buiten koelkast" -> "BUITEN" and "Fridge" -> "FRIDGE".
    loc_compact = (location_label.split()[0] if location_label else "").upper()
    # Kind chip on the right — computed first so the location text can dodge it.
    chip_left = LABEL_W - MX - 22
    if kind_label:
        kf = sans_bold(26)
        kw = d.textlength(kind_label, font=kf)
        chip_pad = 16
        chip_w = kw + chip_pad * 2
        chip_x = LABEL_W - MX - 22 - chip_w
        d.rounded_rectangle([chip_x, y + 24, chip_x + chip_w, y + bar_h - 24],
                            radius=13, outline=WHITE, width=2)
        _, kh, _, kt = _text_size(d, kind_label, kf)
        d.text((chip_x + chip_pad, y + (bar_h - kh) / 2 - kt), kind_label,
               font=kf, fill=WHITE)
        chip_left = chip_x
    # Location text, auto-fit into the space left of the chip.
    loc_avail = chip_left - (MX + 28) - 20
    loc_font, _ = _fit_font(d, loc_compact or " ", cond_bold, loc_avail,
                            start=52, min_size=30)
    _, lh, _, lt = _text_size(d, loc_compact or " ", loc_font)
    d.text((MX + 28, y + (bar_h - lh) / 2 - lt), loc_compact,
           font=loc_font, fill=WHITE)
    y += bar_h + 26

    # 2) Item name -----------------------------------------------------------
    name = str(item.get("name") or "—").strip()
    name_font, _ = _fit_font(d, name, cond_bold, inner_w, start=104, min_size=52)
    lines = _wrap(d, name, name_font, inner_w, max_lines=2)
    if len(lines) > 1:
        name_font, _ = _fit_font(d, max(lines, key=len), cond_bold,
                                 inner_w, start=name_font.size, min_size=44)
        lines = _wrap(d, name, name_font, inner_w, max_lines=2)
    for line in lines:
        lw = d.textlength(line, font=name_font)
        asc, desc = name_font.getmetrics()
        d.text((cx - lw / 2, y), line, font=name_font, fill=BLACK)
        y += asc + desc + 2
    y += 18

    # 3) Hero code + barcode -------------------------------------------------
    code = str(item.get("code") or "----").upper()
    hero_top = y
    d.line([MX, y, LABEL_W - MX, y], fill=BLACK, width=2)
    y += 22
    _draw_tracked(d, (0, y), s["code"], sans_bold(26), tracking=10,
                  anchor_center=cx)
    y += 40
    code_font, _ = _fit_font(d, code, mono_bold, inner_w - 40, start=176,
                             min_size=90)
    cw, ch, cl, ct = _text_size(d, code, code_font)
    d.text((cx - cw / 2 - cl, y), code, font=code_font, fill=BLACK)
    y += ch + 56
    _draw_barcode(d, code, cx, y, height=108, narrow=3, ratio=3)
    y += 108 + 24
    d.line([MX, y, LABEL_W - MX, y], fill=BLACK, width=2)
    y += 22
    del hero_top

    # 4) Stored date ---------------------------------------------------------
    added = _parse(item.get("added_date"))
    added_str = _fmt_date(added, lang) or s["no_date"]
    _draw_tracked(d, (MX, y), s["added"], sans_bold(26), tracking=6)
    y += 38
    d.text((MX, y), added_str, font=sans_bold(46), fill=BLACK)
    y += 66

    # 5) Eat-before block — the actionable hero, always inverted -------------
    # (A physical label is only ever printed for a still-good item, and a
    # "X days left" countdown is only true on the print date, so we drop it and
    # keep the strong black "EAT BEFORE <date>" panel.)
    expiry = _parse(item.get("expiry_date"))
    exp_str = _fmt_date(expiry, lang) or s["no_date"]
    label_font = sans_bold(26)
    exp_font, _ = _fit_font(d, exp_str, sans_bold, inner_w - 56, start=58,
                            min_size=34)
    # Measure both lines and size the box so top and bottom padding are equal.
    _, lh2, _, lt2 = _text_size(d, s["eat_before"], label_font)
    _, ehh, _, et = _text_size(d, exp_str, exp_font)
    gap_ld = 16      # gap between the "EET VOOR" label and the big date
    pad = 24         # equal top/bottom padding inside the box
    content_h = lh2 + gap_ld + ehh
    box_h = content_h + 2 * pad
    box_top = y
    d.rounded_rectangle([MX, box_top, LABEL_W - MX, box_top + box_h],
                        radius=20, fill=BLACK)
    fg = WHITE
    ly = box_top + pad
    _draw_tracked(d, (MX + 28, ly - lt2), s["eat_before"], label_font,
                  fill=fg, tracking=6)
    dy = ly + lh2 + gap_ld
    d.text((MX + 28, dy - et), exp_str, font=exp_font, fill=fg)
    y = box_top + box_h + 24

    # 6) Contents (only as much as fits above the footer) --------------------
    contents = str(item.get("contents") or "").strip()
    quantity = str(item.get("quantity") or "").strip()
    # Reserve a taller footer band when there's a quantity to show.
    footer_top = LABEL_H - (132 if quantity else 70)
    if contents and y < footer_top - 56:
        _draw_tracked(d, (MX, y), s["contents"], sans_bold(26), tracking=6)
        y += 40
        cfont = sans(38)
        line_h = 46
        max_lines = max(1, min(3, int((footer_top - y) // line_h)))
        for line in _wrap(d, contents, cfont, inner_w, max_lines=max_lines):
            d.text((MX, y), line, font=cfont, fill=BLACK)
            y += line_h

    # 7) Footer — the quantity ("how much / how many servings") lives here.
    # It replaces the old label-type stamp because it's what you actually want
    # to read at a glance. Falls back to the brand line when there's no amount.
    if quantity:
        line_y = LABEL_H - 126
        d.line([MX, line_y, LABEL_W - MX, line_y], fill=BLACK, width=2)
        _draw_tracked(d, (MX, line_y + 16), s["servings"], sans_bold(26),
                      tracking=6)
        qfont, _ = _fit_font(d, quantity, sans_bold, inner_w, start=54,
                             min_size=32)
        _, _, _, qt = _text_size(d, quantity, qfont)
        d.text((MX, line_y + 54 - qt), quantity, font=qfont, fill=BLACK)
    else:
        foot_y = LABEL_H - 70
        d.line([MX, foot_y - 16, LABEL_W - MX, foot_y - 16], fill=BLACK, width=2)
        _draw_tracked(d, (0, foot_y), s["brand"], sans_bold(24), tracking=4,
                      anchor_center=cx)

    return img


def render_png(item: dict[str, Any], ctx: dict[str, Any] | None = None) -> bytes:
    """Render ``item`` and return PNG bytes (300 dpi metadata set)."""
    if item.get("_brand"):
        # Dev hook: reuse the reload-able render pipeline to generate the
        # integration's brand artwork (icon/logo). Not used at runtime.
        import importlib

        from . import brand_render

        importlib.reload(brand_render)
        return brand_render.render_asset_png(item)
    img = render_label(item, ctx)
    buf = io.BytesIO()
    img.save(buf, format="PNG", dpi=(DPI, DPI))
    return buf.getvalue()


# --- standalone preview ----------------------------------------------------
if __name__ == "__main__":
    import sys

    sample = {
        "code": "MV12",
        "name": "Macaroni met gehakt en groenten",
        "contents": "restje van zondag, dubbele portie",
        "location": "freezer",
        "added_date": "2026-07-20",
        "expiry_date": "2026-09-20",
        "quantity": "2 bakjes",
    }
    ctx = {"lang": "nl", "location_label": "Vriezer", "kind_label": "Gerecht",
           "today": "2026-07-20"}
    out = sys.argv[1] if len(sys.argv) > 1 else "label_preview.png"
    render_label(sample, ctx).save(out)
    print("wrote", out)
