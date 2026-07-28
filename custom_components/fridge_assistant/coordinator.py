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
    ACTION_EATEN,
    ACTION_TOSSED,
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
    EVENT_ITEM_ADDED,
    EVENT_ITEM_COMPLETED,
    EVENT_ITEM_REMOVED,
    EVENT_PORTION_CONSUMED,
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

    # ------------------------------------------------------------------
    # Mutations shared by the websocket API and the HA services. Each one
    # mutates the store, persists, and fires the public bus events — so the
    # two surfaces can never drift apart in behaviour.
    # ------------------------------------------------------------------

    async def async_user_attrs(
        self, user_id: str | None
    ) -> tuple[str | None, str | None]:
        """Resolve an HA user id (e.g. from a service context) to (id, name)."""
        if not user_id:
            return None, None
        user = await self.hass.auth.async_get_user(user_id)
        if user is None:
            return None, None
        return user.id, user.name

    def _fire_completed(self, event: dict[str, Any]) -> None:
        snap = event.get("item") or {}
        self.hass.bus.async_fire(
            EVENT_ITEM_COMPLETED,
            {
                "action": event["action"],
                "by": event["by"],
                "code": snap.get("code"),
                "name": snap.get("name"),
            },
        )

    async def async_add_item(
        self,
        data: dict[str, Any],
        by: str | None = None,
        by_name: str | None = None,
    ) -> dict[str, Any]:
        """Build, store and announce a new item."""
        if by is not None:
            # The authenticated caller wins over anything in the payload.
            data = {**data, "added_by": by, "added_by_name": by_name}
        item = self.store.build_item(data, self.code_format)
        self.store.add_item(item)
        await self.async_changed()
        self.hass.bus.async_fire(
            EVENT_ITEM_ADDED,
            {"id": item["id"], "code": item["code"], "name": item["name"]},
        )
        return item

    async def async_remove_item(self, item_id: str) -> dict[str, Any] | None:
        item = self.store.remove_item(item_id)
        if item is None:
            return None
        await self.async_changed()
        self.hass.bus.async_fire(
            EVENT_ITEM_REMOVED,
            {"id": item["id"], "code": item["code"], "name": item["name"]},
        )
        return item

    async def async_complete_item(
        self,
        item_id: str,
        action: str,
        by: str | None = None,
        by_name: str | None = None,
    ) -> dict[str, Any] | None:
        """Complete an item (eaten/tossed); None when the id is unknown."""
        event = self.store.complete_item(item_id, action, by=by, by_name=by_name)
        if event is None:
            return None
        await self.async_changed()
        self._fire_completed(event)
        return event

    async def async_consume_portion(
        self,
        item_id: str,
        portion: int | None = None,
        action: str = ACTION_EATEN,
        by: str | None = None,
        by_name: str | None = None,
    ) -> dict[str, Any] | str:
        """Consume one portion; returns the store result or its error key."""
        result = self.store.consume_portion(
            item_id, portion=portion, action=action, by=by, by_name=by_name
        )
        if isinstance(result, str):
            return result
        await self.async_changed()
        event = result["event"]
        snap = event.get("item") or {}
        self.hass.bus.async_fire(
            EVENT_PORTION_CONSUMED,
            {
                "item_id": item_id,
                "code": snap.get("code"),
                "name": snap.get("name"),
                "portion": result["portion"],
                "remaining": result["remaining"],
                "completed": result["completed"],
            },
        )
        if result["completed"]:
            self._fire_completed(event)
        return result

    async def async_set_portions(
        self,
        item_id: str,
        total: int,
        by: str | None = None,
        by_name: str | None = None,
    ) -> dict[str, Any] | None:
        """Resize a batch; announces the completion if shrinking finished it."""
        result = self.store.set_portions(item_id, total, by=by, by_name=by_name)
        if result is None:
            return None
        await self.async_changed()
        if result["completed"] and result.get("completion_event"):
            self._fire_completed(result["completion_event"])
        return result

    async def async_remove_expired(
        self,
        ids: list[str] | None = None,
        by: str | None = None,
        by_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """Toss expired items (optionally a subset) into history as 'tossed'.

        Explicit ids are intersected with the *currently* expired set, so a
        stale caller (yesterday's list) can never throw away food that is
        still good.
        """
        expired = {i["id"] for i in self.store.expired_items()}
        targets = list(expired) if ids is None else [i for i in ids if i in expired]
        removed: list[dict[str, Any]] = []
        for iid in targets:
            event = self.store.complete_item(
                iid, ACTION_TOSSED, by=by, by_name=by_name
            )
            if event is not None:
                removed.append(event["item"])
        if removed:
            await self.async_changed()
        return removed

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

        # Sensors compute "expired/expiring" from today's date but only render
        # on this signal; without it they'd show yesterday's counts until the
        # next CRUD edit.
        async_dispatcher_send(self.hass, SIGNAL_UPDATED)
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
