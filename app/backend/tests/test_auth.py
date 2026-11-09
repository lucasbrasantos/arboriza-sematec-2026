import tempfile
import unittest
import time
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from arboriza_api.access.auth import hash_password
from arboriza_api.core.database import connect, initialize
from arboriza_api.core import database
from arboriza_api.main import create_app
from arboriza_api.analyses import router as analyses


class AuthTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix='arboriza-test-')
        self.addCleanup(temp.cleanup)
        test_dir = Path(temp.name)
        for target, value in (
            ('arboriza_api.core.database.DATABASE', test_dir / 'test.sqlite'),
            ('arboriza_api.main.DATABASE', test_dir / 'test.sqlite'),
            ('arboriza_api.analyses.router.RESULTS', test_dir / 'results'),
            ('arboriza_api.core.processing.CACHE_DIR', test_dir / 'cache'),
            ('arboriza_api.urban_base.jobs.ROOT', test_dir / 'base-urbana'),
        ):
            fixture = patch(target, value)
            fixture.start()
            self.addCleanup(fixture.stop)
        if not database.DATABASE.resolve().is_relative_to(test_dir.resolve()):
            raise RuntimeError('Teste recusado: o banco não está no diretório temporário.')
        initialize()
        with connect() as db:
            db.execute('DELETE FROM sessions')
            db.execute('DELETE FROM login_attempts')
            db.execute('DELETE FROM analyses')
            db.execute('DELETE FROM users')
            db.execute('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)',
                       ('principal', hash_password('senha-segura-123'), 'admin'))
        self.client = TestClient(create_app())

    def login(self, username, password):
        return self.client.post('/api/auth/login', json={'username': username, 'password': password})

    def test_roles_sessions_and_revocation(self):
        self.assertEqual(self.client.get('/api/users').status_code, 401)
        self.assertEqual(self.login('principal', 'errada').status_code, 401)
        response = self.login('principal', 'senha-segura-123')
        self.assertEqual(response.status_code, 200)
        token = response.json()['access_token']
        admin = {'Authorization': 'Bearer ' + token}
        response = self.client.post('/api/users', headers=admin,
                                    json={'username': 'operador', 'password': 'senha-segura-456', 'role': 'operator'})
        self.assertEqual(response.status_code, 201)
        operator = self.login('operador', 'senha-segura-456').json()['access_token']
        self.assertEqual(self.client.get('/api/users', headers={'Authorization': 'Bearer ' + operator}).status_code, 403)
        self.assertEqual(self.client.post('/api/auth/logout', headers=admin).status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me', headers=admin).status_code, 401)

    def test_shared_territory_requires_auth(self):
        self.assertEqual(self.client.get('/api/territorio/setores').status_code, 401)
        token = self.login('principal', 'senha-segura-123').json()['access_token']
        headers = {'Authorization': 'Bearer ' + token}
        response = self.client.get('/api/territorio/setores', headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['features']), 499)
        summary = self.client.post('/api/territorio/resumo', headers=headers,
                                   json={'ids': ['350280405000001']})
        self.assertEqual(summary.status_code, 200)
        profiles = self.client.get('/api/analises/perfis', headers=headers).json()
        self.assertEqual([model['id'] for model in profiles['modelos']], ['controle', 'fusao'])

    def test_operator_cannot_manage_users_and_deactivation_revokes_session(self):
        admin_token = self.login('principal', 'senha-segura-123').json()['access_token']
        headers = {'Authorization': 'Bearer ' + admin_token}
        created = self.client.post('/api/users', headers=headers, json={
            'username': 'operador', 'password': 'senha-segura-456', 'role': 'operator'})
        ident = created.json()['id']
        operator = self.login('operador', 'senha-segura-456').json()['access_token']
        op_headers = {'Authorization': 'Bearer ' + operator}
        self.assertEqual(self.client.post(f'/api/users/{ident}/senha', headers=op_headers,
                                         json={'password': 'outra-senha-segura'}).status_code, 403)
        self.assertEqual(self.client.patch(f'/api/users/{ident}/estado', headers=headers,
                                          json={'active': False}).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/me', headers=op_headers).status_code, 401)
        self.assertEqual(self.client.patch('/api/users/1/estado', headers=headers,
                                          json={'active': False}).status_code, 409)

    def test_login_limits_repeated_failures(self):
        with patch('arboriza_api.access.auth.time.time', return_value=1000):
            for _ in range(5):
                self.assertEqual(self.login('principal', 'errada').status_code, 401)
        with patch('arboriza_api.access.auth.time.time', return_value=1004):
            blocked = self.login('principal', 'senha-segura-123')
            self.assertEqual(blocked.status_code, 429)
            self.assertIn('5 segundos', blocked.json()['detail'])
        with patch('arboriza_api.access.auth.time.time', return_value=1005):
            self.assertEqual(self.login('principal', 'senha-segura-123').status_code, 200)

    def test_another_instance_cannot_start_on_same_database(self):
        with TestClient(create_app()):
            with self.assertRaisesRegex(RuntimeError, 'Já existe uma instância'):
                with TestClient(create_app()):
                    pass

    def test_analysis_survives_restart(self):
        class FakeService:
            def run_sectors(self, territory, ids, score, folder, progress):
                progress('Testando')
                (folder / 'pontos.geojson').write_text('{"type":"FeatureCollection","features":[]}', encoding='utf-8')
                return {'quantidade': 0}

        analyses.service = FakeService()
        with TestClient(create_app()) as client:
            token = client.post('/api/auth/login', json={'username':'principal', 'password':'senha-segura-123'}).json()['access_token']
            headers = {'Authorization': 'Bearer ' + token}
            data = client.get('/api/territorio/setores', headers=headers).json()
            body = {'ids':['350280405000001'], 'fonte_malha': data['arboriza']['sha256_fonte'], 'perfil':'controle', 'score':.15}
            created = client.post('/api/analises/setores', headers=headers, json=body)
            self.assertEqual(created.status_code, 202, created.text)
            ident = created.json()['analysis_id']
            for _ in range(100):
                record = client.get('/api/analises/' + ident, headers=headers).json()
                if record['state'] in ('concluida', 'erro'):
                    break
                time.sleep(.02)
            self.assertEqual(record['state'], 'concluida', record)
        with TestClient(create_app()) as client:
            self.assertEqual(client.get('/api/analises/' + ident, headers=headers).json()['state'], 'concluida')
            self.assertEqual(client.get(f'/api/analises/{ident}/camadas/pontos', headers=headers).status_code, 200)
        analyses.service = None


if __name__ == '__main__':
    unittest.main()
