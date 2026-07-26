/* Sticker print modal with live label preview.
 *
 * Three shapes:
 *  - single item (1 portion): exactly the old behaviour;
 *  - opts.portion: preview + print that one portion's sticker (AB12-3);
 *  - multi-portion item without opts.portion: batch mode — previews the first
 *    open portion and the button prints one sticker per open portion.
 */

import { esc } from "../lib/format.js";
import { openPortions } from "./inspector.js";

export function printSticker(panel, id, itemHint = null, { portion = null } = {}) {
  // itemHint covers the just-added case: the state push may not have
  // landed yet, but the add response already has name/code/portions.
  const item = (panel._state.items || []).find((x) => x.id === id) || itemHint;
  const opts = panel._state.options || {};
  const p = panel._state.printer || {};
  const copies = opts.label_copies || 1;

  const total = (item?.portions || []).length || 1;
  const open = item ? openPortions(item) : [];
  const batch = portion == null && total > 1;
  const batchTargets = batch ? (open.length ? open : (item.portions || []).map((x) => x.n)) : [];
  const previewPortion = portion ?? (batch ? batchTargets[0] : null);
  const codeShown = previewPortion != null && total > 1 ? `${item?.code || ""}-${previewPortion}` : (item?.code || "");

  const note = opts.printer_enabled
    ? panel.t("printerOnNote", esc(p.label || "99014"), esc(p.label_size || "54 × 101 mm"), copies)
    : panel.t("printerOffNote", esc(p.label || "99014"), esc(p.label_size || "54 × 101 mm"));
  const printLabel = batch
    ? panel.t("printAllStickersBtn", batchTargets.length)
    : panel.t("printBtnLabel", copies);

  // Batch mode: which portions are ticked for printing (default: all).
  const selected = new Set(batchTargets);

  const h = panel._openModal(`
    <div class="modal-head">
      <div class="m-title"><div class="m-strong">${panel.t("printStickerModalTitle")}</div>
        <div class="m-sub">${esc(item?.name || "")} · <code>${esc(batch ? item?.code || "" : codeShown)}</code></div>
      </div>
      <button class="icon-btn" id="p-close"><ha-icon icon="mdi:close"></ha-icon></button>
    </div>
    <div class="label-preview${batch ? " multi" : ""}" id="p-preview"><div class="muted">${panel.t("previewLoading")}</div></div>
    <div class="print-note">${note}</div>
    <div class="modal-actions">
      <button class="btn ghost" id="p-cancel">${panel.t("closeBtn")}</button>
      <button class="btn primary" id="p-print">${printLabel}</button>
    </div>
  `, { wide: batch });
  const q = (s) => h.modal.querySelector(s);
  q("#p-close").addEventListener("click", h.close);
  q("#p-cancel").addEventListener("click", h.close);

  let printing = false;
  const syncPrintBtn = () => {
    if (!batch || printing) return;
    const btn = q("#p-print");
    if (!btn) return;
    btn.innerHTML = panel.t("printAllStickersBtn", selected.size);
    btn.disabled = selected.size === 0;
  };

  (async () => {
    const box = q("#p-preview");
    try {
      if (batch) {
        // Every sticker that's about to be printed, in print order. Tapping a
        // sticker toggles it: unticked = 50% opacity and skipped when printing.
        box.innerHTML = batchTargets.map((n) =>
          `<div class="lp-slot" data-slot="${n}" role="checkbox" aria-checked="true">
            <span class="lp-check"><ha-icon icon="mdi:check"></ha-icon></span>
            <div class="muted">${esc(`${item?.code || ""}-${n}`)}</div>
          </div>`
        ).join("");
        box.querySelectorAll(".lp-slot").forEach((slot) =>
          slot.addEventListener("click", () => {
            if (printing) return;
            const n = Number(slot.dataset.slot);
            if (selected.has(n)) selected.delete(n); else selected.add(n);
            slot.classList.toggle("off", !selected.has(n));
            slot.setAttribute("aria-checked", String(selected.has(n)));
            syncPrintBtn();
          }));
        for (const n of batchTargets) {
          if (!box.isConnected) return; // modal closed mid-render
          const r = await panel._call("render_label", { item_id: id, portion: n });
          const slot = box.querySelector(`[data-slot="${n}"]`);
          if (slot) slot.insertAdjacentHTML("beforeend",
            `<img alt="Label ${esc(`${item?.code || ""}-${n}`)}" src="data:image/png;base64,${r.png_base64}">`);
          const ph = slot && slot.querySelector(".muted");
          if (ph) ph.remove();
        }
        return;
      }
      const payload = { item_id: id };
      if (previewPortion != null) payload.portion = previewPortion;
      const r = await panel._call("render_label", payload);
      box.innerHTML = `<img alt="Label ${esc(codeShown)}" src="data:image/png;base64,${r.png_base64}">`;
    } catch (e) {
      box.innerHTML = `<div class="muted">${esc(panel.t("previewUnavailable", e.message || e))}</div>`;
    }
  })();

  const reasonText = (res) => {
    const map = {
      printer_disabled: panel.t("printerDisabledReason"),
      printer_unreachable: panel.t("printerUnreachableReason"),
      printer_not_connected: panel.t("printerNotConnectedReason"),
      render_failed: panel.t("renderFailedReason"),
    };
    return map[res.reason] || panel.t("genericPrintFailed", res.reason);
  };

  q("#p-print").addEventListener("click", async () => {
    const btn = q("#p-print");
    printing = true;
    btn.disabled = true; btn.textContent = panel.t("workingLabel");
    try {
      if (batch) {
        // Only the ticked stickers, sequentially so CUPS gets them in order.
        const targets = batchTargets.filter((n) => selected.has(n));
        for (let i = 0; i < targets.length; i++) {
          btn.textContent = panel.t("printingProgress", i + 1, targets.length);
          const res = await panel._call("print_sticker", { item_id: id, portion: targets[i] });
          if (!res.printed) {
            panel._toast("🖨️ " + reasonText(res), { type: "bad" });
            printing = false; btn.disabled = false; syncPrintBtn();
            return;
          }
        }
        panel._toast(panel.t("printedStickersToast", targets.length, item?.code || ""));
        h.close();
        return;
      }
      const payload = { item_id: id };
      if (portion != null) payload.portion = portion;
      const res = await panel._call("print_sticker", payload);
      if (res.printed) {
        panel._toast(panel.t("stickerPrintedToast", codeShown || res.code, res.copies || 1));
        h.close();
        return;
      }
      panel._toast("🖨️ " + reasonText(res), { type: "bad" });
      printing = false; btn.disabled = false; btn.innerHTML = printLabel; syncPrintBtn();
    } catch (e) {
      panel._toast(panel.t("printFailedError", e.message || e), { type: "bad" });
      printing = false; btn.disabled = false; btn.innerHTML = printLabel; syncPrintBtn();
    }
  });
}
