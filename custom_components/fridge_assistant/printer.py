"""Label rendering context + printer client for the optional add-on.

Rendering happens here (in Home Assistant Core, which ships Pillow); the label
image is then handed to the generic **Label Printer** add-on over HTTP. The
add-on only prints images/PDFs, so it can be reused for anything.

Add-on contract (``GET /printers``): every queue reports its loaded label as
``native_px`` + ``dpi``. We render exactly those pixels and POST without a
media field — the queue's own loaded-label config does the rest, so sizes are
never hard-coded here. Falls back to the 99014 design canvas when the add-on
is unreachable.
"""

from __future__ import annotations

import importlib
import logging
import time
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util import dt as dt_util

from . import label_render
from .const import (
    CATEGORY_KIND,
    CONF_LABEL_COPIES,
    CONF_PRINTER_ENABLED,
    CONF_PRINTER_URL,
    DEFAULT_KIND,
    DEFAULT_PRINTER_URL,
    kind_label as get_kind_label,
    location_label as get_location_label,
    resolve_language,
)

_LOGGER = logging.getLogger(__name__)


class PrinterError(Exception):
    """Raised when a label cannot be printed."""


# --------------------------------------------------------------------------
# Printer discovery (GET /printers on the add-on)
# --------------------------------------------------------------------------
# A short cache so a batch print (one POST per portion sticker) resolves the
# canvas once instead of hammering the add-on.
_PRINTERS_TTL = 10.0
_printers_cache: dict[str, tuple[float, dict]] = {}


