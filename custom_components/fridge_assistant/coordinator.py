"""Runtime object: ties the store to options, persistence and notifications."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.util import dt as dt_util

from .const import (
    CONF_AI_AGENT,
    CONF_AI_ENABLED,
    CONF_CODE_FORMAT,
    CONF_LABEL_COPIES,
    CONF_NOTIFY_ENABLED,
    CONF_NOTIFY_TIME,
    CONF_OPENAI_KEY,
    CONF_OPENAI_MODEL,
    CONF_PRINTER_ENABLED,
    CONF_PRINTER_URL,
    CONF_WARN_DAYS,
    DEFAULT_AI_ENABLED,
    DEFAULT_CODE_FORMAT,
    DEFAULT_LABEL_COPIES,
    DEFAULT_NOTIFY_ENABLED,
    DEFAULT_NOTIFY_TIME,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_PRINTER_ENABLED,
    DEFAULT_PRINTER_URL,
    DEFAULT_WARN_DAYS,
    DOMAIN,
    EVENT_EXPIRING,
    NOTIFICATION_ID,
    SIGNAL_UPDATED,
    location_label as get_location_label,
    resolve_language,
)
from .store import FridgeStore, item_days_left

_LOGGER = logging.getLogger(__name__)

DEFAULT_OPTIONS: dict[str, Any] = {
    CONF_WARN_DAYS: DEFAULT_WARN_DAYS,
    CONF_AI_ENABLED: DEFAULT_AI_ENABLED,
    CONF_AI_AGENT: "",
    CONF_OPENAI_KEY: "",
    CONF_OPENAI_MODEL: DEFAULT_OPENAI_MODEL,
    CONF_CODE_FORMAT: DEFAULT_CODE_FORMAT,
    CONF_NOTIFY_TIME: DEFAULT_NOTIFY_TIME,
    CONF_NOTIFY_ENABLED: DEFAULT_NOTIFY_ENABLED,
    CONF_PRINTER_ENABLED: DEFAULT_PRINTER_ENABLED,
    CONF_PRINTER_URL: DEFAULT_PRINTER_URL,
    CONF_LABEL_COPIES: DEFAULT_LABEL_COPIES,
}


def get_options(entry: ConfigEntry) -> dict[str, Any]:
    """Merge saved options over defaults."""
    return {**DEFAULT_OPTIONS, **dict(entry.options)}


def get_runtime(hass: HomeAssistant) -> "FridgeRuntime | None":
    """Return the single active runtime, or None if not set up."""
    for value in hass.data.get(DOMAIN, {}).values():
        if isinstance(value, FridgeRuntime):
            return value
    return None


def item_summary(item: dict[str, Any], today: date) -> dict[str, Any]:
    """Compact representation used in events and notifications."""
    return {
        "id": item.get("id"),
        "code": item.get("code"),
        "name": item.get("name"),
        "emoji": item.get("emoji"),
        "location": item.get("location"),
        "expiry_date": item.get("expiry_date"),
        "days_left": item_days_left(item, today),
    }


class FridgeRuntime:
    """Per-config-entry runtime; owns the store and side effects."""

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, store: FridgeStore
    ) -> None:
        self.hass = hass
        self.entry = entry
        self.store = store

    @property
    def options(self) -> dict[str, Any]:
        return get_options(self.entry)

    @property
    def code_format(self) -> str:
        return self.options[CONF_CODE_FORMAT]

    async def async_changed(self) -> None:
        """Persist and notify listeners (sensors, live UI) of a data change."""
        await self.store.async_save()
        async_dispatcher_send(self.hass, SIGNAL_UPDATED)

    async def async_run_expiry_check(self, notify: bool = True) -> list[dict[str, Any]]:
        """Compute expiring items, fire an event and manage the notification."""
        warn_days = int(self.options[CONF_WARN_DAYS])
        today = dt_util.now().date()
        items = self.store.expiring_items(warn_days, today)
        summaries = [item_summary(i, today) for i in items]

        self.hass.bus.async_fire(
            EVENT_EXPIRING,
            {"count": len(items), "warn_days": warn_days, "items": summaries},
        )

        if notify and self.options[CONF_NOTIFY_ENABLED]:
            lang = resolve_language(self.hass)
            if items:
                persistent_notification.async_create(
                    self.hass,
                    _notification_message(summaries, lang),
                    title=_NOTIFY_STRINGS[lang]["title"],
                    notification_id=NOTIFICATION_ID,
                )
            else:
                persistent_notification.async_dismiss(self.hass, NOTIFICATION_ID)

        return items


# Small nl/en string set for the daily persistent notification. Follows
# resolve_language() — same nl-if-Dutch-else-English rule as everywhere else.
_NOTIFY_STRINGS: dict[str, dict[str, str]] = {
    "nl": {
        "title": "🧊 Koelkast — let op de houdbaarheid",
        "expired_heading": "**Over datum:**",
        "soon_heading": "**Bijna over datum:**",
        "all_good": "Alles is nog goed. 👍",
        "today": " — vandaag!",
        "expired_suffix": " — {n} dag(en) over datum",
        "soon_suffix": " — nog {n} dag(en)",
    },
    "en": {
        "title": "🧊 Fridge — check what's expiring",
        "expired_heading": "**Past date:**",
        "soon_heading": "**Expiring soon:**",
        "all_good": "Everything is still good. 👍",
        "today": " — today!",
        "expired_suffix": " — {n} day(s) past date",
        "soon_suffix": " — {n} day(s) left",
    },
}


def _notification_message(summaries: list[dict[str, Any]], lang: str) -> str:
    s = _NOTIFY_STRINGS[lang]
    expired = [x for x in summaries if (x["days_left"] or 0) < 0]
    soon = [x for x in summaries if (x["days_left"] or 0) >= 0]
    lines: list[str] = []
    if expired:
        lines.append(s["expired_heading"])
        lines.extend(_line(x, lang) for x in expired)
    if soon:
        if expired:
            lines.append("")
        lines.append(s["soon_heading"])
        lines.extend(_line(x, lang) for x in soon)
    return "\n".join(lines) if lines else s["all_good"]


def _line(item: dict[str, Any], lang: str) -> str:
    s = _NOTIFY_STRINGS[lang]
    loc = get_location_label(item["location"], lang)
    dl = item["days_left"]
    if dl is None:
        when = ""
    elif dl < 0:
        when = s["expired_suffix"].format(n=abs(dl))
    elif dl == 0:
        when = s["today"]
    else:
        when = s["soon_suffix"].format(n=dl)
    emoji = item.get("emoji") or "•"
    return f"- {emoji} **{item['name']}** `{item['code']}` ({loc}){when}"
