import os
from urllib.parse import urlparse


def _load_env_files() -> None:
    """Load environment variables from .env files if present."""
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv()
    except ImportError:
        pass

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    root_dir = os.path.abspath(os.path.join(base_dir, ".."))
    for env_path in (os.path.join(base_dir, ".env"), os.path.join(root_dir, ".env")):
        if os.path.isfile(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as fh:
                    for raw_line in fh:
                        line = raw_line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip('"').strip("'")
                        if key and key not in os.environ:
                            os.environ[key] = val
            except OSError:
                pass


_load_env_files()


def _resolve_port() -> int:
    if os.environ.get("MUSIC_SERVICE_PORT"):
        try:
            return int(os.environ["MUSIC_SERVICE_PORT"])
        except ValueError:
            pass

    service_url = os.environ.get("MUSIC_SERVICE_URL", "").strip()
    if service_url:
        try:
            parsed = urlparse(service_url)
            if parsed.port:
                return int(parsed.port)
        except ValueError:
            pass

    raw_port = os.environ.get("PORT", "").strip()
    if raw_port:
        try:
            port_val = int(raw_port)
            # Avoid colliding with container reverse-proxy (8080) or Express/Vite ports (3000, 8000)
            if port_val not in (3000, 8000, 8080):
                return port_val
        except ValueError:
            pass

    return 5001


class Config:
    """Centralized configuration for the Python music provider service."""

    FLASK_ENV: str = os.environ.get("FLASK_ENV", "development")
    HOST: str = os.environ.get("MUSIC_SERVICE_HOST", "127.0.0.1").strip() or "127.0.0.1"
    PORT: int = _resolve_port()
    INTERNAL_SERVICE_TOKEN: str = os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    REQUEST_TIMEOUT_SECONDS: float = float(os.environ.get("REQUEST_TIMEOUT_SECONDS", "8.0"))
    MAX_QUERY_LENGTH: int = 120
    DEFAULT_LIMIT: int = 15
    MAX_LIMIT: int = 30
