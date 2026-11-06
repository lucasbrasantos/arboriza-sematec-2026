"""Inicia a interface e a API local no mesmo processo."""
import argparse
from pathlib import Path
import socket
import sys
import webbrowser

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5175)
    parser.add_argument("--no-browser", action="store_true", help="Não abrir o navegador automaticamente.")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Use uma porta entre 1 e 65535.")
    import uvicorn
    from backend.api import create_app
    url = f"http://127.0.0.1:{args.port}/"
    # Bind exclusivo antes de abrir o navegador, inclusive no Windows.
    with socket.socket() as sock:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            sock.bind(("127.0.0.1", args.port))
            sock.listen(128)
        except OSError as error:
            parser.exit(1, f"Não foi possível iniciar {url}: {error}\nEncerre o servidor anterior ou use --port 5176.\n")
        print(f"Protótipo 01: {url}\nCtrl+C encerra o servidor.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        uvicorn.Server(uvicorn.Config(create_app(), host="127.0.0.1", port=args.port)).run(sockets=[sock])


if __name__ == "__main__":
    main()