async def async_get_printers(
    hass: HomeAssistant, options: dict[str, Any], *, force: bool = False
) -> dict[str, Any] | None:
    """The add-on's ``GET /printers`` payload, or None when unreachable."""
    url = (options.get(CONF_PRINTER_URL) or DEFAULT_PRINTER_URL).strip().rstrip("/")
    now = time.monotonic()
    cached = _printers_cache.get(url)
    if cached and not force and now - cached[0] < _PRINTERS_TTL:
        return cached[1]
    session = async_get_clientsession(hass)
    try:
        async with session.get(
            f"{url}/printers", timeout=aiohttp.ClientTimeout(total=8)
        ) as resp:
            if resp.status != 200:
                return None
            data = await resp.json(content_type=None)
    except (aiohttp.ClientError, TimeoutError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    _printers_cache[url] = (now, data)
    return data


def resolve_printer(
    data: dict[str, Any] | None, name: str | None
) -> dict[str, Any] | None:
    """Pick the target queue from a ``/printers`` payload.

    An explicit ``name`` must match exactly (asking for an absent printer is
    an error, not a silent fallback); without one the add-on's default wins,
    then any connected queue.
    """
    if not data:
        return None
    printers = data.get("printers") or []
    if name:
        return next((p for p in printers if p.get("name") == name), None)
    for p in printers:
        if p.get("default") and p.get("connected"):
            return p
    return next((p for p in printers if p.get("connected")), None)


def canvas_for(entry: dict[str, Any] | None) -> dict[str, Any] | None:
    """The render canvas (px + dpi) for a printer's loaded label.

    Since add-on 0.6.0 every media entry also reports ``printable.rect_px``:
    the part of the sticker the head can physically reach (DYMO parks the
    label with its leading edge past the head, so the first ~5 mm can never
    receive print). The art is rendered at that rect and pasted onto the
    full white canvas, so nothing of the design lands in a dead zone.
    """
    if not entry:
        return None
    loaded = entry.get("loaded") or {}
    px = entry.get("native_px") or loaded.get("native_px")
    if not px or len(px) != 2 or not all(px):
        return None
    canvas = {"w": int(px[0]), "h": int(px[1]),
              "dpi": int(entry.get("dpi") or label_render.DPI)}
    rect = ((loaded.get("printable") or entry.get("printable") or {})
            .get("rect_px") or {})
    if all(k in rect for k in ("x", "y", "w", "h")) \
            and 0 < int(rect["w"]) <= canvas["w"] \
            and 0 < int(rect["h"]) <= canvas["h"]:
        canvas["printable"] = {k: int(rect[k]) for k in ("x", "y", "w", "h")}
    return canvas


async def async_canvas_for_printer(
    hass: HomeAssistant, options: dict[str, Any], printer: str | None
) -> dict[str, Any] | None:
    """Resolve a printer name (or the default) to its render canvas."""
    data = await async_get_printers(hass, options)
    return canvas_for(resolve_printer(data, printer))


def build_label_context(
    hass: HomeAssistant, item: dict[str, Any], portion: int | None = None
) -> dict[str, Any]:
    """Build the display context (labels, language, date) for rendering."""
    lang = resolve_language(hass)
    location = item.get("location") or ""
    kind = item.get("kind") or CATEGORY_KIND.get(item.get("category"), DEFAULT_KIND)
    return {
        "lang": lang,
        "location_label": get_location_label(location, lang),
        "kind_label": get_kind_label(kind, lang),
        "today": dt_util.now().date(),
        # Portion stickers get a sub-code (AB12-3) + "PORTIE n/N" heading;
        # single-portion items render exactly like before. Stored items carry
        # a portions LIST; ad-hoc render payloads may say ``portions: 8``.
        "portion": portion,
        "portions_total": (
            max(1, portions) if isinstance(portions := item.get("portions"), int)
            else len(portions or []) or 1
        ),
    }


def _render_sync(item: dict[str, Any], ctx: dict[str, Any], reload: bool) -> bytes:
    # Reload keeps the design editable without a full HA restart during dev.
    if reload:
        importlib.reload(label_render)
    return label_render.render_png(item, ctx)


async def async_render_png(
    hass: HomeAssistant,
    item: dict[str, Any],
    *,
    portion: int | None = None,
    reload: bool = False,
    canvas: dict[str, Any] | None = None,
) -> bytes:
    """Render ``item`` (optionally one specific portion) off the event loop.

    ``canvas`` (from :func:`async_canvas_for_printer`) sizes the render for a
    specific printer's loaded label; without it the 99014 design canvas is
    used, exactly like before.
    """
    ctx = build_label_context(hass, item, portion)
    if canvas:
        ctx["canvas"] = canvas
    return await hass.async_add_executor_job(_render_sync, item, ctx, reload)


async def async_print_item(
    hass: HomeAssistant,
    item: dict[str, Any],
    options: dict[str, Any],
    portion: int | None = None,
    printer: str | None = None,
) -> dict[str, Any]:
    """Render ``item`` natively for the target printer and print it.

    Never raises. ``printer`` picks a specific add-on queue (e.g. "zebra"
    for the big labels); without it the add-on's default queue is used.
    """
    code = item.get("code")
    if not options.get(CONF_PRINTER_ENABLED):
        return {"printed": False, "reason": "printer_disabled", "code": code}

    url = (options.get(CONF_PRINTER_URL) or DEFAULT_PRINTER_URL).strip().rstrip("/")
    copies = max(1, int(options.get(CONF_LABEL_COPIES) or 1))

    data = await async_get_printers(hass, options)
    entry = resolve_printer(data, printer)
    if printer and data and entry is None:
        return {"printed": False, "reason": "printer_not_connected",
                "detail": printer, "code": code, "url": url}

    try:
        png = await async_render_png(hass, item, portion=portion,
                                     canvas=canvas_for(entry))
    except Exception as err:  # noqa: BLE001 - render failures shouldn't crash callers
        _LOGGER.exception("Label render failed")
        return {"printed": False, "reason": "render_failed",
                "detail": str(err), "code": code}

    form = aiohttp.FormData()
    form.add_field("file", png, filename="label.png", content_type="image/png")
    form.add_field("copies", str(copies))
    # No media field: the queue's loaded-label config is authoritative and the
    # PNG already matches it pixel for pixel (fit-to-page becomes a no-op).
    if entry:
        form.add_field("printer", str(entry.get("name")))
    elif printer:
        form.add_field("printer", printer)

    session = async_get_clientsession(hass)
    try:
        async with session.post(
            f"{url}/print", data=form,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            # A proxy/ingress can hand back HTML or nothing; that's an HTTP
            # failure to report, not a parse error to crash on.
            try:
                body = await resp.json(content_type=None)
            except ValueError:
                body = None
            if not isinstance(body, dict):
                body = {}
            ok = resp.status == 200 and bool(body.get("ok"))
            return {
                "printed": ok,
                "reason": None if ok else (body.get("error") or f"http_{resp.status}"),
                "detail": body.get("detail") or body.get("hint"),
                "copies": copies, "code": code, "portion": portion, "url": url,
                "printer": (entry or {}).get("name") or printer,
            }
    except (aiohttp.ClientError, TimeoutError) as err:
        # TimeoutError is not a ClientError; without it a hung add-on would
        # surface as a generic "print_failed" with an empty detail.
        return {"printed": False, "reason": "printer_unreachable",
                "detail": f"{url}: {err}", "code": code, "url": url}
    except Exception as err:  # noqa: BLE001
        return {"printed": False, "reason": "print_failed",
                "detail": str(err), "code": code, "url": url}
