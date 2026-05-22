#!/usr/bin/env python3
"""Tests for .github/scripts/generate_wiki.py."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import generate_wiki as gw


class TestVideoDetection(unittest.TestCase):
    def test_detects_lowercase_extensions(self):
        self.assertTrue(gw.is_video_url("https://example.com/foo.mp4"))
        self.assertTrue(gw.is_video_url("https://example.com/foo.mov"))
        self.assertTrue(gw.is_video_url("https://example.com/foo.webm"))
        self.assertTrue(gw.is_video_url("https://example.com/foo.m4v"))

    def test_detects_uppercase_extensions(self):
        self.assertTrue(gw.is_video_url("https://example.com/foo.MP4"))

    def test_ignores_query_string(self):
        self.assertTrue(
            gw.is_video_url("https://example.com/foo.mp4?sign=abc&t=123")
        )

    def test_rejects_image_url(self):
        self.assertFalse(gw.is_video_url("https://example.com/foo.jpg"))
        self.assertFalse(gw.is_video_url("https://example.com/foo.mp4.jpg"))

    def test_rejects_empty(self):
        self.assertFalse(gw.is_video_url(""))


class TestReleaseTagExtraction(unittest.TestCase):
    def test_extracts_standard_tag(self):
        url = (
            "https://github.com/laqieer/Race-Photos/releases/download/"
            "media-2026-runnerbar-50ca6ca79e/file.jpg"
        )
        self.assertEqual(gw.extract_release_tag(url), "media-2026-runnerbar-50ca6ca79e")

    def test_extracts_custom_tag(self):
        url = (
            "https://github.com/laqieer/Race-Photos/releases/download/"
            "media-2026-changxing-alltuu/pl1.jpg"
        )
        self.assertEqual(gw.extract_release_tag(url), "media-2026-changxing-alltuu")

    def test_returns_none_for_non_release(self):
        self.assertIsNone(gw.extract_release_tag("https://example.com/foo.jpg"))
        self.assertIsNone(gw.extract_release_tag(""))


class TestEscaping(unittest.TestCase):
    def test_table_cell_escapes_pipe(self):
        self.assertEqual(gw.escape_table_cell("a|b"), "a\\|b")

    def test_link_text_escapes_brackets(self):
        self.assertEqual(gw.escape_link_text("[x]"), "\\[x\\]")

    def test_image_title_escapes_quote(self):
        self.assertEqual(gw.escape_image_title('hello"world'), 'hello\\"world')

    def test_url_quote_encodes_chinese(self):
        self.assertEqual(
            gw.url_quote("江油"),
            "%E6%B1%9F%E6%B2%B9",
        )

    def test_url_quote_encodes_slash(self):
        self.assertEqual(gw.url_quote("a/b"), "a%2Fb")


class TestPhotoRendering(unittest.TestCase):
    def test_photo_renders_image_link(self):
        photo = {
            "name": "foo.jpg",
            "url": "https://github.com/laqieer/Race-Photos/releases/download/tag/foo.jpg",
        }
        result = gw.render_photo_element(photo)
        self.assertIn('![foo.jpg]', result)
        self.assertIn('"foo.jpg"', result)
        self.assertTrue(result.startswith("[!["))

    def test_video_with_poster_uses_poster(self):
        photo = {
            "name": "clip.mp4",
            "url": "https://example.com/clip.mp4",
            "poster": "https://example.com/poster.png",
        }
        result = gw.render_photo_element(photo)
        self.assertIn("[**Video**]", result)
        self.assertIn("video-player.html", result)
        self.assertIn("poster=", result)
        # The poster image should appear before the player link
        self.assertIn("https://example.com/poster.png", result)
        # The video source should be percent-encoded inside the player URL.
        self.assertIn("src=https%3A%2F%2Fexample.com%2Fclip.mp4", result)
        # And Play video title should be embedded
        self.assertIn("Play video: clip.mp4", result)

    def test_video_without_poster_falls_back_to_release_jpg(self):
        photo = {
            "name": "clip.mp4",
            "url": (
                "https://github.com/laqieer/Race-Photos/releases/download/"
                "media-2026-runff-abc/clip.mp4"
            ),
        }
        result = gw.render_photo_element(photo)
        self.assertIn(
            "https://github.com/laqieer/Race-Photos/releases/download/"
            "media-2026-runff-abc/clip.jpg",
            result,
        )

    def test_skips_photo_without_name_or_url(self):
        self.assertEqual(gw.render_photo_element({"name": "", "url": "x"}), "")
        self.assertEqual(gw.render_photo_element({"name": "x", "url": ""}), "")


class TestSourceSection(unittest.TestCase):
    def test_section_with_only_photos_omits_video_note(self):
        source = {
            "name": "alltuu",
            "photos": [
                {"name": "a.jpg", "url": "https://example.com/a.jpg"},
                {"name": "b.jpg", "url": "https://example.com/b.jpg"},
            ],
        }
        out = gw.render_source_section(source)
        self.assertIn("### alltuu", out)
        self.assertNotIn("Videos are labeled", out)
        self.assertIn("a.jpg", out)
        self.assertIn("b.jpg", out)

    def test_section_with_video_includes_note(self):
        source = {
            "name": "runff",
            "photos": [
                {"name": "a.jpg", "url": "https://example.com/a.jpg"},
                {"name": "clip.mp4", "url": "https://example.com/clip.mp4"},
            ],
        }
        out = gw.render_source_section(source)
        self.assertIn("Videos are labeled", out)
        self.assertIn("[**Video**]", out)


class TestSourcesTable(unittest.TestCase):
    def test_table_counts_videos_and_extracts_tag(self):
        race = {
            "name": "TestRace",
            "sources": [
                {
                    "name": "runff",
                    "photos": [
                        {
                            "name": "a.jpg",
                            "url": (
                                "https://github.com/laqieer/Race-Photos/releases/download/"
                                "media-2026-runff-abc/a.jpg"
                            ),
                        },
                        {
                            "name": "c.mp4",
                            "url": (
                                "https://github.com/laqieer/Race-Photos/releases/download/"
                                "media-2026-runff-abc/c.mp4"
                            ),
                        },
                    ],
                }
            ],
        }
        out = gw.render_sources_table(race)
        self.assertIn("| runff | 2 | 1 | 1 |", out)
        self.assertIn(
            "https://github.com/laqieer/Race-Photos/releases/tag/media-2026-runff-abc",
            out,
        )
        self.assertIn(
            "https://github.com/laqieer/Race-Photos/blob/main/docs/images/TestRace/runff/external_media.json",
            out,
        )

    def test_table_uses_dash_when_no_release_tag(self):
        race = {
            "name": "X",
            "sources": [
                {
                    "name": "local",
                    "photos": [{"name": "a.jpg", "url": "https://other.example/a.jpg"}],
                }
            ],
        }
        out = gw.render_sources_table(race)
        self.assertIn("| local | 1 | 1 | 0 | — |", out)


class TestRacePage(unittest.TestCase):
    def _race(self, **overrides):
        race = {
            "name": "2026Test",
            "date": "2026-03-07",
            "city": "City",
            "province": "Prov",
            "country": "国",
            "route": "routes/2026Test.gpx",
            "strava_url": "https://www.strava.com/activities/123",
            "sources": [
                {
                    "name": "runff",
                    "photos": [
                        {
                            "name": "a.jpg",
                            "url": (
                                "https://github.com/laqieer/Race-Photos/releases/download/"
                                "media-2026-runff-abc/a.jpg"
                            ),
                        }
                    ],
                }
            ],
        }
        race.update(overrides)
        return race

    def test_page_starts_with_generated_marker(self):
        out = gw.render_race_page(self._race())
        self.assertTrue(out.startswith(gw.GENERATED_MARKER))

    def test_page_has_all_optional_lines_when_present(self):
        out = gw.render_race_page(self._race())
        self.assertIn("# 2026Test", out)
        self.assertIn("- Gallery: [Open race page](https://laqieer.github.io/Race-Photos/#2026Test", out)
        self.assertIn("- Date: 2026-03-07", out)
        self.assertIn("- Location: City, Prov, 国", out)
        self.assertIn("- GPX route: [routes/2026Test.gpx]", out)
        self.assertIn("- Strava: [Activity link](https://www.strava.com/activities/123)", out)
        self.assertIn("- Media items: 1 (1 photos, 0 videos)", out)

    def test_page_omits_missing_optional_lines(self):
        race = self._race(city=None, province=None, country=None, route=None, strava_url=None)
        out = gw.render_race_page(race)
        self.assertNotIn("- Location:", out)
        self.assertNotIn("- GPX route:", out)
        self.assertNotIn("- Strava:", out)

    def test_page_has_notes_section(self):
        out = gw.render_race_page(self._race())
        self.assertIn("## Notes", out)
        self.assertIn("Media binaries are hosted as GitHub release assets.", out)

    def test_gallery_link_encodes_chinese(self):
        out = gw.render_race_page(self._race(name="2026江油马拉松"))
        self.assertIn(
            "https://laqieer.github.io/Race-Photos/#2026%E6%B1%9F%E6%B2%B9%E9%A9%AC%E6%8B%89%E6%9D%BE",
            out,
        )

    def test_page_counts_videos_correctly(self):
        race = self._race()
        race["sources"][0]["photos"].append(
            {
                "name": "v.mp4",
                "url": (
                    "https://github.com/laqieer/Race-Photos/releases/download/"
                    "media-2026-runff-abc/v.mp4"
                ),
            }
        )
        out = gw.render_race_page(race)
        self.assertIn("- Media items: 2 (1 photos, 1 videos)", out)

    def test_page_skips_empty_source(self):
        race = self._race()
        race["sources"].append({"name": "empty", "photos": []})
        out = gw.render_race_page(race)
        self.assertNotIn("### empty", out)

    def test_gpx_route_url_is_percent_encoded(self):
        # GPX route URLs with spaces or Chinese characters must be
        # percent-encoded or the Markdown link parser stops at the space.
        race = self._race(
            name="2026 温州市迎新跑",
            route="routes/2026 温州市迎新跑.gpx",
        )
        out = gw.render_race_page(race)
        # Path separator stays readable; the space becomes %20.
        self.assertIn(
            "(https://laqieer.github.io/Race-Photos/routes/2026%20%E6%B8%A9%E5%B7%9E%E5%B8%82%E8%BF%8E%E6%96%B0%E8%B7%91.gpx)",
            out,
        )
        # No raw space inside the link target.
        self.assertNotIn(
            "(https://laqieer.github.io/Race-Photos/routes/2026 ",
            out,
        )


class TestHomePage(unittest.TestCase):
    def test_home_lists_races_in_order(self):
        races = [
            {"name": "2026A", "date": "2026-03-07", "sources": [{"name": "s", "photos": [{"name": "1.jpg", "url": "u"}]}]},
            {"name": "2024B", "date": "2024-01-21", "sources": []},
        ]
        out = gw.render_home_page(races)
        self.assertTrue(out.startswith(gw.GENERATED_MARKER))
        self.assertIn("# Race-Photos wiki", out)
        # 2026A appears before 2024B (same order as input)
        self.assertLess(out.index("2026A"), out.index("2024B"))
        # The Race cell is itself the wiki link (no separate "Wiki page" column).
        self.assertIn("| [2026A](2026A) | 2026-03-07 | 1 | 1 |", out)
        self.assertIn("| [2024B](2024B) | 2024-01-21 | 0 | 0 |", out)
        # Header has 4 columns, not 5.
        self.assertIn("| Race | Date | Sources | Media items |", out)
        self.assertNotIn("Wiki page", out)

    def test_home_link_replaces_spaces_with_hyphens(self):
        # GitHub Wiki normalizes page-name spaces to hyphens in URLs and the
        # Markdown parser stops at unescaped spaces in link targets, so the
        # link target must use the hyphen form to avoid a broken link.
        races = [
            {"name": "2026 温州市迎新跑", "date": "2026-01-01", "sources": []},
        ]
        out = gw.render_home_page(races)
        self.assertIn("[2026 温州市迎新跑](2026-温州市迎新跑)", out)


class TestWikiPageUrl(unittest.TestCase):
    def test_replaces_spaces_with_hyphens(self):
        self.assertEqual(
            gw.wiki_page_url("2026 温州市迎新跑"),
            "2026-温州市迎新跑",
        )

    def test_passes_through_names_without_spaces(self):
        self.assertEqual(gw.wiki_page_url("2026江油马拉松"), "2026江油马拉松")

    def test_handles_multiple_spaces(self):
        self.assertEqual(gw.wiki_page_url("a b c"), "a-b-c")


class TestSafePageFilename(unittest.TestCase):
    def test_chinese_name_is_valid(self):
        self.assertEqual(gw.safe_page_filename("2026江油马拉松"), "2026江油马拉松.md")

    def test_rejects_path_separator(self):
        with self.assertRaises(ValueError):
            gw.safe_page_filename("a/b")

    def test_rejects_reserved_name(self):
        with self.assertRaises(ValueError):
            gw.safe_page_filename("Home")
        with self.assertRaises(ValueError):
            gw.safe_page_filename("_Footer")

    def test_rejects_empty(self):
        with self.assertRaises(ValueError):
            gw.safe_page_filename("")


class TestGenerateWikiIntegration(unittest.TestCase):
    def _build_manifest(self):
        return {
            "races": [
                {
                    "name": "2026Latest",
                    "date": "2026-03-07",
                    "city": "City",
                    "country": "国",
                    "sources": [
                        {
                            "name": "runff",
                            "photos": [
                                {
                                    "name": "a.jpg",
                                    "url": "https://github.com/laqieer/Race-Photos/releases/download/tag-a/a.jpg",
                                },
                                {
                                    "name": "v.mp4",
                                    "url": "https://github.com/laqieer/Race-Photos/releases/download/tag-a/v.mp4",
                                },
                            ],
                        }
                    ],
                },
                {
                    "name": "2023Old",
                    "date": "2023-06-24",
                    "sources": [
                        {
                            "name": "pailixiang",
                            "photos": [
                                {
                                    "name": "x.jpg",
                                    "url": "https://github.com/laqieer/Race-Photos/releases/download/tag-x/x.jpg",
                                }
                            ],
                        }
                    ],
                },
            ]
        }

    def test_generates_home_footer_and_race_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            summary = gw.generate_wiki(self._build_manifest(), out_dir)
            self.assertEqual(summary["races"], 2)
            self.assertTrue((out_dir / "Home.md").exists())
            self.assertTrue((out_dir / "_Footer.md").exists())
            self.assertTrue((out_dir / "2026Latest.md").exists())
            self.assertTrue((out_dir / "2023Old.md").exists())

    def test_second_run_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            manifest = self._build_manifest()
            gw.generate_wiki(manifest, out_dir)
            second = gw.generate_wiki(manifest, out_dir)
            self.assertEqual(second["written"], [])
            self.assertEqual(second["deleted"], [])

    def test_deletes_stale_generated_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            (out_dir / "OldRace.md").write_text(
                gw.GENERATED_MARKER + "\n\n# OldRace\n", encoding="utf-8"
            )
            summary = gw.generate_wiki(self._build_manifest(), out_dir)
            self.assertIn("OldRace.md", summary["deleted"])
            self.assertFalse((out_dir / "OldRace.md").exists())

    def test_preserves_manual_pages_without_marker(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            (out_dir / "ManualPage.md").write_text("# Manual\n", encoding="utf-8")
            summary = gw.generate_wiki(self._build_manifest(), out_dir)
            self.assertNotIn("ManualPage.md", summary["deleted"])
            self.assertTrue((out_dir / "ManualPage.md").exists())


if __name__ == "__main__":
    unittest.main()
