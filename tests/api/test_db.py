"""Persistence and rebuild checks for the API's SQLite store."""

from __future__ import annotations

import csv
import shutil
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SAMPLE_DATA = ROOT / "data" / "sample"


def _copy_sample(tmp_path: Path) -> Path:
    data_dir = tmp_path / "data"
    shutil.copytree(SAMPLE_DATA, data_dir)
    return data_dir


def _item_name(data_dir: Path, item_id: str) -> str:
    with (data_dir / "items.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            if row["item_id"] == item_id:
                return row["name"]
    raise AssertionError(f"sample item {item_id!r} was not found")


def _client(monkeypatch: pytest.MonkeyPatch, data_dir: Path, db_path: Path):
    """Create a client whose lifespan initializes the supplied database."""
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(data_dir))
    monkeypatch.setenv("LUNCHLOOP_DB", str(db_path))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")
    from fastapi.testclient import TestClient

    from api.main import create_app

    return TestClient(create_app())


def test_votes_and_players_survive_restart_and_database_rebuild(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    data_dir = _copy_sample(tmp_path)
    db_path = tmp_path / "lunchloop.db"
    device = "persist-device"

    with _client(monkeypatch, data_dir, db_path) as client:
        spin = client.get("/api/spin", params={"device": device})
        assert spin.status_code == 200
        item_id = spin.json()["options"][0]["item_id"]
        vote = client.post("/api/vote", json={"device": device, "item_id": item_id})
        assert vote.status_code == 200
        assert vote.json()["xp"] == 10

    # The game tables are retained when the app rebuilds its source tables.
    with _client(monkeypatch, data_dir, db_path) as client:
        repeat = client.post("/api/vote", json={"device": device, "item_id": item_id})
        assert repeat.status_code == 409
        me = client.get("/api/me", params={"device": device})
        assert me.status_code == 200
        assert me.json()["xp"] == 10

    db_path.unlink()
    with _client(monkeypatch, data_dir, db_path) as client:
        spin = client.get("/api/spin", params={"device": "new-device"})
        assert spin.status_code == 200
        me = client.get("/api/me", params={"device": "new-device"})
        assert me.status_code == 200
        assert me.json()["xp"] == 0


def test_restart_reloads_edited_item_name_from_csv(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    data_dir = _copy_sample(tmp_path)
    db_path = tmp_path / "lunchloop.db"

    with _client(monkeypatch, data_dir, db_path) as client:
        spin = client.get("/api/spin")
        assert spin.status_code == 200
        item_id = spin.json()["options"][0]["item_id"]

    replacement = "Edited item name"
    rows: list[dict[str, str]]
    items_path = data_dir / "items.csv"
    with items_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames
        assert fieldnames is not None
        rows = list(reader)
    for row in rows:
        if row["item_id"] == item_id:
            row["name"] = replacement
            break
    else:
        raise AssertionError(f"sample item {item_id!r} was not found")
    with items_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    with _client(monkeypatch, data_dir, db_path) as client:
        spin = client.get("/api/spin")
        assert spin.status_code == 200
        option = next(option for option in spin.json()["options"] if option["item_id"] == item_id)
        assert option["name"] == replacement
        assert option["name"] != _item_name(SAMPLE_DATA, item_id)
