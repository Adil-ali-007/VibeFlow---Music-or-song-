import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

# Ensure package imports work when executed directly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import Config
from app.music_provider import MusicProvider
from app.routes import create_flask_app, handle_request

try:
    import flask  # type: ignore # noqa: F401

    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


def run_stdlib_server(host: str, port: int, provider: MusicProvider) -> None:
    """Run a lightweight threaded HTTP server if Flask is not installed in the container."""

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            headers = {k: v for k, v in self.headers.items()}
            status, payload = handle_request(
                method="GET",
                path=parsed.path,
                query_string=parsed.query,
                headers=headers,
                provider=provider,
            )
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: object) -> None:
            # Suppress noisy request logs in stdout
            return

    server = ReusableThreadingHTTPServer((host, port), Handler)
    print(f"[music-service] Listening on http://{host}:{port} (engine={provider.engine_name})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    provider = MusicProvider()
    if HAS_FLASK:
        app = create_flask_app(provider)
        app.run(host=Config.HOST, port=Config.PORT, debug=(Config.FLASK_ENV == "development"))
    else:
        run_stdlib_server(Config.HOST, Config.PORT, provider)
