#!/usr/bin/with-contenv bashio
# ---------------------------------------------------------------------------
# Label Printer add-on
# Starts CUPS, auto-detects every supported USB label printer, registers each
# one as its own CUPS queue with the right driver, then runs the HTTP service.
#
# Supported today:
#   * DYMO LabelWriter (300/400/450/550/4XL/5XL)  — queue "dymo"
#   * Zebra ZPL/EPL desktop printers (ZD220, GK/GX420, …) — queue "zebra"
#
# Tested: DYMO LabelWriter 400 + 99014 (54 x 101 mm) and a Zebra ZD220D with
# 104 x 159 mm shipping labels.
# ---------------------------------------------------------------------------

# Dev convenience: if a live copy exists in /share, use it so the service and
# CUPS config can be iterated by just restarting the add-on (no rebuild).
LIVE_DIR="/share/fridge-assistant/addon/label_printer"
if bashio::fs.file_exists "${LIVE_DIR}/cupsd.conf"; then
    cp "${LIVE_DIR}/cupsd.conf" /etc/cups/cupsd.conf
    bashio::log.info "Using live cupsd.conf from /share"
fi
if bashio::fs.file_exists "${LIVE_DIR}/server.py"; then
    cp "${LIVE_DIR}/server.py" /server.py
    bashio::log.info "Using live server.py from /share"
fi

MODEL="$(bashio::config 'printer_model')"
DEFAULT_MEDIA="$(bashio::config 'default_media')"
ZEBRA_ENABLED="$(bashio::config 'zebra_enabled')"
ZEBRA_LABEL_SIZE="$(bashio::config 'zebra_label_size')"

DYMO_PRINTER="dymo"
ZEBRA_PRINTER="zebra"
export DEFAULT_MEDIA
export PRINTER_NAME="${DYMO_PRINTER}"   # default queue; keeps old callers working

# Map a detected USB device URI (e.g. usb://DYMO/LabelWriter%20450?serial=...)
# to the matching DYMO CUPS driver / PPD name.
detect_model() {
    local u
    # Match only the model name, not the ?serial=... suffix, so a serial number
    # that happens to contain 450/550/etc. can't cause a false match.
    u="$(printf '%s' "${1%%\?*}" | tr '[:upper:]' '[:lower:]')"
    case "$u" in
        *5xl*)       echo "lw5xl" ;;
        *550*turbo*) echo "lw550t" ;;
        *550*)       echo "lw550" ;;
        *4xl*)       echo "lw4xl" ;;
        *450*twin*)  echo "lw450tt" ;;
        *450*turbo*) echo "lw450t" ;;
        *450*duo*)   echo "lw450dl" ;;
        *450*)       echo "lw450" ;;
        *400*turbo*) echo "lw400t" ;;
        *400*)       echo "lw400" ;;
        *330*)       echo "lw330" ;;
        *)           echo "" ;;
    esac
}

# "104x159" (mm) -> "Custom.295x451" (PostScript points), which is how CUPS
# names a custom page size. Anything that isn't a plain WxH pair in millimetres
# is passed through, so a CUPS media name (w154h286) still works.
# points = mm * 72 / 25.4, done in integer maths as mm * 360 / 127 (rounded).
mm_to_media() {
    local spec w h
    spec="$(printf '%s' "$1" | tr -d ' ')"
    case "$spec" in
        [0-9]*x[0-9]*)
            w="${spec%%x*}"; h="${spec##*x}"
            case "$w$h" in
                *[!0-9]*) echo "$spec"; return ;;
            esac
            echo "Custom.$(( (w * 360 + 63) / 127 ))x$(( (h * 360 + 63) / 127 ))"
            ;;
        *) echo "$spec" ;;
    esac
}

# Register one CUPS queue. register_queue <name> <device-uri> <ppd-or-model> [media]
register_queue() {
    local name="$1" uri="$2" ppd="$3" media="$4"
    lpadmin -x "${name}" 2>/dev/null || true
    if [ -f "${ppd}" ]; then
        lpadmin -p "${name}" -v "${uri}" -E -P "${ppd}" || return 1
    else
        # Not a file on disk -> a CUPS model name such as drv:///sample.drv/zebra.ppd
        lpadmin -p "${name}" -v "${uri}" -E -m "${ppd}" || return 1
    fi
    cupsenable "${name}" || true
    cupsaccept "${name}" || true
    if [ -n "${media}" ] && [ "${media}" != "auto" ]; then
        lpoptions -p "${name}" -o "PageSize=${media}" || true
    fi
    return 0
}

bashio::log.info "Starting CUPS..."
mkdir -p /run/cups
chmod 755 /run/cups
cupsd

bashio::log.info "Waiting for CUPS socket..."
for _ in $(seq 1 30); do
    [ -e /run/cups/cups.sock ] && break
    sleep 1
