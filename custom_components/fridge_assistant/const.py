"""Constants for the Fridge Assistant integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "fridge_assistant"

# Storage
STORAGE_VERSION: Final = 1
STORAGE_KEY: Final = "fridge_assistant.data"

# Frontend panel / static
URL_BASE: Final = "/fridge_assistant_static"
PANEL_URL_PATH: Final = "fridge-assistant"
PANEL_TITLE: Final = "Koelkast"
PANEL_ICON: Final = "mdi:fridge-outline"
PANEL_WEBCOMPONENT: Final = "fridge-assistant-panel"

# Dispatcher signal fired whenever inventory/templates change
SIGNAL_UPDATED: Final = "fridge_assistant_updated"

# Locations
LOCATION_FRIDGE: Final = "koelkast"
LOCATION_FREEZER: Final = "vriezer"
LOCATION_OUTSIDE: Final = "buiten"
LOCATIONS: Final = [LOCATION_FRIDGE, LOCATION_FREEZER, LOCATION_OUTSIDE]

LOCATION_META: Final = {
    LOCATION_FRIDGE: {"label": "Koelkast", "emoji": "🧊", "icon": "mdi:fridge"},
    LOCATION_FREEZER: {"label": "Vriezer", "emoji": "❄️", "icon": "mdi:snowflake"},
    LOCATION_OUTSIDE: {"label": "Buiten koelkast", "emoji": "🧺", "icon": "mdi:basket-outline"},
}
# English labels for server-rendered text (printed labels, notifications).
# The panel translates location_meta itself; this covers backend-only output.
LOCATION_LABELS_EN: Final = {
    LOCATION_FRIDGE: "Fridge",
    LOCATION_FREEZER: "Freezer",
    LOCATION_OUTSIDE: "Pantry",
}

# Categories (keys must match seed_templates.json)
CATEGORIES: Final = {
    "groente": {"label": "Groente", "emoji": "🥦", "icon": "mdi:carrot"},
    "fruit": {"label": "Fruit", "emoji": "🍎", "icon": "mdi:food-apple"},
    "zuivel": {"label": "Zuivel", "emoji": "🧀", "icon": "mdi:cheese"},
    "vlees": {"label": "Vlees", "emoji": "🥩", "icon": "mdi:food-steak"},
    "vis": {"label": "Vis", "emoji": "🐟", "icon": "mdi:fish"},
    "bereid_gerecht": {"label": "Bereid gerecht", "emoji": "🍲", "icon": "mdi:pot-steam"},
    "brood_bakkerij": {"label": "Brood & bakkerij", "emoji": "🍞", "icon": "mdi:bread-slice"},
    "saus_kruiden": {"label": "Saus & kruiden", "emoji": "🥫", "icon": "mdi:sauce"},
    "dranken": {"label": "Dranken", "emoji": "🥤", "icon": "mdi:cup"},
    "eieren": {"label": "Eieren", "emoji": "🥚", "icon": "mdi:egg"},
    "restjes": {"label": "Restjes", "emoji": "🥡", "icon": "mdi:food-takeout-box"},
    "overig": {"label": "Overig", "emoji": "🍽️", "icon": "mdi:food-variant"},
}
DEFAULT_EMOJI: Final = "🍽️"
DEFAULT_ICON: Final = "mdi:food-variant"

# Two top-level groups every template belongs to.
KIND_INGREDIENT: Final = "ingredient"
KIND_DISH: Final = "gerecht"
KINDS: Final = {
    KIND_INGREDIENT: {
        "label": "Losse ingrediënten", "short": "Ingrediënten",
        "emoji": "🥕", "icon": "mdi:carrot",
    },
    KIND_DISH: {
        "label": "Gerechten", "short": "Gerechten",
        "emoji": "🍲", "icon": "mdi:pot-steam",
    },
}
# English labels for server-rendered text (printed labels); see LOCATION_LABELS_EN.
KIND_LABELS_EN: Final = {
    KIND_INGREDIENT: {"label": "Individual ingredients", "short": "Ingredients"},
    KIND_DISH: {"label": "Dishes", "short": "Dishes"},
}
# Which fine category rolls up into which big group (used as the default).
CATEGORY_KIND: Final = {
    "groente": KIND_INGREDIENT,
    "fruit": KIND_INGREDIENT,
    "zuivel": KIND_INGREDIENT,
    "vlees": KIND_INGREDIENT,
    "vis": KIND_INGREDIENT,
    "brood_bakkerij": KIND_INGREDIENT,
    "saus_kruiden": KIND_INGREDIENT,
    "dranken": KIND_INGREDIENT,
    "eieren": KIND_INGREDIENT,
    "overig": KIND_INGREDIENT,
    "bereid_gerecht": KIND_DISH,
    "restjes": KIND_DISH,
}
DEFAULT_KIND: Final = KIND_INGREDIENT

# Config / options
CONF_WARN_DAYS: Final = "warn_days"
CONF_AI_ENABLED: Final = "ai_enabled"
CONF_AI_AGENT: Final = "ai_agent"
CONF_OPENAI_KEY: Final = "openai_api_key"
CONF_OPENAI_MODEL: Final = "openai_model"
CONF_CODE_FORMAT: Final = "code_format"
CONF_NOTIFY_TIME: Final = "notify_time"
CONF_NOTIFY_ENABLED: Final = "notify_enabled"
# Printer add-on (optional, phase 2)
CONF_PRINTER_ENABLED: Final = "printer_enabled"
CONF_PRINTER_URL: Final = "printer_url"
CONF_LABEL_COPIES: Final = "label_copies"

CODE_FORMAT_LETTERS: Final = "letters_first"  # AB12
CODE_FORMAT_DIGITS: Final = "digits_first"  # 12AB

DEFAULT_WARN_DAYS: Final = 3
DEFAULT_AI_ENABLED: Final = True
DEFAULT_OPENAI_MODEL: Final = "gpt-4o-mini"
DEFAULT_CODE_FORMAT: Final = CODE_FORMAT_LETTERS
DEFAULT_NOTIFY_TIME: Final = "09:00:00"
DEFAULT_NOTIFY_ENABLED: Final = True

DEFAULT_PRINTER_ENABLED: Final = False
# The local add-on is reachable on the Supervisor network by its hostname.
DEFAULT_PRINTER_URL: Final = "http://local-label-printer:8000"
DEFAULT_LABEL_COPIES: Final = 1

# Label / printer hardware — validated combination.
# NOTE: tested only with a DYMO LabelWriter 550 and 99014 labels (54 x 101 mm).
LABEL_MEDIA: Final = "w154h286"
LABEL_TYPE: Final = "99014"
LABEL_SIZE_MM: Final = "54 x 101 mm"
PRINTER_MODEL: Final = "DYMO LabelWriter 550"

# Completion / history
ACTION_EATEN: Final = "eaten"
ACTION_TOSSED: Final = "tossed"
HISTORY_ACTIONS: Final = (ACTION_EATEN, ACTION_TOSSED)
# Rolling window kept in storage. The whole store blob is loaded in memory and
# rewritten on every save, so history is capped rather than unbounded.
MAX_HISTORY: Final = 500

# Events
EVENT_EXPIRING: Final = "fridge_assistant_expiring"
EVENT_ITEM_ADDED: Final = "fridge_assistant_item_added"
EVENT_ITEM_REMOVED: Final = "fridge_assistant_item_removed"
EVENT_ITEM_COMPLETED: Final = "fridge_assistant_item_completed"

# Persistent notification id
NOTIFICATION_ID: Final = "fridge_assistant_expiring"

# expiry_source values
SOURCE_TEMPLATE: Final = "template"
SOURCE_AI: Final = "ai"
SOURCE_MANUAL: Final = "manual"
SOURCE_NONE: Final = "none"


def resolve_language(hass) -> str:
    """"nl" if Home Assistant's language is Dutch, "en" for anything else.

    Fridge Assistant only ships nl/en text, so any other configured HA
    language (or none at all) falls back to English rather than Dutch.
    """
    raw = (getattr(hass.config, "language", None) or "").split("-")[0].lower()
    return "nl" if raw == "nl" else "en"


def location_label(location: str, lang: str) -> str:
    """Server-rendered location label (printed labels, notifications)."""
    if lang == "en":
        return LOCATION_LABELS_EN.get(location, location)
    return LOCATION_META.get(location, {}).get("label", location)


def kind_label(kind: str, lang: str, *, short: bool = True) -> str:
    """Server-rendered kind label (printed labels)."""
    table = KIND_LABELS_EN if lang == "en" else KINDS
    meta = table.get(kind, {})
    key = "short" if short else "label"
    return meta.get(key) or meta.get("label") or kind
