#!/usr/bin/env python3
"""Generate GitHub wiki pages from docs/images/manifest.json.

This script renders one Markdown page per race plus a Home page and footer,
matching the format established for existing race pages. It is designed to be
idempotent: running it twice in a row produces no diff. Pages it generates are
marked with an HTML comment so the cleanup pass only removes stale generated
pages and never touches manually authored content.

Usage:
    python generate_wiki.py --manifest docs/images/manifest.json --output path/to/wiki

The generator reads no submodule-only files; it operates purely from the
committed manifest, so it can run in CI without cloning the private
scripts/ submodule.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Sequence
from urllib.parse import quote, urlparse

GALLERY_BASE = "https://laqieer.github.io/Race-Photos"
REPO_BASE = "https://github.com/laqieer/Race-Photos"
RELEASE_DOWNLOAD_PREFIX = "/releases/download/"
GENERATED_MARKER = "<!-- generated-by: generate_wiki.py; do not edit manually -->"
VIDEO_EXTENSIONS = (".mp4", ".mov", ".webm", ".m4v")
HOME_FILENAME = "Home.md"
FOOTER_FILENAME = "_Footer.md"
RESERVED_PAGE_NAMES = {HOME_FILENAME, FOOTER_FILENAME}

# Race names are derived from filesystem directory names, so they cannot
# contain path separators or reserved characters on Windows. Still validate to
# fail fast if a future race name slips through with characters that would
# break wiki filenames or links.
INVALID_PAGE_NAME_RE = re.compile(r'[\\/:*?"<>|\r\n\t]')


def is_video_url(url: str) -> bool:
    """Return True when the URL path (ignoring query string) ends in a video extension."""
    try:
        path = urlparse(url).path
    except ValueError:
        return False
    return path.lower().endswith(VIDEO_EXTENSIONS)


def extract_release_tag(url: str) -> Optional[str]:
    """Extract the release tag from a GitHub release-asset URL, or None."""
    idx = url.find(RELEASE_DOWNLOAD_PREFIX)
    if idx == -1:
        return None
    rest = url[idx + len(RELEASE_DOWNLOAD_PREFIX):]
    if not rest:
        return None
    tag, _, _ = rest.partition("/")
    return tag or None


def escape_table_cell(text: str) -> str:
    """Escape characters that would break a Markdown table cell."""
    return (
        text.replace("\\", "\\\\")
        .replace("|", "\\|")
        .replace("\r", " ")
        .replace("\n", " ")
    )


def escape_link_text(text: str) -> str:
    """Escape characters that would break Markdown link text."""
    return (
        text.replace("\\", "\\\\")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace("\r", " ")
        .replace("\n", " ")
    )


def escape_image_alt(text: str) -> str:
    """Escape characters that would break Markdown image alt text."""
    return escape_link_text(text)


def escape_image_title(text: str) -> str:
    """Escape characters that would break a Markdown image title."""
    return text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("\r", " ")


def url_quote(text: str) -> str:
    """Percent-encode all characters except unreserved ones."""
    return quote(text, safe="")


def url_fragment(text: str) -> str:
    """Percent-encode a string for use as a URL fragment."""
    return quote(text, safe="")


def video_player_url(src: str, name: str, poster: Optional[str]) -> str:
    """Build the gallery video-player.html URL."""
    params = [f"src={url_quote(src)}", f"title={url_quote(name)}"]
    if poster:
        params.append(f"poster={url_quote(poster)}")
    return f"{GALLERY_BASE}/video-player.html?" + "&".join(params)


def derive_poster_url(photo: dict) -> Optional[str]:
    """Return the best poster URL for a video photo entry, or None."""
    poster = photo.get("poster")
    if poster:
        return poster
    url = photo.get("url", "")
    if RELEASE_DOWNLOAD_PREFIX in url and "." in url.rsplit("/", 1)[-1]:
        base, filename = url.rsplit("/", 1)
        stem = filename.rsplit(".", 1)[0]
        if stem:
            return f"{base}/{stem}.jpg"
    return None


def render_photo_element(photo: dict) -> str:
    """Render a single photo or video as Markdown."""
    name = photo.get("name", "")
    url = photo.get("url", "")
    if not name or not url:
        return ""
    if is_video_url(url):
        poster = derive_poster_url(photo)
        player = video_player_url(url, name, poster)
        text_link = f"[**Video**]({player})"
        poster_for_img = poster or url
        title = escape_image_title(f"Play video: {name}")
        image = f"[![{escape_image_alt(name)}]({poster_for_img} \"{title}\")]({player})"
        return f"{text_link} {image}"
    title = escape_image_title(name)
    return f"[![{escape_image_alt(name)}]({url} \"{title}\")]({url})"


def source_video_count(source: dict) -> int:
    return sum(1 for p in source.get("photos", []) if is_video_url(p.get("url", "")))


def render_source_section(source: dict) -> str:
    """Render the per-source heading and media paragraph."""
    name = source.get("name", "")
    photos = source.get("photos", [])
    lines: List[str] = [f"### {name}", ""]
    if any(is_video_url(p.get("url", "")) for p in photos):
        lines.append(
            "_Videos are labeled and use the original cover image; "
            "click to open the Race Photos player page._"
        )
        lines.append("")
    elements = [render_photo_element(p) for p in photos]
    elements = [e for e in elements if e]
    if elements:
        lines.append(" ".join(elements))
        lines.append("")
    return "\n".join(lines)


def render_sources_table(race: dict) -> str:
    """Render the per-race sources summary table."""
    lines = [
        "## Sources",
        "",
        "| Source | Items | Photos | Videos | Release assets | Metadata |",
        "| --- | ---: | ---: | ---: | --- | --- |",
    ]
    race_name = race.get("name", "")
    race_enc = url_quote(race_name)
    for src in race.get("sources", []):
        src_name = src.get("name", "")
        photos = src.get("photos", [])
        total = len(photos)
        videos = source_video_count(src)
        photos_only = total - videos
        tag = None
        for p in photos:
            t = extract_release_tag(p.get("url", ""))
            if t:
                tag = t
                break
        if tag:
            release_cell = (
                f"[release {escape_link_text(tag)}]"
                f"({REPO_BASE}/releases/tag/{tag})"
            )
        else:
            release_cell = "—"
        src_enc = url_quote(src_name)
        metadata_cell = (
            "[external_media.json]"
            f"({REPO_BASE}/blob/main/docs/images/{race_enc}/{src_enc}/external_media.json)"
        )
        lines.append(
            f"| {escape_table_cell(src_name)} | {total} | {photos_only} | {videos}"
            f" | {release_cell} | {metadata_cell} |"
        )
    lines.append("")
    return "\n".join(lines)


def total_counts(race: dict) -> tuple:
    """Return (items, photos, videos) totals across all sources."""
    items = 0
    videos = 0
    for src in race.get("sources", []):
        for photo in src.get("photos", []):
            items += 1
            if is_video_url(photo.get("url", "")):
                videos += 1
    return items, items - videos, videos


def render_race_page(race: dict) -> str:
    """Render a full Markdown page for a single race."""
    race_name = race.get("name", "")
    parts: List[str] = [GENERATED_MARKER, "", f"# {race_name}", ""]
    parts.append(
        "This page summarizes the race media published by Race-Photos "
        "and renders the hosted media inline."
    )
    parts.append("")

    gallery_url = f"{GALLERY_BASE}/#{url_fragment(race_name)}"
    bullets: List[str] = [f"- Gallery: [Open race page]({gallery_url})"]

    date = race.get("date")
    if date:
        bullets.append(f"- Date: {date}")

    location_parts = [race.get(key) for key in ("city", "province", "country") if race.get(key)]
    if location_parts:
        bullets.append("- Location: " + ", ".join(location_parts))

    route = race.get("route")
    if route:
        # quote with safe="/" so path separators stay readable while spaces
        # and other URL-unsafe chars are percent-encoded.
        route_url = f"{GALLERY_BASE}/{quote(route, safe='/')}"
        bullets.append(
            f"- GPX route: [{escape_link_text(route)}]({route_url})"
        )

    strava_url = race.get("strava_url")
    if strava_url:
        bullets.append(f"- Strava: [Activity link]({strava_url})")

    items, photos_only, videos = total_counts(race)
    bullets.append(f"- Media items: {items} ({photos_only} photos, {videos} videos)")

    parts.extend(bullets)
    parts.append("")
    parts.append(render_sources_table(race))
    parts.append("## Media")
    parts.append("")
    for src in race.get("sources", []):
        if not src.get("photos"):
            continue
        parts.append(render_source_section(src))
    parts.append("## Notes")
    parts.append("")
    parts.append("- Media binaries are hosted as GitHub release assets.")
    parts.append(
        "- Race metadata remains in the main repository via "
        "`race_info.json`, `photos_list.json`, and `external_media.json`."
    )
    parts.append("")
    return "\n".join(parts)


def render_home_page(races: Sequence[dict]) -> str:
    """Render Home.md with a summary table linking to each race page."""
    lines = [
        GENERATED_MARKER,
        "",
        "# Race-Photos wiki",
        "",
        "Race pages mirror the published gallery and document which release "
        "assets back each race/source.",
        "",
        "| Race | Date | Sources | Media items | Wiki page |",
        "| --- | --- | ---: | ---: | --- |",
    ]
    for race in races:
        name = race.get("name", "")
        date = race.get("date") or ""
        n_sources = len(race.get("sources", []))
        items, _, _ = total_counts(race)
        link = f"[{escape_link_text(name)}]({wiki_page_url(name)})"
        lines.append(
            f"| {escape_table_cell(name)} | {escape_table_cell(date)}"
            f" | {n_sources} | {items} | {link} |"
        )
    lines.append("")
    return "\n".join(lines)


def render_footer() -> str:
    return (
        GENERATED_MARKER
        + "\n\n"
        + f"[Online Race Photo Gallery]({GALLERY_BASE}/)\n"
    )


def safe_page_filename(race_name: str) -> str:
    """Return the wiki Markdown filename for a race, or raise on unsafe names."""
    if not race_name:
        raise ValueError("Race name is empty")
    if INVALID_PAGE_NAME_RE.search(race_name):
        raise ValueError(
            f"Race name contains characters unsafe for wiki filenames: {race_name!r}"
        )
    filename = f"{race_name}.md"
    if filename in RESERVED_PAGE_NAMES:
        raise ValueError(f"Race name collides with reserved wiki page: {race_name!r}")
    return filename


def wiki_page_url(race_name: str) -> str:
    """Return the relative URL slug GitHub Wiki uses for a race page.

    GitHub Wiki normalizes page-name spaces to hyphens in URLs and stops
    Markdown link parsing at unescaped spaces, so a link target of
    ``"2026 温州市..."`` renders as a broken link. Replacing spaces with
    hyphens matches GitHub Wiki's canonical URL slug and keeps the link
    intact regardless of how many spaces appear in the name.
    """
    return race_name.replace(" ", "-")


def file_is_generated(path: Path) -> bool:
    """Return True when a file starts with the generated-by marker."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            first = f.readline().rstrip("\r\n")
    except OSError:
        return False
    return first == GENERATED_MARKER


