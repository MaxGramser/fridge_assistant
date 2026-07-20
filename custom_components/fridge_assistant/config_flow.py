"""Config and options flow for Fridge Assistant."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CODE_FORMAT_DIGITS,
    CODE_FORMAT_LETTERS,
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
    DOMAIN,
)
from .coordinator import get_options


class FridgeAssistantConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the initial setup."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is None:
            return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
        return self.async_create_entry(title="Fridge Assistant", data={})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return FridgeAssistantOptionsFlow()


class FridgeAssistantOptionsFlow(OptionsFlow):
    """Handle settings changes."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            data = dict(user_input)
            # Normalise: numbers to int, blank optional strings dropped.
            if CONF_WARN_DAYS in data:
                data[CONF_WARN_DAYS] = int(data[CONF_WARN_DAYS])
            if CONF_LABEL_COPIES in data:
                data[CONF_LABEL_COPIES] = int(data[CONF_LABEL_COPIES])
            for key in (CONF_AI_AGENT, CONF_OPENAI_KEY, CONF_OPENAI_MODEL,
                        CONF_PRINTER_URL):
                if key in data and isinstance(data[key], str):
                    data[key] = data[key].strip()
            return self.async_create_entry(title="", data=data)

        return self.async_show_form(
            step_id="init", data_schema=self._build_schema()
        )

    def _build_schema(self) -> vol.Schema:
        opts = get_options(self.config_entry)

        def sv(key: str) -> dict[str, Any]:
            return {"suggested_value": opts.get(key)}

        return vol.Schema(
            {
                vol.Optional(
                    CONF_WARN_DAYS, description=sv(CONF_WARN_DAYS)
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0, max=60, step=1, mode=selector.NumberSelectorMode.BOX,
                        unit_of_measurement="dagen",
                    )
                ),
                vol.Optional(
                    CONF_AI_ENABLED, description=sv(CONF_AI_ENABLED)
                ): selector.BooleanSelector(),
                vol.Optional(
                    CONF_AI_AGENT, description=sv(CONF_AI_AGENT)
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="conversation")
                ),
                vol.Optional(
                    CONF_OPENAI_KEY, description=sv(CONF_OPENAI_KEY)
                ): selector.TextSelector(
                    selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)
                ),
                vol.Optional(
                    CONF_OPENAI_MODEL, description=sv(CONF_OPENAI_MODEL)
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_CODE_FORMAT, description=sv(CONF_CODE_FORMAT)
                ): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        mode=selector.SelectSelectorMode.DROPDOWN,
                        options=[
                            selector.SelectOptionDict(
                                value=CODE_FORMAT_LETTERS, label="Letters eerst (AB12)"
                            ),
                            selector.SelectOptionDict(
                                value=CODE_FORMAT_DIGITS, label="Cijfers eerst (12AB)"
                            ),
                        ],
                    )
                ),
                vol.Optional(
                    CONF_NOTIFY_ENABLED, description=sv(CONF_NOTIFY_ENABLED)
                ): selector.BooleanSelector(),
                vol.Optional(
                    CONF_NOTIFY_TIME, description=sv(CONF_NOTIFY_TIME)
                ): selector.TimeSelector(),
                vol.Optional(
                    CONF_PRINTER_ENABLED, description=sv(CONF_PRINTER_ENABLED)
                ): selector.BooleanSelector(),
                vol.Optional(
                    CONF_PRINTER_URL, description=sv(CONF_PRINTER_URL)
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_LABEL_COPIES, description=sv(CONF_LABEL_COPIES)
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=1, max=10, step=1, mode=selector.NumberSelectorMode.BOX,
                    )
                ),
            }
        )
