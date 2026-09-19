"""SQLite-backed storage for enrolled profiles.

Plain sqlite3 (stdlib) rather than an ORM — one table, a handful of queries,
an ORM would be pure overhead at this scale.
"""

import sqlite3
from datetime import datetime, timezone

import numpy as np

from backend.config import DB_PATH, ensure_data_dirs

_SCHEMA = """
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    embedding BLOB NOT NULL,
    image_path TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    ensure_data_dirs()
    with _connect() as conn:
        conn.execute(_SCHEMA)


def insert_profile(name: str, embedding: np.ndarray, image_path: str) -> int:
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO profiles (name, embedding, image_path, created_at) VALUES (?, ?, ?, ?)",
            (name, embedding.astype(np.float32).tobytes(), image_path, datetime.now(timezone.utc).isoformat()),
        )
        return cursor.lastrowid


def list_profiles() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, name, image_path, created_at FROM profiles ORDER BY created_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]


def get_profile(profile_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, name, image_path, created_at FROM profiles WHERE id = ?", (profile_id,)
        ).fetchone()
        return dict(row) if row else None


def delete_profile(profile_id: int) -> bool:
    with _connect() as conn:
        cursor = conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        return cursor.rowcount > 0


def all_embeddings() -> list[tuple[int, str, np.ndarray]]:
    with _connect() as conn:
        rows = conn.execute("SELECT id, name, embedding FROM profiles").fetchall()
        return [
            (row["id"], row["name"], np.frombuffer(row["embedding"], dtype=np.float32))
            for row in rows
        ]
