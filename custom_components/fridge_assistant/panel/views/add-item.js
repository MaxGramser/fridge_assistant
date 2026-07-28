/* Add/edit modal + AI shelf-life estimate. */

import { addDays, daysBetween, daysLabel, debounce, esc, todayISO } from "../lib/format.js";

export function openAddModal(panel, prefill = {}, editItem = null) {
  const isEdit = !!editItem;
  const m = {
    location: prefill.location || editItem?.location || "fridge",
    added: prefill.added_date || editItem?.added_date || todayISO(),
    expiry: prefill.expiry_date || editItem?.expiry_date || "",
    expiryManual: isEdit ? editItem?.expiry_source === "manual" : false,
    emoji: prefill.emoji || editItem?.emoji || "🍽️",
    template_id: prefill.template_id || editItem?.template_id || null,
    category: prefill.category || editItem?.category || null,
    kind: editItem?.kind || prefill.kind || "ingredient",
    kindManual: isEdit,
    portions: 1,
    aiResult: null,
  };
  const locs = panel._state.locations;
  const kinds = panel._state.kinds || { ingredient: {}, dish: {} };
  const nameVal = editItem ? editItem.name : (prefill.name || "");

  const h = panel._openModal(`
    <div class="modal-head">
      <div class="m-emoji" id="m-emoji">${esc(m.emoji)}</div>
      <div class="m-title">
        <input class="m-name" id="f-name" placeholder="${panel.t("addNamePlaceholder")}" value="${esc(nameVal)}">
      </div>
      <button class="icon-btn" id="m-close" aria-label="${panel.t("closeBtn")}"><ha-icon icon="mdi:close"></ha-icon></button>
    </div>
    <div class="suggest" id="f-suggest"></div>
    <div class="seg" id="f-loc">
      ${locs.map((l) => { const lm = panel._locMeta(l); return `<button data-loc="${l}" class="${m.location === l ? "on" : ""}">${lm.emoji} ${lm.label}</button>`; }).join("")}
    </div>
    <div class="seg" id="f-kind">
      ${Object.keys(kinds).map((k) => { const km = panel._kindMeta(k); return `<button type="button" data-kind="${k}" class="${m.kind === k ? "on" : ""}">${km.emoji || ""} ${km.short}</button>`; }).join("")}
    </div>
    ${!isEdit ? `<label class="field"><span>${panel.t("portionsLabel")}</span>
      <div class="pstep-row">
        <span class="pstep">
          <button type="button" class="ps-btn" id="ps-minus" disabled><ha-icon icon="mdi:minus"></ha-icon></button>
          <b class="ps-n" id="ps-n">1</b>
          <button type="button" class="ps-btn" id="ps-plus"><ha-icon icon="mdi:plus"></ha-icon></button>
        </span>
        <small class="ps-note">${panel.t("portionsFieldNote")}</small>
      </div>
    </label>` : ""}
    <div class="grid2">
      <label class="field"><span>${panel.t("dateInFieldLabel")}</span><div class="datefield"><input type="date" id="f-added" value="${m.added}"><span class="df-display"></span></div></label>
      <label class="field"><span>${panel.t("expiryLabel")}</span><div class="datefield"><input type="date" id="f-expiry" value="${m.expiry}"><span class="df-display"></span><button type="button" class="df-clear" title="${panel.t("clearDateTitle")}" aria-label="${panel.t("clearDateTitle")}"><ha-icon icon="mdi:close"></ha-icon></button></div></label>
    </div>
    <div class="expiry-hint" id="f-hint"></div>
    <button class="link" id="f-adv">${panel.t("moreOptions")}</button>
    <div class="adv hidden" id="f-advbox">
      <label class="field"><span>${panel.t("displayNameLabel")}</span><input id="f-dispname" placeholder="${panel.t("displayNamePlaceholder")}" value="${esc(editItem?.name || "")}"></label>
      <div class="grid2">
        <label class="field"><span>${panel.t("quantityLabel")}</span><input id="f-qty" placeholder="${panel.t("quantityPlaceholder")}" value="${esc(editItem?.quantity ?? prefill.quantity ?? "")}"></label>
        <label class="field"><span>${panel.t("emojiLabel")}</span><input id="f-emojiin" maxlength="4" value="${esc(m.emoji)}"></label>
      </div>
      <label class="field"><span>${panel.t("notesLabel")}</span><input id="f-notes" placeholder="${panel.t("notesLabel")}" value="${esc(editItem?.notes ?? prefill.notes ?? "")}"></label>
      <label class="field"><span>${panel.t("photoUrlLabel")}</span><input id="f-photo" placeholder="${panel.t("photoUrlPlaceholder")}" value="${esc(editItem?.photo ?? prefill.photo ?? "")}"></label>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" id="f-template">${panel.t("chooseTemplateBtn")}</button>
      <button class="btn primary" id="f-submit">${isEdit ? panel.t("saveBtn") : panel.t("addBtn")}</button>
    </div>
  `, { wide: false });

  const q = (s) => h.modal.querySelector(s);
  const nameEl = q("#f-name"), addedEl = q("#f-added"), expEl = q("#f-expiry");
  const emojiEl = q("#m-emoji"), suggestEl = q("#f-suggest"), hintEl = q("#f-hint");
  const lang = panel._lang();

  const setEmoji = (e) => { m.emoji = e; emojiEl.textContent = e; if (q("#f-emojiin")) q("#f-emojiin").value = e; };
  const setKind = (k) => {
    if (!k) return;
    m.kind = k;
    const ke = q("#f-kind");
    if (ke) ke.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.kind === k));
  };
  const updateHint = () => {
    const val = expEl.value;
    if (!val) { hintEl.textContent = ""; return; }
    const dl = daysBetween(todayISO(), val);
    const col = dl < 0 ? "var(--fa-red)" : dl <= (panel._state.options.warn_days || 3) ? "var(--fa-orange)" : "var(--fa-green)";
    hintEl.innerHTML = `<span style="color:${col}">● ${daysLabel(dl, lang)}</span>`;
  };
  updateHint();
  panel._wireDateField(addedEl, panel.t("datePickPlaceholder"), lang);
  panel._wireDateField(expEl, panel.t("dateOptionalPlaceholder"), lang);

  const applySuggestion = (expiryDate, source) => {
    if (!m.expiryManual && expiryDate) { expEl.value = expiryDate; m.expiry = expiryDate; }
    m.expirySource = source;
    updateHint();
  };

  const aiCtx = () => ({ m, q, setEmoji, setKind, applySuggestion, suggestEl });
  const wireActions = (query) => {
    const a = q("#s-ai");
    if (a) a.addEventListener("click", () => aiEstimate(panel, query, aiCtx()));
    const o = q("#s-other");
    if (o) o.addEventListener("click", () =>
      panel._openTemplatePicker((t) => { m.noAutoMatch = false; nameEl.value = t.name; doMatch(); }));
  };

  // Shown when nothing matched, or after the user rejected a wrong guess.
  const showManual = (query, heading) => {
    m.template_id = null; m.category = null;
    suggestEl.className = "suggest";
    const aiBtn = panel._state.options.ai_enabled
      ? `<button class="s-mini ai" id="s-ai">${panel.t("aiEstimateMini")}</button>` : "";
    suggestEl.innerHTML = `
      <div class="s-body"><b>${heading || panel.t("unknownProduct")}</b>
        <div class="s-sub">${esc(panel.t("noTemplateFor", query, panel._state.options.ai_enabled))}</div></div>
      <div class="s-actions">${aiBtn}<button class="s-mini" id="s-other" title="${panel.t("chooseTemplateTitle")}"><ha-icon icon="mdi:book-multiple"></ha-icon></button></div>`;
    wireActions(query);
  };

  let lastMatched = null;
  const matchNow = async () => {
    const query = nameEl.value.trim();
    if (m.noAutoMatch) return;
    if (query.length < 2) { suggestEl.innerHTML = ""; suggestEl.className = "suggest"; return; }
    lastMatched = query;
    let res;
    try { res = await panel._call("match_template", { query, location: m.location, added_date: addedEl.value }); }
    catch (e) { return; }
    if (m.noAutoMatch) return; // rejected while the request was in flight
    // Out-of-order responses: an older, slower reply must never overwrite
    // the match for what's in the field NOW ("kip" landing after "kipfilet").
    if (nameEl.value.trim() !== query) return;
    if (res.template) {
      const t = res.template;
      m.template_id = t.id; m.category = t.category; setEmoji(t.emoji || "🍽️");
      if (!m.kindManual) setKind(panel._kindOf(t));
      const sl = t.shelf_life || {};
      const noHere = sl[m.location] === null || sl[m.location] === undefined;
      applySuggestion(res.suggestion?.expiry_date, "template");
      suggestEl.className = "suggest ok";
      suggestEl.innerHTML = `
        <button type="button" class="s-take" id="s-take" title="${panel.t("useTemplateNameTitle")}">
          <span class="s-emoji">${t.emoji || "📋"}</span>
          <div class="s-body"><b>${esc(t.name)}</b>
            <div class="s-sub">${noHere ? panel.t("notSuitableHere") : panel.t("daysAtLocation", panel._locMeta(m.location).label, sl[m.location])}${t.notes ? " · " + esc(t.notes) : ""}</div></div>
        </button>
        <div class="s-actions">
          ${panel._state.options.ai_enabled ? `<button class="s-mini" id="s-ai" title="${panel.t("aiEstimateTitle")}"><ha-icon icon="mdi:creation"></ha-icon></button>` : ""}
          <button class="s-mini" id="s-other" title="${panel.t("otherTemplateTitle")}"><ha-icon icon="mdi:book-multiple"></ha-icon></button>
          <button class="s-mini ghost" id="s-dismiss" title="${panel.t("notThisManualTitle")}"><ha-icon icon="mdi:close"></ha-icon></button>
        </div>`;
      wireActions(query);
      // Tap the recognised template to adopt its (full) name — handy when
      // the match appeared while the user was still halfway through typing.
      q("#s-take").addEventListener("click", () => {
        nameEl.value = t.name;
        lastMatched = t.name;
        nameEl.focus();
        nameEl.setSelectionRange(t.name.length, t.name.length);
      });
      const d = q("#s-dismiss");
      if (d) d.addEventListener("click", () => {
        m.noAutoMatch = true; m.expiryManual = false; m.expirySource = "manual";
        setEmoji("🍽️"); expEl.value = ""; m.expiry = ""; updateHint();
        showManual(query, panel.t("manualEntry"));
      });
    } else {
      showManual(query);
    }
  };
  const doMatch = debounce(matchNow, 350);

  nameEl.addEventListener("input", doMatch);
  // Enter = add straight away, but let a fresh match land first so the
  // template's expiry date still comes along.
  nameEl.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!nameEl.value.trim()) return;
    if (!m.noAutoMatch && nameEl.value.trim() !== lastMatched) await matchNow();
    q("#f-submit").click();
  });
  q("#m-close").addEventListener("click", h.close);
  q("#f-loc").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      m.location = b.dataset.loc;
      q("#f-loc").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      if (m.aiResult) {
        const days = m.aiResult.shelf_life[m.location];
        applySuggestion(days ? addDays(addedEl.value, days) : null, "ai");
      } else doMatch();
    })
  );
  q("#f-kind").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { m.kindManual = true; setKind(b.dataset.kind); }));
  const psMinus = q("#ps-minus"), psPlus = q("#ps-plus"), psN = q("#ps-n");
  const setPortions = (n) => {
    m.portions = Math.max(1, Math.min(24, n));
    if (psN) psN.textContent = m.portions;
    if (psMinus) psMinus.disabled = m.portions <= 1;
    if (psPlus) psPlus.disabled = m.portions >= 24;
  };
  if (psMinus) psMinus.addEventListener("click", () => setPortions(m.portions - 1));
  if (psPlus) psPlus.addEventListener("click", () => setPortions(m.portions + 1));
  addedEl.addEventListener("change", () => { if (!m.expiryManual) doMatch(); });
  expEl.addEventListener("input", () => { m.expiryManual = true; m.expiry = expEl.value; updateHint(); });
  q("#f-adv").addEventListener("click", () => {
    const box = q("#f-advbox"); box.classList.toggle("hidden");
    q("#f-adv").textContent = box.classList.contains("hidden") ? panel.t("moreOptions") : panel.t("lessOptions");
  });
  if (q("#f-emojiin")) q("#f-emojiin").addEventListener("input", (e) => setEmoji(e.target.value || "🍽️"));
  q("#f-template").addEventListener("click", () =>
    panel._openTemplatePicker((t) => { nameEl.value = t.name; doMatch(); })
  );

  q("#f-submit").addEventListener("click", async () => {
    const dispName = (q("#f-dispname")?.value || "").trim();
    const payload = {
      name: dispName || nameEl.value.trim(),
      contents: nameEl.value.trim(),
      location: m.location,
      added_date: addedEl.value || todayISO(),
      expiry_date: expEl.value || null,
      expiry_source: m.expiryManual ? "manual" : (m.expirySource || (expEl.value ? "manual" : "none")),
      emoji: m.emoji,
      category: m.category,
      kind: m.kind,
      template_id: m.template_id,
      quantity: (q("#f-qty")?.value || "").trim() || null,
      notes: (q("#f-notes")?.value || "").trim() || null,
      photo: (q("#f-photo")?.value || "").trim() || null,
      barcode: (editItem?.barcode ?? prefill.barcode) || null,
    };
    if (!isEdit) payload.portions = m.portions;
    if (!payload.contents) { nameEl.focus(); return; }
    q("#f-submit").disabled = true;
    try {
      if (isEdit) {
        await panel._call("update_item", { item_id: editItem.id, changes: payload });
        h.close();
        panel._toast(panel.t("savedToast"));
      } else {
        // Save AI result as a template if the user opted in.
        const saveTpl = h.modal.querySelector("#s-savetpl");
        if (m.aiResult && (!saveTpl || saveTpl.checked)) {
          await panel._call("add_template", {
            template: {
              name: nameEl.value.trim(),
              category: m.aiResult.category,
              kind: m.kind || m.aiResult.kind,
              emoji: m.aiResult.emoji,
              icon: m.aiResult.icon,
              shelf_life: m.aiResult.shelf_life,
              notes: m.aiResult.notes,
              source: "ai",
            },
          }).catch(() => {});
        }
        const res = await panel._call("add_item", { item: payload });
        h.close();
        const code = res?.item?.code;
        if (panel._state.options.printer_enabled && res?.item) {
          // Label printing is on -> jump straight into the print flow, so
          // nobody has to hunt the fresh item down in the list.
          panel._toast(panel.t("addedToast", code));
          panel._printSticker(res.item.id, res.item);
        } else {
          panel._toast(panel.t("addedToast", code), {
            actionLabel: panel.t("printActionLabel"), onAction: () => panel._printSticker(res.item.id),
          });
        }
      }
    } catch (e) {
      q("#f-submit").disabled = false;
      panel._toast(panel.t("errorPrefix") + (e.message || e), { type: "bad" });
    }
  });

  // A scanned product prefills advanced fields — open the box so they show.
  if (!isEdit && (prefill.quantity || prefill.notes || prefill.photo)) {
    q("#f-advbox").classList.remove("hidden");
    q("#f-adv").textContent = panel.t("lessOptions");
  }

  setTimeout(() => nameEl.focus(), 60);
  if (nameVal) doMatch();
}

