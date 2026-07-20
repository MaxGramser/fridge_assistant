"""Item code generation (XX00 style, e.g. AB12)."""

from __future__ import annotations

import random
from collections.abc import Iterable

from .const import CODE_FORMAT_DIGITS

# Exclude visually ambiguous letters (I, O, Q) so codes read cleanly on a sticker.
_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ"
_DIGITS = "0123456789"


def _random_letters() -> str:
    return random.choice(_LETTERS) + random.choice(_LETTERS)


def _random_digits() -> str:
    return random.choice(_DIGITS) + random.choice(_DIGITS)


def generate_code(existing: Iterable[str], code_format: str) -> str:
    """Return a unique 2-letter + 2-digit code not present in ``existing``.

    ``code_format`` decides the order: letters-first (``AB12``) or digits-first
    (``12AB``). Falls back to a longer code in the (astronomically unlikely)
    event the small space fills up.
    """
    taken = {c.upper() for c in existing}

    for _ in range(2000):
        if code_format == CODE_FORMAT_DIGITS:
            code = _random_digits() + _random_letters()
        else:
            code = _random_letters() + _random_digits()
        if code not in taken:
            return code

    # Practically unreachable; guarantee uniqueness with an extra character.
    while True:
        code = _random_letters() + _random_digits() + random.choice(_DIGITS)
        if code not in taken:
            return code
