"""Storage v1 (Dutch identifiers) -> v2 (English) migration."""

import asyncio
import copy
import unittest

from tests.hastubs import fake_hass, load_module

store_mod = load_module("store")

V1_DATA = {
    "items": [
        {
            "id": "a1", "code": "AB12", "name": "Melk",
            "location": "koelkast", "category": "zuivel", "kind": "ingredient",
        },
        {
            "id": "a2", "code": "CD34", "name": "Macaroni",
            "location": "vriezer", "category": "bereid_gerecht", "kind": "gerecht",
        },
    ],
    "user_templates": [
        {
            "id": "eigen", "name": "Eigen ding", "category": "groente",
            "kind": "gerecht", "opened_koelkast": 5,
            "shelf_life": {"koelkast": 3, "vriezer": 90, "buiten": None},
        }
    ],
    "hidden": ["ui"],
    "history": [
        {
            "id": "ev1", "ts": "2026-07-20T12:00:00", "action": "eaten",
            "item": {"id": "old1", "location": "buiten", "category": "overig",
                     "kind": "ingredient"},
        }
    ],
}


def migrate(data, major=1):
    store = store_mod.FridgeDataStore(fake_hass(), 2, "test_key")
    return asyncio.run(store._async_migrate_func(major, 1, data))


class TestMigration(unittest.TestCase):
    def test_items_are_translated(self):
        out = migrate(copy.deepcopy(V1_DATA))
        by_id = {i["id"]: i for i in out["items"]}
        self.assertEqual(by_id["a1"]["location"], "fridge")
        self.assertEqual(by_id["a1"]["category"], "dairy")
        self.assertEqual(by_id["a2"]["location"], "freezer")
        self.assertEqual(by_id["a2"]["category"], "prepared_dish")
        self.assertEqual(by_id["a2"]["kind"], "dish")

    def test_templates_shelf_life_and_opened_field(self):
        out = migrate({"user_templates": [dict(V1_DATA["user_templates"][0])]})
        tpl = out["user_templates"][0]
        self.assertEqual(tpl["category"], "vegetables")
        self.assertEqual(tpl["kind"], "dish")
        self.assertEqual(tpl["shelf_life"], {"fridge": 3, "freezer": 90, "pantry": None})
        self.assertNotIn("opened_koelkast", tpl)
        self.assertEqual(tpl["opened_fridge"], 5)

    def test_history_snapshots_are_translated(self):
        out = migrate({"history": [dict(V1_DATA["history"][0],
                                        item=dict(V1_DATA["history"][0]["item"]))]})
        snap = out["history"][0]["item"]
        self.assertEqual(snap["location"], "pantry")
        self.assertEqual(snap["category"], "other")

    def test_migration_is_idempotent(self):
        once = migrate({"items": [dict(x) for x in V1_DATA["items"]]})
        twice = migrate({"items": [dict(x) for x in once["items"]]})
        self.assertEqual(once, twice)

    def test_v2_data_passes_through_untouched(self):
        v2 = {"items": [{"id": "n1", "location": "fridge", "category": "dairy"}]}
        out = migrate({"items": [dict(v2["items"][0])]}, major=2)
        self.assertEqual(out, v2)


if __name__ == "__main__":
    unittest.main()
