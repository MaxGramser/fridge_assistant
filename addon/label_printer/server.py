#!/usr/bin/env python3
"""Generic label print service for USB label printers.

Accepts a finished PNG/PDF (rendered by whoever calls us) or raw printer
language (ZPL/EPL) and prints it via CUPS. It renders nothing itself, so it
can print ANY label.

Several printers run side by side; ``run.sh`` discovers them on boot and
registers one CUPS queue each. Callers pick one by name and default to the
DYMO queue, so existing integrations keep working unchanged.

Tested with a DYMO LabelWriter 400 (99014, 54 x 101 mm) and a Zebra ZD220D
(104 x 159 mm shipping labels), both attached through one USB hub.

Endpoints:
  GET  /            human-readable status page
  GET  /printers    which printers exist, their labels and accepted formats
  GET  /health      JSON status (printers connected? default media)
  POST /print       print PNG/PDF/JPG/ZPL — pick a printer with "printer"
  POST /selftest    print a small built-in test label
"""

import base64
import json
import os
import re
import subprocess
import tempfile

from flask import Flask, jsonify, request

app = Flask(__name__)

# The DYMO queue stays the default so every existing caller (the Fridge
# Assistant integration, Label Assistant, automations) keeps working when it
# doesn't name a printer.
DEFAULT_PRINTER = os.environ.get("PRINTER_NAME", "dymo")
DEFAULT_MEDIA = os.environ.get("DEFAULT_MEDIA", "w154h286")
MODEL = os.environ.get("PRINTER_MODEL", "")
PORT = int(os.environ.get("PORT", "8000"))

# What run.sh registered: [{name, kind, model, media, raster}, ...]. CUPS stays
# the source of truth for whether a queue is actually alive; this only carries
# the metadata CUPS doesn't know (which hardware family, configured media).
try:
    CONFIGURED = json.loads(os.environ.get("PRINTERS_JSON") or "[]")
except ValueError:
    CONFIGURED = []

RAW_FORMATS = ("zpl", "epl", "raw")
MAX_COPIES = 20


def _run(cmd, data: bytes | None = None):
    """Run a command; pass ``data`` to feed bytes to stdin."""
    return subprocess.run(cmd, capture_output=True, text=data is None,
                          input=data, timeout=60)


def _out(res) -> str:
    out = res.stdout
    return out.decode(errors="replace") if isinstance(out, bytes) else (out or "")


def _err(res) -> str:
    e = res.stderr
    return (e.decode(errors="replace") if isinstance(e, bytes) else (e or "")).strip()


# --------------------------------------------------------------------------
# Printers
# --------------------------------------------------------------------------
def _queues() -> list[str]:
    """Queue names CUPS currently has, in the order it lists them."""
    return re.findall(r"^printer (\S+)", _out(_run(["lpstat", "-p"])), re.M)


def _queue_exists(name: str) -> bool:
    return _run(["lpstat", "-p", name]).returncode == 0


def _media_of(name: str) -> str:
    m = re.search(r"PageSize=(\S+)", _out(_run(["lpoptions", "-p", name])))
    return m.group(1) if m else ""


def _has_driver(name: str) -> bool:
    """A queue with a PPD can rasterise images; a raw queue cannot."""
    return os.path.exists(f"/etc/cups/ppd/{name}.ppd")


def _media_label(media: str) -> str:
    """Human-readable size for a CUPS media name.

    CUPS names carry the size in PostScript points: ``w154h286`` and
    ``Custom.295x451`` both describe a physical label, so one conversion
    covers every printer instead of a hard-coded table.
    """
    if not media:
        return "onbekend"
    m = re.fullmatch(r"w(\d+)h(\d+)", media) or \
        re.fullmatch(r"Custom\.(\d+)x(\d+)(?:mm)?", media)
    if m:
        w = round(int(m.group(1)) * 25.4 / 72)
        h = round(int(m.group(2)) * 25.4 / 72)
        return f"{w} × {h} mm"
    return media


def _configured(name: str) -> dict:
    for entry in CONFIGURED:
        if entry.get("name") == name:
            return entry
    return {}


def _printer_entry(name: str) -> dict:
    cfg = _configured(name)
    media = _media_of(name) or cfg.get("media", "")
    raster = _has_driver(name)
    accepts = ["png", "pdf", "jpg"] if raster else []
    # Zebra speaks ZPL natively; we hand raw jobs straight to the device.
    if cfg.get("kind") == "zebra":
        accepts.append("zpl")
    return {
        "name": name,
        "kind": cfg.get("kind", "unknown"),
        "model": cfg.get("model") or (MODEL if name == DEFAULT_PRINTER else ""),
        "connected": _queue_exists(name),
        "media": media,
        "label": _media_label(media),
        "accepts": accepts,
        "default": name == DEFAULT_PRINTER,
    }


