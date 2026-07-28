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
from .codes import split_portion_code
from .const import (
    ACTION_EATEN,
    CONF_AI_ENABLED,
    CONF_PRINTER_ENABLED,
    DOMAIN,
    HISTORY_ACTIONS,
    LEGACY_LOCATIONS,
    LOCATIONS,
    MAX_PORTIONS,
    localized,
    resolve_language,
    shared_text,
)
from .coordinator import FridgeRuntime, get_runtime

_LOGGER = logging.getLogger(__name__)

# Follows resolve_language() — same nl-if-Dutch-else-English rule as everywhere else.
_STRINGS: dict[str, dict[str, str]] = {
    "nl": {
        "ai_disabled": "AI-schattingen staan uit in de instellingen.",
        "printer_disabled": "De printer staat uit in de instellingen van Fridge "
        "Assistant.",
        "printer_unreachable": "De Label Printer add-on is niet bereikbaar. Staat de "
        "add-on aan?",
        "printer_not_connected": "De printer is niet verbonden of staat uit. Zet hem "
        "aan en probeer opnieuw.",
        "print_failed": "Printen mislukte ({reason}).",
        "sticker_title": "🖨️ Sticker printen",
        "sticker_body": "{msg}\n\nSticker voor **{name}** (`{code}`).",
        "path_not_allowed": "Pad {path} is niet toegestaan; gebruik een pad onder "
        "{allowed} of voeg het toe aan allowlist_external_dirs.",
    },
    "en": {
        "ai_disabled": "AI estimates are turned off in the settings.",
        "printer_disabled": "The printer is turned off in Fridge Assistant's settings.",
        "printer_unreachable": "The Label Printer add-on is unreachable. Is the "
        "add-on running?",
        "printer_not_connected": "The printer is not connected or powered off. Turn "
        "it on and try again.",
        "print_failed": "Print failed ({reason}).",
        "sticker_title": "🖨️ Print sticker",
        "sticker_body": "{msg}\n\nSticker for **{name}** (`{code}`).",
        "path_not_allowed": "Path {path} is not allowed; use a path under {allowed} "
        "or add it to allowlist_external_dirs.",
    },
}

# export_label may write anywhere these trees allow — and nowhere else, so a
# service call can't overwrite e.g. /config/configuration.yaml with PNG bytes.
_EXPORT_BASES = (Path("/share/fridge-assistant"), Path("/tmp"))

SERVICE_ADD_ITEM = "add_item"
SERVICE_UPDATE_ITEM = "update_item"
SERVICE_REMOVE_ITEM = "remove_item"
SERVICE_COMPLETE_ITEM = "complete_item"
SERVICE_EAT_PORTION = "eat_portion"
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
    SERVICE_EAT_PORTION,
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
    "category": "dinner",
    "kind": "dish",
    "added_date": "2026-07-20",
    "expiry_date": "2026-09-20",
    "quantity": "2 bakjes",
}

