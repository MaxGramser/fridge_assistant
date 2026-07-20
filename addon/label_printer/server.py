#!/usr/bin/env python3
"""Generic label print service for a USB DYMO LabelWriter.

Accepts a finished PNG or PDF and prints it via CUPS. It renders nothing
itself, so it can print ANY image/PDF label.

Tested with a DYMO LabelWriter 550 + 99014 labels (54 x 101 mm).

Endpoints:
  GET  /            human-readable status page
  GET  /health      JSON status (printer connected? default media)
  POST /print       print a PNG/PDF (multipart 'file' OR JSON image_base64)
  POST /selftest    print a small built-in test label
"""

import base64
import json
import os
import subprocess
import tempfile

from flask import Flask, jsonify, request

app = Flask(__name__)

PRINTER = os.environ.get("PRINTER_NAME", "dymo")
DEFAULT_MEDIA = os.environ.get("DEFAULT_MEDIA", "w154h286")
MODEL = os.environ.get("PRINTER_MODEL", "")
PORT = int(os.environ.get("PORT", "8000"))


def _run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=60)


def _printer_present():
    res = _run(["lpstat", "-p", PRINTER])
    return res.returncode == 0


def _status():
    return {
        "printer": PRINTER,
        "model": MODEL,
        "connected": _printer_present(),
        "default_media": DEFAULT_MEDIA,
        "queue": _run(["lpstat", "-o"]).stdout.strip(),
        "printers": _run(["lpstat", "-v"]).stdout.strip(),
    }


def _sniff_suffix(data: bytes) -> str:
    if data[:5] == b"%PDF-":
        return ".pdf"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if data[:2] == b"\xff\xd8":
        return ".jpg"
    return ".png"


def _print_bytes(data: bytes, media: str, copies: int) -> dict:
    if not _printer_present():
        return {"ok": False, "error": "printer_not_connected",
                "hint": "Connect + power on the DYMO, then restart the add-on."}
    suffix = _sniff_suffix(data)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        path = tmp.name
    media = (media or DEFAULT_MEDIA or "").strip()
    try:
        cmd = ["lpr", "-P", PRINTER, "-#", str(max(1, min(copies, 20)))]
        # The LabelWriter 550 auto-detects the loaded roll (ALR). Forcing a
        # mismatched PageSize makes it hold the job, so by default we let the
        # driver pick the media and only pass PageSize when explicitly asked.
        if media and media.lower() != "auto":
            cmd += ["-o", f"PageSize={media}"]
        cmd += ["-o", "fit-to-page", path]
        res = _run(cmd)
        if res.returncode != 0:
            return {"ok": False, "error": "lpr_failed",
                    "detail": (res.stderr or res.stdout).strip()}
        return {"ok": True, "printed": True, "media": media or "auto",
                "copies": copies, "type": suffix.lstrip(".")}
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _extract_request():
    """Return (bytes, media, copies) from a multipart or JSON request."""
    media = DEFAULT_MEDIA
    copies = 1
    if request.files.get("file"):
        f = request.files["file"]
        media = request.form.get("media", DEFAULT_MEDIA)
        copies = int(request.form.get("copies", 1))
        return f.read(), media, copies
    if request.is_json:
        body = request.get_json(silent=True) or {}
        b64 = body.get("image_base64") or body.get("png_base64") or body.get("data")
        if not b64:
            return None, media, copies
        return base64.b64decode(b64), body.get("media", DEFAULT_MEDIA), \
            int(body.get("copies", 1))
    if request.data:
        return request.data, media, copies
    return None, media, copies


@app.route("/print", methods=["POST"])
def print_label():
    data, media, copies = _extract_request()
    if not data:
        return jsonify({"ok": False, "error": "no_image",
                        "hint": "POST a PNG/PDF as multipart 'file' or JSON "
                                "{image_base64, media, copies}."}), 400
    result = _print_bytes(data, media, copies)
    return jsonify(result), (200 if result.get("ok") else 503)


@app.route("/selftest", methods=["POST"])
def selftest():
    from PIL import Image, ImageDraw
    img = Image.new("L", (642, 1192), 255)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([12, 12, 629, 1179], radius=30, outline=0, width=3)
    d.text((60, 80), "LABEL PRINTER OK", fill=0)
    d.text((60, 140), "DYMO LW550 · 99014", fill=0)
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG", dpi=(300, 300))
    result = _print_bytes(buf.getvalue(), DEFAULT_MEDIA, 1)
    return jsonify(result), (200 if result.get("ok") else 503)


@app.route("/health", methods=["GET"])
def health():
    return jsonify(_status())


@app.route("/debug", methods=["GET"])
def debug():
    def tail(path, n=12000):
        try:
            with open(path, errors="replace") as f:
                return f.read()[-n:]
        except OSError as e:
            return f"(cannot read {path}: {e})"
    status = _run(["sh", "-c",
        "grep -aE 'Job 1|CheckLock|CheckLabel|CheckStatus|ReadStatus:|STATE:|"
        "counterfeit|Sending|pages|Wrote .* print|CheckPrintHead|Reprint' "
        "/var/log/cups/error_log | tail -40"]).stdout
    return jsonify({
        "printer": _run(["lpstat", "-l", "-p", PRINTER]).stdout,
        "jobs": _run(["lpstat", "-l", "-o"]).stdout,
        "status_lines": status,
        "dymo_filters": _run(
            ["sh", "-c", "find /usr -name 'raster2dymolw*' 2>/dev/null"]
        ).stdout,
        "ppd_filter": _run(
            ["sh", "-c", "grep -i cupsFilter /etc/cups/ppd/%s.ppd" % PRINTER]
        ).stdout,
        "error_log": tail("/var/log/cups/error_log"),
    })


@app.route("/", methods=["GET"])
def index():
    st = _status()
    ok = "🟢 connected" if st["connected"] else "🔴 not found"
    return (
        "<html><head><title>Fridge Assistant – Label Printer</title>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px "
        "auto;padding:0 20px;line-height:1.5}code{background:#f4f4f5;padding:2px 6px;"
        "border-radius:6px}pre{background:#f4f4f5;padding:14px;border-radius:10px;"
        "overflow:auto}</style></head><body>"
        "<h1>🖨️ Label Printer</h1>"
        f"<p>Printer <b>{st['printer']}</b>: {ok}<br>"
        f"Default media: <code>{st['default_media']}</code></p>"
        "<p>Tested with a <b>DYMO LabelWriter 550</b> and <b>99014</b> labels "
        "(54 × 101 mm).</p>"
        "<h3>Print a PNG/PDF</h3>"
        "<pre>curl -F file=@label.png http://HOST:8000/print</pre>"
        "<h3>Test the printer</h3>"
        "<pre>curl -X POST http://HOST:8000/selftest</pre>"
        f"<h3>Status</h3><pre>{json.dumps(st, indent=2)}</pre>"
        "</body></html>"
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
