"""WebSocket API powering the Fridge Assistant panel."""

from __future__ import annotations

import base64
import logging
from datetime import timedelta
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util

from .ai import AIEstimateError, async_estimate
from .const import (
    CATEGORIES,
    CATEGORY_KIND,
    KINDS,
    CONF_AI_ENABLED,
    CONF_CODE_FORMAT,
    CONF_LABEL_COPIES,
    CONF_NOTIFY_ENABLED,
    CONF_OPENAI_KEY,
    ACTION_TOSSED,
    CONF_PRINTER_ENABLED,
    CONF_WARN_DAYS,
    DOMAIN,
    HISTORY_ACTIONS,
    LABEL_SIZE_MM,
    LABEL_TYPE,
    PRINTER_MODEL,
    EVENT_ITEM_ADDED,
    EVENT_ITEM_COMPLETED,
    EVENT_ITEM_REMOVED,
    LOCATION_META,
    LOCATIONS,
    SIGNAL_UPDATED,
)
from .coordinator import FridgeRuntime, get_runtime
from .store import item_age_days, item_days_left, parse_date

_LOGGER = logging.getLogger(__name__)


def async_register_websocket(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_get_state)
    websocket_api.async_register_command(hass, ws_add_item)
    websocket_api.async_register_command(hass, ws_update_item)
    websocket_api.async_register_command(hass, ws_remove_item)
    websocket_api.async_register_command(hass, ws_remove_expired)
    websocket_api.async_register_command(hass, ws_match_template)
    websocket_api.async_register_command(hass, ws_estimate)
    websocket_api.async_register_command(hass, ws_add_template)
    websocket_api.async_register_command(hass, ws_remove_template)
    websocket_api.async_register_command(hass, ws_hide_template)
    websocket_api.async_register_command(hass, ws_unhide_template)
    websocket_api.async_register_command(hass, ws_complete_item)
    websocket_api.async_register_command(hass, ws_history)
    websocket_api.async_register_command(hass, ws_lookup_barcode)
    websocket_api.async_register_command(hass, ws_print_sticker)
    websocket_api.async_register_command(hass, ws_render_label)


def _person_pictures(hass: HomeAssistant) -> dict[str, str]:
    """Map HA auth user_id -> avatar URL, via linked person entities."""
    out: dict[str, str] = {}
    for state in hass.states.async_all("person"):
        uid = state.attributes.get("user_id")
        pic = state.attributes.get("entity_picture")
        if uid and pic:
            out[uid] = pic
    return out


def _history_event(ev: dict[str, Any], pictures: dict[str, str]) -> dict[str, Any]:
    """Annotate a history event with the actor's avatar, if any."""
    return {**ev, "by_picture": pictures.get(ev.get("by"))}


def _enrich(
    item: dict[str, Any], today, warn_days: int, pictures: dict[str, str]
) -> dict[str, Any]:
    dl = item_days_left(item, today)
    if dl is None:
        status = "none"
    elif dl < 0:
        status = "expired"
    elif dl <= warn_days:
        status = "soon"
    else:
        status = "ok"
    return {
        **item,
        "days_left": dl,
        "age_days": item_age_days(item, today),
        "status": status,
        "added_by_picture": pictures.get(item.get("added_by")),
    }


def _serialize_state(hass: HomeAssistant, runtime: FridgeRuntime) -> dict[str, Any]:
    opts = runtime.options
    warn = int(opts[CONF_WARN_DAYS])
    today = dt_util.now().date()
    pictures = _person_pictures(hass)
    items = [_enrich(i, today, warn, pictures) for i in runtime.store.items.values()]
    items.sort(key=lambda i: (i["days_left"] is None, i["days_left"]))
    counts = {
        "total": len(items),
        "expired": sum(1 for i in items if i["status"] == "expired"),
        "soon": sum(1 for i in items if i["status"] == "soon"),
        "by_location": {
            loc: sum(1 for i in items if i["location"] == loc) for loc in LOCATIONS
        },
    }
    return {
        "items": items,
        "templates": runtime.store.templates_for_ui(),
        "hidden": runtime.store.hidden_templates(),
        "categories": CATEGORIES,
        "kinds": KINDS,
        "category_kind": CATEGORY_KIND,
        "locations": LOCATIONS,
        "location_meta": LOCATION_META,
        "counts": counts,
        "today": today.isoformat(),
        # Only a count in the live state; the full log is paged via ws_history so
        # every state push stays small.
        "history_count": len(runtime.store.history),
        "options": {
            "warn_days": warn,
            "ai_enabled": bool(opts.get(CONF_AI_ENABLED)),
            "ai_has_key": bool((opts.get(CONF_OPENAI_KEY) or "").strip()),
            "code_format": opts.get(CONF_CODE_FORMAT),
            "notify_enabled": bool(opts.get(CONF_NOTIFY_ENABLED)),
            "printer_enabled": bool(opts.get(CONF_PRINTER_ENABLED)),
            "label_copies": int(opts.get(CONF_LABEL_COPIES) or 1),
        },
        "printer": {
            "model": PRINTER_MODEL,
            "label": LABEL_TYPE,
            "label_size": LABEL_SIZE_MM,
        },
    }


