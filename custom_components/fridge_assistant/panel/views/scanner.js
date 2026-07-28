/* Barcode scanner: live camera (BarcodeDetector or ZXing), photo capture and
 * manual entry, plus routing of scanned codes (own labels vs retail EAN/UPC). */

import { esc } from "../lib/format.js";

async function makeDetector() {
  const wanted = ["code_39", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"];
  let formats;
  try {
    const sup = await window.BarcodeDetector.getSupportedFormats();
    formats = wanted.filter((f) => sup.includes(f));
  } catch (e) { /* fall back to all formats */ }
  return formats && formats.length
    ? new window.BarcodeDetector({ formats })
    : new window.BarcodeDetector();
}

function loadZXing(panel) {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!panel._zxingPromise) {
    panel._zxingPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "/fridge_assistant_static/zxing.min.js";
      s.onload = () => resolve(window.ZXing || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return panel._zxingPromise;
}

/* Own label codes: 2 letters + 2 digits (either order), with an optional
 * portion suffix from a multi-portion sticker (AB12-3). */
const OWN_CODE_RE = /^([A-Z]{2}\d{2}|\d{2}[A-Z]{2})(?:-(\d{1,2}))?$/;

function parseOwnCode(raw) {
  const m = OWN_CODE_RE.exec(String(raw || "").trim().toUpperCase());
  return m ? { base: m[1], portion: m[2] ? Number(m[2]) : null } : null;
}

export async function eatScanned(panel, raw, setStatus, count) {
  const val = String(raw || "").trim().toUpperCase();
  const parsed = parseOwnCode(val);
  if (!parsed) {
    setStatus(panel.t("notOwnLabel", val));
    return;
  }
  const item = (panel._state.items || []).find(
    (i) => (i.code || "").toUpperCase() === parsed.base
  );
  if (!item) { setStatus(panel.t("noActiveItemWithCode", val)); return; }
  const total = (item.portions || []).length || 1;
  let res;
  try {
    const payload = { item_id: item.id, action: "eaten" };
    if (parsed.portion != null) payload.portion = parsed.portion;
    res = await panel._call("consume_portion", payload);
  } catch (e) {
    // Orphaned sticker (portion resized away) or already-eaten portion:
    // explain instead of a bare failure, with a jump to the item.
    const msgs = {
      portion_not_found: panel.t("portionNotFoundMsg", parsed.portion),
      portion_consumed: panel.t("portionConsumedMsg", parsed.portion),
      no_open_portions: panel.t("noOpenPortionsMsg"),
    };
    const msg = msgs[e.code];
    if (msg) {
      setStatus(msg);
      panel._toast(msg, {
        type: "bad",
        actionLabel: panel.t("openItemLabel"),
        onAction: () => panel._openItemModal(item),
      });
    } else setStatus(panel.t("couldNotEatRetry"));
    return;
  }
  count.n = (count.n || 0) + 1;
  setStatus(panel.t("eatenStatusCount", item.name, count.n));
  const ev = res.event;
  const undo = ev
    ? { actionLabel: panel.t("undoLabel"), onAction: () => panel._call("restore_item", { event_id: ev.id }).catch(() => {}) }
    : {};
  if (res.completed) {
    panel._toast(panel.t("completedToast", "🍽️", esc(item.name), true), undo);
  } else {
    panel._toast(
      panel.t("portionEatenToast", esc(item.name), res.portion, total, res.remaining),
      undo
    );
  }
}

export async function openScanner(panel) {
  const bd = "BarcodeDetector" in window;
  const zxing = bd ? null : await loadZXing(panel);   // decoder for iOS etc.
  const decodable = bd || !!zxing;
  const canLive = decodable && window.isSecureContext
    && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  const h = panel._openModal(`
    <div class="modal-head">
      <div class="m-title"><div class="m-strong">${panel.t("scanTitle")}</div>
        <div class="m-sub">${panel.t("scanSub")}</div></div>
      <button class="icon-btn" id="sc-close" aria-label="${panel.t("closeBtn")}"><ha-icon icon="mdi:close"></ha-icon></button>
    </div>
    <div class="seg sc-mode" id="sc-mode">
      <button type="button" data-mode="find" class="on">${panel.t("searchModeBtn")}</button>
      <button type="button" data-mode="eat">${panel.t("eatModeBtn")}</button>
    </div>
    <div class="scanbox${canLive ? "" : " hidden"}" id="sc-box">
      <video id="sc-video" playsinline muted></video><div class="scan-frame"></div>
      <button class="icon-btn scan-torch hidden" id="sc-torch" title="${panel.t("torchTooltip")}"><ha-icon icon="mdi:flashlight"></ha-icon></button>
    </div>
    <div class="scan-status" id="sc-status"></div>
    <div class="modal-actions">
      ${decodable ? `<label class="btn ghost filepick">${panel.t("photoBtn")}<input id="sc-file" type="file" accept="image/*" capture="environment"></label>` : ""}
      <button class="btn ghost" id="sc-manual">${panel.t("typeCodeBtn")}</button>
    </div>
  `, { wide: false });
  const q = (s) => h.modal.querySelector(s);
  let stopped = false, stream = null, timer = null, reader = null;
  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (reader) { try { reader.reset(); } catch (e) { /* ignore */ } reader = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  };
  let mode = "find", lastCode = "", lastTs = 0;
  const eatCount = { n: 0 };
  const setStatus = (t) => { const s = q("#sc-status"); if (s) s.textContent = t; };
  // Debounced router: search opens the item; eat marks it eaten and keeps scanning.
  const handle = (raw) => {
    const now = Date.now();
    if (raw === lastCode && now - lastTs < 2500) return;
    lastCode = raw; lastTs = now;
    if (mode === "eat") eatScanned(panel, raw, setStatus, eatCount);
    else { stop(); onScan(panel, raw, h); }
  };
  const modeEl = q("#sc-mode");
  modeEl.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode;
      modeEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      setStatus(mode === "eat" ? panel.t("eatModeStatus") : panel.t("aimAtBarcode"));
    }));
  q("#sc-close").addEventListener("click", () => { stop(); h.close(); });

  q("#sc-manual").addEventListener("click", () => {
    stop();
    const box = q("#sc-box"); if (box) box.classList.add("hidden");
    q("#sc-status").innerHTML = `<div class="scan-manual"><input id="sc-code" placeholder="${panel.t("codeInputPlaceholder")}" autocomplete="off" autocapitalize="characters" enterkeyhint="search"><button class="btn primary" id="sc-go">${panel.t("searchBtn")}</button></div>`;
    const go = () => { const v = (q("#sc-code").value || "").trim(); if (v) handle(v); };
    q("#sc-go").addEventListener("click", go);
    q("#sc-code").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    setTimeout(() => q("#sc-code") && q("#sc-code").focus(), 60);
  });

  const fileEl = q("#sc-file");
  if (fileEl) fileEl.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    q("#sc-status").textContent = panel.t("readingPhoto");
    try {
      let raw = null;
      if (bd) {
        const det = await makeDetector();
        const codes = await det.detect(await createImageBitmap(f));
        if (codes && codes.length) raw = codes[0].rawValue;
      } else if (zxing) {
        const hints = new Map();
        hints.set(zxing.DecodeHintType.TRY_HARDER, true);
        const url = URL.createObjectURL(f);
        try { const r = await new zxing.BrowserMultiFormatReader(hints).decodeFromImageUrl(url); raw = r && r.getText(); }
        finally { URL.revokeObjectURL(url); }
      }
      if (raw) { handle(raw); return; }
      q("#sc-status").textContent = panel.t("noBarcodeFound");
    } catch (err) { q("#sc-status").textContent = panel.t("noBarcodeFound"); }
  });

  if (!canLive) {
    q("#sc-status").textContent = decodable ? panel.t("takePhotoOfBarcode") : panel.t("liveScanUnavailable");
    if (!decodable) setTimeout(() => q("#sc-manual").click(), 0);
    return;
  }

  const video = q("#sc-video");
  q("#sc-status").textContent = panel.t("aimAtBarcode");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        aspectRatio: { ideal: 4 / 3 },
      },
    });
  } catch (err) {
    q("#sc-box").classList.add("hidden");
    q("#sc-status").textContent = panel.t("noCameraAccess");
    return;
  }
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* autoplay quirks */ }

  // Flashlight toggle, only shown when the track actually supports it.
  const track = stream.getVideoTracks()[0];
  const torchBtn = q("#sc-torch");
  let torchOn = false;
  try {
    if (track.getCapabilities && track.getCapabilities().torch && torchBtn) {
      torchBtn.classList.remove("hidden");
      torchBtn.addEventListener("click", async () => {
        const next = !torchOn;
        try { await track.applyConstraints({ advanced: [{ torch: next }] }); torchOn = next; torchBtn.classList.toggle("on", torchOn); }
        catch (e) { /* device refused mid-toggle, leave state as-is */ }
      });
    }
  } catch (e) { /* getCapabilities unsupported (e.g. older iOS) — no flashlight button */ }

  if (bd) {
    // Android/Chromium: native detector on the full frame (proven path).
    const det = await makeDetector();
    const tick = async () => {
      if (stopped || !video.isConnected) { stop(); return; }
      try {
        const codes = await det.detect(video);
        if (codes && codes.length) { handle(codes[0].rawValue); return; }
      } catch (e) { /* transient decode error */ }
      if (!stopped) timer = setTimeout(tick, 170);
    };
    tick();
  } else {
    // iOS etc.: ZXing. Decode a native-resolution crop of the .scan-frame
    // region so you can back off to a focusable distance while the barcode
    // still fills the decoder's view. reader.decode(canvas) is broken in this
    // bundle (it reads canvas.naturalWidth → undefined), so build the
    // BinaryBitmap by hand from our own canvas.
    const hints = new Map();
    hints.set(zxing.DecodeHintType.TRY_HARDER, true);
    reader = new zxing.BrowserMultiFormatReader(hints);
    const crop = document.createElement("canvas");
    const cropCtx = crop.getContext("2d", { willReadFrequently: true });
    const decodeCrop = () => {
      const source = new zxing.HTMLCanvasElementLuminanceSource(crop);
      const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source));
      return reader.decodeBitmap(bitmap);   // throws NotFoundException if none
    };
    const tick = async () => {
      if (stopped || !video.isConnected) { stop(); return; }
      const vw = video.videoWidth, vh = video.videoHeight;
      if (vw && vh) {
        const sx = Math.round(vw * 0.08), sy = Math.round(vh * 0.30);
        const sw = Math.round(vw * 0.84), sh = Math.round(vh * 0.40);
        if (crop.width !== sw) crop.width = sw;
        if (crop.height !== sh) crop.height = sh;
        cropCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        try {
          const result = decodeCrop();
          if (result) { handle(result.getText()); return; }
        } catch (e) { /* no barcode in this frame */ }
      }
      if (!stopped) timer = setTimeout(tick, 150);
    };
    tick();
  }
}

