"""Language resolution, legacy mapping and label helpers."""

import unittest

from tests.hastubs import fake_hass, load_module

const = load_module("const")


class TestResolveLanguage(unittest.TestCase):
    def test_dutch_variants_resolve_to_nl(self):
        for lang in ("nl", "nl-NL", "NL", "nl-BE"):
            self.assertEqual(const.resolve_language(fake_hass(lang)), "nl")

    def test_everything_else_falls_back_to_english(self):
        for lang in ("en", "en-GB", "de", "fr", "", None):
            self.assertEqual(const.resolve_language(fake_hass(lang)), "en")


class TestLegacyMaps(unittest.TestCase):
    def test_canonical_location(self):
        self.assertEqual(const.canonical_location("koelkast"), "fridge")
        self.assertEqual(const.canonical_location("vriezer"), "freezer")
        self.assertEqual(const.canonical_location("buiten"), "pantry")
        # Current values and unknowns pass through untouched.
        self.assertEqual(const.canonical_location("fridge"), "fridge")
        self.assertEqual(const.canonical_location("garage"), "garage")
        self.assertIsNone(const.canonical_location(None))

    def test_canonical_category_covers_every_legacy_key(self):
        for legacy, current in const.LEGACY_CATEGORIES.items():
            self.assertIn(current, const.CATEGORIES, f"{legacy} -> {current}")

    def test_canonical_kind(self):
        self.assertEqual(const.canonical_kind("gerecht"), "dish")
        self.assertEqual(const.canonical_kind("ingredient"), "ingredient")

    def test_every_location_and_category_has_meta(self):
        self.assertEqual(set(const.LOCATIONS), set(const.LOCATION_META))
        self.assertEqual(set(const.LOCATIONS), set(const.LOCATION_LABELS_EN))
        self.assertEqual(set(const.CATEGORIES), set(const.CATEGORY_KIND))


class TestLabels(unittest.TestCase):
    def test_location_label_both_languages(self):
        self.assertEqual(const.location_label("fridge", "nl"), "Koelkast")
        self.assertEqual(const.location_label("fridge", "en"), "Fridge")
        self.assertEqual(const.location_label("pantry", "nl"), "Buiten koelkast")
        # Unknown key falls back to the key itself instead of crashing.
        self.assertEqual(const.location_label("attic", "en"), "attic")

    def test_kind_label_both_languages(self):
        self.assertEqual(const.kind_label("dish", "nl"), "Gerechten")
        self.assertEqual(const.kind_label("dish", "en"), "Dishes")
        self.assertEqual(const.kind_label("ingredient", "en", short=False),
                         "Individual ingredients")


if __name__ == "__main__":
    unittest.main()
