from typing import Any, Dict, Tuple
from urllib.parse import parse_qs

from app.config import Config
from app.music_provider import (
    MusicProvider,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ResourceNotFoundError,
    ValidationError,
)


def handle_request(
    method: str,
    path: str,
    query_string: str,
    headers: Dict[str, str],
    provider: MusicProvider,
) -> Tuple[int, Dict[str, Any]]:
    """
    Framework-agnostic HTTP routing handler used by both Flask routes and the WSGI server.
    Ensures identical behavior and deterministic unit testing.
    """
    # Optional internal service token protection
    if Config.INTERNAL_SERVICE_TOKEN:
        supplied_token = headers.get("X-Internal-Token") or headers.get("x-internal-token") or ""
        if supplied_token != Config.INTERNAL_SERVICE_TOKEN:
            return 403, {
                "success": False,
                "error": {
                    "code": "FORBIDDEN_INTERNAL_SERVICE",
                    "message": "Invalid or missing internal service token.",
                },
            }

    if method.upper() != "GET":
        return 405, {
            "success": False,
            "error": {"code": "METHOD_NOT_ALLOWED", "message": "Only GET requests are supported."},
        }

    clean_path = path.rstrip("/") or "/"

    if clean_path == "/health":
        return 200, {
            "success": True,
            "data": {
                "status": "ok",
                "service": "vibeflow-music-service",
                "engine": provider.engine_name,
            },
        }

    params = parse_qs(query_string, keep_blank_values=True)

    try:
        if clean_path == "/search":
            q = params.get("q", [""])[0]
            filter_type = params.get("filter", ["songs"])[0] or "songs"
            raw_limit = params.get("limit", [str(Config.DEFAULT_LIMIT)])[0]
            try:
                limit = int(raw_limit)
            except ValueError as exc:
                raise ValidationError("Parameter 'limit' must be a valid integer.") from exc

            result = provider.search(query=q, filter_type=filter_type, limit=limit)
            return 200, {"success": True, "data": result}

        if clean_path.startswith("/tracks/"):
            video_id = clean_path[len("/tracks/") :]
            track = provider.get_track(video_id)
            return 200, {"success": True, "data": {"track": track}}

        return 404, {
            "success": False,
            "error": {"code": "NOT_FOUND", "message": f"Endpoint '{clean_path}' does not exist."},
        }

    except ValidationError as exc:
        return 400, {
            "success": False,
            "error": {"code": "VALIDATION_ERROR", "message": str(exc)},
        }
    except ResourceNotFoundError as exc:
        return 404, {
            "success": False,
            "error": {"code": "RESOURCE_NOT_FOUND", "message": str(exc)},
        }
    except ProviderTimeoutError as exc:
        return 504, {
            "success": False,
            "error": {"code": "PROVIDER_TIMEOUT", "message": str(exc)},
        }
    except ProviderUnavailableError as exc:
        return 502, {
            "success": False,
            "error": {"code": "PROVIDER_UNAVAILABLE", "message": str(exc)},
        }
    except Exception:
        return 500, {
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred in the music provider service.",
            },
        }


def create_flask_app(provider: MusicProvider | None = None) -> Any:
    """Create a Flask application when Flask is installed."""
    from flask import Flask, jsonify, request  # type: ignore

    app = Flask(__name__)
    active_provider = provider or MusicProvider()

    @app.route("/health", methods=["GET"])
    @app.route("/search", methods=["GET"])
    @app.route("/tracks/<path:subpath>", methods=["GET"])
    def proxy_routes(subpath: str = "") -> Any:
        status, payload = handle_request(
            method=request.method,
            path=request.path,
            query_string=request.query_string.decode("utf-8"),
            headers=dict(request.headers),
            provider=active_provider,
        )
        return jsonify(payload), status

    return app
