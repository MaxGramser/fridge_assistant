/* Paged history (newest first) + restore. Drawer on desktop. */

import { MONTHS } from "../strings.js";
import { esc } from "../lib/format.js";
import { openSurface } from "../lib/surface.js";

export function relTime(panel, ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return "";
  const lang = panel._lang();
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return panel.t("justNow");
  const m = Math.floor(s / 60);
  if (m < 60) return panel.t("minutesAgo", m);
  const hh = Math.floor(m / 60);
  if (hh < 24) return panel.t("hoursAgo", hh);
  const dd = Math.floor(hh / 24);
  if (dd === 1) return panel.t("yesterday");
  if (dd < 7) return panel.t("daysAgo", dd);
  return `${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`;
}

export function historyRow(panel, e) {
  const it = e.item || {};
  const lm = panel._locMeta(it.location);
  // Portion events: one portion of a still-live item was consumed. Same
  // eaten/tossed colours, plus which portion and its sub-code.
  const isPortion = e.action === "portion_eaten" || e.action === "portion_tossed";
  const eaten = e.action === "eaten" || e.action === "portion_eaten";
  const code = it.code ? (isPortion && e.portion ? `${it.code}-${e.portion}` : it.code) : "";
  const act = `<span class="hi-act ${eaten ? "eaten" : "tossed"}">${eaten ? panel.t("eatenBtn") : panel.t("tossedBtn")}</span>`;
  const portionTag = isPortion
    ? ` · ${esc(panel.t("histPortionLabel", e.portion, e.portions_total))}`
    : "";
  const who = e.by_name
    ? `<span class="who">${panel._avatar(e.by_name, e.by_picture, 18)}${esc(e.by_name)}</span>`
    : `<span class="muted">—</span>`;
  return `<div class="hi-row">
    <span class="hi-emoji">${it.emoji || "🍽️"}</span>
    <div class="hi-main">
      <div class="hi-title">${esc(it.name || "?")} ${code ? `<span class="code">${esc(code)}</span>` : ""}</div>
      <div class="hi-sub2">${act}${portionTag}${it.location ? ` · ${lm.emoji || ""} ${esc(lm.label || it.location)}` : ""}</div>
    </div>
    <div class="hi-right">${who}<div class="hi-time">${esc(relTime(panel, e.ts))}</div>
      <div class="hi-btns">
        <button class="hi-undo" data-restore="${esc(e.id)}" title="${panel.t("restoreToFridgeTitle")}">${panel.t("backBtn")}</button>
        <button class="hi-undo hi-del" data-delevent="${esc(e.id)}" title="${panel.t("deleteEventTitle")}"><ha-icon icon="mdi:delete-forever-outline"></ha-icon></button>
      </div>
    </div>
  </div>`;
}

export function openHistory(panel) {
  const h = openSurface(panel, `
    <div class="modal-head">
      <div class="m-title"><h3>${panel.t("historyHeading")}</h3><div class="s-sub" id="hi-sub"></div></div>
      <button class="icon-btn" id="hi-close" aria-label="${panel.t("closeBtn")}"><ha-icon icon="mdi:close"></ha-icon></button>
    </div>
    <div class="tp-list" id="hi-list"><div class="loading">${panel.t("loading")}</div></div>
    <div class="modal-actions" id="hi-more-wrap" style="display:none">
      <button class="btn ghost" id="hi-more">${panel.t("loadMoreBtn")}</button>
    </div>
  `, { prefer: "drawer", wide: true });
  const q = (s) => h.modal.querySelector(s);
  q("#hi-close").addEventListener("click", h.close);
  const PAGE = 25;
  let offset = 0, total = 0;
  const loaded = [];
  const listEl = q("#hi-list");
  const load = async () => {
    const more = q("#hi-more");
    if (more) more.disabled = true;
    let res;
    try { res = await panel._call("history", { limit: PAGE, offset }); }
    catch (e) { listEl.innerHTML = `<div class="empty small"><p>${panel.t("historyLoadFailed")}</p></div>`; return; }
    total = res.total;
    loaded.push(...(res.events || []));
    offset += (res.events || []).length;
    if (!loaded.length) {
      listEl.innerHTML = `<div class="empty small"><div class="empty-emoji">📭</div><p>${panel.t("historyEmpty")}</p></div>`;
    } else {
      listEl.innerHTML = loaded.map((e) => historyRow(panel, e)).join("");
      // Restore and delete both remove the row locally; drop is shared.
      const dropRow = (id, btn) => {
        const idx = loaded.findIndex((x) => x.id === id);
        if (idx >= 0) loaded.splice(idx, 1);
        total = Math.max(0, total - 1);
        offset = Math.max(0, offset - 1);
        const row = btn.closest(".hi-row"); if (row) row.remove();
        q("#hi-sub").textContent = total ? panel.t("historySummary", total) : "";
      };
      listEl.querySelectorAll("[data-restore]").forEach((b) =>
        b.addEventListener("click", async () => {
          const id = b.dataset.restore;
          b.disabled = true;
          try { await panel._call("restore_item", { event_id: id }); }
          catch (e) { b.disabled = false; panel._toast(panel.t("restoreFailedToast"), { type: "bad" }); return; }
          dropRow(id, b);
          panel._toast(panel.t("restoredToFridgeToast"));
        }));
      // Permanent delete is irreversible, so it takes two taps: the button
      // flips to "Zeker?" and only a second tap within 3s actually deletes.
      listEl.querySelectorAll("[data-delevent]").forEach((b) =>
        b.addEventListener("click", async () => {
          if (!b.classList.contains("confirm")) {
            b.classList.add("confirm");
            b.textContent = panel.t("confirmDeleteLabel");
            setTimeout(() => {
              if (!b.isConnected) return;
              b.classList.remove("confirm");
              b.innerHTML = '<ha-icon icon="mdi:delete-forever-outline"></ha-icon>';
            }, 3000);
            return;
          }
          const id = b.dataset.delevent;
          b.disabled = true;
          try { await panel._call("delete_history_event", { event_id: id }); }
          catch (e) { b.disabled = false; panel._toast(panel.t("deleteFailedToast"), { type: "bad" }); return; }
          dropRow(id, b);
          panel._toast(panel.t("eventDeletedToast"));
        }));
    }
    q("#hi-sub").textContent = total ? panel.t("historySummary", total) : "";
    const wrap = q("#hi-more-wrap");
    if (offset < total) { wrap.style.display = ""; if (more) more.disabled = false; }
    else wrap.style.display = "none";
  };
  q("#hi-more").addEventListener("click", load);
  load();
}