def write_if_changed(path: Path, content: str) -> bool:
    """Write content to path only if it differs from the existing file."""
    if path.exists():
        try:
            existing = path.read_text(encoding="utf-8")
        except OSError:
            existing = None
        if existing == content:
            return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def generate_wiki(manifest: dict, output_dir: Path) -> dict:
    """Generate all wiki files into output_dir. Returns a summary dict."""
    output_dir.mkdir(parents=True, exist_ok=True)
    races = manifest.get("races", [])

    written: List[str] = []
    expected_race_pages: set = set()

    for race in races:
        try:
            filename = safe_page_filename(race.get("name", ""))
        except ValueError as exc:
            print(f"WARNING: skipping race: {exc}", file=sys.stderr)
            continue
        expected_race_pages.add(filename)
        page_path = output_dir / filename
        content = render_race_page(race)
        if write_if_changed(page_path, content):
            written.append(filename)

    home_changed = write_if_changed(output_dir / HOME_FILENAME, render_home_page(races))
    if home_changed:
        written.append(HOME_FILENAME)
    footer_changed = write_if_changed(output_dir / FOOTER_FILENAME, render_footer())
    if footer_changed:
        written.append(FOOTER_FILENAME)

    deleted: List[str] = []
    for md_file in output_dir.glob("*.md"):
        if md_file.name in RESERVED_PAGE_NAMES:
            continue
        if md_file.name in expected_race_pages:
            continue
        if not file_is_generated(md_file):
            # Preserve manually authored wiki pages.
            continue
        md_file.unlink()
        deleted.append(md_file.name)

    return {
        "races": len(expected_race_pages),
        "written": written,
        "deleted": deleted,
    }


def load_manifest(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("docs/images/manifest.json"),
        help="Path to docs/images/manifest.json (default: %(default)s)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Path to the wiki clone directory where pages are written",
    )
    args = parser.parse_args(argv)

    manifest = load_manifest(args.manifest)
    summary = generate_wiki(manifest, args.output)
    print(
        f"✓ Wrote {len(summary['written'])} file(s), "
        f"deleted {len(summary['deleted'])} stale page(s), "
        f"for {summary['races']} race(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
