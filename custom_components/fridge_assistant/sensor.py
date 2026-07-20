"""Sensors for Fridge Assistant."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import CONF_WARN_DAYS, DOMAIN, LOCATIONS, SIGNAL_UPDATED
from .coordinator import FridgeRuntime, item_summary


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    runtime: FridgeRuntime = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            FridgeTotalSensor(runtime),
            FridgeExpiringSensor(runtime),
            FridgeExpiredSensor(runtime),
        ]
    )


class _FridgeSensorBase(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, runtime: FridgeRuntime, key: str) -> None:
        self._runtime = runtime
        self._attr_unique_id = f"{runtime.entry.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, runtime.entry.entry_id)},
            name="Fridge Assistant",
            manufacturer="Fridge Assistant",
            model="Inventaris",
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_UPDATED, self._handle_update
            )
        )

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()


class FridgeTotalSensor(_FridgeSensorBase):
    _attr_translation_key = "items_total"
    _attr_icon = "mdi:fridge"
    _attr_native_unit_of_measurement = "items"

    def __init__(self, runtime: FridgeRuntime) -> None:
        super().__init__(runtime, "items_total")

    @property
    def native_value(self) -> int:
        return len(self._runtime.store.items)

    @property
    def extra_state_attributes(self) -> dict:
        items = self._runtime.store.items.values()
        return {
            "by_location": {
                loc: sum(1 for i in items if i.get("location") == loc)
                for loc in LOCATIONS
            }
        }


class FridgeExpiringSensor(_FridgeSensorBase):
    _attr_translation_key = "expiring_soon"
    _attr_icon = "mdi:clock-alert-outline"
    _attr_native_unit_of_measurement = "items"

    def __init__(self, runtime: FridgeRuntime) -> None:
        super().__init__(runtime, "expiring_soon")

    @property
    def native_value(self) -> int:
        warn = int(self._runtime.options[CONF_WARN_DAYS])
        return len(self._runtime.store.soon_items(warn))

    @property
    def extra_state_attributes(self) -> dict:
        warn = int(self._runtime.options[CONF_WARN_DAYS])
        today = dt_util.now().date()
        items = self._runtime.store.soon_items(warn, today)
        summaries = [item_summary(i, today) for i in items]
        return {
            "warn_days": warn,
            "items": summaries,
            "next": summaries[0] if summaries else None,
        }


class FridgeExpiredSensor(_FridgeSensorBase):
    _attr_translation_key = "expired"
    _attr_icon = "mdi:food-off-outline"
    _attr_native_unit_of_measurement = "items"

    def __init__(self, runtime: FridgeRuntime) -> None:
        super().__init__(runtime, "expired")

    @property
    def native_value(self) -> int:
        return len(self._runtime.store.expired_items())

    @property
    def extra_state_attributes(self) -> dict:
        today = dt_util.now().date()
        return {
            "items": [item_summary(i, today) for i in self._runtime.store.expired_items(today)]
        }