done
sleep 1

bashio::log.info "USB devices:"
lsusb || true
bashio::log.info "CUPS backends:"
lpinfo -v || true

DEVICES="$(lpinfo -v 2>/dev/null)"
PRINTERS_JSON="[]"

add_printer_json() {
    # add_printer_json <name> <kind> <model> <media> <raster:true|false>
    PRINTERS_JSON="$(printf '%s' "${PRINTERS_JSON}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
data.append({'name': '$1', 'kind': '$2', 'model': '$3',
             'media': '$4', 'raster': '$5' == 'true'})
print(json.dumps(data))
")"
}

# --- DYMO ------------------------------------------------------------------
DYMO_URI="$(printf '%s' "${DEVICES}" | grep -i 'dymo' | head -n 1 | awk '{print $2}')"

if [ -n "${DYMO_URI}" ]; then
    if [ -z "${MODEL}" ] || [ "${MODEL}" = "auto" ]; then
        DETECTED="$(detect_model "${DYMO_URI}")"
        if [ -n "${DETECTED}" ]; then
            MODEL="${DETECTED}"
            bashio::log.info "Auto-detected DYMO model: ${MODEL}"
        else
            MODEL="lw550"
            bashio::log.warning "Could not auto-detect model from '${DYMO_URI}'; using lw550."
        fi
    else
        bashio::log.info "Using configured DYMO model: ${MODEL}"
    fi

    PPD="/usr/share/cups/model/${MODEL}.ppd"
    if ! bashio::fs.file_exists "${PPD}"; then
        bashio::log.warning "PPD ${PPD} not found, falling back to lw550.ppd"
        PPD="/usr/share/cups/model/lw550.ppd"
        MODEL="lw550"
    fi
    export PRINTER_MODEL="${MODEL}"

    bashio::log.info "Found DYMO at ${DYMO_URI} — registering with ${PPD}"
    if register_queue "${DYMO_PRINTER}" "${DYMO_URI}" "${PPD}" "${DEFAULT_MEDIA}"; then
        lpadmin -d "${DYMO_PRINTER}"   # default queue for callers that omit one
        add_printer_json "${DYMO_PRINTER}" "dymo" "${MODEL}" "${DEFAULT_MEDIA}" "true"
        bashio::log.info "Printer '${DYMO_PRINTER}' ready (model=${MODEL}, media=${DEFAULT_MEDIA})."
    else
        bashio::log.error "Registering the DYMO queue failed."
    fi
else
    bashio::log.warning "No DYMO LabelWriter found on USB."
fi

# --- Zebra -----------------------------------------------------------------
if bashio::var.true "${ZEBRA_ENABLED}"; then
    ZEBRA_URI="$(printf '%s' "${DEVICES}" \
        | grep -iE 'zebra|ztc' | head -n 1 | awk '{print $2}')"
    if [ -n "${ZEBRA_URI}" ]; then
        # The device string states the active language (…ZD220-203dpi ZPL).
        # A queue with the matching driver accepts PNG/PDF (CUPS rasterises,
        # rastertolabel emits printer language); raw ZPL/EPL passes through
        # untouched either way.
        case "$(printf '%s' "${ZEBRA_URI}" | tr '[:upper:]' '[:lower:]')" in
            *epl*)  ZEBRA_PPD="drv:///sample.drv/zebraep2.ppd" ;;
            *cpcl*) ZEBRA_PPD="drv:///sample.drv/zebracpl.ppd" ;;
            *)      ZEBRA_PPD="drv:///sample.drv/zebra.ppd" ;;
        esac
        ZEBRA_MEDIA="$(mm_to_media "${ZEBRA_LABEL_SIZE}")"
        export ZEBRA_MEDIA
        bashio::log.info "Found Zebra at ${ZEBRA_URI} — registering with ${ZEBRA_PPD}"
        if register_queue "${ZEBRA_PRINTER}" "${ZEBRA_URI}" "${ZEBRA_PPD}" "${ZEBRA_MEDIA}"; then
            add_printer_json "${ZEBRA_PRINTER}" "zebra" "${ZEBRA_PPD##*/}" \
                "${ZEBRA_MEDIA}" "true"
            bashio::log.info "Printer '${ZEBRA_PRINTER}' ready (media=${ZEBRA_MEDIA}, label=${ZEBRA_LABEL_SIZE} mm)."
        else
            bashio::log.error "Registering the Zebra queue failed."
        fi
    else
        bashio::log.info "No Zebra printer found on USB."
    fi
else
    bashio::log.info "Zebra support disabled in the add-on options."
fi

export PRINTERS_JSON
bashio::log.info "Configured printers: ${PRINTERS_JSON}"

lpstat -t || true

bashio::log.info "Starting print service on :8000..."
exec python3 /server.py
