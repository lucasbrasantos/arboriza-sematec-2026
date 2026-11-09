import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from arboriza_api.analyses.draft_store import RevisionConflict, read_draft, save_draft
from arboriza_api.core.database import connect, initialize


class DraftStoreTests(unittest.TestCase):
    def test_revision_conflict_preserves_saved_payload(self):
        with tempfile.TemporaryDirectory() as directory, patch('arboriza_api.core.database.DATABASE', Path(directory) / 'test.sqlite'):
            initialize()
            with connect() as db:
                db.execute("INSERT INTO users(id, username, password_hash, role) VALUES(1, 'test', 'test', 'admin')")
                db.execute("INSERT INTO analyses(id, request, state, step, created_at, updated_at, owner) VALUES('a', '{}', 'concluida', '', '', '', 1)")
            self.assertIsNone(read_draft('a'))
            self.assertEqual(save_draft('a', {'points': [1]}, 0, 1)['revision'], 1)
            with self.assertRaises(RevisionConflict):
                save_draft('a', {'points': []}, 0, 1)
            self.assertEqual(read_draft('a')['payload'], {'points': [1]})
            self.assertEqual(save_draft('a', {'points': [2]}, 1, 1)['revision'], 2)
            self.assertEqual(read_draft('a')['payload'], {'points': [2]})
