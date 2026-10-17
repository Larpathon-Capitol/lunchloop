"""School account password and token helpers."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import logging


ITERATIONS = 200_000
_SECRET = None


def sign_device(device_id):
    """Return the server-signed form of a valid unsigned device id."""
    from .game import DEVICE_PATTERN

    if not isinstance(device_id, str) or not DEVICE_PATTERN.fullmatch(device_id):
        raise ValueError("invalid device")
    digest = hmac.new(secret(), ("device:" + device_id).encode(), hashlib.sha256).hexdigest()[:16]
    return f"{device_id}.{digest}"


def verify_device(value):
    """Return the unsigned base id when value is a valid signed device, else None."""
    from .game import DEVICE_PATTERN

    if not isinstance(value, str) or len(value) > 81 or "." not in value:
        return None
    base, signature = value.rsplit(".", 1)
    if not DEVICE_PATTERN.fullmatch(base) or len(signature) != 16 or any(char not in "0123456789abcdef" for char in signature):
        return None
    expected = hmac.new(secret(), ("device:" + base).encode(), hashlib.sha256).hexdigest()[:16]
    return base if hmac.compare_digest(signature, expected) else None


def password_hash(password, iterations=ITERATIONS):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password, encoded):
    try:
        scheme, count, salt, expected = encoded.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        count = int(count)
        if count < 1 or len(salt) % 2 or len(expected) % 2:
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), count)
        return hmac.compare_digest(actual.hex(), expected)
    except (ValueError, TypeError):
        return False


def configured_passwords():
    result = {}
    for entry in os.getenv("LUNCHLOOP_SCHOOL_PASSWORDS", "").split(","):
        entry = entry.strip()
        if not entry:
            continue
        if "=" not in entry:
            logging.warning("Ignoring malformed school password entry")
            continue
        school, encoded = (part.strip() for part in entry.split("=", 1))
        try:
            scheme, count, salt, digest = encoded.split("$")
            valid = scheme == "pbkdf2_sha256" and int(count) >= ITERATIONS and len(salt) == 32 and len(digest) == 64
            bytes.fromhex(salt)
            bytes.fromhex(digest)
        except (ValueError, TypeError):
            valid = False
        if not valid:
            logging.warning(
                "Ignoring malformed or weak school password entry for %s",
                school or "unknown school",
            )
        if school and valid:
            result[school] = encoded
    return result


def secret():
    global _SECRET
    if _SECRET is not None:
        return _SECRET
    value = os.getenv("LUNCHLOOP_SECRET")
    if value:
        _SECRET = value.encode()
    else:
        _SECRET = secrets.token_bytes(32)
    return _SECRET


def make_token(school_id, ttl=12 * 60 * 60):
    payload = {"s": school_id, "exp": int(time.time()) + ttl}
    raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(secret(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{signature}", payload["exp"]


def read_token(token):
    try:
        raw, signature = token.split(".", 1)
        expected = hmac.new(secret(), raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
        if not isinstance(payload, dict) or int(payload["exp"]) < int(time.time()):
            return None
        return payload
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None
