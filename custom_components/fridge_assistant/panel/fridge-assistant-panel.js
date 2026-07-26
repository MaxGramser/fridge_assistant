/* Fridge Assistant panel — vanilla custom element, no external deps.
 *
 * Entry module: the custom element (shell, state subscription, list and
 * filters) plus thin delegates into the view modules. Loaded natively as an
 * ES module via panel_custom's module_url — no build step involved; the
 * views/lib/strings/styles files are plain sibling modules.
 *
 * i18n: everything follows a simple rule — Dutch if Home Assistant's
 * (per-user) language is Dutch, English for anything else. See `_lang()`/
 * `t()` below. Only nl/en exist; there is no third language.
 */

import { CATEGORY_LABELS, KIND_LABELS, LOCATION_LABELS, STATUS_COLOR, STRINGS } from "./strings.js";
import { STYLES } from "./styles.js";
import { daysLabel, esc, fmtDate } from "./lib/format.js";
import { openModal, toast, wireDateField } from "./lib/surface.js";
import { aiEstimate, openAddModal } from "./views/add-item.js";
import { completeItem, openInspector } from "./views/inspector.js";
import { aiNewTemplate, openTemplateEditor, openTemplatePicker, openTemplatesManager } from "./views/templates.js";
import { eatScanned, onRetailBarcode, onScan, openScanner } from "./views/scanner.js";
import { historyRow, openHistory, relTime } from "./views/history.js";
import { openCleanModal } from "./views/cleanup.js";
import { printSticker } from "./views/print.js";

class FridgeAssistantPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = null;
    this._filterLoc = "all";
    this._filterKind = "all";
    this._filterCat = "all";
    this._search = "";
    this._unsub = null;
    this._shellBuilt = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._shellBuilt) this._init();
    if (!this._unsub && hass) this._subscribe();
    if (this._shellBuilt) this._applyChrome();
  }
  get hass() { return this._hass; }

  // HA sets these properties on the panel element; `narrow` drives mobile layout.
  set narrow(v) { this._narrow = v; if (this._shellBuilt) this._applyChrome(); }
  get narrow() { return this._narrow; }
  set route(v) { this._route = v; }
  get route() { return this._route; }
  set panel(v) { this._panel = v; }
  get panel() { return this._panel; }

  connectedCallback() {
    if (!this._shellBuilt && this._hass) this._init();
  }
  disconnectedCallback() {
    if (this._unsub) { try { this._unsub(); } catch (e) {} this._unsub = null; }
  }

  /* ------------------------------------------------------------------ i18n */
  // "nl" only if Home Assistant's (per-user) language is Dutch; English for
  // everything else, including no language at all. Mirrors the backend's
  // resolve_language() so printed labels/notifications match the panel.
  _lang() {
    const raw = (this._hass && this._hass.language) || "en";
    return String(raw).split("-")[0].toLowerCase() === "nl" ? "nl" : "en";
  }

  t(key, ...args) {
    const table = STRINGS[this._lang()] || STRINGS.en;
    const v = (key in table ? table[key] : STRINGS.en[key]);
    return typeof v === "function" ? v(...args) : v;
  }

  // Backend sends location_meta/categories/kinds with Dutch labels (plus
  // emoji/icon, which aren't translated); these merge in the frontend label
  // for the active language while keeping the rest of the backend object.
  _locMeta(key) {
    const base = (this._state && this._state.location_meta || {})[key] || {};
    const table = LOCATION_LABELS[this._lang()] || LOCATION_LABELS.en;
    return { ...base, label: table[key] || base.label || key };
  }
  _catMeta(key) {
    const base = (this._state && this._state.categories || {})[key] || {};
    const table = CATEGORY_LABELS[this._lang()] || CATEGORY_LABELS.en;
    return { ...base, label: table[key] || base.label || key };
  }
  _kindMeta(key) {
    const base = (this._state && this._state.kinds || {})[key] || {};
    const table = (KIND_LABELS[this._lang()] || KIND_LABELS.en)[key] || {};
    const label = table.label || base.label || key;
    return { ...base, label, short: table.short || base.short || label };
  }

  async _subscribe() {
    try {
      this._unsub = await this._hass.connection.subscribeMessage(
        (state) => { this._state = state; this._onState(); },
        { type: "fridge_assistant/subscribe" }
      );
    } catch (e) {
      this._unsub = null;
    }
  }

  async _call(type, payload = {}) {
    return this._hass.callWS({ type: `fridge_assistant/${type}`, ...payload });
  }

  _kindOf(t) {
    return (t && t.kind) || (this._state.category_kind || {})[t && t.category] || "ingredient";
  }

  /* Avatar for the person who added an item: their photo if a linked person
     entity has one, else coloured initials derived from the name. */
  _avatar(name, picture, size = 20) {
    const box = `width:${size}px;height:${size}px`;
    if (picture) return `<img class="avatar" style="${box}" src="${esc(picture)}" alt="" title="${esc(name || "")}">`;
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    const initials = (parts.length ? parts.map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
    let hash = 0;
    for (const ch of String(name || "?")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `<span class="avatar avatar-i" style="${box};font-size:${Math.round(size * 0.42)}px;background:hsl(${hash % 360} 52% 52%)" title="${esc(name || "")}">${esc(initials)}</span>`;
  }

  /* ------------------------------------------------------ view delegates */
  /* The view modules are plain functions taking the panel instance; these
     thin wrappers keep every internal `this._x()` call site working. */
  _openModal(html, opts) { return openModal(this, html, opts); }
  _wireDateField(inp, placeholder, lang) { return wireDateField(inp, placeholder, lang); }
  _toast(msg, opts) { return toast(this, msg, opts); }
  _openAddModal(prefill, editItem) { return openAddModal(this, prefill, editItem); }
  _aiEstimate(name, ctx) { return aiEstimate(this, name, ctx); }
  _openTemplatePicker(onPick) { return openTemplatePicker(this, onPick); }
  _openTemplatesManager() { return openTemplatesManager(this); }
  _aiNewTemplate(onChanged) { return aiNewTemplate(this, onChanged); }
  _openTemplateEditor(tpl, isNew, onChanged) { return openTemplateEditor(this, tpl, isNew, onChanged); }
  _openItemModal(item, opts) { return openInspector(this, item, opts); }
  _completeItem(item, action, close) { return completeItem(this, item, action, close); }
  _eatScanned(raw, setStatus, count) { return eatScanned(this, raw, setStatus, count); }
  _openScanner() { return openScanner(this); }
  _onScan(raw, h) { return onScan(this, raw, h); }
  _onRetailBarcode(code) { return onRetailBarcode(this, code); }
  _openCleanModal() { return openCleanModal(this); }
  _relTime(ts) { return relTime(this, ts); }
  _historyRow(e) { return historyRow(this, e); }
  _openHistory() { return openHistory(this); }
  _printSticker(id, itemHint, opts) { return printSticker(this, id, itemHint, opts); }

  /* ---------------------------------------------------------------- shell */
  _init() {
    this._shellBuilt = true;
    // Rounded UI font (vendored woff2). @font-face doesn't apply inside a
    // shadow root, so the declaration goes into the document head once.
    if (!document.getElementById("fa-doc-fonts")) {
      const st = document.createElement("style");
      st.id = "fa-doc-fonts";
      st.textContent = [400, 800].map((w) =>
        `@font-face{font-family:"Nunito";font-weight:${w};font-style:normal;` +
        `font-display:swap;src:url("/fridge_assistant_static/fonts/nunito-${w}.woff2") format("woff2");}`
      ).join("\n");
      document.head.appendChild(st);
    }
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <div class="wrap">
        <header class="topbar">
          <div class="topbar-row">
            <span class="menu-slot" id="menu-slot"></span>
            <div class="brand"><ha-icon class="brand-emoji" icon="mdi:fridge-outline"></ha-icon><h1>${this.t("appTitle")}</h1></div>
            <span class="spacer"></span>
            <button class="icon-btn" id="btn-history" title="${this.t("historyTooltip", 0)}"><ha-icon icon="mdi:history"></ha-icon></button>
            <button class="icon-btn" id="btn-templates" title="${this.t("manageTemplates")}"><ha-icon icon="mdi:book-multiple"></ha-icon></button>
            <button class="icon-btn" id="btn-settings" title="${this.t("settings")}"><ha-icon icon="mdi:cog-outline"></ha-icon></button>
          </div>
          <div class="counts" id="counts"></div>
          <div class="searchrow">
            <div class="search"><ha-icon icon="mdi:magnify" style="--mdc-icon-size:18px;color:var(--fa-muted)"></ha-icon><input id="search" placeholder="${this.t("searchPlaceholder")}" autocomplete="off" enterkeyhint="search"></div>
            <button class="btn ghost icon-only" id="btn-clean" title="${this.t("cleanUp")}"><ha-icon icon="mdi:broom"></ha-icon></button>
          </div>
        </header>
        <nav class="filters" id="filters"></nav>
        <main id="list"><div class="loading">${this.t("loading")}</div></main>
      </div>
      <button class="fab fab-scan" id="fab-scan" aria-label="${this.t("scanAria")}"><ha-icon icon="mdi:barcode-scan"></ha-icon></button>
      <button class="fab" id="fab-add" aria-label="${this.t("addItemAria")}"><ha-icon icon="mdi:plus"></ha-icon></button>
      <div id="modal-root"></div>
      <div id="toast-root"></div>
    `;
    const $ = (s) => this.shadowRoot.getElementById(s);
    $("fab-add").addEventListener("click", () => this._openAddModal());
    $("fab-scan").addEventListener("click", () => this._openScanner());
    $("btn-clean").addEventListener("click", () => this._openCleanModal());
    $("btn-history").addEventListener("click", () => this._openHistory());
    $("btn-templates").addEventListener("click", () => this._openTemplatesManager());
    $("btn-settings").addEventListener("click", () => {
      window.location.href = "/config/integrations/integration/fridge_assistant";
    });
    $("search").addEventListener("input", (e) => { this._search = e.target.value; this._renderList(); });
    this._applyChrome();
    if (this._state) this._onState();
  }

  /* Render the native HA hamburger so the sidebar is reachable on mobile
     (a full-page custom panel has no HA header of its own). */
  _applyChrome() {
    const slot = this.shadowRoot && this.shadowRoot.getElementById("menu-slot");
    if (!slot) return;
    if (!this._menuBtn) {
      this._menuBtn = document.createElement("ha-menu-button");
      slot.appendChild(this._menuBtn);
    }
    this._menuBtn.hass = this._hass;
    this._menuBtn.narrow = this._narrow ?? false;
  }

  _onState() {
    const hb = this.shadowRoot.getElementById("btn-history");
    if (hb) hb.title = this.t("historyTooltip", this._state.history_count || 0);
    this._renderCounts();
    this._renderFilters();
    this._renderList();
    // Keep an open inspector (drawer or sheet) in sync with the new state.
    if (this._refreshSurface) this._refreshSurface();
  }

  _renderCounts() {
    const c = this._state.counts;
    const el = this.shadowRoot.getElementById("counts");
    el.innerHTML = `
      <span class="pill"><b>${c.total}</b> ${this.t("itemsUnit")}</span>
      ${c.soon ? `<span class="pill warn"><b>${c.soon}</b> ${this.t("soonUnit")}</span>` : ""}
      ${c.expired ? `<span class="pill bad"><b>${c.expired}</b> ${this.t("expiredUnit")}</span>` : ""}
    `;
  }

  _renderFilters() {
    const { locations, counts, kinds } = this._state;
    const el = this.shadowRoot.getElementById("filters");
    const locChip = (key, label, count) =>
      `<button class="chip ${this._filterLoc === key ? "active" : ""}" data-loc="${key}">${label} <span class="chip-n">${count}</span></button>`;
    let html = locChip("all", this.t("all"), counts.total);
    for (const loc of locations) {
      const m = this._locMeta(loc);
      html += locChip(loc, `${m.emoji || ""} ${m.label || loc}`, counts.by_location[loc] || 0);
    }

    const kindKeys = Object.keys(kinds || {});
    if (kindKeys.length) {
      const kindCounts = {};
      for (const i of this._state.items) {
        const k = this._kindOf(i);
        kindCounts[k] = (kindCounts[k] || 0) + 1;
      }
      const kindChip = (key, label, count) =>
        `<button class="chip ${this._filterKind === key ? "active" : ""}" data-kind="${key}">${label} <span class="chip-n">${count}</span></button>`;
      html += `<span class="chip-sep"></span>`;
      html += kindChip("all", this.t("all"), counts.total);
      for (const k of kindKeys) {
        const km = this._kindMeta(k);
        html += kindChip(k, `${km.emoji || ""} ${km.short || km.label}`, kindCounts[k] || 0);
      }
    }

    // Category chips: only categories that actually hold items (the full
    // catalogue would flood the bar), plus the active one so an emptied
    // filter can still be tapped back to "all".
    const catCounts = {};
    for (const i of this._state.items) {
      catCounts[i.category] = (catCounts[i.category] || 0) + 1;
    }
    const catKeys = Object.keys(this._state.categories || {})
      .filter((k) => catCounts[k] || k === this._filterCat);
    if (catKeys.length) {
      const catChip = (key, label, count) =>
        `<button class="chip ${this._filterCat === key ? "active" : ""}" data-cat="${key}">${label} <span class="chip-n">${count}</span></button>`;
      html += `<span class="chip-sep"></span>`;
      html += catChip("all", this.t("all"), counts.total);
      for (const k of catKeys) {
        const cm = this._catMeta(k);
        html += catChip(k, `${cm.emoji || ""} ${cm.label || k}`, catCounts[k] || 0);
      }
    }

    el.innerHTML = html;
    el.querySelectorAll("[data-loc]").forEach((b) =>
      b.addEventListener("click", () => { this._filterLoc = b.dataset.loc; this._renderFilters(); this._renderList(); })
    );
    el.querySelectorAll("[data-kind]").forEach((b) =>
      b.addEventListener("click", () => { this._filterKind = b.dataset.kind; this._renderFilters(); this._renderList(); })
    );
    el.querySelectorAll("[data-cat]").forEach((b) =>
      b.addEventListener("click", () => { this._filterCat = b.dataset.cat; this._renderFilters(); this._renderList(); })
    );
  }

  _filteredItems() {
    let items = this._state.items.slice();
    if (this._filterLoc !== "all") items = items.filter((i) => i.location === this._filterLoc);
    if (this._filterKind !== "all") items = items.filter((i) => this._kindOf(i) === this._filterKind);
    if (this._filterCat !== "all") items = items.filter((i) => i.category === this._filterCat);
    const q = this._search.trim().toLowerCase();
    if (q) items = items.filter((i) =>
      (i.name || "").toLowerCase().includes(q) ||
      (i.contents || "").toLowerCase().includes(q) ||
      (i.code || "").toLowerCase().includes(q)
    );
    return items;
  }

  _renderList() {
    if (!this._state) return;
    const list = this.shadowRoot.getElementById("list");
    const items = this._filteredItems();
    const lang = this._lang();

    if (this._state.counts.total === 0) {
      list.innerHTML = `<div class="empty">
        <div class="empty-emoji">🧊</div>
        <h2>${this.t("emptyTitle")}</h2>
        <p>${this.t("emptySub")}</p>
        <button class="btn primary" id="empty-add">${this.t("addItemBtn")}</button>
      </div>`;
      list.querySelector("#empty-add").addEventListener("click", () => this._openAddModal());
      return;
    }

    let html = "";
    if (!items.length) {
      html += `<div class="empty small"><p>${this.t("nothingFound")}</p></div>`;
    } else {
      // Urgency sections: full-width headers inside the cards grid, so the
      // expiry sort stays readable in the two-column layout. They apply in
      // every view (filters/search included); a single group needs no header.
      const secOf = (i) =>
        i.days_left == null ? "nodate"
        : (i.status === "expired" || i.status === "soon") ? "first"
        : i.days_left <= 7 ? "week" : "later";
      const titles = {
        first: this.t("useFirst"),
        week: this.t("secThisWeek"),
        later: this.t("secLater"),
        nodate: this.t("secNoDate"),
      };
      const groups = ["first", "week", "later", "nodate"]
        .map((k) => [k, items.filter((i) => secOf(i) === k)])
        .filter(([, arr]) => arr.length);
      const showHeads = groups.length > 1;
      html += `<div class="cards">${groups.map(([k, arr]) =>
        (showHeads ? `<div class="sec-head${k === "first" ? " urgent" : ""}">${titles[k]} <span class="sec-n">${arr.length}</span></div>` : "")
        + arr.map((i) => this._itemCard(i, lang)).join("")
      ).join("")}</div>`;
    }
    list.innerHTML = html;

    list.querySelectorAll("[data-item]").forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target.closest(".card-print")) return;
        const item = this._state.items.find((x) => x.id === el.dataset.item);
        if (item) this._openItemModal(item);
      })
    );
    list.querySelectorAll(".card-print").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); this._printSticker(b.dataset.print); })
    );
  }

  _itemCard(i, lang) {
    const lm = this._locMeta(i.location);
    // First word of the location label keeps the meta line short in both
    // languages ("Buiten koelkast" -> "Buiten", "Fridge" -> "Fridge").
    const locShort = (lm.label || i.location || "").split(" ")[0];
    const contents = i.contents && i.contents !== i.name ? i.contents : "";
    const portions = i.portions || [];
    const total = portions.length;
    const open = portions.filter((p) => p.status === "open").length;
    const pbadge = total > 1
      ? `<span class="cs-sep">·</span><span class="pbadge" title="${esc(this.t("pbadgeTitle", open, total))}">${open}/${total}</span>`
      : "";
    const selected = this._inspectorItemId === i.id ? " selected" : "";
    return `<div class="card${selected}" data-item="${i.id}">
      <div class="card-emoji">${i.emoji || "🍽️"}</div>
      <div class="card-main">
        <div class="card-title">${esc(i.name)}</div>
        <div class="card-sub">
          <span class="cs-fix">${lm.emoji || ""} ${esc(locShort)}</span>
          <span class="cs-sep">·</span>
          <span class="code">${esc(i.code)}</span>${pbadge}
          ${contents ? `<span class="cs-sep">·</span><span class="cs-more">${esc(contents)}</span>` : ""}
        </div>
      </div>
      <div class="card-right">
        <div class="status" style="--c:${STATUS_COLOR[i.status]}">${daysLabel(i.days_left, lang)}</div>
        <div class="card-when">${i.added_by_name ? `<span class="who" title="${esc(i.added_by_name)}">${this._avatar(i.added_by_name, i.added_by_picture, 15)}</span>` : ""}${i.expiry_date ? `<span>${fmtDate(i.expiry_date, lang)}</span>` : ""}</div>
      </div>
      <button class="card-print icon-btn" data-print="${i.id}" title="${this.t("printSticker")}"><ha-icon icon="mdi:tag-outline"></ha-icon></button>
    </div>`;
  }
}

customElements.define("fridge-assistant-panel", FridgeAssistantPanel);
