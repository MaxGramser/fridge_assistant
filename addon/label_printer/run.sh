#!/usr/bin/with-contenv bashio
# ---------------------------------------------------------------------------
# Fridge Assistant – Label Printer
# Starts CUPS, auto-detects the USB DYMO LabelWriter, registers it with the
# right PPD, then runs the HTTP print service.
# Tested with a DYMO LabelWriter 550 + 99014 labels (54 x 101 mm).
# ---------------------------------------------------------------------------

# Dev convenience: if a live copy exists in /share, use it so server/CUPS
# tweaks can be iterated by just restarting the add-on (no rebuild needed).
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
export PRINTER_NAME="dymo"
export DEFAULT_MEDIA

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

DYMO_URI="$(lpinfo -v 2>/dev/null | grep -i 'dymo' | head -n 1 | awk '{print $2}')"

if [ -n "${DYMO_URI}" ]; then
    # Resolve which driver/PPD to use: auto-detect from the device unless the
    # user pinned a specific model in the add-on options.
    if [ -z "${MODEL}" ] || [ "${MODEL}" = "auto" ]; then
        DETECTED="$(detect_model "${DYMO_URI}")"
        if [ -n "${DETECTED}" ]; then
            MODEL="${DETECTED}"
            bashio::log.info "Auto-detected printer model: ${MODEL}"
        else
            MODEL="lw550"
            bashio::log.warning "Could not auto-detect model from '${DYMO_URI}'; using lw550."
        fi
    else
        bashio::log.info "Using configured printer model: ${MODEL}"
    fi

    PPD="/usr/share/cups/model/${MODEL}.ppd"
    if ! bashio::fs.file_exists "${PPD}"; then
        bashio::log.warning "PPD ${PPD} not found, falling back to lw550.ppd"
        PPD="/usr/share/cups/model/lw550.ppd"
        MODEL="lw550"
    fi
    export PRINTER_MODEL="${MODEL}"

    bashio::log.info "Found DYMO at ${DYMO_URI} — registering with ${PPD}"
    lpadmin -x "${PRINTER_NAME}" 2>/dev/null || true
    lpadmin -p "${PRINTER_NAME}" -v "${DYMO_URI}" -E -P "${PPD}"
    lpadmin -d "${PRINTER_NAME}"
    cupsenable "${PRINTER_NAME}" || true
    cupsaccept "${PRINTER_NAME}" || true
    lpoptions -p "${PRINTER_NAME}" -o "PageSize=${DEFAULT_MEDIA}" || true
    bashio::log.info "Printer '${PRINTER_NAME}' ready (model=${MODEL}, media=${DEFAULT_MEDIA})."
else
    bashio::log.warning "No DYMO LabelWriter found on USB."
    bashio::log.warning "Connect + power on the printer, then restart this add-on."
fi

lpstat -t || true

bashio::log.info "Starting print service on :8000..."
exec python3 /server.py
