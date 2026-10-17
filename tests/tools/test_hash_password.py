"""Tests for tools/hash_password.py: the format and a hashlib re-check."""

import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools" / "hash_password.py"
FORMAT = re.compile(r"pbkdf2_sha256\$(\d+)\$([0-9a-f]+)\$([0-9a-f]+)")


def run_tool(stdin_text, cwd=None):
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=stdin_text,
        capture_output=True,
        text=True,
        cwd=cwd or ROOT,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def parse(output):
    match = FORMAT.fullmatch(output)
    assert match, output
    return int(match.group(1)), bytes.fromhex(match.group(2)), bytes.fromhex(match.group(3))


def recompute(password, iterations, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


def test_output_format_and_iteration_floor():
    output = run_tool("correct horse\n")
    assert output.count("\n") == 0
    iterations, salt, digest = parse(output)
    assert iterations >= 200_000
    assert len(salt) >= 8
    assert len(digest) == 32  # SHA-256 output size


def test_hash_verifies_against_the_original_password():
    iterations, salt, digest = parse(run_tool("correct horse\n"))
    assert recompute("correct horse", iterations, salt) == digest
    assert recompute("correct horse!", iterations, salt) != digest
    assert recompute("Correct horse", iterations, salt) != digest


def test_each_run_uses_a_fresh_salt():
    first = run_tool("same-password\n")
    second = run_tool("same-password\n")
    assert first != second
    assert parse(first)[1] != parse(second)[1]


def test_only_the_final_newline_is_dropped():
    iterations, salt, digest = parse(run_tool("  spaced pw  \n"))
    assert recompute("  spaced pw  ", iterations, salt) == digest


def test_no_trailing_newline_needed():
    iterations, salt, digest = parse(run_tool("no-newline"))
    assert recompute("no-newline", iterations, salt) == digest


def test_unicode_password_is_hashed_as_utf8():
    iterations, salt, digest = parse(run_tool("pässwörd-日本\n"))
    assert recompute("pässwörd-日本", iterations, salt) == digest


def test_runs_from_any_working_directory(tmp_path):
    iterations, salt, digest = parse(run_tool("elsewhere\n", cwd=tmp_path))
    assert recompute("elsewhere", iterations, salt) == digest


def test_plain_password_is_not_in_the_output():
    output = run_tool("super-secret-value\n")
    assert "super-secret-value" not in output
