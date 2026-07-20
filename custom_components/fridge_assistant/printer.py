"""Label rendering context + printer client for the optional add-on.

Rendering happens here (in Home Assistant Core, which ships Pillow); the label
image is then handed to the generic **Label Printer** add-on over HTTP. The
add-on only prints images/PDFs, so it can be reused for anything.

Validated hardware: DYMO LabelWriter 550 + 99014 labels (54 x 101 mm).
"""

from __future__ import annotations

import importlib
import logging
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
    KINDS,
    LABEL_MEDIA,
    LOCATION_META,
)

_LOGGER = logging.getLogger(__name__)


class PrinterError(Exception):
    """Raised when a label cannot be printed."""


def build_label_context(hass: HomeAssistant, item: dict[str, Any]) -> dict[str, Any]:
    """Build the display context (labels, language, date) for rendering."""
    location = item.get("location")
    location_label = LOCATION_META.get(location, {}).get("label", location or "")
    kind = item.get("kind") or CATEGORY_KIND.get(item.get("category"), DEFAULT_KIND)
    kind_label = KINDS.get(kind, {}).get("short", "")
    lang = (getattr(hass.config, "language", None) or "nl").split("-")[0]
    return {
        "lang": lang,
        "location_label": location_label,
        "kind_label": kind_label,
        "today": dt_util.now().date(),
    }


def _render_sync(item: dict[str, Any], ctx: dict[str, Any], reload: bool) -> bytes:
    # Reload keeps the design editable without a full HA restart during dev.
    if reload:
        importlib.reload(label_render)
    return label_render.render_png(item, ctx)


async def async_render_png(
    hass: HomeAssistant, item: dict[str, Any], *, reload: bool = False
) -> bytes:
    """Render ``item`` to PNG bytes off the event loop."""
    ctx = build_label_context(hass, item)
    return await hass.async_add_executor_job(_render_sync, item, ctx, reload)


async def async_print_item(
    hass: HomeAssistant, item: dict[str, Any], options: dict[str, Any]
) -> dict[str, Any]:
    """Render ``item`` and send it to the printer add-on. Never raises."""
    code = item.get("code")
    if not options.get(CONF_PRINTER_ENABLED):
        return {"printed": False, "reason": "printer_disabled", "code": code}

    url = (options.get(CONF_PRINTER_URL) or DEFAULT_PRINTER_URL).strip().rstrip("/")
    copies = max(1, int(options.get(CONF_LABEL_COPIES) or 1))
    try:
        png = await async_render_png(hass, item)
    except Exception as err:  # noqa: BLE001 - render failures shouldn't crash callers
        _LOGGER.exception("Label render failed")
        return {"printed": False, "reason": "render_failed",
                "detail": str(err), "code": code}

    form = aiohttp.FormData()
    form.add_field("file", png, filename="label.png", content_type="image/png")
    form.add_field("media", LABEL_MEDIA)
    form.add_field("copies", str(copies))

    session = async_get_clientsession(hass)
    try:
        async with session.post(
            f"{url}/print", data=form,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            body = await resp.json(content_type=None)
            ok = resp.status == 200 and bool(body.get("ok"))
            return {
                "printed": ok,
                "reason": None if ok else (body.get("error") or f"http_{resp.status}"),
                "detail": body.get("detail") or body.get("hint"),
                "copies": copies, "code": code, "url": url,
            }
    except aiohttp.ClientError as err:
        return {"printed": False, "reason": "printer_unreachable",
                "detail": f"{url}: {err}", "code": code, "url": url}
    except Exception as err:  # noqa: BLE001
        return {"printed": False, "reason": "print_failed",
                "detail": str(err), "code": code, "url": url}
