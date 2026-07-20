"""Barcode → product lookup via OpenFoodFacts (free, no API key).

Runs in Home Assistant Core (server side), so the panel never has to reach an
external host directly — avoids browser CORS/CSP limits entirely.
"""

from __future__ import annotations

import logging
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)

OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
_FIELDS = (
    "product_name,product_name_nl,brands,quantity,"
    "categories_tags,image_front_small_url"
)

# Map OpenFoodFacts category tags onto our own coarse categories.
_CATEGORY_KEYWORDS: list[tuple[tuple[str, ...], str]] = [
    (("milk", "dairy", "yogurt", "yoghurt", "cheese", "butter", "cream"), "zuivel"),
    (("egg",), "eieren"),
    (("beverage", "soda", "water", "juice", "drink", "cola", "coffee", "tea"), "dranken"),
    (("meat", "poultry", "chicken", "beef", "pork", "sausage", "ham"), "vlees"),
    (("fish", "seafood", "salmon", "tuna", "shrimp"), "vis"),
    (("vegetable", "legume"), "groente"),
    (("fruit",), "fruit"),
    (("bread", "bakery", "pastr"), "brood_bakkerij"),
    (("sauce", "condiment", "spread", "spice", "herb"), "saus_kruiden"),
    (("meal", "pizza", "ready-made"), "bereid_gerecht"),
]


def _category_from_tags(tags: list[str] | None) -> str:
    text = " ".join(tags or []).lower()
    for keys, category in _CATEGORY_KEYWORDS:
        if any(k in text for k in keys):
            return category
    return "overig"


def normalize_barcode(value: Any) -> str:
    """Keep only the digits of a scanned barcode."""
    return "".join(ch for ch in str(value or "") if ch.isdigit())


async def async_lookup_barcode(
    hass: HomeAssistant, code: str
) -> dict[str, Any] | None:
    """Return product details for an EAN/UPC, or None if unknown/unreachable."""
    code = normalize_barcode(code)
    if not code:
        return None
    session = async_get_clientsession(hass)
    try:
        async with session.get(
            OFF_URL.format(code=code),
            params={"fields": _FIELDS},
            timeout=aiohttp.ClientTimeout(total=12),
        ) as resp:
            if resp.status != 200:
                return None
            data = await resp.json(content_type=None)
    except Exception as err:  # noqa: BLE001 - lookup is best-effort
        _LOGGER.debug("OpenFoodFacts lookup failed for %s: %s", code, err)
        return None

    if data.get("status") != 1 or not isinstance(data.get("product"), dict):
        return None
    product = data["product"]
    name = (
        product.get("product_name_nl")
        or product.get("product_name")
        or product.get("brands")
        or ""
    ).strip()
    if not name:
        return None
    return {
        "barcode": code,
        "name": name,
        "brand": (product.get("brands") or "").split(",")[0].strip(),
        "quantity": (product.get("quantity") or "").strip(),
        "category": _category_from_tags(product.get("categories_tags")),
        "photo": product.get("image_front_small_url") or "",
        "source": "openfoodfacts",
    }
