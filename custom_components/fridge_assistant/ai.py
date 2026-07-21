"""AI shelf-life estimation, via a direct OpenAI key or a HA conversation agent."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CATEGORIES,
    CATEGORY_KIND,
    CONF_AI_AGENT,
    CONF_OPENAI_KEY,
    CONF_OPENAI_MODEL,
    DEFAULT_CATEGORY,
    DEFAULT_EMOJI,
    DEFAULT_ICON,
    DEFAULT_KIND,
    DEFAULT_OPENAI_MODEL,
    KIND_DISH,
    KIND_INGREDIENT,
    LEGACY_LOCATIONS,
    LOCATIONS,
    canonical_category,
    localized,
    resolve_language,
)

_LOGGER = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"

# Follows resolve_language() — same nl-if-Dutch-else-English rule as everywhere else.
_STRINGS: dict[str, dict[str, str]] = {
    "nl": {
        "no_name": "Geen productnaam opgegeven.",
        "unreadable_json": "Kon AI-antwoord niet lezen: {err}",
        "no_json": "AI gaf geen bruikbaar JSON-antwoord.",
        "openai_error": "OpenAI-fout ({status}): {body}",
        "openai_unreachable": "OpenAI onbereikbaar: {err}",
        "unexpected_response": "Onverwacht OpenAI-antwoord.",
        "no_ai": "Geen AI beschikbaar. Stel een conversation-agent of OpenAI-key in "
        "bij de instellingen van Fridge Assistant.",
        "no_agent": "Geen geschikte AI-agent gevonden. Voeg een LLM conversation-agent "
        "toe (bijv. OpenAI) of vul een OpenAI-key in bij de instellingen van Fridge "
        "Assistant.",
        "agent_failed": "Conversation-agent faalde: {err}",
        "no_agent_response": "Geen leesbaar antwoord van de agent.",
    },
    "en": {
        "no_name": "No product name given.",
        "unreadable_json": "Could not read the AI response: {err}",
        "no_json": "The AI didn't return usable JSON.",
        "openai_error": "OpenAI error ({status}): {body}",
        "openai_unreachable": "OpenAI unreachable: {err}",
        "unexpected_response": "Unexpected OpenAI response.",
        "no_ai": "No AI available. Set a conversation agent or an OpenAI key in "
        "Fridge Assistant's settings.",
        "no_agent": "No suitable AI agent found. Add an LLM conversation agent "
        "(e.g. OpenAI) or fill in an OpenAI key in Fridge Assistant's settings.",
        "agent_failed": "Conversation agent failed: {err}",
        "no_agent_response": "No readable response from the agent.",
    },
}


def _t(lang: str, key: str, **kwargs: Any) -> str:
    return localized(_STRINGS, lang, key, **kwargs)


# Instructions are in English (most reliable for LLMs); only the free-text
# "notes" tip is asked in the user's own language so it fits the UI.
_SYSTEM_PROMPT = (
    "You are a food-storage assistant for a household food inventory. "
    "Given a product or dish, estimate how long it keeps, in whole days, in three "
    "places: 'fridge' (refrigerator, ~4°C), 'freezer' (~-18°C) and 'pantry' "
    "(kitchen cupboard at room temperature). "
    "Be realistic and food-safe. Use null ONLY when a place is unsafe for the "
    "product or genuinely pointless — never because it is merely 'not the best' "
    "spot. Guidelines: shelf-stable goods (uncooked rice, dry pasta, flour, sugar, "
    "canned food, unopened jars, oil, honey) belong in the pantry — give 'pantry' "
    "their real long shelf life (often 365-730 days) and ALWAYS return null for "
    "both 'fridge' and 'freezer' for them (cold storage adds nothing). "
    "Perishables (raw meat, fish, dairy, cooked food) get conservative "
    "fridge durations and usually null for 'pantry', but freezing keeps most of "
    "them good for 30-365 days — only use null for the freezer when a product "
    "does not survive freezing (e.g. lettuce, cucumber). Some produce (bananas, "
    "onions, potatoes, whole bread) keeps fine at room temperature. "
    "Reply with ONLY valid JSON, no prose."
)

_USER_TEMPLATE = (
    'Product: "{name}".\n'
    "Return exactly this JSON object:\n"
    "{{\n"
    '  "fridge": <integer days or null>,\n'
    '  "freezer": <integer days or null>,\n'
    '  "pantry": <integer days or null>,\n'
    '  "kind": "<ingredient for a single ingredient, or dish for a prepared meal>",\n'
    '  "category": "<one of: {categories}>",\n'
    '  "emoji": "<1 fitting food emoji>",\n'
    '  "icon": "mdi:<fitting material design icon id>",\n'
    '  "notes": "<a short storage tip, max 90 chars, written in the language with '
    "ISO code '{lang}'>\"\n"
    "}}"
)


def _user_prompt(hass: HomeAssistant, name: str) -> str:
    lang = resolve_language(hass)
    return _USER_TEMPLATE.format(name=name, categories=", ".join(CATEGORIES), lang=lang)


class AIEstimateError(Exception):
    """Raised when an AI estimate cannot be produced."""


# Conversation integrations that provide a free-form LLM (as opposed to the
# intent-only default agent). Used to auto-pick a sensible agent.
_LLM_AGENT_KEYWORDS = (
    "openai",
    "anthropic",
    "google_generative",
    "google_gen",
    "gemini",
    "extended",
    "ollama",
    "mistral",
    "groq",
)


def _pick_conversation_agent(hass: HomeAssistant) -> str | None:
    """Choose an LLM conversation agent, avoiding the intent-only default."""
    entities = hass.states.async_entity_ids("conversation")
    candidates = [e for e in entities if e != "conversation.home_assistant"]
    for keyword in _LLM_AGENT_KEYWORDS:
        for entity_id in candidates:
            if keyword in entity_id:
                return entity_id
    return candidates[0] if candidates else None


def _extract_json(text: str, lang: str) -> dict[str, Any]:
    text = text.strip()
    # Strip ```json ... ``` fences if present.
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(text)
    except ValueError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except ValueError as err:
            raise AIEstimateError(_t(lang, "unreadable_json", err=err)) from err
    raise AIEstimateError(_t(lang, "no_json"))


def _coerce_days(value: Any) -> int | None:
    if value is None:
        return None
    try:
        num = int(round(float(value)))
    except (ValueError, TypeError):
        return None
    if num <= 0:
        return None
    return min(num, 3650)


# fridge -> koelkast, …: tolerate models that answer with the legacy Dutch
# keys even though the prompt asks for the English ones.
_LEGACY_LOCATION_ALIASES = {v: k for k, v in LEGACY_LOCATIONS.items()}


def _normalize(name: str, parsed: dict[str, Any]) -> dict[str, Any]:
    shelf = {
        loc: _coerce_days(
            parsed.get(loc, parsed.get(_LEGACY_LOCATION_ALIASES.get(loc)))
        )
        for loc in LOCATIONS
    }
    category = canonical_category(parsed.get("category"))
    if category not in CATEGORIES:
        category = DEFAULT_CATEGORY
    kind_raw = str(parsed.get("kind") or "").strip().lower()
    if kind_raw in (KIND_DISH, "meal", "prepared", "gerecht"):
        kind = KIND_DISH
    elif kind_raw in (KIND_INGREDIENT, "los"):
        kind = KIND_INGREDIENT
    else:
        kind = CATEGORY_KIND.get(category, DEFAULT_KIND)
    emoji = parsed.get("emoji") or CATEGORIES[category].get("emoji", DEFAULT_EMOJI)
    icon = parsed.get("icon") or CATEGORIES[category].get("icon", DEFAULT_ICON)
    if not isinstance(icon, str) or not icon.startswith("mdi:"):
        icon = CATEGORIES[category].get("icon", DEFAULT_ICON)
    return {
        "name": name,
        "shelf_life": shelf,
        "kind": kind,
        "category": category,
        "emoji": emoji if isinstance(emoji, str) else DEFAULT_EMOJI,
        "icon": icon,
        "notes": (parsed.get("notes") or "").strip()[:140],
        "source": "ai",
    }


async def async_estimate(
    hass: HomeAssistant, name: str, options: dict[str, Any]
) -> dict[str, Any]:
    """Estimate shelf life for ``name``. Prefers a direct OpenAI key, else agent."""
    if not name or not name.strip():
        raise AIEstimateError(_t(resolve_language(hass), "no_name"))
    name = name.strip()

    api_key = (options.get(CONF_OPENAI_KEY) or "").strip()
    if api_key:
        result = await _estimate_openai(hass, name, api_key, options)
        result["provider"] = "openai"
        return result

    result = await _estimate_conversation(hass, name, options)
    result["provider"] = "conversation"
    return result


async def _openai_request(
    session, api_key: str, payload: dict[str, Any]
) -> tuple[int, str]:
    async with session.post(
        OPENAI_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=30,
    ) as resp:
        return resp.status, await resp.text()


async def _estimate_openai(
    hass: HomeAssistant, name: str, api_key: str, options: dict[str, Any]
) -> dict[str, Any]:
    lang = resolve_language(hass)
    session = async_get_clientsession(hass)
    model = options.get(CONF_OPENAI_MODEL) or DEFAULT_OPENAI_MODEL
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(hass, name)},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        status, body = await _openai_request(session, api_key, payload)
        # Reasoning-style models (o1/o3/gpt-5, ...) reject any non-default
        # temperature. Retry once without it rather than hardcoding a model
        # name list that would always be out of date.
        if status == 400 and "temperature" in payload:
            try:
                err_param = json.loads(body).get("error", {}).get("param")
            except ValueError:
                err_param = None
            if err_param == "temperature":
                payload.pop("temperature")
                status, body = await _openai_request(session, api_key, payload)
        if status != 200:
            raise AIEstimateError(_t(lang, "openai_error", status=status, body=body[:200]))
        data = json.loads(body)
    except AIEstimateError:
        raise
    except Exception as err:  # noqa: BLE001 - surface any network error to the UI
        raise AIEstimateError(_t(lang, "openai_unreachable", err=err)) from err

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as err:
        raise AIEstimateError(_t(lang, "unexpected_response")) from err
    return _normalize(name, _extract_json(content, lang))


async def _estimate_conversation(
    hass: HomeAssistant, name: str, options: dict[str, Any]
) -> dict[str, Any]:
    lang = resolve_language(hass)
    if not hass.services.has_service("conversation", "process"):
        raise AIEstimateError(_t(lang, "no_ai"))
    service_data: dict[str, Any] = {
        "text": _SYSTEM_PROMPT + "\n\n" + _user_prompt(hass, name)
    }
    agent = (options.get(CONF_AI_AGENT) or "").strip()
    if not agent:
        agent = _pick_conversation_agent(hass) or ""
    if not agent:
        raise AIEstimateError(_t(lang, "no_agent"))
    service_data["agent_id"] = agent

    try:
        resp = await hass.services.async_call(
            "conversation",
            "process",
            service_data,
            blocking=True,
            return_response=True,
        )
    except Exception as err:  # noqa: BLE001
        raise AIEstimateError(_t(lang, "agent_failed", err=err)) from err

    try:
        text = resp["response"]["speech"]["plain"]["speech"]
    except (KeyError, TypeError) as err:
        raise AIEstimateError(_t(lang, "no_agent_response")) from err
    return _normalize(name, _extract_json(text, lang))
