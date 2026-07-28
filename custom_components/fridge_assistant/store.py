"""Data layer for Fridge Assistant: items + templates, persisted via HA Store."""

from __future__ import annotations

import json
import logging
import unicodedata
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .codes import generate_code
from .const import (
    ACTION_EATEN,
    ACTION_PORTION_EATEN,
    ACTION_PORTION_TOSSED,
    ACTION_TOSSED,
    CATEGORIES,
    CATEGORY_KIND,
    DEFAULT_CATEGORY,
    DEFAULT_CODE_FORMAT,
    DEFAULT_EMOJI,
    DEFAULT_ICON,
    DEFAULT_KIND,
    HISTORY_ACTIONS,
    KIND_DISH,
    KIND_INGREDIENT,
    LOCATIONS,
    MAX_HISTORY,
    MAX_PORTIONS,
    PORTION_ACTIONS,
    SOURCE_MANUAL,
    SOURCE_NONE,
    SOURCE_TEMPLATE,
    STORAGE_KEY,
    STORAGE_VERSION,
    UNKNOWN_ITEM_NAME,
    canonical_category,
    canonical_kind,
    canonical_location,
    resolve_language,
)

_LOGGER = logging.getLogger(__name__)

SEED_PATH = Path(__file__).parent / "data" / "seed_templates.json"


def _normalize(text: str) -> str:
    """Lowercase, strip accents and punctuation for matching."""
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().strip()
    out = []
    for ch in text:
        out.append(ch if ch.isalnum() or ch.isspace() else " ")
    return " ".join("".join(out).split())


# Filler/modifier words that carry no matching signal on their own.
_STOP = {
    "met", "en", "de", "het", "een", "van", "in", "op", "gekookt", "rauw", "vers",
    "zonder", "geen", "restje", "restjes", "beetje", "oud", "oude", "half", "halve",
    "stukje", "stukjes", "verse", "gebakken", "gekookte",
}
# Words that flip meaning: what follows is explicitly excluded.
_NEG_WORDS = {"zonder", "geen"}


def _tokens(text: str) -> set[str]:
    return {t for t in _normalize(text).split() if t and t not in _STOP}


def _negated_tokens(text: str) -> set[str]:
    """Words the user explicitly excluded, e.g. 'macaroni zonder vlees' -> {vlees}."""
    words = _normalize(text).split()
    neg: set[str] = set()
    for i, word in enumerate(words):
        if word in _NEG_WORDS:
            neg.update(words[i + 1 : i + 3])
    return {t for t in neg if t and t not in ("met", "en", "de", "het", "een", "van")}


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def item_days_left(item: dict[str, Any], today: date) -> int | None:
    """Days until expiry (negative = already expired), or None if no expiry."""
    exp = parse_date(item.get("expiry_date"))
    if exp is None:
        return None
    return (exp - today).days


def item_age_days(item: dict[str, Any], today: date) -> int | None:
    added = parse_date(item.get("added_date"))
    if added is None:
        return None
    return (today - added).days


def template_kind(tpl: dict[str, Any]) -> str:
    """Big group a template belongs to: 'ingredient' or 'dish'."""
    return tpl.get("kind") or CATEGORY_KIND.get(tpl.get("category"), DEFAULT_KIND)


def _migrate_record_v1(record: dict[str, Any]) -> None:
    """Rewrite one v1 item/template dict to the English identifiers."""
    for field, canon in (
        ("location", canonical_location),
        ("category", canonical_category),
        ("kind", canonical_kind),
    ):
        if field in record:
            record[field] = canon(record[field])
    sl = record.get("shelf_life")
    if isinstance(sl, dict):
        record["shelf_life"] = {canonical_location(k): v for k, v in sl.items()}
    if "opened_koelkast" in record:
        record.setdefault("opened_fridge", record.pop("opened_koelkast"))


def _migrate_category_v4(record: dict[str, Any]) -> None:
    """Remap a v3-and-earlier ``category`` onto the current key (e.g. the
    old catch-all "prepared_dish" onto "dinner")."""
    if "category" in record:
        record["category"] = canonical_category(record["category"])


def default_portions(count: int = 1) -> list[dict[str, Any]]:
    """A fresh portions list: ``count`` open portions numbered from 1."""
    count = max(1, min(int(count or 1), MAX_PORTIONS))
    return [{"n": i + 1, "status": "open"} for i in range(count)]


