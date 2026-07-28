"""WebSocket API powering the Fridge Assistant panel."""

from __future__ import annotations

import base64
import logging
from datetime import timedelta
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util

from .ai import AIEstimateError, async_estimate
from .const import (
    ACTION_EATEN,
    CATEGORIES,
    CATEGORY_KIND,
    KINDS,
    CONF_AI_ENABLED,
    CONF_CODE_FORMAT,
    CONF_LABEL_COPIES,
    CONF_NOTIFY_ENABLED,
    CONF_OPENAI_KEY,
    CONF_PRINTER_ENABLED,
    CONF_PRINTER_URL,
    DEFAULT_PRINTER_URL,
    CONF_WARN_DAYS,
    DOMAIN,
    HISTORY_ACTIONS,
    MAX_PORTIONS,
    LOCATION_META,
    LOCATIONS,
    SIGNAL_UPDATED,
    localized,
    resolve_language,
    shared_text,
)
from .coordinator import FridgeRuntime, get_runtime
from .store import item_age_days, item_days_left, parse_date

_LOGGER = logging.getLogger(__name__)

# Follows resolve_language() — same nl-if-Dutch-else-English rule as everywhere else.
_STRINGS: dict[str, dict[str, str]] = {
    "nl": {"ai_disabled": "AI-schattingen staan uit in de instellingen."},
    "en": {"ai_disabled": "AI estimates are turned off in the settings."},
}

# Per-field validation for client payloads: a wrong type must surface as a
# clear schema error, not crash the handler ("unknown_error" + stack trace)
# or persist junk that every panel then chokes on. REMOVE_EXTRA also strips
# keys the client has no business setting (added_by, _brand, …).
_OPT_STR = vol.Any(None, cv.string)
_ITEM_FIELDS = {
    # id/code pass through for ad-hoc render payloads; build_item generates
    # its own and update_item ignores them, so they can't be spoofed in.
    vol.Optional("id"): _OPT_STR,
    vol.Optional("code"): _OPT_STR,
    vol.Optional("name"): _OPT_STR,
    vol.Optional("contents"): _OPT_STR,
    vol.Optional("location"): cv.string,
    vol.Optional("category"): _OPT_STR,
    vol.Optional("kind"): _OPT_STR,
    vol.Optional("emoji"): _OPT_STR,
    vol.Optional("icon"): _OPT_STR,
    vol.Optional("photo"): _OPT_STR,
    vol.Optional("template_id"): _OPT_STR,
    vol.Optional("quantity"): _OPT_STR,
    vol.Optional("portions"): vol.Any(
        None, vol.All(vol.Coerce(int), vol.Range(min=1, max=MAX_PORTIONS))
    ),
    vol.Optional("added_date"): _OPT_STR,
    vol.Optional("expiry_date"): _OPT_STR,
    vol.Optional("expiry_source"): _OPT_STR,
    vol.Optional("notes"): _OPT_STR,
    vol.Optional("barcode"): _OPT_STR,
}
ITEM_SCHEMA = vol.Schema(_ITEM_FIELDS, extra=vol.REMOVE_EXTRA)
CHANGES_SCHEMA = vol.Schema(
    {k: v for k, v in _ITEM_FIELDS.items() if k.schema != "portions"},
    extra=vol.REMOVE_EXTRA,
)
TEMPLATE_SCHEMA = vol.Schema(
    {
        vol.Optional("id"): _OPT_STR,
        vol.Optional("name"): cv.string,
        vol.Optional("aliases"): [cv.string],
        vol.Optional("category"): _OPT_STR,
        vol.Optional("kind"): _OPT_STR,
        vol.Optional("emoji"): _OPT_STR,
        vol.Optional("icon"): _OPT_STR,
        vol.Optional("shelf_life"): vol.Schema(
            {cv.string: vol.Any(None, vol.Coerce(int))}
        ),
        vol.Optional("notes"): _OPT_STR,
        vol.Optional("opened_fridge"): vol.Any(None, vol.Coerce(int)),
        vol.Optional("source"): cv.string,
    },
    extra=vol.REMOVE_EXTRA,
)


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
    websocket_api.async_register_command(hass, ws_consume_portion)
    websocket_api.async_register_command(hass, ws_set_portions)
    websocket_api.async_register_command(hass, ws_restore_item)
    websocket_api.async_register_command(hass, ws_delete_history_event)
    websocket_api.async_register_command(hass, ws_history)
    websocket_api.async_register_command(hass, ws_lookup_barcode)
    websocket_api.async_register_command(hass, ws_print_sticker)
    websocket_api.async_register_command(hass, ws_render_label)
    websocket_api.async_register_command(hass, ws_get_printers)


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
            "printer_url": (opts.get(CONF_PRINTER_URL)
                            or DEFAULT_PRINTER_URL).strip().rstrip("/"),
            "label_copies": int(opts.get(CONF_LABEL_COPIES) or 1),
        },
        # No hardcoded "printer" hardware block anymore: what is actually
        # connected/loaded is live data, served by ws get_printers.
    }


