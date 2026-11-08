import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from shapely.geometry import box

from arboriza_api.access.auth import current_user
from arboriza_api.analyses.workspace import router
from arboriza_api.core.database import connect, initialize


class Territory:
    metadata = {'sha256_fonte': 'mesh'}

    def selected(self, ids):
        if ids != ['s1']:
            raise ValueError('Setores inválidos.')
        return [box(-51, -22, -50, -21)]


class WorkspaceArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = patch('arboriza_api.core.database.DATABASE', Path(self.temp.name) / 'test.sqlite')
        self.database.start()
        self.territory = patch('arboriza_api.analyses.workspace.get_territory', return_value=Territory())
        self.territory.start()
        initialize()
        with connect() as db:
            db.execute("INSERT INTO users(id,username,password_hash,role) VALUES(1,'test','hash','admin')")
        self.role = 'admin'
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[current_user] = lambda: {'id': 1, 'role': self.role}
        self.client = TestClient(app)
        self.snapshot = {'layers': [{'id': 'import:test', 'name': 'Camada', 'executionId': 'import:test', 'execution': 'Importação', 'origin': 'Externo', 'category': 'Pontos', 'color': '#112233', 'bounds': [[-22, -51], [-21, -50]], 'territory': {'ids': ['s1'], 'source': 'mesh'}, 'items': [{'id': 'p1', 'kind': 'point', 'area': 'cidade', 'label': 'Ponto', 'position': [-21.5, -50.5], 'properties': {}}]}], 'visible_ids': ['import:test'], 'active_id': 'import:test'}

    def tearDown(self):
        self.client.close()
        self.territory.stop()
        self.database.stop()
        self.temp.cleanup()

    def test_save_restore_and_conflict(self):
        self.assertEqual(self.client.get('/api/workspace').json()['revision'], 0)
        self.assertEqual(self.client.put('/api/workspace', json={**self.snapshot, 'revision': 0}).status_code, 200)
        self.assertEqual(self.client.put('/api/workspace', json={**self.snapshot, 'revision': 0}).status_code, 409)
        self.assertEqual(self.client.get('/api/workspace').json()['snapshot'], self.snapshot)

    def test_reject_wrong_area_invalid_points_and_original_path(self):
        bad = copy.deepcopy(self.snapshot)
        bad['layers'][0]['items'][0]['position'] = [-25, -53]
        self.assertEqual(self.client.put('/api/workspace', json={**bad, 'revision': 0}).status_code, 422)
        bad['layers'][0]['items'] = [None]
        self.assertEqual(self.client.post('/api/workspace/validar', json=bad).status_code, 422)
        bad = copy.deepcopy(self.snapshot)
        bad['layers'][0].update(linkedCrowns=True, executionId='../../outside', items=[], segmentation={'type': 'FeatureCollection', 'features': []})
        self.assertEqual(self.client.post('/api/workspace/validar', json=bad).status_code, 422)
        self.assertEqual(self.client.get('/api/workspace').json()['revision'], 0)

    def send(self, snapshot=None):
        response = self.client.post('/api/acervo', json={'name': 'Pacote', 'snapshot': snapshot or self.snapshot})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()['id']

    def test_review_publish_replacement_and_permissions(self):
        first = self.send()
        self.assertEqual(self.client.post(f'/api/acervo/{first}/publicar').status_code, 409)
        self.role = 'operator'
        self.assertEqual(self.client.post(f'/api/acervo/{first}/aprovar').status_code, 403)
        self.role = 'admin'
        self.assertEqual(self.client.post(f'/api/acervo/{first}/aprovar').status_code, 200)
        self.assertEqual(self.client.post(f'/api/acervo/{first}/publicar').status_code, 200)
        second = self.send()
        self.assertEqual(self.client.post(f'/api/acervo/{second}/aprovar').status_code, 200)
        self.assertEqual(self.client.post(f'/api/acervo/{second}/publicar').status_code, 200)
        states = {row['id']: row['state'] for row in self.client.get('/api/acervo').json()}
        self.assertEqual(states, {first: 'aprovado', second: 'publicado'})
        self.assertEqual(self.client.get(f'/api/acervo/{first}').json()['snapshot'], self.snapshot)

    def test_import_without_territory_can_be_archived_but_not_approved(self):
        imported = copy.deepcopy(self.snapshot)
        del imported['layers'][0]['territory']
        ident = self.send(imported)
        self.assertEqual(self.client.post(f'/api/acervo/{ident}/aprovar').status_code, 422)

    def test_public_feed_contains_only_published_visible_layers(self):
        hidden = copy.deepcopy(self.snapshot['layers'][0])
        hidden['id'] = 'hidden'
        hidden['items'][0]['id'] = 'hidden-point'
        hidden['items'][0]['label'] = 'Ponto oculto'
        self.snapshot['layers'].append(hidden)
        ident = self.send()
        self.assertEqual(self.client.get('/api/publico/pacotes').json(), [])
        self.client.post(f'/api/acervo/{ident}/aprovar')
        self.client.post(f'/api/acervo/{ident}/publicar')
        public = self.client.get('/api/publico/pacotes').json()
        self.assertEqual(len(public), 1)
        self.assertEqual(len(public[0]['data']['features']), 1)
        self.assertEqual(public[0]['data']['features'][0]['properties']['label'], 'Ponto')
        self.assertNotIn('owner', public[0])
        app = FastAPI()
        app.include_router(router)
        with TestClient(app) as anonymous:
            self.assertEqual(anonymous.get('/api/acervo').status_code, 401)
            self.assertEqual(anonymous.get('/api/publico/pacotes').status_code, 200)
        self.client.post(f'/api/acervo/{ident}/despublicar')
        self.assertEqual(self.client.get('/api/publico/pacotes').json(), [])
