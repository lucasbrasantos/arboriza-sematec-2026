"""python -m arboriza_api.urban_base [--run ID | --retomar | --publicar]."""
import argparse
from . import jobs

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run')
parser.add_argument('--retomar',action='store_true')
parser.add_argument('--publicar',action='store_true')
parser.add_argument('--ids',nargs='+',help='Recorte de teste; omitido = todos os setores urbanos')
args = parser.parse_args()
if args.run:
    jobs.run(args.run)
elif args.publicar:
    print(jobs.publish())
else:
    print(jobs.launch(args.retomar,args.ids))
