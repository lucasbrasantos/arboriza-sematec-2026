"""Armazenamento transacional de rascunhos, separado dos resultados originais.

O chamador deve validar geometria, vínculos, autorização e estado da análise antes
de gravar. Este módulo ainda não expõe uma rota HTTP.
"""
import json
from datetime import datetime, timezone

from ..core.database import connect


class RevisionConflict(Exception):
    """Outra sessão alterou o rascunho desde a última leitura."""


def read_draft(analysis_id):
    with connect() as db:
        row = db.execute('SELECT revision, payload, updated_at, updated_by FROM analysis_drafts WHERE analysis_id=?', (analysis_id,)).fetchone()
    if row is None:
        return None
    return {**dict(row), 'payload': json.loads(row['payload'])}


def save_draft(analysis_id, payload, expected_revision, user_id):
    encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
    timestamp = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT revision FROM analysis_drafts WHERE analysis_id=?', (analysis_id,)).fetchone()
        actual = row['revision'] if row else 0
        if actual != expected_revision:
            raise RevisionConflict('O rascunho foi alterado em outra sessão.')
        revision = actual + 1
        db.execute('''INSERT INTO analysis_drafts(analysis_id, revision, payload, updated_at, updated_by)
                      VALUES(?,?,?,?,?) ON CONFLICT(analysis_id) DO UPDATE SET
                      revision=excluded.revision, payload=excluded.payload,
                      updated_at=excluded.updated_at, updated_by=excluded.updated_by''',
                   (analysis_id, revision, encoded, timestamp, user_id))
    return {'revision': revision, 'updated_at': timestamp, 'updated_by': user_id}
