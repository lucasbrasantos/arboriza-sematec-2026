"""Banco local de metadados; dados geográficos permanecem em arquivos."""
import sqlite3
from contextlib import contextmanager

from .config import DATABASE


@contextmanager
def connect():
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DATABASE, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize():
    with connect() as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE NOT NULL,
                password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','operator')),
                active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS login_attempts (
                identity TEXT PRIMARY KEY, failures INTEGER NOT NULL, last_failure INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS analyses (
                id TEXT PRIMARY KEY, request TEXT NOT NULL, state TEXT NOT NULL,
                step TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                owner INTEGER NOT NULL REFERENCES users(id), summary TEXT, error TEXT
            );
            CREATE TABLE IF NOT EXISTS analysis_drafts (
                analysis_id TEXT PRIMARY KEY REFERENCES analyses(id),
                revision INTEGER NOT NULL CHECK(revision > 0),
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                updated_by INTEGER NOT NULL REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS workspaces (
                user_id INTEGER PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL,
                payload TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS archive_packages (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, payload TEXT NOT NULL,
                state TEXT NOT NULL CHECK(state IN ('nao_revisado','aprovado','publicado')),
                territory_key TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                owner INTEGER NOT NULL REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS archive_events (
                id INTEGER PRIMARY KEY, package_id TEXT NOT NULL REFERENCES archive_packages(id),
                action TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id), at TEXT NOT NULL
            );
        ''')
