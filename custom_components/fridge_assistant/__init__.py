"""The Fridge Assistant integration."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, Platform
from homeassistant.core import Event, HomeAssistant
from homeassistant.helpers.event import async_track_time_change

from .const import (
    CONF_NOTIFY_TIME,
    DOMAIN,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PANEL_WEBCOMPONENT,
    URL_BASE,
)
from .coordinator import FridgeRuntime
from .services import async_setup_services, async_unload_services
from .store import FridgeStore
from .websocket_api import async_register_websocket

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

_STATIC_REGISTERED = "static_registered"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Fridge Assistant from a config entry."""
    domain_data = hass.data.setdefault(DOMAIN, {})

    store = FridgeStore(hass)
    await store.async_load()
    runtime = FridgeRuntime(hass, entry, store)
    domain_data[entry.entry_id] = runtime

    await _async_register_static(hass)
    await _async_register_panel(hass)
    async_setup_services(hass)
    async_register_websocket(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Daily expiry check at the configured time.
    hh, mm, ss = _parse_time(runtime.options[CONF_NOTIFY_TIME])

    async def _daily(_now) -> None:
        await runtime.async_run_expiry_check()

    entry.async_on_unload(
        async_track_time_change(hass, _daily, hour=hh, minute=mm, second=ss)
    )

    # Run one check shortly after startup so the notification reflects reality.
    async def _initial(_event: Event | None = None) -> None:
        await runtime.async_run_expiry_check()

    if hass.is_running:
        entry.async_create_background_task(
            hass, _initial(), "fridge_assistant_initial_check"
        )
    else:
        entry.async_on_unload(
            hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _initial)
        )

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if PANEL_URL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
            frontend.async_remove_panel(hass, PANEL_URL_PATH)
        # Remove services only when the last entry is gone.
        remaining = [
            k for k in hass.data[DOMAIN] if k != _STATIC_REGISTERED
        ]
        if not remaining:
            async_unload_services(hass)
    return unloaded


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload when options change (re-reads warn days, notify time, AI settings)."""
    await hass.config_entries.async_reload(entry.entry_id)


async def _async_register_static(hass: HomeAssistant) -> None:
    if hass.data[DOMAIN].get(_STATIC_REGISTERED):
        return
    panel_dir = Path(__file__).parent / "panel"
    panel_js = panel_dir / "fridge-assistant-panel.js"
    zxing_js = panel_dir / "vendor" / "zxing.min.js"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(f"{URL_BASE}/panel.js", str(panel_js), False),
            # Barcode decoder for browsers without a native BarcodeDetector
            # (notably iOS). Static & versioned, so it may be cached.
            StaticPathConfig(f"{URL_BASE}/zxing.min.js", str(zxing_js), True),
        ]
    )
    hass.data[DOMAIN][_STATIC_REGISTERED] = True


async def _async_register_panel(hass: HomeAssistant) -> None:
    if PANEL_URL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        return
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_WEBCOMPONENT,
        module_url=f"{URL_BASE}/panel.js",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
        config={},
        embed_iframe=False,
    )


def _parse_time(value: str) -> tuple[int, int, int]:
    try:
        parts = [int(x) for x in str(value).split(":")]
        while len(parts) < 3:
            parts.append(0)
        return parts[0], parts[1], parts[2]
    except (ValueError, AttributeError):
        return 9, 0, 0