@callback
def _runtime_or_error(hass, connection, msg) -> FridgeRuntime | None:
    runtime = get_runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_ready", "Fridge Assistant niet geladen.")
        return None
    return runtime


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@websocket_api.async_response
async def ws_subscribe(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return

    @callback
    def _forward() -> None:
        connection.send_message(
            websocket_api.event_message(msg["id"], _serialize_state(hass, runtime))
        )

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_UPDATED, _forward
    )
    connection.send_result(msg["id"])
    _forward()


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_state"})
@websocket_api.async_response
async def ws_get_state(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    connection.send_result(msg["id"], _serialize_state(hass, runtime))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/add_item",
        vol.Required("item"): dict,
    }
)
@websocket_api.async_response
async def ws_add_item(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    data = dict(msg["item"])
    # Record who added it, from the authenticated websocket user.
    user = connection.user
    if user is not None:
        data.setdefault("added_by", user.id)
        data.setdefault("added_by_name", user.name)
    item = runtime.store.build_item(data, runtime.code_format)
    runtime.store.add_item(item)
    await runtime.async_changed()
    hass.bus.async_fire(
        EVENT_ITEM_ADDED, {"id": item["id"], "code": item["code"], "name": item["name"]}
    )
    connection.send_result(msg["id"], {"item": item})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_item",
        vol.Required("item_id"): str,
        vol.Required("changes"): dict,
    }
)
@websocket_api.async_response
async def ws_update_item(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    item = runtime.store.update_item(msg["item_id"], dict(msg["changes"]))
    if item is None:
        connection.send_error(msg["id"], "not_found", "Item niet gevonden.")
        return
    await runtime.async_changed()
    connection.send_result(msg["id"], {"item": item})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/remove_item",
        vol.Required("item_id"): str,
    }
)
@websocket_api.async_response
async def ws_remove_item(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    item = runtime.store.remove_item(msg["item_id"])
    if item is None:
        connection.send_error(msg["id"], "not_found", "Item niet gevonden.")
        return
    await runtime.async_changed()
    hass.bus.async_fire(
        EVENT_ITEM_REMOVED, {"id": item["id"], "code": item["code"], "name": item["name"]}
    )
    connection.send_result(msg["id"], {"item": item})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/remove_expired",
        vol.Optional("ids"): [str],
    }
)
@websocket_api.async_response
async def ws_remove_expired(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    ids = msg.get("ids")
    if ids is None:
        targets = [i["id"] for i in runtime.store.expired_items()]
    else:
        targets = ids
    # Clearing out the fridge is "throwing away" — log each with who did it.
    user = connection.user
    removed = 0
    for iid in targets:
        event = runtime.store.complete_item(
            iid,
            ACTION_TOSSED,
            by=user.id if user is not None else None,
            by_name=user.name if user is not None else None,
        )
        if event is not None:
            removed += 1
    if removed:
        await runtime.async_changed()
    connection.send_result(msg["id"], {"count": removed})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/complete_item",
        vol.Required("item_id"): str,
        vol.Required("action"): vol.In(HISTORY_ACTIONS),
    }
)
@websocket_api.async_response
async def ws_complete_item(hass, connection, msg) -> None:
    """Mark an item eaten/tossed → moves it to the history log with who + when."""
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    user = connection.user
    event = runtime.store.complete_item(
        msg["item_id"],
        msg["action"],
        by=user.id if user is not None else None,
        by_name=user.name if user is not None else None,
    )
    if event is None:
        connection.send_error(msg["id"], "not_found", "Item niet gevonden.")
        return
    await runtime.async_changed()
    hass.bus.async_fire(
        EVENT_ITEM_COMPLETED,
        {
            "action": event["action"],
            "by": event["by"],
            "code": event["item"].get("code"),
            "name": event["item"].get("name"),
        },
    )
    connection.send_result(msg["id"], {"event": event})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/history",
        vol.Optional("limit"): int,
        vol.Optional("offset"): int,
    }
)
@websocket_api.async_response
async def ws_history(hass, connection, msg) -> None:
    """Paged history (newest first) — the panel loads more on demand."""
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    pictures = _person_pictures(hass)
    page = runtime.store.history_page(msg.get("limit", 25), msg.get("offset", 0))
    page["events"] = [_history_event(e, pictures) for e in page["events"]]
    connection.send_result(msg["id"], page)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/lookup_barcode",
        vol.Required("barcode"): str,
    }
)
@websocket_api.async_response
async def ws_lookup_barcode(hass, connection, msg) -> None:
    """Resolve a retail barcode: our own memory first, then OpenFoodFacts."""
    from .products import async_lookup_barcode, normalize_barcode

    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    code = normalize_barcode(msg["barcode"])

    def _prefill(src: dict[str, Any]) -> dict[str, Any]:
        return {
            "name": src.get("name"),
            "category": src.get("category"),
            "quantity": src.get("quantity"),
            "emoji": src.get("emoji"),
            "kind": src.get("kind"),
            "photo": src.get("photo"),
        }

    # Recognise a product we've stored before — active items, then history.
    known = None
    if code:
        for it in runtime.store.items.values():
            if (it.get("barcode") or "") == code:
                known = _prefill(it)
                break
        if known is None:
            for ev in runtime.store.history:
                snap = ev.get("item") or {}
                if (snap.get("barcode") or "") == code:
                    known = _prefill(snap)
                    break

    product = await async_lookup_barcode(hass, code)
    connection.send_result(
        msg["id"], {"barcode": code, "known": known, "product": product}
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/match_template",
        vol.Required("query"): str,
        vol.Optional("location"): vol.In(LOCATIONS),
        vol.Optional("added_date"): str,
    }
)
@websocket_api.async_response
async def ws_match_template(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    tpl = runtime.store.match_template(msg["query"])
    suggestion = None
    if tpl and msg.get("location"):
        days = runtime.store.shelf_life_days(tpl, msg["location"])
        if days is not None:
            base = parse_date(msg.get("added_date")) or dt_util.now().date()
            suggestion = {
                "days": days,
                "location": msg["location"],
                "expiry_date": (base + timedelta(days=days)).isoformat(),
                "source": "template",
            }
    connection.send_result(msg["id"], {"template": tpl, "suggestion": suggestion})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/estimate",
        vol.Required("name"): str,
    }
)
@websocket_api.async_response
async def ws_estimate(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    if not runtime.options.get(CONF_AI_ENABLED):
        connection.send_error(msg["id"], "ai_disabled", "AI-schattingen staan uit.")
        return
    try:
        result = await async_estimate(hass, msg["name"], runtime.options)
    except AIEstimateError as err:
        connection.send_error(msg["id"], "ai_error", str(err))
        return
    connection.send_result(msg["id"], {"estimate": result})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/add_template",
        vol.Required("template"): dict,
    }
)
@websocket_api.async_response
async def ws_add_template(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    tpl = runtime.store.upsert_user_template(dict(msg["template"]))
    await runtime.async_changed()
    connection.send_result(msg["id"], {"template": tpl})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/remove_template",
        vol.Required("template_id"): str,
    }
)
@websocket_api.async_response
async def ws_remove_template(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    ok = runtime.store.remove_user_template(msg["template_id"])
    if ok:
        await runtime.async_changed()
    connection.send_result(msg["id"], {"removed": ok})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/hide_template",
        vol.Required("template_id"): str,
    }
)
@websocket_api.async_response
async def ws_hide_template(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    ok = runtime.store.hide_template(msg["template_id"])
    if ok:
        await runtime.async_changed()
    connection.send_result(msg["id"], {"hidden": ok})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/unhide_template",
        vol.Required("template_id"): str,
    }
)
@websocket_api.async_response
async def ws_unhide_template(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    ok = runtime.store.unhide_template(msg["template_id"])
    if ok:
        await runtime.async_changed()
    connection.send_result(msg["id"], {"unhidden": ok})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/print_sticker",
        vol.Required("item_id"): str,
    }
)
@websocket_api.async_response
async def ws_print_sticker(hass, connection, msg) -> None:
    from .printer import async_print_item

    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    item = runtime.store.items.get(msg["item_id"])
    if item is None:
        connection.send_error(msg["id"], "not_found", "Item niet gevonden.")
        return
    result = await async_print_item(hass, item, runtime.options)
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/render_label",
        vol.Optional("item_id"): str,
        vol.Optional("item"): dict,
    }
)
@websocket_api.async_response
async def ws_render_label(hass, connection, msg) -> None:
    """Render a label to a base64 PNG for on-screen preview."""
    from .printer import async_render_png

    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    if msg.get("item"):
        item = dict(msg["item"])
    else:
        item = runtime.store.items.get(msg.get("item_id"))
        if item is None:
            connection.send_error(msg["id"], "not_found", "Item niet gevonden.")
            return
    try:
        png = await async_render_png(hass, item)
    except Exception as err:  # noqa: BLE001
        connection.send_error(msg["id"], "render_failed", str(err))
        return
    connection.send_result(
        msg["id"],
        {"png_base64": base64.b64encode(png).decode("ascii"), "code": item.get("code")},
    )
