import json
import re
import socket
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from app.config import Config

try:
    from ytmusicapi import YTMusic  # type: ignore

    HAS_YTMUSICAPI = True
except ImportError:
    YTMusic = None
    HAS_YTMUSICAPI = False


class ValidationError(Exception):
    """Raised when request parameters fail validation."""


class ProviderTimeoutError(Exception):
    """Raised when the upstream music provider times out."""


class ProviderUnavailableError(Exception):
    """Raised when the upstream music provider fails or is unreachable."""


class ResourceNotFoundError(Exception):
    """Raised when a requested track, album, or artist does not exist."""


SAFE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_\-]{3,64}$")
ALLOWED_FILTERS = {"songs", "albums", "artists", "all"}

# Standard YouTube Music InnerTube base64 protobuf filter parameters (mirrors ytmusicapi)
INNERTUBE_FILTER_PARAMS = {
    "songs": "EgWKAQIIAWoMEA4QChADEAQQCRAF",
    "albums": "EgWKAQIYAWoMEA4QChADEAQQCRAF",
    "artists": "EgWKAQIgAWoMEA4QChADEAQQCRAF",
}


def parse_duration_seconds(duration_text: Optional[str]) -> Optional[int]:
    """Convert a 'MM:SS' or 'HH:MM:SS' duration string into integer seconds."""
    if not duration_text or not isinstance(duration_text, str):
        return None
    parts = duration_text.strip().split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        return None
    return None


def format_duration(seconds: Optional[int], fallback: Optional[str] = None) -> Optional[str]:
    """Format seconds into 'M:SS'."""
    if seconds is not None and seconds >= 0:
        mins, secs = divmod(int(seconds), 60)
        return f"{mins}:{secs:02d}"
    return fallback