export function onScan(panel, raw, h) {
  const val = String(raw || "").trim().toUpperCase();
  if (h && h.close) h.close();
  // Our own label: 2 letters + 2 digits, either order, optional portion
  // suffix (AB12 / 12AB / AB12-3).
  const parsed = parseOwnCode(val);
  if (parsed) {
    const item = (panel._state.items || []).find(
      (i) => (i.code || "").toUpperCase() === parsed.base
    );
    if (item) {
      panel._openItemModal(item, { highlight: parsed.portion });
      panel._toast(panel.t("foundToast", esc(item.name)));
    } else panel._toast(panel.t("noActiveItemHistoryHint", esc(val)), { type: "bad" });
    return;
  }
  // Public retail barcode: EAN-8/13 or UPC (8–14 digits).
  if (/^\d{8,14}$/.test(val)) { onRetailBarcode(panel, val); return; }
  panel._toast(panel.t("unknownCode", esc(val)), { type: "bad" });
}

export async function onRetailBarcode(panel, code) {
  // Resolve server-side: our own memory first, then OpenFoodFacts (no key).
  panel._toast(panel.t("lookingUpProduct", code));
  let res = null;
  try { res = await panel._call("lookup_barcode", { barcode: code }); }
  catch (e) { /* offline / not ready — fall through */ }
  const src = (res && (res.known || res.product)) || null;

  if (!src || !src.name) {
    panel._openAddModal({ notes: panel.t("retailBarcodeNote", code), barcode: code });
    panel._toast(panel.t("noProductNameFound", code), { type: "bad" });
    return;
  }
  const known = !!(res && res.known);
  panel._openAddModal({
    name: src.name,
    category: src.category || null,
    quantity: src.quantity || "",
    photo: src.photo || "",
    emoji: src.emoji || undefined,
    kind: src.kind || undefined,
    notes: known ? "" : panel.t("retailBarcodeNote", code),
    barcode: code,
  });
  // src.name comes from OpenFoodFacts — remote data must not reach the
  // toast's innerHTML unescaped.
  panel._toast(known ? panel.t("recognizedBefore") : panel.t("productFoundToast", esc(src.name)));
}