EXPORT_LABEL_SCHEMA = vol.Schema(
    {
        vol.Optional("item_id"): cv.string,
        vol.Optional("item"): dict,
        vol.Optional("portion"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("path"): cv.string,
        vol.Optional("reload", default=False): cv.boolean,
        vol.Optional("printer"): cv.string,
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
        vol.Optional("portions"): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=MAX_PORTIONS)
        ),
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

EAT_PORTION_SCHEMA = vol.Schema(
    {
        # Either the internal id or the printed code — a portion sub-code
        # ("AB12-3") picks that specific portion.
        vol.Optional("id"): cv.string,
        vol.Optional("code"): cv.string,
        vol.Optional("portion"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("action", default=ACTION_EATEN): vol.In(HISTORY_ACTIONS),
    }
)

ESTIMATE_SCHEMA = vol.Schema({vol.Required("name"): cv.string})

PRINT_STICKER_SCHEMA = vol.Schema(
    {
        vol.Required("id"): cv.string,
        vol.Optional("printer"): cv.string,
    }
)


def _get_runtime(hass: HomeAssistant) -> FridgeRuntime:
    runtime = get_runtime(hass)
    if runtime is None:
        raise HomeAssistantError(shared_text(hass, "not_configured"))
    return runtime


def async_setup_services(hass: HomeAssistant) -> None:
    """Register all services (idempotent).

    All mutations go through the FridgeRuntime methods, which persist and
    fire the public bus events — the websocket API uses the same ones, so
    the two surfaces cannot drift apart.
    """

    async def handle_add_item(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        # Attribute the item to the HA user behind the service call, if any.
        by, by_name = await runtime.async_user_attrs(call.context.user_id)
        item = await runtime.async_add_item(dict(call.data), by=by, by_name=by_name)
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
        item = await runtime.async_remove_item(call.data["id"])
        if item is None:
            raise HomeAssistantError(shared_text(hass, "item_not_found", id=call.data["id"]))
        return {"item": item}

    async def handle_complete_item(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        by, by_name = await runtime.async_user_attrs(call.context.user_id)
        event = await runtime.async_complete_item(
            call.data["id"], call.data["action"], by=by, by_name=by_name
        )
        if event is None:
            raise HomeAssistantError(shared_text(hass, "item_not_found", id=call.data["id"]))
        return {"event": event}

    async def handle_eat_portion(call: ServiceCall) -> ServiceResponse:
        runtime = _get_runtime(hass)
        item_id = call.data.get("id")
        portion = call.data.get("portion")
        if not item_id:
            base, code_portion = split_portion_code(call.data.get("code") or "")
            if portion is None:
                portion = code_portion
            item = next(
                (i for i in runtime.store.items.values()
                 if (i.get("code") or "").upper() == base),
                None,
            )
            if item is None:
                raise HomeAssistantError(
                    shared_text(hass, "item_not_found", id=call.data.get("code"))
                )
            item_id = item["id"]
        by, by_name = await runtime.async_user_attrs(call.context.user_id)
        result = await runtime.async_consume_portion(
            item_id, portion=portion, action=call.data["action"], by=by, by_name=by_name
        )
        if isinstance(result, str):
            if result == "item_not_found":
                raise HomeAssistantError(shared_text(hass, "item_not_found", id=item_id))
            raise HomeAssistantError(shared_text(hass, result, n=portion))
        return result

    async def handle_remove_expired(call: ServiceCall) -> ServiceResponse:
        # Same behaviour as the panel's clean-up mode: completing as "tossed"
        # keeps a history record of what was thrown out and by whom, instead
        # of deleting silently.
        runtime = _get_runtime(hass)
        by, by_name = await runtime.async_user_attrs(call.context.user_id)
        removed = await runtime.async_remove_expired(by=by, by_name=by_name)
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
        result = await async_print_item(
            hass, item, runtime.options, printer=call.data.get("printer")
        )
        if not result.get("printed"):
            lang = resolve_language(hass)
            reasons = {
                "printer_disabled": localized(_STRINGS, lang, "printer_disabled"),
                "printer_unreachable": localized(_STRINGS, lang, "printer_unreachable"),
                "printer_not_connected": localized(
                    _STRINGS, lang, "printer_not_connected"
                ),
            }
            msg = reasons.get(
                result.get("reason"),
                localized(_STRINGS, lang, "print_failed", reason=result.get("reason")),
            )
            # The add-on's detail/hint says what to actually do (which queues
            # exist, plug in the printer, …) — losing it made failures vague.
            detail = result.get("detail")
            if detail:
                msg = f"{msg}\n{detail}"
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
        from .printer import async_canvas_for_printer, async_render_png

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
        # Any authenticated user/automation can call this service, so the
        # target must stay inside known-safe trees — otherwise a stray path
        # overwrites arbitrary files (e.g. /config/configuration.yaml).
        resolved = Path(path).resolve()
        allowed = [*_EXPORT_BASES, Path(hass.config.path("www"))]
        if not (
            any(resolved.is_relative_to(base) for base in allowed)
            or hass.config.is_allowed_path(str(resolved))
        ):
            raise HomeAssistantError(
                localized(
                    _STRINGS, resolve_language(hass), "path_not_allowed",
                    path=path, allowed=", ".join(str(b) for b in allowed),
                )
            )
        path = str(resolved)
        # Same canvas rule as the live preview: size for the target printer
        # when one is named or printing is enabled, else the design canvas.
        canvas = None
        if call.data.get("printer") or runtime.options.get(CONF_PRINTER_ENABLED):
            canvas = await async_canvas_for_printer(
                hass, runtime.options, call.data.get("printer")
            )
        png = await async_render_png(
            hass, item,
            portion=call.data.get("portion"),
            reload=call.data.get("reload", False),
            canvas=canvas,
        )

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
        DOMAIN, SERVICE_EAT_PORTION, handle_eat_portion,
        schema=EAT_PORTION_SCHEMA, supports_response=SupportsResponse.OPTIONAL,
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
