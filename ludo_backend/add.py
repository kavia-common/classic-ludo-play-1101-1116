"""Small arithmetic helper utilities for the ludo_backend repository.

This file was added per request. It is currently standalone and does not affect
the runtime of the backend service unless imported/used elsewhere.
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

    Notes:
        - Inputs are typed as floats to support both int and float values.
        - Python will naturally allow ints here as well.
    """
    return float(a) + float(b)


def _main() -> None:
    """Simple CLI entrypoint for manual verification.

    Usage:
        python add.py 1 2
    """
    import sys

    if len(sys.argv) != 3:
        print("Usage: python add.py <a> <b>")
        raise SystemExit(2)

    try:
        a = float(sys.argv[1])
        b = float(sys.argv[2])
    except ValueError:
        print("Both <a> and <b> must be numbers.")
        raise SystemExit(2)

    print(add(a, b))


if __name__ == "__main__":
    _main()
