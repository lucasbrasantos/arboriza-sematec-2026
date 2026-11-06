"""Copia recortes existentes para o cache, preservando os arquivos originais."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.analysis import RECORTES
from backend.image_cache import DEFAULT_LIMIT, cache_status, import_image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recorte', choices=RECORTES, required=True)
    parser.add_argument('--limite-gib', type=float, default=DEFAULT_LIMIT / 1024**3)
    args = parser.parse_args()
    source = RECORTES[args.recorte]
    metadata_file = source.with_name(source.name.replace('_rgb8.tif', '_fonte.json'))
    metadata = json.loads(metadata_file.read_text(encoding='utf-8'))
    limit = int(args.limite_gib * 1024**3)
    print(json.dumps({'importacao': import_image(source, metadata, limit=limit),
                      'cache': cache_status(limit=limit)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