export async function aiEstimate(panel, name, ctx) {
  const { m, setEmoji, setKind, suggestEl } = ctx;
  const lang = panel._lang();
  suggestEl.className = "suggest";
  suggestEl.innerHTML = `<div class="s-body"><b>${panel.t("aiThinking")}</b><div class="s-sub">${esc(panel.t("estimatingFor", name))}</div></div><div class="spinner"></div>`;
  let res;
  try { res = await panel._call("estimate", { name }); }
  catch (e) {
    suggestEl.className = "suggest bad";
    suggestEl.innerHTML = `<div class="s-body"><b>${panel.t("aiFailed")}</b><div class="s-sub">${esc(e.message || e)}</div></div>`;
    return;
  }
  const est = res.estimate;
  m.aiResult = est; m.category = est.category; m.expirySource = "ai"; setEmoji(est.emoji || "✨");
  if (!m.kindManual && setKind) setKind(est.kind);
  const addedEl = ctx.addedEl || suggestEl.parentNode.querySelector("#f-added");
  const expEl = ctx.expEl || suggestEl.parentNode.querySelector("#f-expiry");
  const hintEl = suggestEl.parentNode.querySelector("#f-hint");
  const warn = panel._state.options.warn_days || 3;

  // Recompute the expiry date + hint from the (possibly edited) AI days.
  const recompute = () => {
    const days = m.aiResult.shelf_life[m.location];
    if (!m.expiryManual) {
      expEl.value = days ? addDays(addedEl.value, days) : "";
      m.expiry = expEl.value;
    }
    if (hintEl) {
      if (expEl.value) {
        const dl = daysBetween(todayISO(), expEl.value);
        const col = dl < 0 ? "var(--fa-red)" : dl <= warn ? "var(--fa-orange)" : "var(--fa-green)";
        hintEl.innerHTML = `<span style="color:${col}">● ${daysLabel(dl, lang)}</span>`;
      } else hintEl.innerHTML = "";
    }
  };

  const cell = (loc) => {
    const d = est.shelf_life[loc];
    const lm = panel._locMeta(loc);
    return `<div class="ai-loc ${loc === m.location ? "active" : ""}" data-loccell="${loc}">
      <span class="ai-loc-emoji">${lm.emoji}</span>
      <span class="ai-days-wrap"><input class="ai-days" type="number" inputmode="numeric" min="0" max="3650" step="1" data-loc="${loc}" value="${d ?? ""}" placeholder="—"><i>${panel.t("dayUnitShort")}</i></span>
      <small>${lm.label}</small>
    </div>`;
  };

  suggestEl.className = "suggest ai";
  suggestEl.innerHTML = `
    <div class="ai-head"><span class="s-emoji">${est.emoji || "✨"}</span><b>${panel.t("aiEstimateTitle")}</b><span class="s-badge ai">AI · ${esc(res.estimate.provider || "")}</span></div>
    <div class="ai-sub">${panel.t("aiHint")}</div>
    <div class="ai-locs">${panel._state.locations.map(cell).join("")}</div>
    ${est.notes ? `<div class="s-sub">💡 ${esc(est.notes)}</div>` : ""}
    <label class="checkline"><input type="checkbox" id="s-savetpl" checked> ${panel.t("saveAsTemplateLabel")}</label>
  `;
  suggestEl.querySelectorAll(".ai-days").forEach((inp) =>
    inp.addEventListener("input", () => {
      const raw = inp.value.trim();
      const v = raw === "" ? null : Math.min(3650, Math.max(0, parseInt(raw, 10) || 0));
      m.aiResult.shelf_life[inp.dataset.loc] = v && v > 0 ? v : null;
      recompute();
    })
  );
  recompute();
}
