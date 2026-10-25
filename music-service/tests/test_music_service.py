import os
import sys
import unittest
from typing import Any, Dict, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import Config
from app.music_provider import (
    INNERTUBE_FILTER_PARAMS,
    InnerTubeFallbackClient,
    MusicProvider,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ResourceNotFoundError,
)
from app.routes import handle_request


class FakeYTMusicClient:
    """Deterministic fake client for unit testing without external network calls."""

    def __init__(
        self,
        search_results: List[Dict[str, Any]] | None = None,
        song_result: Dict[str, Any] | None = None,
        raise_exc: Exception | None = None,
    ):
        self.search_results = search_results if search_results is not None else []
        self.song_result = song_result if song_result is not None else {}
        self.raise_exc = raise_exc

    def search(self, query: str, filter_type: str = "songs", limit: int = 15) -> List[Dict[str, Any]]:
        if self.raise_exc:
            raise self.raise_exc
        return self.search_results[:limit]

    def get_song(self, video_id: str) -> Dict[str, Any]:
        if self.raise_exc:
            raise self.raise_exc
        if not self.song_result:
            raise ResourceNotFoundError(f"Track '{video_id}' was not found.")
        return self.song_result


class MusicServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self._orig_token = Config.INTERNAL_SERVICE_TOKEN
        Config.INTERNAL_SERVICE_TOKEN = ""

    def tearDown(self) -> None:
        Config.INTERNAL_SERVICE_TOKEN = self._orig_token

    def test_internal_service_token_enforcement(self) -> None:
        Config.INTERNAL_SERVICE_TOKEN = "secret-token-123"
        provider = MusicProvider(client=FakeYTMusicClient())
        status_denied, body_denied = handle_request("GET", "/health", "", {}, provider)
        self.assertEqual(status_denied, 403)
        self.assertEqual(body_denied["error"]["code"], "FORBIDDEN_INTERNAL_SERVICE")

        status_ok, _ = handle_request(
            "GET", "/health", "", {"X-Internal-Token": "secret-token-123"}, provider
        )
        self.assertEqual(status_ok, 200)

    def test_valid_search_normalizes_tracks(self) -> None:
        raw_items = [
            {
                "resultType": "song",
                "videoId": "dQw4w9WgXcQ",
                "title": "Digital Love",
                "artists": [{"id": "UC_daft", "name": "Daft Punk"}],
                "album": {"id": "MPREb_discovery", "name": "Discovery"},
                "duration": "5:01",
                "thumbnails": [{"url": "http://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg"}],
                "isExplicit": False,
            }
        ]
        provider = MusicProvider(client=FakeYTMusicClient(search_results=raw_items))
        status, body = handle_request("GET", "/search", "q=Digital+Love&filter=songs&limit=10", {}, provider)

        self.assertEqual(status, 200)
        self.assertTrue(body["success"])
        tracks = body["data"]["tracks"]
        self.assertEqual(len(tracks), 1)
        track = tracks[0]
        self.assertEqual(track["providerId"], "dQw4w9WgXcQ")
        self.assertEqual(track["title"], "Digital Love")
        self.assertEqual(track["artistName"], "Daft Punk")
        self.assertEqual(track["durationSeconds"], 301)
        self.assertEqual(track["durationFormatted"], "5:01")
        self.assertTrue(track["thumbnailUrl"].startswith("https://"))
        self.assertEqual(track["playbackType"], "YOUTUBE_EMBED")

    def test_empty_search_query_returns_validation_error(self) -> None:
        provider = MusicProvider(client=FakeYTMusicClient())
        status, body = handle_request("GET", "/search", "q=   ", {}, provider)
        self.assertEqual(status, 400)
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")

    def test_invalid_filter_returns_validation_error(self) -> None:
        provider = MusicProvider(client=FakeYTMusicClient())
        status, body = handle_request("GET", "/search", "q=jazz&filter=podcasts", {}, provider)
        self.assertEqual(status, 400)
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")

    def test_empty_results_returns_empty_lists(self) -> None:
        provider = MusicProvider(client=FakeYTMusicClient(search_results=[]))
        status, body = handle_request("GET", "/search", "q=nonexistenttrackxyz", {}, provider)
        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["tracks"], [])

    def test_provider_timeout_returns_504(self) -> None:
        provider = MusicProvider(
            client=FakeYTMusicClient(raise_exc=ProviderTimeoutError("Upstream timed out."))
        )
        status, body = handle_request("GET", "/search", "q=test", {}, provider)
        self.assertEqual(status, 504)
        self.assertEqual(body["error"]["code"], "PROVIDER_TIMEOUT")

    def test_provider_failure_returns_502(self) -> None:
        provider = MusicProvider(
            client=FakeYTMusicClient(raise_exc=ProviderUnavailableError("Upstream down."))
        )
        status, body = handle_request("GET", "/search", "q=test", {}, provider)
        self.assertEqual(status, 502)
        self.assertEqual(body["error"]["code"], "PROVIDER_UNAVAILABLE")

    def test_track_lookup_and_invalid_id(self) -> None:
        song_payload = {
            "videoDetails": {
                "videoId": "abc123XYZ_-",
                "title": "Veridis Quo",
                "author": "Daft Punk",
                "channelId": "UC_daft",
                "lengthSeconds": "345",
                "thumbnail": {"thumbnails": [{"url": "https://i.ytimg.com/vi/abc123XYZ_-/hqdefault.jpg"}]},
            }
        }
        provider = MusicProvider(client=FakeYTMusicClient(song_result=song_payload))
        status, body = handle_request("GET", "/tracks/abc123XYZ_-", "", {}, provider)
        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["track"]["title"], "Veridis Quo")
        self.assertEqual(body["data"]["track"]["durationSeconds"], 345)

        bad_status, bad_body = handle_request("GET", "/tracks/bad$id!", "", {}, provider)
        self.assertEqual(bad_status, 400)
        self.assertEqual(bad_body["error"]["code"], "VALIDATION_ERROR")

    def test_innertube_filter_params_are_valid_base64_not_url_encoded(self) -> None:
        for key, param in INNERTUBE_FILTER_PARAMS.items():
            self.assertNotIn("%", param, f"Filter param for {key} must not be URL-encoded")

        client = InnerTubeFallbackClient()
        parsed_song = client._parse_responsive_item(
            {
                "playlistItemData": {"videoId": "FGBhQbmPwH8"},
                "flexColumns": [
                    {
                        "musicResponsiveListItemFlexColumnRenderer": {
                            "text": {"runs": [{"text": "One More Time"}]}
                        }
                    },
                    {
                        "musicResponsiveListItemFlexColumnRenderer": {
                            "text": {
                                "runs": [
                                    {"text": "Song"},
                                    {"text": " • "},
                                    {"text": "5:20"},
                                ]
                            }
                        }
                    },
                ],
            },
            default_artist={"id": "UCRr1xG_2WIDs18a6cIiCxeA", "name": "Daft Punk"},
        )
        self.assertIsNotNone(parsed_song)
        assert parsed_song is not None
        self.assertEqual(parsed_song["artists"][0]["name"], "Daft Punk")
        self.assertEqual(parsed_song["duration_seconds"], 320)


if __name__ == "__main__":
    unittest.main()
