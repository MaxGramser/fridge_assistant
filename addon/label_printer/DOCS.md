# Fridge Assistant – Label Printer

A tiny, generic **label print service** for a USB DYMO LabelWriter. It receives
a finished **PNG or PDF** over HTTP and prints it through CUPS. It renders
nothing itself, so you can use it to print *any* image/PDF label — the Fridge
Assistant integration just happens to be its main client.

> ⚠️ **Tested combination:** DYMO **LabelWriter 550** + **99014** labels
> (54 × 101 mm). Other DYMO models/labels may work (the driver bundle includes
> several PPDs) but are **not** verified.

## How it fits together

```
Fridge Assistant integration           this add-on
(renders the label with Pillow)   →    (prints the PNG on the DYMO)
        PNG/PDF over HTTP  ───────────────────►  CUPS → USB → LabelWriter
```

## Install

1. Copy this folder into your Home Assistant **`/addons`** directory, e.g. from
   an SSH/Terminal add-on:
   ```bash
   cp -r /share/fridge-assistant/addon/label_printer /addons/
   ```
2. **Settings → Add-ons → ⟳ (reload)**, then open **Fridge Assistant – Label
   Printer** and click **Install** (the first build compiles the DYMO driver and
   takes a few minutes).
3. Plug in + power on the LabelWriter, then **Start** the add-on.
4. Open the add-on **Log**; you should see `Printer 'dymo' ready`.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `printer_model` | `auto` | `auto` detects the model from the USB device (LabelWriter 450/550/5XL/400/…) and picks the right driver. Pin a specific PPD (`lw550`, `lw450`, `lw5xl`, …) only if auto-detect guesses wrong. |
| `default_media` | `w154h286` | CUPS page size for 99014 (54 × 101 mm). |
| `log_level` | `info` | Add-on log verbosity. |

With `printer_model: auto` you can plug in **any** supported DYMO LabelWriter and
the add-on selects the matching driver automatically.

> ⚠️ **DYMO LabelWriter 550 series:** these enforce RFID "Automatic Label
> Recognition" in firmware and will **only print genuine DYMO labels**.
> Third-party/aftermarket rolls are refused by the printer itself (nothing this
> add-on can change). Older models like the **LabelWriter 450 have no such lock**
> and print any compatible 99014 roll.

## HTTP API (port 8000)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET`  | `/` | – | Status page. |
| `GET`  | `/health` | – | JSON status (printer connected? default media). |
| `POST` | `/print` | multipart `file=@label.png` **or** JSON `{image_base64, media, copies}` | Print a PNG/PDF. |
| `POST` | `/selftest` | – | Print a small built-in test label. |

Examples:
```bash
# Print a PNG
curl -F file=@label.png http://local-label-printer:8000/print
# Print a base64 PNG with 2 copies
curl -H 'Content-Type: application/json' \
     -d '{"image_base64":"<...>","media":"w154h286","copies":2}' \
     http://local-label-printer:8000/print
# Verify the hardware
curl -X POST http://local-label-printer:8000/selftest
```

## Troubleshooting

- **`printer_not_connected`** – the DYMO wasn't found on USB. Check the cable/power,
  then restart the add-on (USB is claimed at start).
- **Nothing prints / blank** – confirm genuine DYMO **99014** labels are loaded
  (the LW550 refuses unknown rolls) and that the media matches `default_media`.
- **Build fails** – ensure the add-on has USB + full hardware access
  (`usb: true`, `full_access: true`) and rebuild.
