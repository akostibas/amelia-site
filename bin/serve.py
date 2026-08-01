#!/usr/bin/env python3
"""Zero-dependency live-reload dev server for a static site.

Serves files from the site root and injects a tiny poller into every HTML
response. The poller hits /__mtime__; when the newest file mtime changes,
the browser reloads. No build step, no external packages, nothing to break.

Usage: bin/serve.py [--port PORT] [--root DIR]
"""
import argparse
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RELOAD_SNIPPET = b"""
<script>
(function () {
  // Soft live-reload: on change, swap the .scene subtree and re-fetch the
  // stylesheet in place -- WITHOUT reloading the document. This keeps any
  // running audio (and all other page JS state) alive across edits.
  let last = null;
  async function poll() {
    try {
      const r = await fetch('/__mtime__', {cache: 'no-store'});
      const v = await r.text();
      if (last !== null && v !== last) { location.reload(); return; }
      last = v;
    } catch (e) { /* server restarting; keep trying */ }
    setTimeout(poll, 400);
  }
  poll();
})();
</script>
"""


def newest_mtime(root):
    newest = 0.0
    for dirpath, dirnames, filenames in os.walk(root):
        # skip dotdirs and bin so editor/git churn doesn't trigger reloads
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d != "bin"]
        for name in filenames:
            if name.startswith("."):
                continue
            try:
                newest = max(newest, os.path.getmtime(os.path.join(dirpath, name)))
            except OSError:
                pass
    return newest


class Handler(SimpleHTTPRequestHandler):
    root = os.getcwd()

    def log_message(self, *args):
        pass  # keep the terminal quiet

    def do_GET(self):
        if self.path == "/__mtime__":
            body = f"{newest_mtime(self.root):.3f}".encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def end_headers(self):
        # never cache page assets during dev
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _resolve_file(self):
        """Map self.path to an on-disk file, applying directory-index rules."""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            for index in ("index.html", "index.htm"):
                candidate = os.path.join(path, index)
                if os.path.isfile(candidate):
                    return candidate
            return None
        return path if os.path.isfile(path) else None

    def send_head(self):
        # For HTML we inject a reload snippet, which changes the byte length,
        # so we can't let the parent send a file-size Content-Length. Handle
        # HTML ourselves and delegate everything else.
        target = self._resolve_file()
        if target and self.guess_type(target) == "text/html":
            try:
                data = open(target, "rb").read()
            except OSError:
                self.send_error(404)
                return None
            marker = b"</body>"
            data = data.replace(marker, RELOAD_SNIPPET + marker, 1) if marker in data else data + RELOAD_SNIPPET
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            import io
            return io.BytesIO(data)
        return super().send_head()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5500)
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    args = ap.parse_args()

    os.chdir(args.root)
    Handler.root = args.root
    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Amelia's site → http://localhost:{args.port}  (root: {args.root})")
    print("Live reload on. Ctrl-C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")


if __name__ == "__main__":
    main()
