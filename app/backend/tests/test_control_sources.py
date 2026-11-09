import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import geometry_mask
from rasterio.transform import from_bounds, from_origin
from shapely import transform
from shapely.geometry import box, mapping

from arboriza_api.engine.imagery.control_sources import LocalControlSource, direct_datageo
from arboriza_api.engine.geography.coverage import valid_footprint
from arboriza_api.engine.inference.fusion_engine import LocalImages, windows
from arboriza_api.engine.inference.sector_analysis import run_sector_analysis
from arboriza_api.engine.inference.service import recorte_footprint
from arboriza_api.engine.geography.territory import Territory
from tests.test_sector_analysis import Detector


class ControlSourcesTests(unittest.TestCase):
    def test_centro_projection_border_does_not_report_missing_image(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'centro.tif'
            bounds=(-50.4404,-21.21019886795048,-50.43789939465794,-21.2079)
            with rasterio.open(path,'w',driver='GTiff',width=1066,height=980,count=3,dtype='uint8',
                               crs='EPSG:4326',transform=from_bounds(*bounds,1066,980),compress='deflate') as output:
                output.write(np.ones((3,980,1066),dtype='uint8'))
            info=path.stat(); project=Transformer.from_crs(4326,31982,always_xy=True)
            before=transform(valid_footprint(str(path),info.st_size,info.st_mtime_ns),project.transform,interleaved=False)
            after=transform(recorte_footprint(path),project.transform,interleaved=False)
            reader=LocalImages([path], cache_root=Path(temp)/'imagens-cache')
            def missing(area):
                total=0
                for _,_,b in windows(area,512):
                    _,valid,affine,_=reader.read(b,512)
                    required=geometry_mask([mapping(area.intersection(box(*b)))],out_shape=valid.shape,transform=affine,invert=True)
                    total+=int((required&~valid).sum())
                return total
            self.assertGreater(missing(before),0)
            self.assertEqual(missing(after),0)

    def test_control_sources_share_grid_and_local_never_uses_network_or_wms_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); origin=root/'acervo.tif'
            left,bottom=3610*150,50810*150
            with rasterio.open(origin,'w',driver='GTiff',width=2000,height=2000,count=3,dtype='uint8',
                               crs='EPSG:31982',transform=from_origin(left-100,bottom+400,.25,.25),compress='deflate') as output:
                output.write(np.ones((3,2000,2000),dtype='uint8'))
            geographic=transform(box(left+50,bottom+50,left+100,bottom+100),Transformer.from_crs(31982,4326,always_xy=True).transform,interleaved=False)
            path=root/'territorio.json';path.write_text(json.dumps({'arboriza':{'sha256_fonte':'teste'},
                'features':[{'type':'Feature','id':'a','properties':{},'geometry':mapping(geographic)}]}),encoding='utf-8')
            territory=Territory(path);local=LocalControlSource([origin], cache_root=root/'janelas-cache');requests=[]
            inferences=[]
            class RecordingDetector(Detector):
                def predict(self, image):
                    inferences.append(image.shape)
                    return super().predict(image)
            def fake(bounds,width,height,target,client=None,crs=None):
                requests.append((bounds,width,height))
                with rasterio.open(target,'w',driver='GTiff',width=width,height=height,count=3,dtype='uint8',
                                   crs=crs,transform=from_bounds(*bounds,width,height)) as output:
                    output.write(np.ones((3,height,width),dtype='uint8'))
                return {'aquisicao_s':.2,'pixels_validos':width*height,'pixels_totais':width*height,'sha256_png':'teste'}
            def run(name,provider):
                folder=root/name;folder.mkdir()
                return run_sector_analysis(RecordingDetector(),territory,['a'],.15,folder,lambda _:None,
                    image_provider=provider,profile=name,cache_root=root/'cache-proibido',metric_grid=True)
            with patch('httpx.Client.send',side_effect=AssertionError('Rede proibida no teste')), \
                 patch('arboriza_api.engine.inference.sector_analysis.cached_orthophoto',side_effect=AssertionError('Cache WMS proibido')):
                a=run('controle-local',local)
                repeated=run('controle-local-repetido',local)
                with patch('arboriza_api.engine.imagery.control_sources.fetch_orthophoto',side_effect=fake):
                    b=run('controle-datageo',direct_datageo)
                    c=run('controle-datageo-repetido',direct_datageo)
            self.assertEqual(len(requests),2)
            self.assertEqual(len(inferences),4)
            self.assertEqual(a['janelas_cache_acervo'],0)
            self.assertEqual(repeated['janelas_cache_acervo'],1)
            self.assertEqual(a['candidatos'],repeated['candidatos'])
            self.assertEqual(a['janelas_locais'],1);self.assertEqual(a['janelas_download'],0)
            self.assertEqual(b['janelas_download'],1);self.assertEqual(c['janelas_download'],1)
            for key in ('candidatos','janela_m','passo_m','resolucao_solicitada_m','janelas'):
                self.assertEqual(a[key],b[key])
            x,y=a['medicoes_janelas'][0],b['medicoes_janelas'][0]
            for key in ('bounds_lon_lat','bounds_imagem','crs_imagem','largura','altura','sha256_rgb_validade'):
                self.assertEqual(x[key],y[key])
            self.assertFalse((root/'cache-proibido').exists())


if __name__=='__main__':unittest.main()
