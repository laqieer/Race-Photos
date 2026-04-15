#!/usr/bin/env python3
"""Local development server with no-cache headers."""

from functools import partial
import http.server
import sys
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler that disables browser caching."""

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    directory = Path(__file__).resolve().parent / 'docs'
    if not directory.is_dir():
        raise FileNotFoundError(f'docs directory not found: {directory}')
    handler = partial(NoCacheHandler, directory=str(directory))
    server = http.server.HTTPServer(('', port), handler)
    print(f"Serving docs/ at http://localhost:{port} (no-cache)")
    server.serve_forever()
