/* Item inspector: drawer on desktop (list stays visible; selecting another
 * item swaps the content), bottom sheet on mobile. Shows the portions of a
 * batch with per-portion eat/toss/print/undo, plus the item details. */

import { STATUS_COLOR } from "../strings.js";
import { daysLabel, esc, fmtDate } from "../lib/format.js";
import { openSurface } from "../lib/surface.js";
import { relTime } from "./history.js";

function portionsOf(item) {
  const list = Array.isArray(item.portions) && item.portions.length
    ? item.portions
    : [{ n: 1, status: "open" }];
  return [...list].sort((a, b) => (a.n || 0) - (b.n || 0));
}

export function openPortions(item) {
  return portionsOf(item).filter((p) => p.status === "open").map((p) => p.n);
}

export function openInspector(panel, item, { highlight = null } = {}) {
  const itemId = item.id;
  const clearSelection = () => {
    if (panel._inspectorItemId === itemId) {
      panel._inspectorItemId = null;
      panel._renderList();
    }
  };
  const h = openSurface(panel, "", { prefer: "drawer", onClose: clearSelection });
  panel._inspectorItemId = itemId;
  panel._renderList();
  const close = () => h.close();

  const render = () => {
    const i = (panel._state.items || []).find((x) => x.id === itemId);
    if (!i) { close(); return; }
    const lm = panel._locMeta(i.location);
    const col = STATUS_COLOR[i.status];
    const lang = panel._lang();
    const portions = portionsOf(i);
    const total = portions.length;
    const open = portions.filter((p) => p.status === "open").length;
    const consumed = total - open;

    const portionRow = (p) => {
      const isOpen = p.status === "open";
      const code = total > 1 ? `${i.code}-${p.n}` : i.code;
      const hl = highlight != null && p.n === highlight ? " hl" : "";
      let status;
      if (isOpen) {
        status = `<span class="po-status">${panel.t("portionOpenLabel")}</span>`;
      } else {
        const icon = p.status === "eaten" ? "mdi:silverware-fork-knife" : "mdi:delete-outline";
        const who = p.by_name ? `${esc(p.by_name)} · ` : "";
        status = `<span class="po-status"><ha-icon icon="${icon}"></ha-icon>${who}${esc(relTime(panel, p.ts))}</span>`;
      }
      const actions = isOpen
        ? `<span class="po-act">
            <button class="icon-btn" data-eat="${p.n}" title="${panel.t("eatPortionTitle")}"><ha-icon icon="mdi:silverware-fork-knife"></ha-icon></button>
            <button class="icon-btn" data-toss="${p.n}" title="${panel.t("tossPortionTitle")}"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
            <button class="icon-btn" data-pprint="${p.n}" title="${panel.t("printPortionTitle")}"><ha-icon icon="mdi:tag-outline"></ha-icon></button>
          </span>`
        : (p.event_id
          ? `<button class="po-undo" data-undo="${esc(p.event_id)}" title="${panel.t("undoPortionTitle")}">${panel.t("backBtn")}</button>`
          : "");
      return `<div class="po-row${isOpen ? "" : ` done ${p.status}`}${hl}">
        <span class="code">${esc(code)}</span>${status}${actions}
      </div>`;
    };

    h.modal.innerHTML = `
      <div class="detail-head" style="--c:${col}">
        <div class="d-emoji">${i.emoji || "🍽️"}</div>
        <div class="d-title"><h2>${esc(i.name)}</h2><div class="d-code">${esc(i.code)}${total > 1 ? ` · <span class="pbadge" title="${esc(panel.t("pbadgeTitle", open, total))}">${open}/${total}</span>` : ""}</div></div>
        <button class="icon-btn" id="d-close" aria-label="${panel.t("closeBtn")}"><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="d-status" style="--c:${col}">${daysLabel(i.days_left, lang)}${i.expiry_date ? " · " + fmtDate(i.expiry_date, lang) : ""}</div>
      <div class="po-sec">
        <div class="po-head">
          <span>${panel.t("portionsLabel")}</span>
          <span class="pstep">
            <button type="button" class="ps-btn" id="po-minus" ${total <= Math.max(consumed, 1) ? "disabled" : ""}><ha-icon icon="mdi:minus"></ha-icon></button>
            <b class="ps-n">${total}</b>
            <button type="button" class="ps-btn" id="po-plus" ${total >= 24 ? "disabled" : ""}><ha-icon icon="mdi:plus"></ha-icon></button>
          </span>
        </div>
        <small class="ps-note">${panel.t("portionsStepperNote")}</small>
        ${total > 1 ? `<div class="po-rows">${portions.map(portionRow).join("")}</div>` : ""}
      </div>
      <div class="d-rows">
        <div class="d-row"><span>${panel.t("locationLabel")}</span><b>${lm.emoji || ""} ${esc(lm.label || i.location)}</b></div>
        ${i.added_by_name ? `<div class="d-row"><span>${panel.t("addedByLabel")}</span><b class="who">${panel._avatar(i.added_by_name, i.added_by_picture, 24)} ${esc(i.added_by_name)}</b></div>` : ""}
        ${i.contents && i.contents !== i.name ? `<div class="d-row"><span>${panel.t("contentsLabel")}</span><b>${esc(i.contents)}</b></div>` : ""}
        <div class="d-row"><span>${panel.t("dateInDetailLabel")}</span><b>${fmtDate(i.added_date, lang)}${i.age_days != null ? ` · ${esc(panel.t("daysAgoShort", i.age_days))}` : ""}</b></div>
        <div class="d-row"><span>${panel.t("expiryLabel")}</span><b>${i.expiry_date ? fmtDate(i.expiry_date, lang) : "—"}</b></div>
        ${i.quantity ? `<div class="d-row"><span>${panel.t("quantityLabel")}</span><b>${esc(i.quantity)}</b></div>` : ""}
        ${i.notes ? `<div class="d-row"><span>${panel.t("notesLabel")}</span><b>${esc(i.notes)}</b></div>` : ""}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="d-print">${total > 1 ? panel.t("printAllStickersBtn", open || total) : panel.t("stickerBtn")}</button>
        <button class="btn ghost" id="d-edit">${panel.t("editBtn")}</button>
      </div>
      <div class="modal-actions done-row">
        <button class="btn good" id="d-eaten">${panel.t("eatenBtn")}</button>
        <button class="btn tossed" id="d-tossed">${panel.t("tossedBtn")}</button>
      </div>
    `;

    const q = (s) => h.modal.querySelector(s);
    q("#d-close").addEventListener("click", close);
    q("#d-print").addEventListener("click", () => panel._printSticker(i.id, i));
    q("#d-edit").addEventListener("click", () => { close(); panel._openAddModal({}, i); });
    q("#d-eaten").addEventListener("click", () => completeItem(panel, i, "eaten", close));
    q("#d-tossed").addEventListener("click", () => completeItem(panel, i, "tossed", close));

    const stepTo = async (t) => {
      try {
        const res = await panel._call("set_portions", { item_id: itemId, total: t });
        if (res.completed) {
          close();
          const ev = res.completion_event;
          panel._toast(
            panel.t("completedToast", ev?.action === "tossed" ? "🗑️" : "🍽️", esc(i.name), ev?.action !== "tossed"),
            ev ? { actionLabel: panel.t("undoLabel"), onAction: () => panel._call("restore_item", { event_id: ev.id }).catch(() => {}) } : {}
          );
        } else if (t > total && res.item) {
          // A fresh portion needs a fresh sticker — offer it right away
          // instead of hoping someone finds the row's print button.
          const newN = Math.max(...res.item.portions.map((p) => p.n || 0));
          panel._toast(panel.t("portionAddedToast", newN), {
            actionLabel: panel.t("printActionLabel"),
            onAction: () => panel._printSticker(itemId, res.item, { portion: newN }),
          });
        }
      } catch (e) {
        panel._toast(panel.t("errorPrefix") + (e.message || e), { type: "bad" });
      }
    };
    const minus = q("#po-minus"), plus = q("#po-plus");
    if (minus) minus.addEventListener("click", () => stepTo(total - 1));
    if (plus) plus.addEventListener("click", () => stepTo(total + 1));

    h.modal.querySelectorAll("[data-eat]").forEach((b) =>
      b.addEventListener("click", () => consumePortion(panel, i, Number(b.dataset.eat), "eaten", close)));
    h.modal.querySelectorAll("[data-toss]").forEach((b) =>
      b.addEventListener("click", () => consumePortion(panel, i, Number(b.dataset.toss), "tossed", close)));
    h.modal.querySelectorAll("[data-pprint]").forEach((b) =>
      b.addEventListener("click", () => panel._printSticker(i.id, i, { portion: Number(b.dataset.pprint) })));
    h.modal.querySelectorAll("[data-undo]").forEach((b) =>
      b.addEventListener("click", async () => {
        b.disabled = true;
        try { await panel._call("restore_item", { event_id: b.dataset.undo }); }
        catch (e) { b.disabled = false; panel._toast(panel.t("restoreFailedToast"), { type: "bad" }); }
      }));

    const hlRow = h.modal.querySelector(".po-row.hl");
    if (hlRow) hlRow.scrollIntoView({ block: "center" });
    highlight = null; // only pulse once; state refreshes drop it
  };

  // Re-render on every state push while this surface is on screen; when the
  // sheet was dismissed some other way, self-clean the hook + selection.
  panel._refreshSurface = () => {
    if (!h.modal.isConnected) {
      panel._refreshSurface = null;
      clearSelection();
      return;
    }
    render();
  };
  render();
}

