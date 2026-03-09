"""Small arithmetic helper utilities for the ludo_backend repository.

This file is intentionally standalone and only affects runtime if imported/used
elsewhere.
"""

from __future__ import annotations


# PUBLIC_INTERFACE
def add(a: float, b: float) -> float:
    """Return the sum of two numbers.

    Args:
        a: First number.
        b: Second number.

    Returns:
        The arithmetic sum (a + b) as a float.
    """
    return float(a) + float(b)
