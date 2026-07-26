# Label Printer (DYMO + Zebra)

A small, generic **label print service** for USB label printers. It receives a
finished **PNG/PDF** — or **raw ZPL** — over HTTP and prints it through CUPS. It
renders nothing itself, so you can use it to print *any* label: the Fridge
Assistant integration, Label Assistant, or an external system such as a webshop.

Multiple printers run **side by side**. Each attached printer gets its own CUPS
queue; callers pick one by name and default to the DYMO, so existing
integrations keep working unchanged.

> ✅ **Tested combination:** DYMO **LabelWriter 400** + **99014** labels
> (54 × 101 mm) and a **Zebra ZD220D** + 104 × 159 mm shipping labels
> (S0904980-style, for PostNL/DHL/DPD), both on one USB hub.

## How it fits together

```
Fridge Assistant / Label Assistant / webshop        this add-on
(renders a PNG, or generates ZPL)             →     (prints it)
    PNG · PDF · ZPL over HTTP  ─────────────────►   CUPS → USB → printer
```

## Install

1. Copy this folder into your Home Assistant **`/addons`** directory, e.g. from
   an SSH/Terminal add-on:
   ```bash
   cp -rf /share/fridge-assistant/addon/label_printer/. /addons/label_printer/
   ```
2. **Settings → Add-ons → ⟳ (reload)**, then open **Label Printer** and click
   **Install** (the first build compiles the DYMO driver and takes a few minutes).
3. Plug in + power on the printers, then **Start** the add-on.
4. Open the add-on **Log**; you should see `Printer 'dymo' ready` and, if a Zebra
   is attached, `Printer 'zebra' ready`.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `printer_model` | `auto` | `auto` detects the DYMO model from the USB device (LabelWriter 450/550/5XL/400/…) and picks the right driver. Pin a specific PPD (`lw550`, `lw450`, …) only if auto-detect guesses wrong. |
| `default_media` | `w154h286` | CUPS page size for the DYMO roll — 99014 (54 × 101 mm). |
| `zebra_enabled` | `true` | Detect and register an attached Zebra printer. |
| `zebra_label_size` | `104x159` | Zebra label size **in millimetres** (`WxH`). Converted to a CUPS custom page size automatically. A raw CUPS media name (e.g. `w288h432`) is also accepted. |
| `log_level` | `info` | Add-on log verbosity. |

Printer detection is automatic: plug in any supported DYMO LabelWriter and/or a
Zebra ZPL printer and the add-on selects the matching driver. The Zebra's active
language is read from its USB device string (ZPL / EPL / CPCL).

> ⚠️ **DYMO LabelWriter 550 series:** these enforce RFID "Automatic Label
> Recognition" in firmware and will **only print genuine DYMO labels**.
> Third-party/aftermarket rolls are refused by the printer itself (nothing this
> add-on can change). Older models like the **LabelWriter 400/450 have no such
> lock** and print any compatible 99014 roll.

## HTTP API (port 8000)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET`  | `/` | – | Status page with a table of every printer. |
| `GET`  | `/printers` | – | JSON: which printers exist, their label size and accepted formats. |
| `GET`  | `/health` | – | JSON status (printers connected, queue, devices). |
| `POST` | `/print` | multipart `file=@label.png` **or** JSON `{image_base64 \| zpl, printer, media, copies, format}` | Print a label. |
| `POST` | `/selftest` | `?printer=<name>` | Print a built-in test label (native ZPL on a Zebra). |

### Picking a printer

Every print call takes an optional `printer` field. Leave it out and the job
goes to the **DYMO** queue, exactly like before this feature existed.

```bash
curl http://local-label-printer:8000/printers
```
```json
{
  "default": "dymo",
  "printers": [
    {"name": "dymo",  "kind": "dymo",  "model": "lw400",
     "media": "w154h286", "label": "54 × 101 mm",
     "accepts": ["png", "pdf", "jpg"], "connected": true, "default": true},
    {"name": "zebra", "kind": "zebra", "model": "zebra.ppd",
     "media": "Custom.295x451", "label": "104 × 159 mm",
     "accepts": ["png", "pdf", "jpg", "zpl"], "connected": true, "default": false}
  ]
}
```

### Formats

The format is sniffed from the payload (PDF/PNG/JPG magic bytes, or `^XA` for
ZPL) and can be forced with `format`:

- **PNG/PDF/JPG** — CUPS rasterises the image and the printer's driver turns it
  into printer language. Works on both printers; `fit-to-page` scales it to the
  loaded label.
- **ZPL** (Zebra only) — sent to the device **untouched**, so the label is
  exactly what your webshop generated. Page size comes from the ZPL itself, not
  from `media`.

```bash
# PNG to the DYMO (default printer — no 'printer' field needed)
curl -F file=@label.png http://local-label-printer:8000/print

# PNG to the Zebra
curl -F file=@shipping.png -F printer=zebra http://local-label-printer:8000/print

# Raw ZPL to the Zebra, as plain text
curl -H 'Content-Type: application/json' \
     -d '{"printer":"zebra","zpl":"^XA^FO50,50^A0N,60,60^FDHello^FS^XZ"}' \
     http://local-label-printer:8000/print

# Raw ZPL from a file
curl -H 'Content-Type: text/plain' --data-binary @label.zpl \
     'http://local-label-printer:8000/print?printer=zebra'

# A base64 PNG, two copies
curl -H 'Content-Type: application/json' \
     -d '{"image_base64":"<...>","printer":"dymo","copies":2}' \
     http://local-label-printer:8000/print

# Verify the hardware
curl -X POST 'http://local-label-printer:8000/selftest?printer=zebra'
```

## Troubleshooting

- **`printer_not_connected`** – that queue doesn't exist or the printer wasn't
  found on USB. The response lists the queues that *do* exist. Check
  cable/power, then restart the add-on (USB is claimed at start).
- **Nothing prints / blank** – confirm the loaded roll matches the configured
  label size, and that a LabelWriter 550 has genuine DYMO labels (it refuses
  unknown rolls).
- **Zebra prints ZPL as text** – the printer is in EPL mode. Its USB device
  string then contains `EPL`, which the add-on detects; restart the add-on after
  switching languages so the right driver is registered.
- **Zebra feeds the wrong length** – run a label calibration on the printer
  (hold the feed button until it flashes) so the gap sensor learns the roll.
- **Build fails** – ensure the add-on has USB + full hardware access
  (`usb: true`, `full_access: true`) and rebuild.
