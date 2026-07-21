"""Parsing and normalisation of AI shelf-life answers."""

import unittest

from tests.hastubs import load_module

ai = load_module("ai")


class TestExtractJson(unittest.TestCase):
    def test_plain_json(self):
        self.assertEqual(ai._extract_json('{"fridge": 2}', "en"), {"fridge": 2})

    def test_fenced_json(self):
        text = '```json\n{"fridge": 2, "freezer": null}\n```'
        self.assertEqual(ai._extract_json(text, "en"),
                         {"fridge": 2, "freezer": None})

    def test_json_embedded_in_prose(self):
        text = 'Sure! Here you go: {"fridge": 5} Hope that helps.'
        self.assertEqual(ai._extract_json(text, "en"), {"fridge": 5})

    def test_no_json_raises(self):
        with self.assertRaises(ai.AIEstimateError):
            ai._extract_json("I cannot help with that.", "en")


class TestCoerceDays(unittest.TestCase):
    def test_values(self):
        self.assertIsNone(ai._coerce_days(None))
        self.assertIsNone(ai._coerce_days(0))
        self.assertIsNone(ai._coerce_days(-3))
        self.assertIsNone(ai._coerce_days("veel"))
        self.assertEqual(ai._coerce_days(7), 7)
        self.assertEqual(ai._coerce_days("14"), 14)
        self.assertEqual(ai._coerce_days(2.6), 3)
        self.assertEqual(ai._coerce_days(99999), 3650)  # capped at 10 years


class TestNormalize(unittest.TestCase):
    def test_english_keys(self):
        out = ai._normalize("rijst", {
            "fridge": None, "freezer": None, "pantry": 730,
            "kind": "ingredient", "category": "other",
            "emoji": "🍚", "icon": "mdi:rice", "notes": "Droog bewaren.",
        })
        self.assertEqual(out["shelf_life"],
                         {"fridge": None, "freezer": None, "pantry": 730})
        self.assertEqual(out["category"], "other")
        self.assertEqual(out["kind"], "ingredient")

    def test_legacy_dutch_location_keys_still_understood(self):
        out = ai._normalize("melk", {"koelkast": 7, "vriezer": 30, "buiten": None})
        self.assertEqual(out["shelf_life"],
                         {"fridge": 7, "freezer": 30, "pantry": None})

    def test_legacy_dutch_category_is_mapped(self):
        out = ai._normalize("melk", {"category": "zuivel"})
        self.assertEqual(out["category"], "dairy")

    def test_unknown_category_falls_back(self):
        out = ai._normalize("x", {"category": "spacefood"})
        self.assertEqual(out["category"], "other")

    def test_kind_synonyms(self):
        self.assertEqual(ai._normalize("x", {"kind": "dish"})["kind"], "dish")
        self.assertEqual(ai._normalize("x", {"kind": "meal"})["kind"], "dish")
        self.assertEqual(ai._normalize("x", {"kind": "gerecht"})["kind"], "dish")
        self.assertEqual(ai._normalize("x", {"kind": "ingredient"})["kind"],
                         "ingredient")

    def test_kind_derived_from_category_when_missing(self):
        self.assertEqual(ai._normalize("x", {"category": "prepared_dish"})["kind"],
                         "dish")
        self.assertEqual(ai._normalize("x", {"category": "dairy"})["kind"],
                         "ingredient")

    def test_invalid_icon_falls_back_to_category_icon(self):
        out = ai._normalize("x", {"category": "dairy", "icon": "not-an-icon"})
        self.assertTrue(out["icon"].startswith("mdi:"))

    def test_notes_are_trimmed(self):
        out = ai._normalize("x", {"notes": "  a" + "b" * 300})
        self.assertLessEqual(len(out["notes"]), 140)


if __name__ == "__main__":
    unittest.main()
