"""Shared fixtures for API tests."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch, tmp_path):
    data_dir = Path(__file__).resolve().parents[2] / "data" / "sample"
    monkeypatch.setenv("LUNCHLOOP_DATA_DIR", str(data_dir))
    monkeypatch.setenv("LUNCHLOOP_DB", str(tmp_path / "t.db"))
    monkeypatch.setenv("LUNCHLOOP_TODAY", "2026-10-19")
    from api.main import create_app

    with TestClient(create_app()) as c:
        yield c