class InnerTubeFallbackClient:
    """
    Lightweight standard-library client for YouTube Music's public InnerTube endpoints.
    Used automatically if the `ytmusicapi` wheel is not installed in a container environment,
    ensuring real YouTube Music search and metadata retrieval without mock data.
    """

    BASE_URL = "https://music.youtube.com/youtubei/v1"
    CONTEXT = {
        "client": {
            "clientName": "WEB_REMIX",
            "clientVersion": "1.20240401.01.00",
            "hl": "en",
            "gl": "US",
        }
    }

    def __init__(self, timeout: float = 8.0):
        self.timeout = timeout

    def _post(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.BASE_URL}/{endpoint}?prettyPrint=false"
        body = json.dumps({**payload, "context": self.CONTEXT}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Origin": "https://music.youtube.com",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (socket.timeout, TimeoutError) as exc:
            raise ProviderTimeoutError("YouTube Music request timed out.") from exc
        except urllib.error.URLError as exc:
            if isinstance(getattr(exc, "reason", None), socket.timeout):
                raise ProviderTimeoutError("YouTube Music request timed out.") from exc
            raise ProviderUnavailableError("Unable to reach YouTube Music upstream.") from exc
        except Exception as exc:
            raise ProviderUnavailableError("Unexpected error communicating with YouTube Music.") from exc

    def search(self, query: str, filter_type: Optional[str] = None, limit: int = 15) -> List[Dict[str, Any]]:
        payload: Dict[str, Any] = {"query": query}
        if filter_type in INNERTUBE_FILTER_PARAMS:
            payload["params"] = INNERTUBE_FILTER_PARAMS[filter_type]

        data = self._post("search", payload)
        results: List[Dict[str, Any]] = []
        seen_ids: set[str] = set()

        def add_result(parsed: Optional[Dict[str, Any]]) -> None:
            if not parsed:
                return
            unique_key = f"{parsed.get('resultType')}:{parsed.get('videoId') or parsed.get('browseId')}"
            if unique_key in seen_ids:
                return
            seen_ids.add(unique_key)
            results.append(parsed)

        def walk_items(node: Any, context_artist: Optional[Dict[str, Optional[str]]] = None) -> None:
            if isinstance(node, dict):
                if "musicCardShelfRenderer" in node:
                    card = node["musicCardShelfRenderer"]
                    card_artist = self._parse_card_shelf(card, add_result)
                    walk_items(card.get("contents", []), card_artist or context_artist)
                    return

                if "musicResponsiveListItemRenderer" in node:
                    parsed = self._parse_responsive_item(
                        node["musicResponsiveListItemRenderer"],
                        default_artist=context_artist,
                    )
                    add_result(parsed)
                else:
                    for val in node.values():
                        walk_items(val, context_artist)
            elif isinstance(node, list):
                for item in node:
                    walk_items(item, context_artist)

        walk_items(data)

        if filter_type == "songs":
            results = [r for r in results if r.get("resultType") in ("song", "video")]
            # Rank results matching query terms in title or artist ahead of spell-corrected noise
            q_terms = [t for t in query.lower().split() if len(t) >= 2]
            if q_terms:
                def relevance_key(item: Dict[str, Any]) -> int:
                    haystack = f"{item.get('title', '')} {' '.join(a.get('name', '') for a in item.get('artists', []))}".lower()
                    return 0 if all(t in haystack for t in q_terms) else (1 if any(t in haystack for t in q_terms) else 2)

                results.sort(key=relevance_key)
        elif filter_type == "albums":
            results = [r for r in results if r.get("resultType") == "album"]
        elif filter_type == "artists":
            results = [r for r in results if r.get("resultType") == "artist"]

        return results[:limit]

    def _parse_card_shelf(
        self,
        card: Dict[str, Any],
        add_result: Any,
    ) -> Optional[Dict[str, Optional[str]]]:
        """Parse top-result musicCardShelfRenderer and extract artist context for child tracks."""
        title_runs = card.get("title", {}).get("runs", [])
        if not title_runs:
            return None
        title = title_runs[0].get("text", "").strip()
        if not title:
            return None

        nav_ep = title_runs[0].get("navigationEndpoint", {})
        browse_id = nav_ep.get("browseEndpoint", {}).get("browseId")
        video_id = nav_ep.get("watchEndpoint", {}).get("videoId")
        thumbnails = (
            card.get("thumbnail", {})
            .get("musicThumbnailRenderer", {})
            .get("thumbnail", {})
            .get("thumbnails", [])
        )
        subtitle_runs = card.get("subtitle", {}).get("runs", [])

        if browse_id and browse_id.startswith("UC"):
            add_result(
                {
                    "resultType": "artist",
                    "browseId": browse_id,
                    "artist": title,
                    "thumbnails": thumbnails,
                }
            )
            return {"id": browse_id, "name": title}

        if browse_id and browse_id.startswith("MPREb_"):
            artists: List[Dict[str, Optional[str]]] = []
            year_str: Optional[str] = None
            for run in subtitle_runs:
                text = run.get("text", "").strip()
                b_id = run.get("navigationEndpoint", {}).get("browseEndpoint", {}).get("browseId")
                if b_id and b_id.startswith("UC"):
                    artists.append({"id": b_id, "name": text})
                elif re.match(r"^(19|20)\d{2}$", text):
                    year_str = text
            add_result(
                {
                    "resultType": "album",
                    "browseId": browse_id,
                    "title": title,
                    "artists": artists or [{"id": None, "name": "Unknown Artist"}],
                    "year": year_str,
                    "thumbnails": thumbnails,
                }
            )
            return artists[0] if artists else None

        if video_id:
            artists = []
            duration_str = None
            for run in subtitle_runs:
                text = run.get("text", "").strip()
                b_id = run.get("navigationEndpoint", {}).get("browseEndpoint", {}).get("browseId")
                if b_id and b_id.startswith("UC"):
                    artists.append({"id": b_id, "name": text})
                elif re.match(r"^\d{1,2}:\d{2}(:\d{2})?$", text):
                    duration_str = text
            add_result(
                {
                    "resultType": "song",
                    "videoId": video_id,
                    "title": title,
                    "artists": artists or [{"id": None, "name": "Unknown Artist"}],
                    "album": None,
                    "duration": duration_str,
                    "duration_seconds": parse_duration_seconds(duration_str),
                    "thumbnails": thumbnails,
                    "isExplicit": False,
                }
            )
        return None

    def _parse_responsive_item(
        self,
        item: Dict[str, Any],
        default_artist: Optional[Dict[str, Optional[str]]] = None,
    ) -> Optional[Dict[str, Any]]:
        flex_cols = item.get("flexColumns", [])
        if not flex_cols:
            return None

        title_runs = (
            flex_cols[0]
            .get("musicResponsiveListItemFlexColumnRenderer", {})
            .get("text", {})
            .get("runs", [])
        )
        if not title_runs:
            return None
        title = title_runs[0].get("text", "").strip()
        if not title:
            return None

        video_id = item.get("playlistItemData", {}).get("videoId")
        if not video_id:
            nav_ep = title_runs[0].get("navigationEndpoint", {})
            video_id = nav_ep.get("watchEndpoint", {}).get("videoId")

        browse_id = (
            item.get("navigationEndpoint", {}).get("browseEndpoint", {}).get("browseId")
            or title_runs[0].get("navigationEndpoint", {}).get("browseEndpoint", {}).get("browseId")
        )

        thumbnails = (
            item.get("thumbnail", {})
            .get("musicThumbnailRenderer", {})
            .get("thumbnail", {})
            .get("thumbnails", [])
        )

        # Parse secondary runs across remaining flexColumns and fixedColumns
        secondary_runs: List[Dict[str, Any]] = []
        for col in flex_cols[1:]:
            col_runs = (
                col.get("musicResponsiveListItemFlexColumnRenderer", {})
                .get("text", {})
                .get("runs", [])
            )
            secondary_runs.extend(col_runs)

        for fixed_col in item.get("fixedColumns", []):
            fixed_runs = (
                fixed_col.get("musicResponsiveListItemFixedColumnRenderer", {})
                .get("text", {})
                .get("runs", [])
            )
            secondary_runs.extend(fixed_runs)

        artists: List[Dict[str, Optional[str]]] = []
        album: Optional[Dict[str, Optional[str]]] = None
        duration_str: Optional[str] = None
        year_str: Optional[str] = None

        for run in secondary_runs:
            text = run.get("text", "").strip()
            if not text or text in ("•", "·", "-", ",", "&"):
                continue
            if re.match(r"^\d{1,2}:\d{2}(:\d{2})?$", text):
                duration_str = text
                continue
            if re.match(r"^(19|20)\d{2}$", text):
                year_str = text
                continue
            if re.search(r"\b(plays|views|subscribers|audience|listeners)\b", text, re.IGNORECASE):
                continue

            b_id = run.get("navigationEndpoint", {}).get("browseEndpoint", {}).get("browseId")
            page_type = (
                run.get("navigationEndpoint", {})
                .get("browseEndpoint", {})
                .get("browseEndpointContextSupportedConfigs", {})
                .get("browseEndpointContextMusicConfig", {})
                .get("pageType", "")
            )

            if (b_id and b_id.startswith("MPREb_")) or page_type == "MUSIC_PAGE_TYPE_ALBUM":
                album = {"id": b_id, "name": text}
            elif (b_id and b_id.startswith("UC")) or page_type in (
                "MUSIC_PAGE_TYPE_ARTIST",
                "MUSIC_PAGE_TYPE_USER_CHANNEL",
            ):
                artists.append({"id": b_id, "name": text})
            elif text.lower() not in (
                "song",
                "video",
                "album",
                "artist",
                "single",
                "ep",
                "playlist",
                "profile",
            ):
                if not artists:
                    artists.append({"id": b_id, "name": text})

        if not artists and default_artist:
            artists.append(default_artist)

        is_explicit = False
        for badge in item.get("badges", []):
            icon_type = (
                badge.get("musicInlineBadgeRenderer", {}).get("icon", {}).get("iconType", "")
            )
            if "EXPLICIT" in icon_type:
                is_explicit = True

        if video_id:
            return {
                "resultType": "song",
                "videoId": video_id,
                "title": title,
                "artists": artists or [{"id": None, "name": "Unknown Artist"}],
                "album": album,
                "duration": duration_str,
                "duration_seconds": parse_duration_seconds(duration_str),
                "thumbnails": thumbnails,
                "isExplicit": is_explicit,
            }

        if browse_id and browse_id.startswith("MPREb_"):
            return {
                "resultType": "album",
                "browseId": browse_id,
                "title": title,
                "artists": artists or [{"id": None, "name": "Unknown Artist"}],
                "year": year_str,
                "thumbnails": thumbnails,
            }

        if browse_id and browse_id.startswith("UC"):
            return {
                "resultType": "artist",
                "browseId": browse_id,
                "artist": title,
                "thumbnails": thumbnails,
            }

        return None

    def get_song(self, video_id: str) -> Dict[str, Any]:
        # 1. Try the player endpoint first
        try:
            player_data = self._post("player", {"videoId": video_id})
            video_details = player_data.get("videoDetails")
            if isinstance(video_details, dict) and video_details.get("videoId") == video_id:
                return {"videoDetails": video_details}
        except (ProviderTimeoutError, ProviderUnavailableError):
            raise
        except Exception:
            pass

        # 2. Fallback to the `next` queue metadata endpoint (works without player signature/poToken)
        next_data = self._post("next", {"videoId": video_id})
        matched_renderer: Optional[Dict[str, Any]] = None

        def find_panel_video(node: Any) -> None:
            nonlocal matched_renderer
            if matched_renderer is not None:
                return
            if isinstance(node, dict):
                if "playlistPanelVideoRenderer" in node:
                    r = node["playlistPanelVideoRenderer"]
                    if r.get("videoId") == video_id or r.get("selected"):
                        matched_renderer = r
                        return
                for val in node.values():
                    find_panel_video(val)
            elif isinstance(node, list):
                for item in node:
                    find_panel_video(item)

        find_panel_video(next_data)
        if not matched_renderer or not matched_renderer.get("videoId"):
            raise ResourceNotFoundError(f"Track '{video_id}' was not found.")

        title_runs = matched_renderer.get("title", {}).get("runs", [])
        title = title_runs[0].get("text", "").strip() if title_runs else ""
        if not title:
            raise ResourceNotFoundError(f"Track '{video_id}' was not found.")

        short_runs = matched_renderer.get("shortBylineText", {}).get("runs", [])
        long_runs = matched_renderer.get("longBylineText", {}).get("runs", [])
        author = short_runs[0].get("text", "").strip() if short_runs else ""
        channel_id: Optional[str] = None
        album_info: Optional[Dict[str, Optional[str]]] = None
        view_count: Optional[str] = None

        for run in long_runs:
            text = run.get("text", "").strip()
            if not text or text in ("•", "·", "-", ",", "&"):
                continue
            b_id = run.get("navigationEndpoint", {}).get("browseEndpoint", {}).get("browseId")
            if b_id and b_id.startswith("UC"):
                if not author:
                    author = text
                if not channel_id:
                    channel_id = b_id
            elif b_id and b_id.startswith("MPREb_"):
                album_info = {"id": b_id, "name": text}
            elif "view" in text.lower() or "play" in text.lower():
                digits = re.sub(r"[^\d]", "", text)
                if digits:
                    view_count = digits

        length_runs = matched_renderer.get("lengthText", {}).get("runs", [])
        duration_text = length_runs[0].get("text", "").strip() if length_runs else None
        length_seconds = parse_duration_seconds(duration_text)

        return {
            "videoDetails": {
                "videoId": matched_renderer.get("videoId", video_id),
                "title": title,
                "author": author or "Unknown Artist",
                "channelId": channel_id,
                "lengthSeconds": str(length_seconds) if length_seconds is not None else None,
                "thumbnail": matched_renderer.get("thumbnail", {}),
                "viewCount": view_count,
                "album": album_info,
            }
        }


class MusicProvider:
    """
    Isolated music discovery provider using ytmusicapi (with InnerTube HTTP fallback).
    Normalizes upstream YouTube Music structures into VibeFlow's clean domain schema.
    """

    def __init__(self, client: Any = None, timeout: float = Config.REQUEST_TIMEOUT_SECONDS):
        self.timeout = timeout
        if client is not None:
            self.client = client
            self.engine_name = "custom-client"
        elif HAS_YTMUSICAPI and YTMusic is not None:
            self.client = YTMusic()
            self.engine_name = "ytmusicapi"
        else:
            self.client = InnerTubeFallbackClient(timeout=timeout)
            self.engine_name = "innertube-urllib"

    @staticmethod
    def validate_query(query: Optional[str], filter_type: str = "songs", limit: int = 15) -> tuple[str, str, int]:
        if not query or not isinstance(query, str) or not query.strip():
            raise ValidationError("Search query parameter 'q' is required and cannot be empty.")
        cleaned = query.strip()
        if len(cleaned) > Config.MAX_QUERY_LENGTH:
            raise ValidationError(f"Search query cannot exceed {Config.MAX_QUERY_LENGTH} characters.")
        normalized_filter = (filter_type or "songs").strip().lower()
        if normalized_filter not in ALLOWED_FILTERS:
            raise ValidationError(
                f"Invalid filter '{filter_type}'. Must be one of: {', '.join(sorted(ALLOWED_FILTERS))}."
            )
        if limit < 1 or limit > Config.MAX_LIMIT:
            raise ValidationError(f"Limit must be between 1 and {Config.MAX_LIMIT}.")
        return cleaned, normalized_filter, limit

    @staticmethod
    def validate_identifier(identifier: Optional[str], label: str = "identifier") -> str:
        if not identifier or not isinstance(identifier, str) or not SAFE_ID_PATTERN.match(identifier.strip()):
            raise ValidationError(f"Invalid {label} format.")
        return identifier.strip()

    @staticmethod
    def _pick_thumbnail(thumbnails: Any) -> Optional[str]:
        if not isinstance(thumbnails, list) or not thumbnails:
            return None
        valid = [t.get("url") for t in thumbnails if isinstance(t, dict) and t.get("url")]
        if not valid:
            return None
        url = valid[-1]
        if url.startswith("http://"):
            url = "https://" + url[len("http://") :]
        return url

    @classmethod
    def normalize_track(cls, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        video_id = raw.get("videoId")
        title = (raw.get("title") or "").strip()
        if not video_id or not title:
            return None

        raw_artists = raw.get("artists") or []
        artists = []
        if isinstance(raw_artists, list):
            for artist in raw_artists:
                if isinstance(artist, dict) and artist.get("name"):
                    artists.append(
                        {"id": artist.get("id") or artist.get("browseId"), "name": artist["name"]}
                    )
        if not artists:
            author = raw.get("author")
            artists = [{"id": raw.get("channelId"), "name": author if author else "Unknown Artist"}]

        raw_album = raw.get("album")
        album = None
        if isinstance(raw_album, dict) and raw_album.get("name"):
            album = {"id": raw_album.get("id") or raw_album.get("browseId"), "name": raw_album["name"]}

        duration_seconds = raw.get("duration_seconds")
        if duration_seconds is None and raw.get("lengthSeconds"):
            try:
                duration_seconds = int(raw["lengthSeconds"])
            except (ValueError, TypeError):
                duration_seconds = None
        if duration_seconds is None:
            duration_seconds = parse_duration_seconds(raw.get("duration"))

        duration_formatted = format_duration(duration_seconds, raw.get("duration"))
        thumbnail_url = cls._pick_thumbnail(raw.get("thumbnails")) or (
            f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
        )

        return {
            "providerId": str(video_id),
            "title": title,
            "artists": artists,
            "artistName": ", ".join(a["name"] for a in artists),
            "album": album,
            "durationSeconds": duration_seconds,
            "durationFormatted": duration_formatted or "0:00",
            "thumbnailUrl": thumbnail_url,
            "isExplicit": bool(raw.get("isExplicit", False)),
            "playbackType": "YOUTUBE_EMBED",
            "embedUrl": f"https://www.youtube.com/embed/{video_id}?enablejsapi=1&rel=0",
            "externalUrl": f"https://music.youtube.com/watch?v={video_id}",
        }

    @classmethod
    def normalize_album_summary(cls, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        browse_id = raw.get("browseId")
        title = (raw.get("title") or "").strip()
        if not browse_id or not title:
            return None
        raw_artists = raw.get("artists") or []
        artists = [
            {"id": a.get("id"), "name": a.get("name")}
            for a in raw_artists
            if isinstance(a, dict) and a.get("name")
        ]
        return {
            "providerId": str(browse_id),
            "title": title,
            "artists": artists,
            "artistName": ", ".join(a["name"] for a in artists) if artists else "Various Artists",
            "year": raw.get("year"),
            "thumbnailUrl": cls._pick_thumbnail(raw.get("thumbnails")),
            "externalUrl": f"https://music.youtube.com/browse/{browse_id}",
        }

    @classmethod
    def normalize_artist_summary(cls, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        browse_id = raw.get("browseId")
        name = (raw.get("artist") or raw.get("title") or "").strip()
        if not browse_id or not name:
            return None
        return {
            "providerId": str(browse_id),
            "name": name,
            "thumbnailUrl": cls._pick_thumbnail(raw.get("thumbnails")),
            "externalUrl": f"https://music.youtube.com/channel/{browse_id}",
        }

    def search(self, query: str, filter_type: str = "songs", limit: int = 15) -> Dict[str, Any]:
        cleaned_query, normalized_filter, validated_limit = self.validate_query(query, filter_type, limit)

        try:
            if self.engine_name == "ytmusicapi":
                yt_filter = None if normalized_filter == "all" else normalized_filter
                try:
                    raw_results = self.client.search(cleaned_query, filter=yt_filter, limit=validated_limit)
                except Exception:
                    fallback = InnerTubeFallbackClient(timeout=self.timeout)
                    raw_results = fallback.search(
                        cleaned_query, filter_type=normalized_filter, limit=validated_limit
                    )
            else:
                raw_results = self.client.search(
                    cleaned_query, filter_type=normalized_filter, limit=validated_limit
                )
        except (ProviderTimeoutError, ProviderUnavailableError):
            raise
        except TimeoutError as exc:
            raise ProviderTimeoutError("Music provider search timed out.") from exc
        except Exception as exc:
            raise ProviderUnavailableError("Failed to query upstream music provider.") from exc

        tracks: List[Dict[str, Any]] = []
        albums: List[Dict[str, Any]] = []
        artists: List[Dict[str, Any]] = []

        for item in raw_results or []:
            if not isinstance(item, dict):
                continue
            result_type = item.get("resultType", "")
            if normalized_filter == "songs" or result_type in ("song", "video"):
                track = self.normalize_track(item)
                if track:
                    tracks.append(track)
            elif normalized_filter == "albums" or result_type == "album":
                album = self.normalize_album_summary(item)
                if album:
                    albums.append(album)
            elif normalized_filter == "artists" or result_type == "artist":
                artist = self.normalize_artist_summary(item)
                if artist:
                    artists.append(artist)

        return {
            "query": cleaned_query,
            "filter": normalized_filter,
            "tracks": tracks[:validated_limit],
            "albums": albums[:validated_limit],
            "artists": artists[:validated_limit],
        }

    def get_track(self, video_id: str) -> Dict[str, Any]:
        clean_id = self.validate_identifier(video_id, "track ID")
        try:
            raw = self.client.get_song(clean_id)
            if (
                self.engine_name == "ytmusicapi"
                and (not isinstance(raw, dict) or not raw.get("videoDetails", {}).get("videoId"))
            ):
                raw = InnerTubeFallbackClient(timeout=self.timeout).get_song(clean_id)
        except ResourceNotFoundError:
            raise
        except (ProviderTimeoutError, ProviderUnavailableError):
            raise
        except TimeoutError as exc:
            raise ProviderTimeoutError("Track metadata lookup timed out.") from exc
        except Exception as exc:
            if self.engine_name == "ytmusicapi":
                raw = InnerTubeFallbackClient(timeout=self.timeout).get_song(clean_id)
            else:
                raise ProviderUnavailableError("Unable to retrieve track details from provider.") from exc

        video_details = raw.get("videoDetails") if isinstance(raw, dict) else None
        if not isinstance(video_details, dict) or not video_details.get("videoId"):
            raise ResourceNotFoundError(f"Track '{clean_id}' was not found.")

        thumbnails = video_details.get("thumbnail", {}).get("thumbnails", [])
        normalized = self.normalize_track(
            {
                "videoId": video_details.get("videoId"),
                "title": video_details.get("title"),
                "author": video_details.get("author"),
                "channelId": video_details.get("channelId"),
                "lengthSeconds": video_details.get("lengthSeconds"),
                "thumbnails": thumbnails,
                "album": video_details.get("album"),
            }
        )
        if not normalized:
            raise ResourceNotFoundError(f"Track '{clean_id}' metadata is incomplete.")
        if video_details.get("viewCount"):
            normalized["viewCount"] = str(video_details.get("viewCount"))
        return normalized
