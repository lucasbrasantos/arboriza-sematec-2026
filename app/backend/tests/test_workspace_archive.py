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
        if not ids or any(ident not in ('s1', 's2') for ident in ids):
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

    def test_large_snapshot_can_be_validated_and_saved(self):
        snapshot = copy.deepcopy(self.snapshot)
        snapshot['layers'][0]['items'][0]['properties']['extra'] = 'x' * 30_000_001
        response = self.client.post('/api/workspace/validar', json=snapshot)
        self.assertEqual(response.status_code, 200, response.text[:500])
        response = self.client.put('/api/workspace', json={**snapshot, 'revision': 0})
        self.assertEqual(response.status_code, 200, response.text[:500])

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

    def test_legacy_package_with_distinct_territories_can_be_approved_and_replaced(self):
        snapshot = copy.deepcopy(self.snapshot)
        other = copy.deepcopy(snapshot['layers'][0])
        other['id'] = 'second'
        other['items'][0]['id'] = 'second-point'
        other['territory']['ids'] = ['s1', 's2']
        snapshot['layers'].append(other)
        ident = self.send(snapshot)
        # Reproduz um pacote salvo antes da mudança, com chave territorial nula.
        with connect() as db:
            db.execute('UPDATE archive_packages SET territory_key=NULL WHERE id=?', (ident,))
        self.assertTrue(self.client.get(f'/api/acervo/{ident}').json()['territory_key'])
        self.assertEqual(self.client.post(f'/api/acervo/{ident}/aprovar').status_code, 200)
        self.assertEqual(self.client.post(f'/api/acervo/{ident}/publicar').status_code, 200)
        replacement = self.send(snapshot)
        self.assertEqual(self.client.post(f'/api/acervo/{replacement}/aprovar').status_code, 200)
        self.assertEqual(self.client.post(f'/api/acervo/{replacement}/publicar').status_code, 200)
        states = {row['id']: row['state'] for row in self.client.get('/api/acervo').json()}
        self.assertEqual(states, {ident: 'aprovado', replacement: 'publicado'})

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
        self.assertEqual([layer['id'] for layer in public[0]['layers']], ['import:test'])
        self.assertEqual(public[0]['data']['features'][0]['properties']['camada_id'], 'import:test')
        self.assertEqual(public[0]['data']['features'][0]['properties']['label'], 'Ponto')
        self.assertNotIn('owner', public[0])
        app = FastAPI()
        app.include_router(router)
        with TestClient(app) as anonymous:
            self.assertEqual(anonymous.get('/api/acervo').status_code, 401)
            self.assertEqual(anonymous.get('/api/publico/pacotes').status_code, 200)
        self.client.post(f'/api/acervo/{ident}/despublicar')
        self.assertEqual(self.client.get('/api/publico/pacotes').json(), [])

    @patch('arboriza_api.analyses.workspace.read_sector_analysis', return_value=['s1'])
    @patch('arboriza_api.analyses.workspace.analyze_streets', return_value={'type': 'FeatureCollection', 'features': [], 'arboriza': {}})
    @patch('arboriza_api.analyses.workspace.read', return_value={'state': 'concluida', 'request': {'ids': ['s1'], 'fonte_malha': 'mesh', 'perfil': 'controle'}})
    def test_public_street_diagnostic_uses_only_published_layers(self, _read, analyze, _sectors):
        snapshot = copy.deepcopy(self.snapshot)
        snapshot['layers'][0]['executionId'] = '20261108T123456Z-abcdefab'
        hidden = copy.deepcopy(snapshot['layers'][0])
        hidden['id'] = 'hidden'
        hidden['items'][0]['id'] = 'hidden-point'
        snapshot['layers'].append(hidden)
        ident = self.send(snapshot)
        body = {'layer_id': 'import:test', 'layer_ids': ['import:test'], 'distancia_m': 25}
        self.assertEqual(self.client.post(f'/api/publico/pacotes/{ident}/ruas', json=body).status_code, 404)
        self.assertEqual(self.client.post(f'/api/acervo/{ident}/aprovar').status_code, 200)
        self.assertEqual(self.client.post(f'/api/acervo/{ident}/publicar').status_code, 200)
        response = self.client.post(f'/api/publico/pacotes/{ident}/ruas', json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(analyze.call_args.args[2], [[-50.5, -21.5]])
        self.assertEqual(self.client.post(f'/api/publico/pacotes/{ident}/ruas', json={**body, 'layer_ids': ['import:test', 'hidden']}).status_code, 422)
        self.assertEqual(self.client.post(f'/api/publico/pacotes/{ident}/ruas', json={**body, 'pontos': [[0, 0]]}).status_code, 422)
        self.client.post(f'/api/acervo/{ident}/despublicar')
        self.assertEqual(self.client.post(f'/api/publico/pacotes/{ident}/ruas', json=body).status_code, 404)

    @patch('arboriza_api.analyses.workspace.read_sector_analysis', return_value=['s1'])
    @patch('arboriza_api.analyses.workspace.analyze_streets', return_value={'type': 'FeatureCollection', 'features': [], 'arboriza': {}})
    @patch('arboriza_api.analyses.workspace.select_canopies', return_value=([{'id': 'c1', 'coordinates': [-50.5, -21.5], 'tipo': 'copa_individual'}], {'multicamadas': True}))
    @patch('arboriza_api.analyses.workspace.read', return_value={'state': 'concluida', 'request': {'ids': ['s1'], 'fonte_malha': 'mesh', 'perfil': 'fusao'}})
    def test_public_v2_diagnostic_rejects_unpublished_layers(self, _read, select, analyze, _sectors):
        snapshot = copy.deepcopy(self.snapshot)
        layer = snapshot['layers'][0]
        layer.update(executionId='20261108T123456Z-abcdefab', linkedCrowns=True)
        layer['items'][0]['properties'] = {'copa_id': 'c1'}
        hidden = copy.deepcopy(layer)
        hidden['id'] = 'hidden'
        hidden['items'][0]['id'] = 'hidden-point'
        snapshot['layers'].append(hidden)
        ident = self.send(snapshot)
        self.assertEqual(self.client.post(f'/api/acervo/{ident}/aprovar').status_code, 200)
        self.assertEqual(self.client.post(f'/api/acervo/{ident}/publicar').status_code, 200)
        body = {'layer_id': layer['id'], 'layer_ids': [layer['id']], 'distancia_m': 25}
        response = self.client.post(f'/api/publico/pacotes/{ident}/ruas', json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(select.call_args.args[2], [{'id_camada': layer['id'], 'ids_copas': ['c1']}])
        self.assertEqual(analyze.call_args.args[2], [[-50.5, -21.5]])
        self.assertEqual(self.client.post(f'/api/publico/pacotes/{ident}/ruas', json={**body, 'layer_ids': [layer['id'], 'hidden']}).status_code, 422)