@callback
def _runtime_or_error(hass, connection, msg) -> FridgeRuntime | None:
    runtime = get_runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_ready", shared_text(hass, "not_loaded"))
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


def _user_attrs(connection) -> tuple[str | None, str | None]:
    user = connection.user
    if user is None:
        return None, None
    return user.id, user.name


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/add_item",
        vol.Required("item"): ITEM_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_add_item(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    # Attribution comes from the authenticated websocket user.
    by, by_name = _user_attrs(connection)
    item = await runtime.async_add_item(dict(msg["item"]), by=by, by_name=by_name)
    connection.send_result(msg["id"], {"item": item})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_item",
        vol.Required("item_id"): str,
        vol.Required("changes"): CHANGES_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_update_item(hass, connection, msg) -> None:
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    item = runtime.store.update_item(msg["item_id"], dict(msg["changes"]))
    if item is None:
        connection.send_error(msg["id"], "not_found", shared_text(hass, "item_not_found", id=msg["item_id"]))
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
    item = await runtime.async_remove_item(msg["item_id"])
    if item is None:
        connection.send_error(msg["id"], "not_found", shared_text(hass, "item_not_found", id=msg["item_id"]))
        return
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
    # Clearing out the fridge is "throwing away" — log each with who did it.
    by, by_name = _user_attrs(connection)
    removed = await runtime.async_remove_expired(
        msg.get("ids"), by=by, by_name=by_name
    )
    connection.send_result(msg["id"], {"count": len(removed)})


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
    by, by_name = _user_attrs(connection)
    event = await runtime.async_complete_item(
        msg["item_id"], msg["action"], by=by, by_name=by_name
    )
    if event is None:
        connection.send_error(msg["id"], "not_found", shared_text(hass, "item_not_found", id=msg["item_id"]))
        return
    connection.send_result(msg["id"], {"event": event})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/consume_portion",
        vol.Required("item_id"): str,
        vol.Optional("portion"): int,
        vol.Optional("action"): vol.In(HISTORY_ACTIONS),
    }
)
@websocket_api.async_response
async def ws_consume_portion(hass, connection, msg) -> None:
    """Eat/toss one portion; the last open portion completes the whole item."""
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    by, by_name = _user_attrs(connection)
    result = await runtime.async_consume_portion(
        msg["item_id"],
        portion=msg.get("portion"),
        action=msg.get("action", ACTION_EATEN),
        by=by,
        by_name=by_name,
    )
    if isinstance(result, str):
        # Runtime returned an error key; localise it for the panel.
        if result == "item_not_found":
            connection.send_error(
                msg["id"], "not_found",
                shared_text(hass, "item_not_found", id=msg["item_id"]),
            )
        else:
            connection.send_error(
                msg["id"], result,
                shared_text(hass, result, n=msg.get("portion")),
            )
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_portions",
        vol.Required("item_id"): str,
        vol.Required("total"): vol.All(int, vol.Range(min=1, max=MAX_PORTIONS)),
    }
)
@websocket_api.async_response
async def ws_set_portions(hass, connection, msg) -> None:
    """Resize a batch; shrinking away the last open portion completes it."""
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    by, by_name = _user_attrs(connection)
    result = await runtime.async_set_portions(
        msg["item_id"], msg["total"], by=by, by_name=by_name
    )
    if result is None:
        connection.send_error(
            msg["id"], "not_found",
            shared_text(hass, "item_not_found", id=msg["item_id"]),
        )
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/restore_item",
        vol.Required("event_id"): str,
    }
)
@websocket_api.async_response
async def ws_restore_item(hass, connection, msg) -> None:
    """Undo a completion — puts the item back with its original id/code."""
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    item = runtime.store.restore_item(msg["event_id"])
    if item is None:
        connection.send_error(msg["id"], "not_found", shared_text(hass, "cannot_restore"))
        return
    await runtime.async_changed()
    connection.send_result(msg["id"], {"item": item})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_history_event",
        vol.Required("event_id"): str,
    }
)
@websocket_api.async_response
async def ws_delete_history_event(hass, connection, msg) -> None:
    """Permanently delete one history event — the counterpart of restore."""
    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    ok = runtime.store.delete_history_event(msg["event_id"])
    if not ok:
        connection.send_error(msg["id"], "not_found", shared_text(hass, "cannot_restore"))
        return
    await runtime.async_changed()
    connection.send_result(msg["id"], {"deleted": True})


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
        connection.send_error(
            msg["id"], "ai_disabled", localized(_STRINGS, resolve_language(hass), "ai_disabled")
        )
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
        vol.Required("template"): TEMPLATE_SCHEMA,
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
        vol.Optional("portion"): int,
        vol.Optional("printer"): str,
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
        connection.send_error(msg["id"], "not_found", shared_text(hass, "item_not_found", id=msg["item_id"]))
        return
    result = await async_print_item(
        hass, item, runtime.options,
        portion=msg.get("portion"), printer=msg.get("printer"),
    )
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/render_label",
        vol.Optional("item_id"): str,
        # ITEM_SCHEMA also strips underscore keys, so the ad-hoc preview can
        # never reach dev hooks like the _brand asset renderer.
        vol.Optional("item"): ITEM_SCHEMA,
        vol.Optional("portion"): int,
        vol.Optional("printer"): str,
    }
)
@websocket_api.async_response
async def ws_render_label(hass, connection, msg) -> None:
    """Render a label to a base64 PNG for on-screen preview.

    The preview is sized for the target printer's loaded label (``printer``
    picks a queue, otherwise the add-on default), so what you see is exactly
    what comes out.
    """
    from .printer import async_canvas_for_printer, async_render_png

    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    if msg.get("item"):
        item = dict(msg["item"])
    else:
        item = runtime.store.items.get(msg.get("item_id"))
        if item is None:
            connection.send_error(
                msg["id"], "not_found",
                shared_text(hass, "item_not_found", id=msg.get("item_id")),
            )
            return
    # Only consult the add-on when printing is on (or a queue was named):
    # without an add-on the design-canvas fallback renders instantly.
    canvas = None
    if msg.get("printer") or runtime.options.get(CONF_PRINTER_ENABLED):
        canvas = await async_canvas_for_printer(
            hass, runtime.options, msg.get("printer")
        )
    try:
        png = await async_render_png(
            hass, item, portion=msg.get("portion"), canvas=canvas
        )
    except Exception as err:  # noqa: BLE001
        connection.send_error(msg["id"], "render_failed", str(err))
        return
    connection.send_result(
        msg["id"],
        {"png_base64": base64.b64encode(png).decode("ascii"), "code": item.get("code")},
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_printers"})
@websocket_api.async_response
async def ws_get_printers(hass, connection, msg) -> None:
    """The add-on's live printer list, for the print modal's queue picker."""
    from .printer import async_get_printers

    runtime = _runtime_or_error(hass, connection, msg)
    if runtime is None:
        return
    data = await async_get_printers(hass, runtime.options, force=True)
    printers = [
        {
            "name": p.get("name"),
            "kind": p.get("kind"),
            "model": p.get("model"),
            "connected": bool(p.get("connected")),
            "label": p.get("label"),
            "media": p.get("media"),
            "native_px": p.get("native_px"),
            "dpi": p.get("dpi"),
            "default": bool(p.get("default")),
        }
        for p in (data or {}).get("printers", [])
    ]
    connection.send_result(
        msg["id"], {"available": bool(data), "printers": printers}
    )