def _printer_list() -> list[dict]:
    return [_printer_entry(n) for n in _queues()]


def _status() -> dict:
    printers = _printer_list()
    return {
        # Kept for backwards compatibility with callers written against v0.1.
        "printer": DEFAULT_PRINTER,
        "model": MODEL,
        "connected": any(p["connected"] for p in printers),
        "default_media": DEFAULT_MEDIA,
        "printers": printers,
        "queue": _out(_run(["lpstat", "-o"])).strip(),
        "devices": _out(_run(["lpstat", "-v"])).strip(),
    }


def _default_media_for(printer: str) -> str:
    cfg = _configured(printer)
    return cfg.get("media") or (DEFAULT_MEDIA if printer == DEFAULT_PRINTER else "")


# --------------------------------------------------------------------------
# Printing
# --------------------------------------------------------------------------
def _sniff_format(data: bytes) -> str:
    """Detect what we were handed: pdf / png / jpg / zpl."""
    head = data[:200].lstrip()
    if head[:5] == b"%PDF-":
        return "pdf"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:2] == b"\xff\xd8":
        return "jpg"
    # ZPL always opens a label with ^XA (or a ~ control command).
    if head[:3] == b"^XA" or head[:2] == b"~J" or head[:2] == b"^X":
        return "zpl"
    return "png"


def _print_bytes(data: bytes, media: str | None, copies: int, printer: str,
                 fmt: str | None = None) -> dict:
    if not _queue_exists(printer):
        known = _queues()
        return {"ok": False, "error": "printer_not_connected", "printer": printer,
                "available": known,
                "hint": f"Unknown or offline queue '{printer}'. "
                        f"Available: {', '.join(known) or 'none'}. "
                        "Connect + power on the printer, then restart the add-on."}
    fmt = (fmt or _sniff_format(data)).lower()
    copies = max(1, min(int(copies or 1), MAX_COPIES))

    if fmt in RAW_FORMATS:
        # Raw printer language goes to the device untouched — the job already
        # *is* what the printer speaks, so CUPS must not filter or re-render it
        # (-l). Page size lives inside the ZPL itself.
        res = _run(["lpr", "-P", printer, "-#", str(copies), "-l"], data=data)
        if res.returncode != 0:
            return {"ok": False, "error": "lpr_failed", "detail": _err(res),
                    "printer": printer, "format": fmt}
        return {"ok": True, "printed": True, "printer": printer, "format": fmt,
                "copies": copies, "media": "raw"}

    with tempfile.NamedTemporaryFile(suffix=f".{fmt}", delete=False) as tmp:
        tmp.write(data)
        path = tmp.name
    media = (media or "").strip()
    try:
        cmd = ["lpr", "-P", printer, "-#", str(copies)]
        # The LabelWriter 550 auto-detects the loaded roll (ALR). Forcing a
        # mismatched PageSize makes it hold the job, so "auto" (or empty) lets
        # the driver decide and we only pass PageSize when asked.
        if media and media.lower() != "auto":
            cmd += ["-o", f"PageSize={media}"]
        cmd += ["-o", "fit-to-page", path]
        res = _run(cmd)
        if res.returncode != 0:
            return {"ok": False, "error": "lpr_failed", "printer": printer,
                    "detail": _err(res) or _out(res).strip()}
        return {"ok": True, "printed": True, "printer": printer,
                "media": media or "auto", "copies": copies, "format": fmt}
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _extract_request():
    """Return (bytes, media, copies, printer, format) from the request.

    Accepts three shapes: multipart upload, JSON (base64 image or ZPL text),
    or a raw body with query parameters.
    """
    if request.files.get("file"):
        f = request.files["file"]
        return (f.read(), request.form.get("media"),
                request.form.get("copies", 1),
                request.form.get("printer") or DEFAULT_PRINTER,
                request.form.get("format"))
    if request.is_json:
        body = request.get_json(silent=True) or {}
        printer = body.get("printer") or DEFAULT_PRINTER
        media, copies, fmt = body.get("media"), body.get("copies", 1), body.get("format")
        zpl = body.get("zpl") or body.get("raw")
        if zpl:  # plain-text ZPL is the friendliest payload for a webshop
            return zpl.encode(), media, copies, printer, fmt or "zpl"
        b64 = body.get("image_base64") or body.get("png_base64") or body.get("data")
        if not b64:
            return None, media, copies, printer, fmt
        return base64.b64decode(b64), media, copies, printer, fmt
    if request.data:
        return (request.data, request.args.get("media"),
                request.args.get("copies", 1),
                request.args.get("printer") or DEFAULT_PRINTER,
                request.args.get("format"))
    return None, None, 1, DEFAULT_PRINTER, None


