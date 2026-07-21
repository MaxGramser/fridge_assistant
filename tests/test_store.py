"""Store logic: building items, updating, completing, matching templates."""

import unittest

from tests.hastubs import fake_hass, load_module

store_mod = load_module("store")
const = load_module("const")


def make_store(language: str = "nl") -> "store_mod.FridgeStore":
    store = store_mod.FridgeStore(fake_hass(language))
    store._seed = store._read_seed()  # sync read of the bundled seed database
    return store


class TestBuildItem(unittest.TestCase):
    def test_defaults(self):
        store = make_store()
        item = store.build_item({"name": "Melk", "location": "fridge"})
        self.assertEqual(item["location"], "fridge")
        self.assertRegex(item["code"], r"^[A-Z]{2}\d{2}$")
        self.assertIn(item["kind"], ("ingredient", "dish"))

    def test_legacy_dutch_location_is_canonicalised(self):
        store = make_store()
        item = store.build_item({"name": "Soep", "location": "vriezer"})
        self.assertEqual(item["location"], "freezer")

    def test_legacy_dutch_kind_is_canonicalised(self):
        store = make_store()
        item = store.build_item({"name": "Soep", "kind": "gerecht"})
        self.assertEqual(item["kind"], "dish")

    def test_invalid_location_falls_back_to_first(self):
        store = make_store()
        item = store.build_item({"name": "X", "location": "garage"})
        self.assertEqual(item["location"], const.LOCATIONS[0])

    def test_unknown_name_localised(self):
        self.assertEqual(make_store("nl").build_item({})["name"], "Onbekend")
        self.assertEqual(make_store("en").build_item({})["name"], "Unknown")

    def test_template_shelf_life_sets_expiry(self):
        store = make_store()
        item = store.build_item(
            {"name": "gekookte rijst", "location": "fridge",
             "added_date": "2026-07-01"}
        )
        # Seed: cooked rice keeps 3 days in the fridge.
        self.assertEqual(item["template_id"], "rijst-gekookt")
        self.assertEqual(item["expiry_date"], "2026-07-04")
        self.assertEqual(item["expiry_source"], "template")


class TestUpdateItem(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.item = self.store.add_item(
            self.store.build_item({"name": "Kaas", "location": "fridge"})
        )

    def test_legacy_location_value_is_accepted(self):
        updated = self.store.update_item(self.item["id"], {"location": "buiten"})
        self.assertEqual(updated["location"], "pantry")

    def test_invalid_enum_values_are_ignored(self):
        updated = self.store.update_item(
            self.item["id"], {"location": "garage", "kind": "snack"}
        )
        self.assertEqual(updated["location"], "fridge")
        self.assertIn(updated["kind"], ("ingredient", "dish"))

    def test_unknown_fields_are_ignored(self):
        updated = self.store.update_item(self.item["id"], {"id": "hacked", "name": "Brie"})
        self.assertEqual(updated["id"], self.item["id"])
        self.assertEqual(updated["name"], "Brie")


class TestCompleteRestore(unittest.TestCase):
    def test_roundtrip_keeps_id_and_code(self):
        store = make_store()
        item = store.add_item(store.build_item({"name": "Soep", "location": "freezer"}))
        event = store.complete_item(item["id"], "eaten", by="u1", by_name="Max")
        self.assertNotIn(item["id"], store.items)
        self.assertEqual(event["item"]["code"], item["code"])
        self.assertEqual(event["by_name"], "Max")

        restored = store.restore_item(event["id"])
        self.assertEqual(restored["id"], item["id"])
        self.assertEqual(restored["code"], item["code"])
        self.assertEqual(len(store.history), 0)

    def test_history_is_capped(self):
        store = make_store()
        for i in range(const.MAX_HISTORY + 25):
            item = store.add_item(store.build_item({"name": f"i{i}"}))
            store.complete_item(item["id"], "tossed")
        self.assertEqual(len(store.history), const.MAX_HISTORY)


class TestMatchTemplate(unittest.TestCase):
    def setUp(self):
        self.store = make_store()

    def test_exact_and_alias_match(self):
        self.assertEqual(self.store.match_template("gekookte rijst")["id"], "rijst-gekookt")

    def test_loose_overlap_is_rejected(self):
        # "pizza" must not be guessed as some cheese template (historic bug).
        match = self.store.match_template("pizza quattro formaggi")
        if match is not None:
            self.assertIn("pizza", match["name"].lower())

    def test_negation_excludes_templates(self):
        match = self.store.match_template("macaroni zonder vlees")
        if match is not None:
            self.assertNotIn("vlees", match["name"].lower())

    def test_empty_query(self):
        self.assertIsNone(self.store.match_template(""))
        self.assertIsNone(self.store.match_template("   "))


class TestUserTemplates(unittest.TestCase):
    def test_new_template_never_overwrites_builtin(self):
        store = make_store()
        tpl = store.upsert_user_template({"name": "Ui"})  # collides with seed id "ui"
        self.assertNotEqual(tpl["id"], "ui")
        self.assertIn("ui", store._seed)

    def test_explicit_id_overrides_builtin(self):
        store = make_store()
        tpl = store.upsert_user_template({"id": "ui", "name": "Rode ui"})
        self.assertEqual(tpl["id"], "ui")
        self.assertEqual(store.get_template("ui")["name"], "Rode ui")

    def test_legacy_category_is_canonicalised(self):
        store = make_store()
        tpl = store.upsert_user_template({"name": "Testje", "category": "zuivel"})
        self.assertEqual(tpl["category"], "dairy")


if __name__ == "__main__":
    unittest.main()
