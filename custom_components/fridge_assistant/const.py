"""Constants for the Fridge Assistant integration."""

from __future__ import annotations

from typing import Any, Final

DOMAIN: Final = "fridge_assistant"

# Storage. Version 2 = English enum identifiers (fridge/freezer/pantry,
# dish, dairy/…); version 1 stored the original Dutch ones. See
# FridgeDataStore._async_migrate_func in store.py.
STORAGE_VERSION: Final = 2
STORAGE_KEY: Final = "fridge_assistant.data"

# Frontend panel / static
URL_BASE: Final = "/fridge_assistant_static"
PANEL_URL_PATH: Final = "fridge-assistant"
PANEL_TITLE: Final = "Koelkast"
PANEL_TITLE_EN: Final = "Fridge"
PANEL_ICON: Final = "mdi:fridge-outline"
PANEL_WEBCOMPONENT: Final = "fridge-assistant-panel"

# Dispatcher signal fired whenever inventory/templates change
SIGNAL_UPDATED: Final = "fridge_assistant_updated"

# Locations
LOCATION_FRIDGE: Final = "fridge"
LOCATION_FREEZER: Final = "freezer"
LOCATION_PANTRY: Final = "pantry"
LOCATIONS: Final = [LOCATION_FRIDGE, LOCATION_FREEZER, LOCATION_PANTRY]

LOCATION_META: Final = {
    LOCATION_FRIDGE: {"label": "Koelkast", "emoji": "🧊", "icon": "mdi:fridge"},
    LOCATION_FREEZER: {"label": "Vriezer", "emoji": "❄️", "icon": "mdi:snowflake"},
    LOCATION_PANTRY: {"label": "Buiten koelkast", "emoji": "🧺", "icon": "mdi:basket-outline"},
}
# English labels for server-rendered text (printed labels, notifications).
# The panel translates location_meta itself; this covers backend-only output.
LOCATION_LABELS_EN: Final = {
    LOCATION_FRIDGE: "Fridge",
    LOCATION_FREEZER: "Freezer",
    LOCATION_PANTRY: "Pantry",
}

# Categories (keys must match seed_templates.json)
CATEGORIES: Final = {
    "vegetables": {"label": "Groente", "emoji": "🥦", "icon": "mdi:carrot"},
    "fruit": {"label": "Fruit", "emoji": "🍎", "icon": "mdi:food-apple"},
    "dairy": {"label": "Zuivel", "emoji": "🧀", "icon": "mdi:cheese"},
    "meat": {"label": "Vlees", "emoji": "🥩", "icon": "mdi:food-steak"},
    "fish": {"label": "Vis", "emoji": "🐟", "icon": "mdi:fish"},
    "prepared_dish": {"label": "Bereid gerecht", "emoji": "🍲", "icon": "mdi:pot-steam"},
    "bread_bakery": {"label": "Brood & bakkerij", "emoji": "🍞", "icon": "mdi:bread-slice"},
    "sauces_spices": {"label": "Saus & kruiden", "emoji": "🥫", "icon": "mdi:sauce"},
    "drinks": {"label": "Dranken", "emoji": "🥤", "icon": "mdi:cup"},
    "eggs": {"label": "Eieren", "emoji": "🥚", "icon": "mdi:egg"},
    "leftovers": {"label": "Restjes", "emoji": "🥡", "icon": "mdi:food-takeout-box"},
    "other": {"label": "Overig", "emoji": "🍽️", "icon": "mdi:food-variant"},
}
DEFAULT_CATEGORY: Final = "other"
DEFAULT_EMOJI: Final = "🍽️"
DEFAULT_ICON: Final = "mdi:food-variant"

# Two top-level groups every template belongs to.
KIND_INGREDIENT: Final = "ingredient"
KIND_DISH: Final = "dish"
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
    "vegetables": KIND_INGREDIENT,
    "fruit": KIND_INGREDIENT,
    "dairy": KIND_INGREDIENT,
    "meat": KIND_INGREDIENT,
    "fish": KIND_INGREDIENT,
    "bread_bakery": KIND_INGREDIENT,
    "sauces_spices": KIND_INGREDIENT,
    "drinks": KIND_INGREDIENT,
    "eggs": KIND_INGREDIENT,
    "other": KIND_INGREDIENT,
    "prepared_dish": KIND_DISH,
    "leftovers": KIND_DISH,
}
DEFAULT_KIND: Final = KIND_INGREDIENT

# ---------------------------------------------------------------------------
# Legacy (pre-1.x) Dutch identifiers. Storage, service calls and AI answers
# used Dutch enum values before the switch to English ones; these maps drive
# the one-time storage migration in store.py and keep old service calls /
# automations working. Values may appear in: item location/category/kind,
# template category/kind/shelf_life keys and the opened_koelkast field.
# ---------------------------------------------------------------------------
LEGACY_LOCATIONS: Final = {
    "koelkast": LOCATION_FRIDGE,
    "vriezer": LOCATION_FREEZER,
    "buiten": LOCATION_PANTRY,
}
LEGACY_KINDS: Final = {"gerecht": KIND_DISH}
LEGACY_CATEGORIES: Final = {
    "groente": "vegetables",
    "zuivel": "dairy",
    "vlees": "meat",
    "vis": "fish",
    "bereid_gerecht": "prepared_dish",
    "brood_bakkerij": "bread_bakery",
    "saus_kruiden": "sauces_spices",
    "dranken": "drinks",
    "eieren": "eggs",
    "restjes": "leftovers",
    "overig": "other",
}


def canonical_location(value: Any) -> Any:
    """Map a legacy Dutch location value onto the current English one."""
    return LEGACY_LOCATIONS.get(value, value)


def canonical_category(value: Any) -> Any:
    return LEGACY_CATEGORIES.get(value, value)


def canonical_kind(value: Any) -> Any:
    return LEGACY_KINDS.get(value, value)

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


def localized(strings: dict[str, dict[str, str]], lang: str, key: str, **kwargs: Any) -> str:
    """Format ``key`` from a per-file nl/en STRINGS dict for ``lang``."""
    return strings[lang][key].format(**kwargs)


# Error strings identical across services.py and websocket_api.py (both raise
# them for the same conditions), kept in one place to avoid drift.
_SHARED_STRINGS: dict[str, dict[str, str]] = {
    "nl": {
        "not_configured": "Fridge Assistant is niet (meer) geconfigureerd.",
        "not_loaded": "Fridge Assistant niet geladen.",
        "item_not_found": "Item {id} niet gevonden.",
        "cannot_restore": "Kan niet herstellen.",
    },
    "en": {
        "not_configured": "Fridge Assistant is not configured (anymore).",
        "not_loaded": "Fridge Assistant not loaded.",
        "item_not_found": "Item {id} not found.",
        "cannot_restore": "Cannot restore.",
    },
}


def shared_text(hass, key: str, **kwargs: Any) -> str:
    """nl/en text for an error shared by services.py and websocket_api.py."""
    return localized(_SHARED_STRINGS, resolve_language(hass), key, **kwargs)
