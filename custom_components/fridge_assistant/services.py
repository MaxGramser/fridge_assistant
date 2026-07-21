"""Services for Fridge Assistant."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import persistent_notification
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
)
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .ai import AIEstimateError, async_estimate
from .const import (
    CONF_AI_ENABLED,
    DOMAIN,
    EVENT_ITEM_ADDED,
    EVENT_ITEM_COMPLETED,
    EVENT_ITEM_REMOVED,
    HISTORY_ACTIONS,
    LEGACY_LOCATIONS,
    LOCATIONS,
    localized,
    resolve_language,
    shared_text,
)
from .coordinator import FridgeRuntime

_LOGGER = logging.getLogger(__name__)

# Follows resolve_language() — same nl-if-Dutch-else-English rule as everywhere else.
_STRINGS: dict[str, dict[str, str]] = {
    "nl": {
        "ai_disabled": "AI-schattingen staan uit in de instellingen.",
        "printer_disabled": "De printer staat uit in de instellingen van Fridge "
        "Assistant.",
        "printer_unreachable": "De Label Printer add-on is niet bereikbaar. Staat de "
        "add-on aan?",
        "print_failed": "Printen mislukte ({reason}).",
        "sticker_title": "🖨️ Sticker printen",
        "sticker_body": "{msg}\n\nSticker voor **{name}** (`{code}`).",
    },
    "en": {
        "ai_disabled": "AI estimates are turned off in the settings.",
        "printer_disabled": "The printer is turned off in Fridge Assistant's settings.",
        "printer_unreachable": "The Label Printer add-on is unreachable. Is the "
        "add-on running?",
        "print_failed": "Print failed ({reason}).",
        "sticker_title": "🖨️ Print sticker",
        "sticker_body": "{msg}\n\nSticker for **{name}** (`{code}`).",
    },
}

SERVICE_ADD_ITEM = "add_item"
SERVICE_UPDATE_ITEM = "update_item"
SERVICE_REMOVE_ITEM = "remove_item"
SERVICE_COMPLETE_ITEM = "complete_item"
SERVICE_REMOVE_EXPIRED = "remove_expired"
SERVICE_ESTIMATE = "estimate"
SERVICE_ADD_TEMPLATE = "add_template"
SERVICE_PRINT_STICKER = "print_sticker"
SERVICE_EXPORT_LABEL = "export_label"
SERVICE_RUN_CHECK = "run_check"

_ALL_SERVICES = [
    SERVICE_ADD_ITEM,
    SERVICE_UPDATE_ITEM,
    SERVICE_REMOVE_ITEM,
    SERVICE_COMPLETE_ITEM,
    SERVICE_REMOVE_EXPIRED,
    SERVICE_ESTIMATE,
    SERVICE_ADD_TEMPLATE,
    SERVICE_PRINT_STICKER,
    SERVICE_EXPORT_LABEL,
    SERVICE_RUN_CHECK,
]

_SAMPLE_ITEM = {
    "code": "MV12",
    "name": "Macaroni met gehakt",
    "contents": "restje van zondag, dubbele portie",
    "location": "freezer",
    "category": "prepared_dish",
    "kind": "dish",
    "added_date": "2026-07-20",
    "expiry_date": "2026-09-20",
    "quantity": "2 bakjes",
}

EXPORT_LABEL_SCHEMA = vol.Schema(
    {
        vol.Optional("item_id"): cv.string,
        vol.Optional("item"): dict,
        vol.Optional("path"): cv.string,
        vol.Optional("reload", default=False): cv.boolean,
    }
)

ADD_ITEM_SCHEMA = vol.Schema(
    {
        vol.Optional("name"): cv.string,
        vol.Optional("contents"): cv.string,
        # Legacy Dutch values stay accepted so old automations keep working;
        # store.build_item canonicalises them to the English ones.
        vol.Optional("location", default=LOCATIONS[0]): vol.In(
            [*LOCATIONS, *LEGACY_LOCATIONS]
        ),
        vol.Optional("category"): cv.string,
        vol.Optional("kind"): cv.string,
        vol.Optional("template_id"): cv.string,
        vol.Optional("added_date"): cv.string,
        vol.Optional("expiry_date"): cv.string,
        vol.Optional("quantity"): cv.string,
        vol.Optional("emoji"): cv.string,
        vol.Optional("icon"): cv.string,
        vol.Optional("photo"): cv.string,
        vol.Optional("notes"): cv.string,
    }
)

UPDATE_ITEM_SCHEMA = vol.Schema(
    {vol.Required("id"): cv.string}, extra=vol.ALLOW_EXTRA
)

REMOVE_ITEM_SCHEMA = vol.Schema({vol.Required("id"): cv.string})

COMPLETE_ITEM_SCHEMA = vol.Schema(
    {
        vol.Required("id"): cv.string,
        vol.Required("action"): vol.In(HISTORY_ACTIONS),
    }
)

ESTIMATE_SCHEMA = vol.Schema({vol.Required("name"): cv.string})

PRINT_STICKER_SCHEMA = vol.Schema({vol.Required("id"): cv.string})


def _get_runtime(hass: HomeAssistant) -> FridgeRuntime:
    for value in hass.data.get(DOMAIN, {}).values():
        if isinstance(value, FridgeRuntime):
            return value
    raise HomeAssistantError(shared_text(hass, "not_configured"))


def async_setup_services(hass: HomeAssistant) -> None:
    """Register all services (idempotent)."""

    async def handle_add_item(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        data = dict(call.data)
        # Attribute the item to the HA user behind the service call, if any.
        if call.context.user_id and not data.get("added_by"):
            user = await hass.auth.async_get_user(call.context.user_id)
            if user:
                data["added_by"] = user.id
                data.setdefault("added_by_name", user.name)
        item = runtime.store.build_item(data, runtime.code_format)
        runtime.store.add_item(item)
        await runtime.async_changed()
        hass.bus.async_fire(
            EVENT_ITEM_ADDED, {"id": item["id"], "code": item["code"], "name": item["name"]}
        )
        return {"item": item}

    async def handle_update_item(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        data = dict(call.data)
        item_id = data.pop("id")
        item = runtime.store.update_item(item_id, data)
        if item is None:
            raise HomeAssistantError(shared_text(hass, "item_not_found", id=item_id))
        await runtime.async_changed()
        return {"item": item}

    async def handle_remove_item(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        item = runtime.store.remove_item(call.data["id"])
        if item is None:
            raise HomeAssistantError(shared_text(hass, "item_not_found", id=call.data["id"]))
        await runtime.async_changed()
        hass.bus.async_fire(
            EVENT_ITEM_REMOVED, {"id": item["id"], "code": item["code"], "name": item["name"]}
        )
        return {"item": item}

    async def handle_complete_item(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        by = by_name = None
        if call.context.user_id:
            user = await hass.auth.async_get_user(call.context.user_id)
            if user:
                by, by_name = user.id, user.name
        event = runtime.store.complete_item(
            call.data["id"], call.data["action"], by, by_name
        )
        if event is None:
            raise HomeAssistantError(shared_text(hass, "item_not_found", id=call.data["id"]))
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
        return {"event": event}

    async def handle_remove_expired(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        removed = []
        for item in runtime.store.expired_items():
            if runtime.store.remove_item(item["id"]):
                removed.append(item)
        if removed:
            await runtime.async_changed()
        return {"removed": removed, "count": len(removed)}

    async def handle_estimate(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        if not runtime.options.get(CONF_AI_ENABLED):
            raise HomeAssistantError(localized(_STRINGS, resolve_language(hass), "ai_disabled"))
        try:
            result = await async_estimate(hass, call.data["name"], runtime.options)
        except AIEstimateError as err:
            raise HomeAssistantError(str(err)) from err
        return {"estimate": result}

    async def handle_add_template(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        tpl = runtime.store.upsert_user_template(dict(call.data))
        await runtime.async_changed()
        return {"template": tpl}

    async def handle_print_sticker(call: ServiceCall) -> ServiceResponse:
        from .printer import async_print_item

        runtime = _get_runtime(hass)
        item = runtime.store.items.get(call.data["id"])
        if item is None:
            raise HomeAssistantError(shared_text(hass, "item_not_found", id=call.data["id"]))
        result = await async_print_item(hass, item, runtime.options)
        if not result.get("printed"):
            lang = resolve_language(hass)
            reasons = {
                "printer_disabled": localized(_STRINGS, lang, "printer_disabled"),
                "printer_unreachable": localized(_STRINGS, lang, "printer_unreachable"),
            }
            msg = reasons.get(
                result.get("reason"),
                localized(_STRINGS, lang, "print_failed", reason=result.get("reason")),
            )
            persistent_notification.async_create(
                hass,
                localized(
                    _STRINGS, lang, "sticker_body",
                    msg=msg, name=item["name"], code=item["code"],
                ),
                title=localized(_STRINGS, lang, "sticker_title"),
                notification_id="fridge_assistant_print",
            )
        return result

    async def handle_export_label(call: ServiceCall) -> ServiceResponse:
        from .printer import async_render_png

        runtime = _get_runtime(hass)
        item_id = call.data.get("item_id")
        if call.data.get("item"):
            item = dict(call.data["item"])
        elif item_id:
            item = runtime.store.items.get(item_id)
            if item is None:
                raise HomeAssistantError(shared_text(hass, "item_not_found", id=item_id))
        else:
            item = dict(_SAMPLE_ITEM)
        path = call.data.get("path") or "/share/fridge-assistant/_preview/label.png"
        png = await async_render_png(hass, item, reload=call.data.get("reload", False))

        def _write() -> int:
            target = Path(path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(png)
            return len(png)

        size = await hass.async_add_executor_job(_write)
        _LOGGER.info("Exported label for %s -> %s (%d bytes)",
                     item.get("code"), path, size)
        return {"path": path, "bytes": size, "code": item.get("code")}

    async def handle_run_check(call: ServiceCall) -> None:
        runtime = _get_runtime(hass)
        await runtime.async_run_expiry_check()

    hass.services.async_register(
        DOMAIN, SERVICE_ADD_ITEM, handle_add_item,
        schema=ADD_ITEM_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_UPDATE_ITEM, handle_update_item,
        schema=UPDATE_ITEM_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_REMOVE_ITEM, handle_remove_item,
        schema=REMOVE_ITEM_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_COMPLETE_ITEM, handle_complete_item,
        schema=COMPLETE_ITEM_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_REMOVE_EXPIRED, handle_remove_expired,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_ESTIMATE, handle_estimate,
        schema=ESTIMATE_SCHEMA, supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_ADD_TEMPLATE, handle_add_template,
        schema=vol.Schema({vol.Required("name"): cv.string}, extra=vol.ALLOW_EXTRA),
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_PRINT_STICKER, handle_print_sticker,
        schema=PRINT_STICKER_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_EXPORT_LABEL, handle_export_label,
        schema=EXPORT_LABEL_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(DOMAIN, SERVICE_RUN_CHECK, handle_run_check)


def async_unload_services(hass: HomeAssistant) -> None:
    for service in _ALL_SERVICES:
        if hass.services.has_service(DOMAIN, service):
            hass.services.async_remove(DOMAIN, service)
