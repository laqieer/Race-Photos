#!/usr/bin/env python3
"""Local development server with no-cache headers."""

import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler that disables browser caching."""

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    directory = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs')
    os.chdir(directory)
    server = http.server.HTTPServer(('', port), NoCacheHandler)
    print(f"Serving docs/ at http://localhost:{port} (no-cache)")
    server.serve_forever()
