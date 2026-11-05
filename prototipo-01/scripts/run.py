"""Servidor local da interface"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = {"index.html", "styles.css", "app.js", "map.js", "points.js"}


class InterfaceHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = Path(self.translate_path(self.path)).resolve()
        if path == ROOT:
            path /= "index.html"
        try:
            relative = path.relative_to(ROOT)
        except ValueError:
            return self.send_error(404)
        if relative.as_posix() not in PUBLIC_FILES and relative.parts[:1] != ("assets",):
            return self.send_error(404)
        return super().send_head()

    def list_directory(self, path):
        return self.send_error(404)


class InterfaceServer(ThreadingHTTPServer):
    allow_reuse_address = False  # No Windows, SO_REUSEADDR permitiria dois servidores na mesma porta.


def main():
    parser = argparse.ArgumentParser(description="Abrir a interface do Protótipo 01.")
    parser.add_argument("--port", type=int, default=5175)
    parser.add_argument("--no-browser", action="store_true", help="Não abrir o navegador automaticamente.")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Use uma porta entre 1 e 65535.")
    url = f"http://127.0.0.1:{args.port}/"
    try:
        server = InterfaceServer(("127.0.0.1", args.port),
                                 partial(InterfaceHandler, directory=str(ROOT)))
    except OSError as error:
        parser.exit(1, f"Não foi possível iniciar {url}: {error}\n"
                    "Se a porta estiver ocupada, encerre o servidor anterior ou use --port 5176.\n")
    with server:
        print(f"Protótipo 01: {url}\nCtrl+C encerra o servidor.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")


if __name__ == "__main__":
    main()