@app.route("/print", methods=["POST"])
def print_label():
    data, media, copies, printer, fmt = _extract_request()
    if not data:
        return jsonify({"ok": False, "error": "no_image",
                        "hint": "POST a PNG/PDF/ZPL as multipart 'file', or JSON "
                                "{image_base64|zpl, printer, media, copies}."}), 400
    if media is None:
        media = _default_media_for(printer)
    result = _print_bytes(data, media, copies, printer, fmt)
    return jsonify(result), (200 if result.get("ok") else 503)


@app.route("/printers", methods=["GET"])
def printers():
    """What can I print on, with which labels, in which formats?"""
    return jsonify({"default": DEFAULT_PRINTER, "printers": _printer_list()})


@app.route("/selftest", methods=["POST"])
def selftest():
    printer = (request.args.get("printer")
               or (request.get_json(silent=True) or {}).get("printer")
               or DEFAULT_PRINTER)
    if _configured(printer).get("kind") == "zebra":
        # Native ZPL, so the test also proves the raw passthrough works.
        zpl = (
            "^XA^CI28"
            "^FO40,60^A0N,60,60^FDLABEL PRINTER OK^FS"
            f"^FO40,140^A0N,40,40^FD{printer} - raw ZPL^FS"
            "^FO40,200^GB700,4,4^FS"
            "^FO40,240^BY3^BCN,120,Y,N,N^FDSELFTEST^FS"
            "^XZ"
        ).encode()
        result = _print_bytes(zpl, None, 1, printer, "zpl")
        return jsonify(result), (200 if result.get("ok") else 503)

    import io

    from PIL import Image, ImageDraw
    img = Image.new("L", (642, 1192), 255)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([12, 12, 629, 1179], radius=30, outline=0, width=3)
    d.text((60, 80), "LABEL PRINTER OK", fill=0)
    d.text((60, 140), f"{printer} - {_media_label(_media_of(printer))}", fill=0)
    buf = io.BytesIO()
    img.save(buf, format="PNG", dpi=(300, 300))
    result = _print_bytes(buf.getvalue(), _default_media_for(printer), 1, printer)
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
    status = _out(_run(["sh", "-c",
        "grep -aE 'Job 1|CheckLock|CheckLabel|CheckStatus|ReadStatus:|STATE:|"
        "counterfeit|Sending|pages|Wrote .* print|CheckPrintHead|Reprint' "
        "/var/log/cups/error_log | tail -40"]))
    return jsonify({
        "configured": CONFIGURED,
        "printers": _out(_run(["lpstat", "-l", "-p"])),
        "jobs": _out(_run(["lpstat", "-l", "-o"])),
        "devices": _out(_run(["lpinfo", "-v"])),
        "status_lines": status,
        "error_log": tail("/var/log/cups/error_log"),
    })


@app.route("/", methods=["GET"])
def index():
    st = _status()
    rows = "".join(
        f"<tr><td><code>{p['name']}</code>{' <b>· default</b>' if p['default'] else ''}</td>"
        f"<td>{p['model'] or p['kind']}</td><td>{p['label']}</td>"
        f"<td>{', '.join(p['accepts']) or '—'}</td>"
        f"<td>{'🟢' if p['connected'] else '🔴'}</td></tr>"
        for p in st["printers"]
    ) or "<tr><td colspan='5'>Geen printers gevonden.</td></tr>"
    return (
        "<html><head><title>Label Printer</title>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px "
        "auto;padding:0 20px;line-height:1.5}code{background:#f4f4f5;padding:2px 6px;"
        "border-radius:6px}pre{background:#f4f4f5;padding:14px;border-radius:10px;"
        "overflow:auto;font-size:13px}table{border-collapse:collapse;width:100%}"
        "td,th{padding:8px 10px;border-bottom:1px solid #e5e5e5;text-align:left;"
        "font-size:14px}</style></head><body>"
        "<h1>🖨️ Label Printer</h1>"
        "<table><tr><th>Queue</th><th>Model</th><th>Labels</th>"
        f"<th>Accepteert</th><th></th></tr>{rows}</table>"
        "<h3>PNG/PDF printen</h3>"
        "<pre>curl -F file=@label.png -F printer=dymo http://HOST:8000/print</pre>"
        "<h3>Raw ZPL printen</h3>"
        "<pre>curl -H 'Content-Type: application/json' \\\n"
        "  -d '{\"printer\":\"zebra\",\"zpl\":\"^XA^FO50,50^A0N,50,50^FDHi^FS^XZ\"}' \\\n"
        "  http://HOST:8000/print</pre>"
        "<h3>Printers opvragen / testen</h3>"
        "<pre>curl http://HOST:8000/printers\n"
        "curl -X POST 'http://HOST:8000/selftest?printer=zebra'</pre>"
        f"<h3>Status</h3><pre>{json.dumps(st, indent=2)}</pre>"
        "</body></html>"
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
