import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from shapely.geometry import box, mapping
from shapely import transform
from fastapi.testclient import TestClient
from arboriza_api.main import create_app
from arboriza_api.urban_base import storage, jobs
from arboriza_api.engine.inference.crown_fusion import fuse


class UrbanBaseTest(unittest.TestCase):
    def test_transient_windows_file_lock_is_retried(self):
        with patch.object(jobs,'_atomic_json',side_effect=[PermissionError('locked'),None]) as write, \
             patch.object(jobs.time,'sleep'):
            jobs.atomic_json(Path('unused'),{'state':'processando'})
            self.assertEqual(write.call_count,2)

    def test_global_fusion_matches_original_and_exports(self):
        def row(key,engine,kind,geom,score=.9):
            return {'key':key,'engine':engine,'tipo':kind,'geometry':geom,'score':score,'pixel_area_m2':.0625}
        rows = [row('r1','restor','copa_individual',box(550000,7650000,550010,7650010)),
                row('r2','restor','copa_individual',box(550001,7650001,550011,7650011),.8),
                row('r3','restor','grupo_de_copas',box(550008,7650000,550020,7650010)),
                row('c1','cambridge200','copa_candidata',box(550000,7650000,550010,7650010)),
                row('c2','cambridge100','copa_candidata',box(550024,7650000,550028,7650004))]
        sectors = {'1':box(550000,7650000,550010,7650020),'2':box(550010,7650000,550030,7650020)}
        area=box(550000,7650000,550030,7650020)
        original=fuse(rows,area,'test',sectors=sectors)
        with tempfile.TemporaryDirectory() as tmp:
            db=storage.connect(Path(tmp)/'catalog.sqlite')
            storage.insert_window(db,'window',rows)
            self.assertEqual(db.execute('SELECT count(*) FROM windows').fetchone()[0],1)
            storage.consolidate(db,area,sectors,'test',.15,lambda *a:None)
            features=[{'id':i,'geometry':mapping(transform(g,storage.BACK.transform,interleaved=False))} for i,g in sectors.items()]
            summary=storage.statistics(db,sectors,features,'test','hash',lambda *a:None)
            self.assertEqual(summary['base']['individuos'],original['resumo']['copas_individuais'])
            self.assertEqual(summary['base']['grupos'],original['resumo']['grupos_copas'])
            for f in summary['features']:
                expected=original['resumo']['cobertura_por_setor'][f['id']]
                self.assertAlmostEqual(f['properties']['copas_m2'],expected['cobertura_operacional_m2'])
            storage.export_files(db,tmp,summary['base'],lambda *a:None)
            points=json.loads((Path(tmp)/'pontos.geojson').read_text())
            self.assertEqual(len(points['features']),len(original['pontos-todos']['features']))
            import fiona
            self.assertEqual(set(fiona.listlayers(Path(tmp)/'aracatuba.gpkg')),{'copas','pontos'})
            db.close()

    def test_operations_require_admin_and_public_empty_is_lightweight(self):
        client=TestClient(create_app())
        with tempfile.TemporaryDirectory() as tmp, patch.object(jobs,'ROOT',Path(tmp)), \
             patch('arboriza_api.urban_base.router.BACKEND_DIR',Path(tmp)/'backend'):
            self.assertEqual(client.get('/api/base-urbana/status').status_code,401)
            self.assertEqual(client.post('/api/base-urbana/iniciar').status_code,401)
            r=client.get('/api/base-urbana/publicada')
            self.assertEqual(r.status_code,200)
            self.assertEqual(r.json()['features'],[])
            self.assertEqual(client.get('/api/base-urbana/exportar/pontos').status_code,404)
            with self.assertRaises(ValueError): jobs.folder('../outside')

    def test_resume_checkpoint_does_not_lose_completed_window(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'db.sqlite'
            db=storage.connect(path); storage.insert_window(db,'done',[]); db.close()
            db=storage.connect(path)
            self.assertEqual(db.execute('SELECT key FROM windows').fetchone()[0],'done')
            db.close()
