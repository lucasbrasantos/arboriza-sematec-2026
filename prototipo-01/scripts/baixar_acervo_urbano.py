"""Planeja ou baixa ortofotos dos setores urbanos; sem --baixar, não faz requisições."""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.urban_capture import DESTINATION, SOURCE, download_plan, plan_capture


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baixar', action='store_true', help='Iniciar a aquisição; sem esta opção, somente mostrar o plano.')
    parser.add_argument('--destino', type=Path, default=DESTINATION)
    parser.add_argument('--malha', type=Path, default=SOURCE)
    parser.add_argument('--contexto-m', type=float, default=25)
    parser.add_argument('--paralelos', type=int, choices=range(1, 5), default=3)
    parser.add_argument('--tentativas', type=int, choices=range(1, 9), default=5)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s',
                        datefmt='%H:%M:%S', handlers=[logging.StreamHandler(sys.stdout)])
    logging.getLogger('httpx').setLevel(logging.WARNING)
    try:
        plan = plan_capture(args.malha, args.contexto_m)
        log = logging.getLogger('captura_urbana')
        log.info('SELEÇÃO | %d setores | %.2f km² | contexto %.1f m',
                 len(plan['ids_setores']), plan['area_setores_m2']/1e6, plan['margem_contexto_m'])
        log.info('GRADE | 500 × 500 m | 2000 × 2000 px | 25 cm/px | EPSG:31982')
        log.info('PLANO | %d blocos necessários | %d quadrados externos descartados | %d apenas de contexto',
                 len(plan['blocos']), plan['quadrados_descartados'], sum(b['somente_contexto'] for b in plan['blocos']))
        log.info('VOLUME | %.2f GB de RGB bruto antes de compressão, máscaras e overviews; tamanho final varia',
                 len(plan['blocos'])*2000**2*3/1e9)
        log.info('DESTINO | %s', args.destino.resolve())
        if not args.baixar:
            log.info('SOMENTE PLANEJAMENTO. Nenhum download iniciado. Para capturar, execute novamente com --baixar.')
            return 0
        result = download_plan(plan, args.destino, args.paralelos, args.tentativas)
        return 130 if result['interrompido'] else (1 if result['pendentes'] else 0)
    except (ValueError, OSError) as error:
        logging.getLogger('captura_urbana').error('%s', error)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
