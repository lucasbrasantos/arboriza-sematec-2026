"""Baixa a malha pública do IBGE e prepara somente os setores urbanos de Araçatuba."""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen

import fiona
from pyproj import Transformer
from shapely import transform
from shapely.geometry import mapping, shape


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.detector import DATA_ROOT
OUTPUT = DATA_ROOT / "territorial" / "setores-urbanos-aracatuba-ibge-2022.geojson"
SOURCE = ("https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/"
          "malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/"
          "setores/shp/UF/SP_setores_CD2022.zip")


def prepare(output=OUTPUT):
    output = Path(output)
    if output.exists():
        raise FileExistsError(f"O arquivo já existe e foi preservado: {output}")
    with TemporaryDirectory(prefix="arboriza-ibge-") as temporary:
        archive = Path(temporary) / "SP_setores_CD2022.zip"
        checksum = hashlib.sha256()
        print("Baixando a malha pública do IBGE (São Paulo)...", flush=True)
        with urlopen(SOURCE, timeout=120) as response, archive.open("wb") as destination:
            while block := response.read(1024 * 1024):
                checksum.update(block)
                destination.write(block)
        features = []
        with fiona.open("zip://" + archive.as_posix()) as source:
            converter = Transformer.from_crs(source.crs, "EPSG:4326", always_xy=True)
            for feature in source:
                properties = dict(feature["properties"])
                if str(properties.get("CD_MUN")) != "3502804" or properties.get("SITUACAO") != "Urbana":
                    continue
                geometry = shape(feature["geometry"])
                ident = str(properties["CD_SETOR"])
                if geometry.is_empty or not geometry.is_valid:
                    raise ValueError(f"Geometria inválida no setor {ident}; a fonte precisa ser conferida.")
                geometry = transform(geometry, converter.transform, interleaved=False)
                features.append({"type": "Feature", "id": ident,
                                 "properties": {key: properties.get(key) for key in
                                                ("CD_SETOR", "CD_MUN", "SITUACAO", "CD_SIT", "CD_TIPO", "AREA_KM2")},
                                 "geometry": mapping(geometry)})
        if not features or len({item["id"] for item in features}) != len(features):
            raise ValueError("A fonte não contém setores urbanos válidos ou contém IDs duplicados.")
        features.sort(key=lambda item: item["id"])
        collection = {"type": "FeatureCollection", "features": features,
                      "arboriza": {"fonte": "IBGE — Malha de Setores Censitários definitiva do Censo 2022",
                                    "url": SOURCE, "municipio": "Araçatuba/SP", "codigo_municipio": "3502804",
                                    "situacao": "Urbana", "crs_origem": "EPSG:4674", "crs_geojson": "EPSG:4326",
                                    "sha256_fonte": checksum.hexdigest(), "setores": len(features),
                                    "obtida_em": datetime.now(timezone.utc).isoformat()}}
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("x", encoding="utf-8") as stream:
            json.dump(collection, stream, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        print(f"{len(features)} setores urbanos salvos em {output}")
        print(f"SHA-256 da fonte: {checksum.hexdigest()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    prepare()
