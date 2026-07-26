/* Clean-up mode: bulk-remove expired/soon items. */

import { STATUS_COLOR } from "../strings.js";
import { daysLabel, esc } from "../lib/format.js";

export function openCleanModal(panel) {
  const expired = panel._state.items.filter((i) => i.status === "expired");
  const soon = panel._state.items.filter((i) => i.status === "soon");
  const lang = panel._lang();
  const row = (i, checked) => {
    const lm = panel._locMeta(i.location);
    return `<label class="clean-row">
      <input type="checkbox" data-id="${i.id}" ${checked ? "checked" : ""}>
      <span class="cr-emoji">${i.emoji || "🍽️"}</span>
      <span class="cr-name"><b>${esc(i.name)}</b><small>${lm.emoji || ""} ${esc(lm.label || i.location)} · ${esc(i.code)}</small></span>
      <span class="cr-days" style="--c:${STATUS_COLOR[i.status]}">${daysLabel(i.days_left, lang)}</span>
    </label>`;
  };
  const h = panel._openModal(`
    <div class="modal-head"><div class="m-title"><h3>${panel.t("cleanUpTitle")}</h3></div><button class="icon-btn" id="c-close"><ha-icon icon="mdi:close"></ha-icon></button></div>
    ${expired.length ? `<div class="clean-sec">${panel.t("expiredSection")}</div>${expired.map((i) => row(i, true)).join("")}` : ""}
    ${soon.length ? `<div class="clean-sec">${panel.t("soonSection")}</div>${soon.map((i) => row(i, false)).join("")}` : ""}
    ${!expired.length && !soon.length ? `<div class="empty small"><div class="empty-emoji">✨</div><p>${panel.t("allGoodMessage")}</p></div>` : ""}
    ${(expired.length || soon.length) ? `<div class="modal-actions"><button class="btn danger" id="c-remove">${panel.t("removeSelectedBtn")}</button></div>` : ""}
  `, { wide: true });
  const q = (s) => h.modal.querySelector(s);
  q("#c-close").addEventListener("click", h.close);
  const rm = q("#c-remove");
  const updateBtn = () => {
    const n = h.modal.querySelectorAll("input[data-id]:checked").length;
    if (rm) { rm.textContent = n ? panel.t("removeNItems", n) : panel.t("nothingSelected"); rm.disabled = !n; }
  };
  h.modal.querySelectorAll("input[data-id]").forEach((c) => c.addEventListener("change", updateBtn));
  updateBtn();
  if (rm) rm.addEventListener("click", async () => {
    const ids = [...h.modal.querySelectorAll("input[data-id]:checked")].map((c) => c.dataset.id);
    if (!ids.length) return;
    rm.disabled = true;
    const res = await panel._call("remove_expired", { ids });
    h.close();
    panel._toast(panel.t("cleanedUpToast", res.count));
  });
}