async function consumePortion(panel, item, n, action, closeSurface) {
  const total = portionsOf(item).length;
  let res;
  try {
    res = await panel._call("consume_portion", { item_id: item.id, portion: n, action });
  } catch (e) {
    panel._toast(panel.t("errorPrefix") + (e.message || e), { type: "bad" });
    return;
  }
  const ev = res.event;
  const undo = ev
    ? { actionLabel: panel.t("undoLabel"), onAction: () => panel._call("restore_item", { event_id: ev.id }).catch(() => {}) }
    : {};
  if (res.completed) {
    closeSurface && closeSurface();
    panel._toast(
      panel.t("completedToast", ev?.action === "tossed" ? "🗑️" : "🍽️", esc(item.name), ev?.action !== "tossed"),
      undo
    );
  } else {
    panel._toast(
      panel.t(action === "tossed" ? "portionTossedToast" : "portionEatenToast",
        esc(item.name), n, total, res.remaining),
      undo
    );
  }
}

export async function completeItem(panel, item, action, close) {
  let ev = null;
  try {
    const res = await panel._call("complete_item", { item_id: item.id, action });
    ev = res && res.event;
  } catch (e) {
    panel._toast(panel.t("errorPrefix") + (e.message || e), { type: "bad" });
    return;
  }
  close && close();
  const eaten = action === "eaten";
  panel._toast(
    panel.t("completedToast", eaten ? "🍽️" : "🗑️", esc(item.name), eaten),
    ev ? { actionLabel: panel.t("undoLabel"), onAction: () => panel._call("restore_item", { event_id: ev.id }).catch(() => {}) } : {}
  );
}