class FridgeDataStore(Store):
    """Versioned store.

    v1 -> v2: Dutch identifiers to English. v2 -> v3: every item and history
    snapshot gets a ``portions`` list (default one open portion). v3 -> v4:
    the "prepared_dish" category is remapped onto "dinner" (see
    LEGACY_CATEGORIES / CATEGORIES in const.py).
    """

    async def _async_migrate_func(
        self, old_major_version: int, old_minor_version: int, old_data: dict[str, Any]
    ) -> dict[str, Any]:
        if old_major_version == 1:
            _LOGGER.info(
                "Migrating Fridge Assistant storage v1 -> v2 "
                "(Dutch to English identifiers)"
            )
            for item in old_data.get("items", []):
                _migrate_record_v1(item)
            for tpl in old_data.get("user_templates", []):
                _migrate_record_v1(tpl)
            for event in old_data.get("history", []):
                snap = event.get("item")
                if isinstance(snap, dict):
                    _migrate_record_v1(snap)
        if old_major_version < 3:
            _LOGGER.info("Migrating Fridge Assistant storage -> v3 (portions)")
            for item in old_data.get("items", []):
                item.setdefault("portions", default_portions())
            for event in old_data.get("history", []):
                snap = event.get("item")
                if isinstance(snap, dict):
                    snap.setdefault("portions", default_portions())
        if old_major_version < 4:
            _LOGGER.info(
                "Migrating Fridge Assistant storage -> v4 "
                "(prepared_dish category split into meal-time categories)"
            )
            for item in old_data.get("items", []):
                _migrate_category_v4(item)
            for tpl in old_data.get("user_templates", []):
                _migrate_category_v4(tpl)
            for event in old_data.get("history", []):
                snap = event.get("item")
                if isinstance(snap, dict):
                    _migrate_category_v4(snap)
        return old_data


