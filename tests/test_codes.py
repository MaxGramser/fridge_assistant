"""Item code generation."""

import re
import unittest

from tests.hastubs import load_module

codes = load_module("codes")
const = load_module("const")


class TestGenerateCode(unittest.TestCase):
    def test_letters_first_format(self):
        for _ in range(50):
            code = codes.generate_code([], const.CODE_FORMAT_LETTERS)
            self.assertRegex(code, r"^[A-Z]{2}\d{2}$")

    def test_digits_first_format(self):
        for _ in range(50):
            code = codes.generate_code([], const.CODE_FORMAT_DIGITS)
            self.assertRegex(code, r"^\d{2}[A-Z]{2}$")

    def test_ambiguous_letters_are_never_used(self):
        for _ in range(300):
            code = codes.generate_code([], const.CODE_FORMAT_LETTERS)
            self.assertFalse(re.search(r"[IOQ]", code), code)

    def test_avoids_existing_codes(self):
        existing = set()
        for _ in range(200):
            code = codes.generate_code(existing, const.CODE_FORMAT_LETTERS)
            self.assertNotIn(code, existing)
            existing.add(code)

    def test_existing_comparison_is_case_insensitive(self):
        # The generator uppercases what it's given, so a lowercase existing
        # code can never be handed out again in uppercase.
        code = codes.generate_code([], const.CODE_FORMAT_LETTERS)
        regenerated = codes.generate_code([code.lower()], const.CODE_FORMAT_LETTERS)
        self.assertNotEqual(code, regenerated)


if __name__ == "__main__":
    unittest.main()