class FridgeStore:
    """Holds inventory items and templates and persists them."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        # atomic_writes: tmp-file + rename, so a power cut mid-save can never
        # leave a truncated file behind (Store silently treats a corrupt file
        # as "no data", which would reset the whole inventory).
        self._store: Store = FridgeDataStore(
            hass, STORAGE_VERSION, STORAGE_KEY, atomic_writes=True
        )
        self.items: dict[str, dict[str, Any]] = {}
        self.user_templates: dict[str, dict[str, Any]] = {}
        self.hidden: set[str] = set()
        self.history: list[dict[str, Any]] = []  # newest first, capped
        self._seed: dict[str, dict[str, Any]] = {}

    # ---- loading / saving -------------------------------------------------

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if data:
            self.items = {i["id"]: i for i in data.get("items", []) if i.get("id")}
            self.user_templates = {
                t["id"]: t for t in data.get("user_templates", []) if t.get("id")
            }
            self.hidden = set(data.get("hidden", []))
            self.history = list(data.get("history", []))[:MAX_HISTORY]
        self._seed = await self.hass.async_add_executor_job(self._read_seed)
        _LOGGER.debug(
            "Fridge Assistant loaded: %s items, %s user templates, %s seed templates",
            len(self.items),
            len(self.user_templates),
            len(self._seed),
        )

    def _read_seed(self) -> dict[str, dict[str, Any]]:
        try:
            with SEED_PATH.open(encoding="utf-8") as fh:
                raw = json.load(fh)
        except (OSError, ValueError) as err:  # pragma: no cover - defensive
            _LOGGER.warning("Could not read seed templates: %s", err)
            return {}
        result: dict[str, dict[str, Any]] = {}
        for tpl in raw.get("templates", []):
            tpl = dict(tpl)
            tpl["source"] = "builtin"
            result[tpl["id"]] = tpl
        return result

    async def async_save(self) -> None:
        await self._store.async_save(
            {
                "items": list(self.items.values()),
                "user_templates": list(self.user_templates.values()),
                "hidden": list(self.hidden),
                "history": self.history,
            }
        )

    # ---- templates --------------------------------------------------------

    def all_templates(self) -> list[dict[str, Any]]:
        """Merged templates; user templates override builtins with the same id."""
        merged: dict[str, dict[str, Any]] = dict(self._seed)
        merged.update(self.user_templates)
        for hid in self.hidden:
            merged.pop(hid, None)
        return sorted(merged.values(), key=lambda t: t.get("name", "").lower())

    def hidden_templates(self) -> list[dict[str, Any]]:
        """Builtin templates the user has hidden (for the restore view)."""
        out: list[dict[str, Any]] = []
        for hid in self.hidden:
            tpl = self._seed.get(hid)
            if tpl:
                item = dict(tpl)
                item["builtin"] = True
                item["custom"] = False
                item["hidden"] = True
                item["kind"] = template_kind(tpl)
                out.append(item)
        return sorted(out, key=lambda t: t.get("name", "").lower())

    def hide_template(self, template_id: str) -> bool:
        """Hide a builtin from the working set (also drops any override)."""
        self.user_templates.pop(template_id, None)
        if template_id in self._seed:
            self.hidden.add(template_id)
            return True
        return False

    def unhide_template(self, template_id: str) -> bool:
        if template_id in self.hidden:
            self.hidden.discard(template_id)
            return True
        return False

    def templates_for_ui(self) -> list[dict[str, Any]]:
        """all_templates() annotated with builtin/custom flags for the editor."""
        seed_ids = set(self._seed)
        user_ids = set(self.user_templates)
        out: list[dict[str, Any]] = []
        for tpl in self.all_templates():
            item = dict(tpl)
            item["builtin"] = tpl["id"] in seed_ids
            item["custom"] = tpl["id"] in user_ids
            item["kind"] = template_kind(tpl)
            out.append(item)
        return out

    def get_template(self, template_id: str | None) -> dict[str, Any] | None:
        if not template_id:
            return None
        return self.user_templates.get(template_id) or self._seed.get(template_id)

    def match_template(self, query: str) -> dict[str, Any] | None:
        """Conservative match of free text to a template, or None.

        Only returns a template when the typed words line up closely with a
        template name/alias. Loose single-word overlaps are rejected so we
        don't guess wildly (e.g. 'pizza' must not become 'kaas'), and negations
        ('macaroni zonder vlees', 'geen ui') drop any template that contains
        the excluded word.
        """
        if not query or not query.strip():
            return None
        norm = _normalize(query)
        if not norm:
            return None
        negated = _negated_tokens(query)
        qtokens = _tokens(query) - negated
        best: tuple[float, dict[str, Any]] | None = None

        for tpl in self.all_templates():
            names = [tpl.get("name", "")] + list(tpl.get("aliases", []))
            norm_names = [_normalize(n) for n in names if n]
            ctokens: set[str] = set()
            for nn in norm_names:
                ctokens |= set(nn.split())

            # Never suggest something the user explicitly excluded.
            if negated and (negated & ctokens):
                continue

            score = 0.0
            if norm in norm_names:
                score = 100.0
            elif qtokens and ctokens:
                overlap = qtokens & ctokens
                if overlap:
                    if qtokens == ctokens:
                        score = 85.0
                    elif qtokens <= ctokens:  # typed words are a subset of the template
                        score = 72.0 - 3.0 * (len(ctokens) - len(qtokens))
                    elif ctokens <= qtokens:  # template fully inside what was typed
                        score = 60.0
                    else:  # only partial overlap — usually a wrong guess
                        score = 20.0 + 6.0 * len(overlap)

            if score and (best is None or score > best[0]):
                best = (score, tpl)

        # 58 = accept exact / subset / superset matches; reject loose overlap.
        if best and best[0] >= 58.0:
            return best[1]
        return None

    def upsert_user_template(self, data: dict[str, Any]) -> dict[str, Any]:
        # An explicit id means "edit this one" (override a builtin / update an
        # own template). Without an id it's a brand-new template, so we pick an
        # id that can't collide with a builtin or existing user template —
        # otherwise a new "Ui" would silently overwrite the builtin onion.
        explicit_id = data.get("id")
        tpl_id = explicit_id or self._unique_template_id(data.get("name", "template"))
        existing = self.user_templates.get(tpl_id, {})
        tpl = {
            "id": tpl_id,
            "name": data.get("name", existing.get("name", tpl_id)),
            "aliases": data.get("aliases", existing.get("aliases", [])),
            "category": canonical_category(
                data.get("category", existing.get("category", DEFAULT_CATEGORY))
            ),
            "emoji": data.get("emoji", existing.get("emoji", DEFAULT_EMOJI)),
            "icon": data.get("icon", existing.get("icon", DEFAULT_ICON)),
            "shelf_life": data.get("shelf_life", existing.get("shelf_life", {})),
            "notes": data.get("notes", existing.get("notes", "")),
            "source": data.get("source", "user"),
        }
        tpl["kind"] = canonical_kind(
            data.get("kind")
            or existing.get("kind")
            or CATEGORY_KIND.get(tpl["category"], DEFAULT_KIND)
        )
        if "opened_fridge" in data or "opened_fridge" in existing:
            tpl["opened_fridge"] = data.get(
                "opened_fridge", existing.get("opened_fridge")
            )
        self.user_templates[tpl_id] = tpl
        return tpl

    def remove_user_template(self, template_id: str) -> bool:
        return self.user_templates.pop(template_id, None) is not None

    @staticmethod
    def _slug(name: str) -> str:
        norm = _normalize(name).replace(" ", "-")
        return norm or uuid.uuid4().hex[:8]

    def _unique_template_id(self, name: str) -> str:
        """Fresh template id that collides with neither a builtin nor an
        existing user template."""
        base = self._slug(name)
        if base not in self._seed and base not in self.user_templates:
            return base
        for _ in range(1000):
            candidate = f"{base}-{uuid.uuid4().hex[:4]}"
            if candidate not in self._seed and candidate not in self.user_templates:
                return candidate
        return uuid.uuid4().hex

    @staticmethod
    def shelf_life_days(template: dict[str, Any] | None, location: str) -> int | None:
        if not template:
            return None
        sl = template.get("shelf_life") or {}
        val = sl.get(location)
        return int(val) if isinstance(val, (int, float)) else None

    # ---- items ------------------------------------------------------------

    def _decorate_from_template(
        self, item: dict[str, Any], template: dict[str, Any] | None
    ) -> None:
        """Fill emoji/icon/category from a template, else category defaults."""
        if template:
            if not item.get("emoji"):
                item["emoji"] = template.get("emoji") or DEFAULT_EMOJI
            if not item.get("icon"):
                item["icon"] = template.get("icon") or DEFAULT_ICON
            if not item.get("category"):
                item["category"] = template.get("category") or DEFAULT_CATEGORY
        cat = item.get("category")
        if not item.get("emoji"):
            item["emoji"] = CATEGORIES.get(cat, {}).get("emoji", DEFAULT_EMOJI)
        if not item.get("icon"):
            item["icon"] = CATEGORIES.get(cat, {}).get("icon", DEFAULT_ICON)

    def build_item(
        self, data: dict[str, Any], code_format: str = DEFAULT_CODE_FORMAT
    ) -> dict[str, Any]:
        """Create a new item dict (not yet stored)."""
        now = dt_util.now()
        today = now.date()
        # Accept legacy Dutch values from old automations / service calls.
        loc = canonical_location(data.get("location"))
        location = loc if loc in LOCATIONS else LOCATIONS[0]

        template = self.get_template(data.get("template_id"))
        if template is None and data.get("contents"):
            template = self.match_template(data["contents"])
        if template is None and data.get("name"):
            template = self.match_template(data["name"])

        added_date = data.get("added_date") or today.isoformat()

        expiry_date = data.get("expiry_date")
        expiry_source = data.get("expiry_source") or SOURCE_MANUAL
        if not expiry_date:
            days = self.shelf_life_days(template, location)
            if days is not None:
                base = parse_date(added_date) or today
                expiry_date = (base + _days(days)).isoformat()
                expiry_source = SOURCE_TEMPLATE
            else:
                expiry_source = SOURCE_NONE

        # A code stays reserved while its history event can still be restored:
        # otherwise a new item could reuse the code and a restore would put
        # two live items behind one printed sticker.
        taken_codes = [i.get("code") for i in self.items.values()]
        taken_codes += [
            (ev.get("item") or {}).get("code") for ev in self.history
        ]
        item = {
            "id": uuid.uuid4().hex,
            "code": generate_code((c for c in taken_codes if c), code_format),
            "name": (
                data.get("name")
                or data.get("contents")
                or UNKNOWN_ITEM_NAME[resolve_language(self.hass)]
            ).strip(),
            "contents": (data.get("contents") or "").strip(),
            "location": location,
            "category": canonical_category(data.get("category"))
            or (template or {}).get("category"),
            "emoji": data.get("emoji"),
            "icon": data.get("icon"),
            "photo": data.get("photo"),
            "template_id": (template or {}).get("id") if template else data.get("template_id"),
            "quantity": data.get("quantity"),
            # Every item has portions; a normal single item is one open portion.
            # Only multi-portion items get sub-codes (AB12-1 …) on stickers.
            "portions": default_portions(data.get("portions")),
            "added_date": added_date,
            "expiry_date": expiry_date,
            "expiry_source": expiry_source,
            "notes": data.get("notes"),
            # Retail barcode (EAN/UPC) if the item was added by scanning one;
            # lets us recognise the same product next time.
            "barcode": data.get("barcode"),
            # Who put it in the fridge (resolved from the HA user by the caller).
            "added_by": data.get("added_by"),
            "added_by_name": data.get("added_by_name"),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        self._decorate_from_template(item, template)
        # An explicit kind from the user wins; otherwise derive it.
        kind = canonical_kind(data.get("kind"))
        if kind not in (KIND_INGREDIENT, KIND_DISH):
            kind = (
                template_kind(template)
                if template
                else CATEGORY_KIND.get(item.get("category"), DEFAULT_KIND)
            )
        item["kind"] = kind
        return item

    def add_item(self, item: dict[str, Any]) -> dict[str, Any]:
        self.items[item["id"]] = item
        return item

    def update_item(self, item_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        item = self.items.get(item_id)
        if not item:
            return None
        allowed = {
            "name",
            "contents",
            "location",
            "category",
            "kind",
            "emoji",
            "icon",
            "photo",
            "template_id",
            "quantity",
            "added_date",
            "expiry_date",
            "expiry_source",
            "notes",
            "barcode",
        }
        for key, value in changes.items():
            if key not in allowed:
                continue
            # Accept legacy Dutch enum values, then guard the enum-ish fields
            # the UI and counts rely on, so a bad value can't slip in and
            # break filtering/labels.
            if key == "location":
                value = canonical_location(value)
                if value not in LOCATIONS:
                    continue
            if key == "kind":
                value = canonical_kind(value)
                if value not in (KIND_INGREDIENT, KIND_DISH):
                    continue
            if key == "category":
                value = canonical_category(value)
            item[key] = value
        item["updated_at"] = dt_util.now().isoformat()
        return item

    def remove_item(self, item_id: str) -> dict[str, Any] | None:
        return self.items.pop(item_id, None)

    def complete_item(
        self,
        item_id: str,
        action: str,
        by: str | None = None,
        by_name: str | None = None,
        portion: int | None = None,
    ) -> dict[str, Any] | None:
        """Mark an item done (eaten/tossed): remove it and log a history event.

        Stores a compact snapshot of the item so history stays readable even
        after the live item is gone. The list is capped at ``MAX_HISTORY``.
        ``portion`` records which portion triggered an automatic completion,
        so undoing it can reopen exactly that portion.
        """
        item = self.items.pop(item_id, None)
        if item is None:
            return None
        if action not in HISTORY_ACTIONS:
            action = ACTION_EATEN
        event = {
            "id": uuid.uuid4().hex,
            "ts": dt_util.now().isoformat(),
            "action": action,
            "by": by,
            "by_name": by_name,
            # Full snapshot so a completion can be undone losslessly, keeping
            # the original id + code (so the physical label still matches).
            # Portions are copied per-dict so later edits to a restored item
            # can never rewrite this snapshot.
            "item": {**item, "portions": [dict(p) for p in item.get("portions") or []]},
        }
        if portion is not None:
            event["portion"] = portion
        self.history.insert(0, event)
        if len(self.history) > MAX_HISTORY:
            del self.history[MAX_HISTORY:]
        return event

    # ---- portions ---------------------------------------------------------

    @staticmethod
    def _portions(item: dict[str, Any]) -> list[dict[str, Any]]:
        """The item's portions list, creating the default for pre-v3 dicts."""
        portions = item.get("portions")
        if not isinstance(portions, list) or not portions:
            portions = default_portions()
            item["portions"] = portions
        return portions

    def set_portions(
        self,
        item_id: str,
        total: int,
        by: str | None = None,
        by_name: str | None = None,
    ) -> dict[str, Any] | None:
        """Resize how many portions a batch is split into.

        Consumed portions are untouched and portion numbers stay stable (a
        printed sticker keeps matching). Growing appends fresh open portions;
        shrinking drops the highest-numbered *open* ones. The total can never
        drop below the number of consumed portions — and if shrinking removes
        the last open portion, the item completes just like eating it would
        (``by``/``by_name`` attribute that completion to the acting user).

        Returns ``{"item", "completed", "completion_event"}`` or None.
        """
        item = self.items.get(item_id)
        if item is None:
            return None
        portions = self._portions(item)
        consumed = [p for p in portions if p.get("status") != "open"]
        total = max(len(consumed), min(int(total or 1), MAX_PORTIONS))
        if total == 0:
            total = 1
        current = len(portions)
        if total > current:
            next_n = max(p.get("n", 0) for p in portions) + 1
            for i in range(total - current):
                portions.append({"n": next_n + i, "status": "open"})
        elif total < current:
            removable = current - total
            for p in sorted(
                (p for p in portions if p.get("status") == "open"),
                key=lambda p: p.get("n", 0),
                reverse=True,
            )[:removable]:
                portions.remove(p)
        item["updated_at"] = dt_util.now().isoformat()

        completion_event = None
        if consumed and not any(p.get("status") == "open" for p in portions):
            # Shrinking removed the last open portion: the batch is finished.
            action = (
                ACTION_TOSSED
                if all(p.get("status") == "tossed" for p in consumed)
                else ACTION_EATEN
            )
            completion_event = self.complete_item(item_id, action, by, by_name)
        return {
            "item": None if completion_event else item,
            "completed": completion_event is not None,
            "completion_event": completion_event,
        }

    def consume_portion(
        self,
        item_id: str,
        portion: int | None = None,
        action: str = ACTION_EATEN,
        by: str | None = None,
        by_name: str | None = None,
    ) -> dict[str, Any] | str:
        """Mark one portion eaten/tossed; auto-complete on the last one.

        ``portion`` picks a specific portion number (from a scanned sub-code);
        None consumes the lowest-numbered open portion. Returns a result dict,
        or an error key ('item_not_found' / 'portion_not_found' /
        'portion_consumed' / 'no_open_portions') for the caller to localise.

        The last open portion logs ONE event: the item completion (stamped
        with the portion number) — not an extra portion event — so a scan
        never produces two history rows. The completion action is 'tossed'
        only when every portion was tossed; otherwise 'eaten'.
        """
        item = self.items.get(item_id)
        if item is None:
            return "item_not_found"
        if action not in HISTORY_ACTIONS:
            action = ACTION_EATEN
        portions = self._portions(item)
        if portion is not None:
            target = next((p for p in portions if p.get("n") == portion), None)
            if target is None:
                return "portion_not_found"
            if target.get("status") != "open":
                return "portion_consumed"
        else:
            target = next(
                (p for p in sorted(portions, key=lambda p: p.get("n", 0))
                 if p.get("status") == "open"),
                None,
            )
            if target is None:
                return "no_open_portions"

        target["status"] = "eaten" if action == ACTION_EATEN else "tossed"
        target["ts"] = dt_util.now().isoformat()
        target["by"] = by
        target["by_name"] = by_name
        item["updated_at"] = dt_util.now().isoformat()
        remaining = sum(1 for p in portions if p.get("status") == "open")

        if remaining == 0:
            final_action = (
                ACTION_TOSSED
                if all(p.get("status") == "tossed" for p in portions)
                else ACTION_EATEN
            )
            event = self.complete_item(
                item_id, final_action, by, by_name, portion=target.get("n")
            )
            return {
                "event": event,
                "portion": target.get("n"),
                "remaining": 0,
                "completed": True,
                "item": None,
            }

        event = {
            "id": uuid.uuid4().hex,
            "ts": dt_util.now().isoformat(),
            "action": ACTION_PORTION_EATEN
            if action == ACTION_EATEN
            else ACTION_PORTION_TOSSED,
            "by": by,
            "by_name": by_name,
            "portion": target.get("n"),
            "portions_total": len(portions),
            # The item stays live; item_id lets restore find it again and the
            # snapshot keeps the history readable if it later disappears.
            "item_id": item["id"],
            "item": {**item, "portions": [dict(p) for p in portions]},
        }
        # Stamped on the live portion (after the snapshot) so the panel can
        # offer per-portion undo straight from state, without a history query.
        target["event_id"] = event["id"]
        self.history.insert(0, event)
        if len(self.history) > MAX_HISTORY:
            del self.history[MAX_HISTORY:]
        return {
            "event": event,
            "portion": target.get("n"),
            "remaining": remaining,
            "completed": False,
            "item": item,
        }

    @staticmethod
    def _reopen_portion(item: dict[str, Any], portion: int | None) -> None:
        if portion is None:
            return
        for p in item.get("portions") or []:
            if p.get("n") == portion:
                p["status"] = "open"
                p.pop("ts", None)
                p.pop("by", None)
                p.pop("by_name", None)
                p.pop("event_id", None)
                return

    def restore_item(self, event_id: str) -> dict[str, Any] | None:
        """Undo a completion or portion event, dropping it from history."""
        for i, ev in enumerate(self.history):
            if ev.get("id") != event_id:
                continue
            if ev.get("action") in PORTION_ACTIONS:
                # Portion undo: the item must still be live.
                item = self.items.get(ev.get("item_id"))
                if item is None:
                    return None
                self._reopen_portion(item, ev.get("portion"))
                item["updated_at"] = dt_util.now().isoformat()
                del self.history[i]
                return item
            snap = ev.get("item") or {}
            if not snap.get("id"):
                return None
            item = dict(snap)
            # An auto-completion consumed its final portion in the snapshot;
            # undoing it puts the item back with that portion open again.
            self._reopen_portion(item, ev.get("portion"))
            item["updated_at"] = dt_util.now().isoformat()
            self.items[item["id"]] = item
            del self.history[i]
            return item
        return None

    def delete_history_event(self, event_id: str) -> bool:
        """Permanently drop one event from the log (no restore, no trace)."""
        for i, ev in enumerate(self.history):
            if ev.get("id") == event_id:
                del self.history[i]
                return True
        return False

    def history_page(self, limit: int = 25, offset: int = 0) -> dict[str, Any]:
        """A slice of the history (newest first) plus the total count."""
        limit = max(1, min(int(limit or 25), 200))
        offset = max(0, int(offset or 0))
        return {
            "events": self.history[offset : offset + limit],
            "total": len(self.history),
            "offset": offset,
            "limit": limit,
        }

    def recent_history(self, n: int = 6) -> list[dict[str, Any]]:
        return self.history[: max(0, n)]

    def expired_items(self, today: date | None = None) -> list[dict[str, Any]]:
        today = today or dt_util.now().date()
        out = []
        for item in self.items.values():
            dl = item_days_left(item, today)
            if dl is not None and dl < 0:
                out.append(item)
        return out

    def expiring_items(
        self, warn_days: int, today: date | None = None
    ) -> list[dict[str, Any]]:
        """Items expired or expiring within ``warn_days`` (inclusive).

        Includes already-expired items — used by the daily notification, which
        splits them into "over datum" and "bijna over datum".
        """
        today = today or dt_util.now().date()
        out = []
        for item in self.items.values():
            dl = item_days_left(item, today)
            if dl is not None and dl <= warn_days:
                out.append(item)
        out.sort(key=lambda i: item_days_left(i, today) or 0)
        return out

    def soon_items(
        self, warn_days: int, today: date | None = None
    ) -> list[dict[str, Any]]:
        """Items expiring within ``warn_days`` but not yet expired (0..warn).

        Kept separate from :meth:`expiring_items` so the "expiring soon" sensor
        and the "expired" sensor partition cleanly instead of double-counting.
        """
        today = today or dt_util.now().date()
        out = [
            item
            for item in self.items.values()
            if (dl := item_days_left(item, today)) is not None
            and 0 <= dl <= warn_days
        ]
        out.sort(key=lambda i: item_days_left(i, today) or 0)
        return out


def _days(n: int):
    from datetime import timedelta

    return timedelta(days=n)
