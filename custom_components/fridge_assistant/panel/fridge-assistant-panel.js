/* Fridge Assistant panel — vanilla custom element, no external deps. */

const MONTHS_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const STATUS_COLOR = {
  expired: "var(--fa-red)",
  soon: "var(--fa-orange)",
  ok: "var(--fa-green)",
  none: "var(--fa-muted)",
};

/* ---------- small date helpers (timezone-safe, YYYY-MM-DD) ---------- */
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function parseISO(d) {
  if (!d) return null;
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}
function toISO(dt) {
  return dt.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const dt = parseISO(iso);
  if (!dt) return null;
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}
function daysBetween(fromISO, toISOv) {
  const a = parseISO(fromISO), b = parseISO(toISOv);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}
function fmtDate(iso) {
  const dt = parseISO(iso);
  if (!dt) return "—";
  return `${dt.getUTCDate()} ${MONTHS_NL[dt.getUTCMonth()]}`;
}
function daysLabel(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return "geen datum";
  if (daysLeft < 0) return `${Math.abs(daysLeft)} dag${Math.abs(daysLeft) === 1 ? "" : "en"} over datum`;
  if (daysLeft === 0) return "vandaag!";
  if (daysLeft === 1) return "nog 1 dag";
  return `nog ${daysLeft} dagen`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

class FridgeAssistantPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = null;
    this._filterLoc = "all";
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

  /* ---------------------------------------------------------------- shell */
  _init() {
    this._shellBuilt = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <div class="wrap">
        <header class="topbar">
          <div class="topbar-row">
            <span class="menu-slot" id="menu-slot"></span>
            <div class="brand"><span class="brand-emoji">🧊</span><h1>Koelkast</h1></div>
            <span class="spacer"></span>
            <button class="icon-btn" id="btn-history" title="Geschiedenis">📜</button>
            <button class="icon-btn" id="btn-templates" title="Templates beheren">📚</button>
            <button class="icon-btn" id="btn-settings" title="Instellingen">⚙︎</button>
          </div>
          <div class="counts" id="counts"></div>
          <div class="searchrow">
            <div class="search"><span>🔍</span><input id="search" placeholder="Zoek…" autocomplete="off" enterkeyhint="search"></div>
            <button class="btn ghost icon-only" id="btn-clean" title="Opruimen">🧹</button>
          </div>
        </header>
        <nav class="filters" id="filters"></nav>
        <main id="list"><div class="loading">Laden…</div></main>
      </div>
      <button class="fab fab-scan" id="fab-scan" aria-label="Scan barcode">📷</button>
      <button class="fab" id="fab-add" aria-label="Item toevoegen">＋</button>
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
    if (hb) hb.title = this._state.history_count
      ? `Geschiedenis (${this._state.history_count})` : "Geschiedenis";
    this._renderCounts();
    this._renderFilters();
    this._renderList();
  }

  _renderCounts() {
    const c = this._state.counts;
    const el = this.shadowRoot.getElementById("counts");
    el.innerHTML = `
      <span class="pill"><b>${c.total}</b> items</span>
      ${c.soon ? `<span class="pill warn"><b>${c.soon}</b> bijna op</span>` : ""}
      ${c.expired ? `<span class="pill bad"><b>${c.expired}</b> over datum</span>` : ""}
    `;
  }

  _renderFilters() {
    const { locations, location_meta, counts } = this._state;
    const el = this.shadowRoot.getElementById("filters");
    const chip = (key, label, count) =>
      `<button class="chip ${this._filterLoc === key ? "active" : ""}" data-loc="${key}">${label} <span class="chip-n">${count}</span></button>`;
    let html = chip("all", "Alles", counts.total);
    for (const loc of locations) {
      const m = location_meta[loc] || {};
      html += chip(loc, `${m.emoji || ""} ${m.label || loc}`, counts.by_location[loc] || 0);
    }
    el.innerHTML = html;
    el.querySelectorAll(".chip").forEach((b) =>
      b.addEventListener("click", () => { this._filterLoc = b.dataset.loc; this._renderFilters(); this._renderList(); })
    );
  }

  _filteredItems() {
    let items = this._state.items.slice();
    if (this._filterLoc !== "all") items = items.filter((i) => i.location === this._filterLoc);
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

    if (this._state.counts.total === 0) {
      list.innerHTML = `<div class="empty">
        <div class="empty-emoji">🧊</div>
        <h2>Nog niets in de koelkast</h2>
        <p>Voeg je eerste item toe — houdbaarheid wordt automatisch geschat.</p>
        <button class="btn primary" id="empty-add">＋ Item toevoegen</button>
      </div>`;
      list.querySelector("#empty-add").addEventListener("click", () => this._openAddModal());
      return;
    }

    // Urgency strip (expired + soon), only in "all" view without search.
    const urgent = this._state.items.filter((i) => i.status === "expired" || i.status === "soon");
    let html = "";
    if (this._filterLoc === "all" && !this._search && urgent.length) {
      const kinds = this._state.kinds || {};
      const order = Object.keys(kinds).length ? Object.keys(kinds) : ["ingredient", "gerecht"];
      const groups = order
        .map((k) => [k, urgent.filter((i) => this._kindOf(i) === k)])
        .filter(([, arr]) => arr.length);
      html += `<section class="strip"><div class="strip-head">⏰ Als eerste op</div>
        ${groups.map(([k, arr]) => `<div class="strip-group">
          <div class="strip-sub">${(kinds[k] || {}).emoji || ""} ${(kinds[k] || {}).short || (kinds[k] || {}).label || k}</div>
          <div class="strip-row">${arr.slice(0, 12).map((i) => this._urgentCard(i)).join("")}</div>
        </div>`).join("")}
      </section>`;
    }

    if (!items.length) {
      html += `<div class="empty small"><p>Niets gevonden.</p></div>`;
    } else {
      html += `<div class="cards">${items.map((i) => this._itemCard(i)).join("")}</div>`;
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

  _urgentCard(i) {
    return `<div class="ucard" data-item="${i.id}" style="--c:${STATUS_COLOR[i.status]}">
      <div class="ucard-emoji">${i.emoji || "🍽️"}</div>
      <div class="ucard-name">${esc(i.name)}</div>
      <div class="ucard-days">${daysLabel(i.days_left)}</div>
    </div>`;
  }

  _itemCard(i) {
    const lm = this._state.location_meta[i.location] || {};
    return `<div class="card" data-item="${i.id}">
      <div class="card-emoji">${i.emoji || "🍽️"}</div>
      <div class="card-main">
        <div class="card-title">${esc(i.name)}</div>
        <div class="card-sub">
          <span class="tag">${lm.emoji || ""} ${esc(lm.label || i.location)}</span>
          <span class="code">${esc(i.code)}</span>
          ${i.contents && i.contents !== i.name ? `<span class="muted">${esc(i.contents)}</span>` : ""}
          ${i.added_by_name ? `<span class="who">${this._avatar(i.added_by_name, i.added_by_picture, 16)}${esc(i.added_by_name.split(" ")[0])}</span>` : ""}
        </div>
      </div>
      <div class="card-right">
        <div class="status" style="--c:${STATUS_COLOR[i.status]}">${daysLabel(i.days_left)}</div>
        <div class="card-when">${i.expiry_date ? fmtDate(i.expiry_date) : ""}</div>
      </div>
      <button class="card-print icon-btn" data-print="${i.id}" title="Print sticker">🏷️</button>
    </div>`;
  }

  /* --------------------------------------------------------------- modals */
  _openModal(innerHTML, { wide = false } = {}) {
    const root = this.shadowRoot.getElementById("modal-root");
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog">${innerHTML}</div>`;
    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    const close = () => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 180);
    };
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
    return { overlay, modal: overlay.querySelector(".modal"), close };
  }

  /* ---- ADD / EDIT ---- */
  _openAddModal(prefill = {}, editItem = null) {
    const isEdit = !!editItem;
    const m = {
      location: prefill.location || editItem?.location || "koelkast",
      added: prefill.added_date || editItem?.added_date || todayISO(),
      expiry: prefill.expiry_date || editItem?.expiry_date || "",
      expiryManual: isEdit ? editItem?.expiry_source === "manual" : false,
      emoji: prefill.emoji || editItem?.emoji || "🍽️",
      template_id: prefill.template_id || editItem?.template_id || null,
      category: prefill.category || editItem?.category || null,
      kind: editItem?.kind || prefill.kind || "ingredient",
      kindManual: isEdit,
      aiResult: null,
    };
    const locs = this._state.locations;
    const lm = this._state.location_meta;
    const kinds = this._state.kinds || { ingredient: { emoji: "🥕", short: "Ingrediënt" }, gerecht: { emoji: "🍲", short: "Gerecht" } };
    const nameVal = editItem ? editItem.name : (prefill.name || "");

    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-emoji" id="m-emoji">${m.emoji}</div>
        <div class="m-title">
          <input class="m-name" id="f-name" placeholder="Wat leg je erin? bv. krop sla" value="${esc(nameVal)}">
        </div>
        <button class="icon-btn" id="m-close">✕</button>
      </div>
      <div class="suggest" id="f-suggest"></div>
      <div class="seg" id="f-loc">
        ${locs.map((l) => `<button data-loc="${l}" class="${m.location === l ? "on" : ""}">${lm[l].emoji} ${lm[l].label}</button>`).join("")}
      </div>
      <div class="seg" id="f-kind">
        ${Object.keys(kinds).map((k) => `<button type="button" data-kind="${k}" class="${m.kind === k ? "on" : ""}">${kinds[k].emoji} ${kinds[k].short || kinds[k].label}</button>`).join("")}
      </div>
      <div class="grid2">
        <label class="field"><span>Datum erin</span><input type="date" id="f-added" value="${m.added}"></label>
        <label class="field"><span>Houdbaar tot</span><input type="date" id="f-expiry" value="${m.expiry}"></label>
      </div>
      <div class="expiry-hint" id="f-hint"></div>
      <button class="link" id="f-adv">Meer opties ▾</button>
      <div class="adv hidden" id="f-advbox">
        <label class="field"><span>Aparte naam (optioneel)</span><input id="f-dispname" placeholder="Weergavenaam" value="${esc(editItem?.name || "")}"></label>
        <div class="grid2">
          <label class="field"><span>Hoeveelheid</span><input id="f-qty" placeholder="bv. 2 bakjes" value="${esc(editItem?.quantity ?? prefill.quantity ?? "")}"></label>
          <label class="field"><span>Emoji</span><input id="f-emojiin" maxlength="4" value="${esc(m.emoji)}"></label>
        </div>
        <label class="field"><span>Notitie</span><input id="f-notes" placeholder="Notitie" value="${esc(editItem?.notes ?? prefill.notes ?? "")}"></label>
        <label class="field"><span>Foto-URL (optioneel)</span><input id="f-photo" placeholder="https://…" value="${esc(editItem?.photo ?? prefill.photo ?? "")}"></label>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="f-template">📚 Template kiezen</button>
        <button class="btn primary" id="f-submit">${isEdit ? "Opslaan" : "Toevoegen"}</button>
      </div>
    `, { wide: false });

    const q = (s) => h.modal.querySelector(s);
    const nameEl = q("#f-name"), addedEl = q("#f-added"), expEl = q("#f-expiry");
    const emojiEl = q("#m-emoji"), suggestEl = q("#f-suggest"), hintEl = q("#f-hint");

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
      const col = dl < 0 ? "var(--fa-red)" : dl <= (this._state.options.warn_days || 3) ? "var(--fa-orange)" : "var(--fa-green)";
      hintEl.innerHTML = `<span style="color:${col}">● ${daysLabel(dl)}</span>`;
    };
    updateHint();

    const applySuggestion = (expiryDate, source) => {
      if (!m.expiryManual && expiryDate) { expEl.value = expiryDate; m.expiry = expiryDate; }
      m.expirySource = source;
      updateHint();
    };

    const aiCtx = () => ({ m, q, setEmoji, setKind, applySuggestion, suggestEl });
    const wireActions = (query) => {
      const a = q("#s-ai");
      if (a) a.addEventListener("click", () => this._aiEstimate(query, aiCtx()));
      const o = q("#s-other");
      if (o) o.addEventListener("click", () =>
        this._openTemplatePicker((t) => { m.noAutoMatch = false; nameEl.value = t.name; doMatch(); }));
    };

    // Shown when nothing matched, or after the user rejected a wrong guess.
    const showManual = (query, heading) => {
      m.template_id = null; m.category = null;
      suggestEl.className = "suggest";
      const aiBtn = this._state.options.ai_enabled
        ? `<button class="s-mini ai" id="s-ai">✨ AI schat</button>` : "";
      suggestEl.innerHTML = `
        <div class="s-body"><b>${heading || "Onbekend product"}</b>
          <div class="s-sub">Nog geen template voor “${esc(query)}” — vul zelf een datum in${this._state.options.ai_enabled ? " of laat AI schatten" : ""}.</div></div>
        <div class="s-actions">${aiBtn}<button class="s-mini" id="s-other" title="Kies template">📚</button></div>`;
      wireActions(query);
    };

    const doMatch = debounce(async () => {
      const query = nameEl.value.trim();
      if (m.noAutoMatch) return;
      if (query.length < 2) { suggestEl.innerHTML = ""; suggestEl.className = "suggest"; return; }
      let res;
      try { res = await this._call("match_template", { query, location: m.location, added_date: addedEl.value }); }
      catch (e) { return; }
      if (m.noAutoMatch) return; // rejected while the request was in flight
      if (res.template) {
        const t = res.template;
        m.template_id = t.id; m.category = t.category; setEmoji(t.emoji || "🍽️");
        if (!m.kindManual) setKind(this._kindOf(t));
        const sl = t.shelf_life || {};
        const noHere = sl[m.location] === null || sl[m.location] === undefined;
        applySuggestion(res.suggestion?.expiry_date, "template");
        suggestEl.className = "suggest ok";
        suggestEl.innerHTML = `
          <span class="s-emoji">${t.emoji || "📋"}</span>
          <div class="s-body"><b>${esc(t.name)}</b>
            <div class="s-sub">${noHere ? "Niet geschikt voor deze locatie" : `${lm[m.location].label}: ${sl[m.location]} dagen`}${t.notes ? " · " + esc(t.notes) : ""}</div></div>
          <div class="s-actions">
            ${this._state.options.ai_enabled ? `<button class="s-mini" id="s-ai" title="AI-schatting">✨</button>` : ""}
            <button class="s-mini" id="s-other" title="Andere template">📚</button>
            <button class="s-mini ghost" id="s-dismiss" title="Niet dit — handmatig">✕</button>
          </div>`;
        wireActions(query);
        const d = q("#s-dismiss");
        if (d) d.addEventListener("click", () => {
          m.noAutoMatch = true; m.expiryManual = false; m.expirySource = "manual";
          setEmoji("🍽️"); expEl.value = ""; m.expiry = ""; updateHint();
          showManual(query, "Handmatig invullen");
        });
      } else {
        showManual(query);
      }
    }, 350);

    nameEl.addEventListener("input", doMatch);
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
    addedEl.addEventListener("change", () => { if (!m.expiryManual) doMatch(); });
    expEl.addEventListener("input", () => { m.expiryManual = true; m.expiry = expEl.value; updateHint(); });
    q("#f-adv").addEventListener("click", () => {
      const box = q("#f-advbox"); box.classList.toggle("hidden");
      q("#f-adv").textContent = box.classList.contains("hidden") ? "Meer opties ▾" : "Minder opties ▴";
    });
    if (q("#f-emojiin")) q("#f-emojiin").addEventListener("input", (e) => setEmoji(e.target.value || "🍽️"));
    q("#f-template").addEventListener("click", () =>
      this._openTemplatePicker((t) => { nameEl.value = t.name; doMatch(); })
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
      if (!payload.contents) { nameEl.focus(); return; }
      q("#f-submit").disabled = true;
      try {
        if (isEdit) {
          await this._call("update_item", { item_id: editItem.id, changes: payload });
          h.close();
          this._toast("Opgeslagen ✓");
        } else {
          // Save AI result as a template if the user opted in.
          const saveTpl = h.modal.querySelector("#s-savetpl");
          if (m.aiResult && (!saveTpl || saveTpl.checked)) {
            await this._call("add_template", {
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
          const res = await this._call("add_item", { item: payload });
          h.close();
          const code = res?.item?.code;
          this._toast(`Toegevoegd ✓ ${code ? "code " + code : ""}`, {
            actionLabel: "🏷️ Print", onAction: () => this._printSticker(res.item.id),
          });
        }
      } catch (e) {
        q("#f-submit").disabled = false;
        this._toast("Fout: " + (e.message || e), { type: "bad" });
      }
    });

    // A scanned product prefills advanced fields — open the box so they show.
    if (!isEdit && (prefill.quantity || prefill.notes || prefill.photo)) {
      q("#f-advbox").classList.remove("hidden");
      q("#f-adv").textContent = "Minder opties ▴";
    }

    setTimeout(() => nameEl.focus(), 60);
    if (nameVal) doMatch();
  }

  async _aiEstimate(name, ctx) {
    const { m, setEmoji, setKind, suggestEl } = ctx;
    suggestEl.className = "suggest";
    suggestEl.innerHTML = `<div class="s-body"><b>✨ AI denkt na…</b><div class="s-sub">Houdbaarheid van “${esc(name)}” schatten…</div></div><div class="spinner"></div>`;
    let res;
    try { res = await this._call("estimate", { name }); }
    catch (e) {
      suggestEl.className = "suggest bad";
      suggestEl.innerHTML = `<div class="s-body"><b>AI-schatting mislukt</b><div class="s-sub">${esc(e.message || e)}</div></div>`;
      return;
    }
    const est = res.estimate;
    m.aiResult = est; m.category = est.category; m.expirySource = "ai"; setEmoji(est.emoji || "✨");
    if (!m.kindManual && setKind) setKind(est.kind);
    const addedEl = ctx.addedEl || suggestEl.parentNode.querySelector("#f-added");
    const expEl = ctx.expEl || suggestEl.parentNode.querySelector("#f-expiry");
    const hintEl = suggestEl.parentNode.querySelector("#f-hint");
    const lm = this._state.location_meta;
    const warn = this._state.options.warn_days || 3;

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
          hintEl.innerHTML = `<span style="color:${col}">● ${daysLabel(dl)}</span>`;
        } else hintEl.innerHTML = "";
      }
    };

    const cell = (loc) => {
      const d = est.shelf_life[loc];
      return `<div class="ai-loc ${loc === m.location ? "active" : ""}" data-loccell="${loc}">
        <span class="ai-loc-emoji">${lm[loc].emoji}</span>
        <span class="ai-days-wrap"><input class="ai-days" type="number" inputmode="numeric" min="0" max="3650" step="1" data-loc="${loc}" value="${d ?? ""}" placeholder="—"><i>dg</i></span>
        <small>${lm[loc].label}</small>
      </div>`;
    };

    suggestEl.className = "suggest ai";
    suggestEl.innerHTML = `
      <div class="ai-head"><span class="s-emoji">${est.emoji || "✨"}</span><b>AI-schatting</b><span class="s-badge ai">AI · ${esc(res.estimate.provider || "")}</span></div>
      <div class="ai-sub">Klopt niet helemaal? Tik een dag-getal aan en pas het aan 👇</div>
      <div class="ai-locs">${this._state.locations.map(cell).join("")}</div>
      ${est.notes ? `<div class="s-sub">💡 ${esc(est.notes)}</div>` : ""}
      <label class="checkline"><input type="checkbox" id="s-savetpl" checked> Bewaar (met jouw aanpassingen) als template</label>
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

  /* ---- TEMPLATE PICKER ---- */
  _openTemplatePicker(onPick) {
    const templates = this._state.templates;
    const cats = this._state.categories;
    const kinds = this._state.kinds || {};
    let kindFilter = "all";
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><h3>📚 Kies een template</h3></div>
        <button class="icon-btn" id="tp-close">✕</button>
      </div>
      <div class="seg" id="tp-kinds">
        <button data-kind="all" class="on">Alles</button>
        ${Object.keys(kinds).map((k) => `<button data-kind="${k}">${kinds[k].emoji} ${kinds[k].short || kinds[k].label}</button>`).join("")}
      </div>
      <div class="search big"><span>🔍</span><input id="tp-search" placeholder="Zoek in ${templates.length} templates…" autocomplete="off"></div>
      <div class="tp-list" id="tp-list"></div>
    `, { wide: true });
    const listEl = h.modal.querySelector("#tp-list");
    const searchEl = h.modal.querySelector("#tp-search");
    const render = () => {
      const qq = (searchEl.value || "").trim().toLowerCase();
      const filtered = templates.filter((t) => {
        if (kindFilter !== "all" && this._kindOf(t) !== kindFilter) return false;
        if (!qq) return true;
        return t.name.toLowerCase().includes(qq) || (t.aliases || []).some((a) => a.toLowerCase().includes(qq));
      });
      listEl.innerHTML = filtered.map((t) => {
        const c = cats[t.category] || {};
        const sl = t.shelf_life || {};
        return `<button class="tp-item" data-id="${t.id}">
          <span class="tp-emoji">${t.emoji || c.emoji || "🍽️"}</span>
          <span class="tp-name"><b>${esc(t.name)}</b><small>${(kinds[this._kindOf(t)] || {}).emoji || ""} ${esc(c.label || t.category)}${t.source === "user" || t.source === "ai" ? " · eigen" : ""}</small></span>
          <span class="tp-sl">${["koelkast", "vriezer", "buiten"].map((l) => sl[l] ? `<i>${({ koelkast: "🧊", vriezer: "❄️", buiten: "🧺" })[l]}${sl[l]}d</i>` : "").join("")}</span>
        </button>`;
      }).join("") || `<div class="empty small"><p>Niets gevonden.</p></div>`;
      listEl.querySelectorAll(".tp-item").forEach((b) =>
        b.addEventListener("click", () => {
          const t = templates.find((x) => x.id === b.dataset.id);
          h.close(); onPick(t);
        })
      );
    };
    render();
    searchEl.addEventListener("input", render);
    const kindsEl = h.modal.querySelector("#tp-kinds");
    kindsEl.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        kindFilter = b.dataset.kind;
        kindsEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        render();
      })
    );
    h.modal.querySelector("#tp-close").addEventListener("click", h.close);
    setTimeout(() => searchEl.focus(), 60);
  }

  /* ---- TEMPLATES MANAGER (view / edit / add — no AI required) ---- */
  _openTemplatesManager() {
    const cats = this._state.categories;
    const kinds = this._state.kinds || {};
    let kindFilter = "all";
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><h3>📚 Templates</h3></div>
        ${this._state.options.ai_enabled ? `<button class="btn ai icon-only" id="tm-ai" title="Template met AI">✨</button>` : ""}
        <button class="btn primary icon-only" id="tm-new" title="Nieuwe template">＋</button>
        <button class="icon-btn" id="tm-close">✕</button>
      </div>
      <div class="seg" id="tm-kinds">
        <button data-kind="all" class="on">Alles</button>
        ${Object.keys(kinds).map((k) => `<button data-kind="${k}">${kinds[k].emoji} ${kinds[k].short || kinds[k].label}</button>`).join("")}
        ${(this._state.hidden || []).length ? `<button data-kind="hidden" title="Verborgen standaard-templates">🙈</button>` : ""}
      </div>
      <div class="search big"><span>🔍</span><input id="tm-search" placeholder="Zoek of filter…" autocomplete="off"></div>
      <div class="tp-list" id="tm-list"></div>
    `, { wide: true });
    const listEl = h.modal.querySelector("#tm-list");
    const searchEl = h.modal.querySelector("#tm-search");
    const render = () => {
      if (kindFilter === "hidden") {
        const hidden = this._state.hidden || [];
        listEl.innerHTML = hidden.map((t) => {
          const c = cats[t.category] || {};
          return `<div class="tp-item"><span class="tp-emoji">${t.emoji || c.emoji || "🍽️"}</span>
            <span class="tp-name"><b>${esc(t.name)}</b><small>${esc(c.label || t.category)}</small></span>
            <button class="s-mini" data-unhide="${t.id}">↩︎ Terug</button></div>`;
        }).join("") || `<div class="empty small"><p>Niets verborgen.</p></div>`;
        listEl.querySelectorAll("[data-unhide]").forEach((b) =>
          b.addEventListener("click", async () => {
            await this._call("unhide_template", { template_id: b.dataset.unhide });
            this._toast("Teruggezet ✓"); render();
          }));
        return;
      }
      const qq = (searchEl.value || "").trim().toLowerCase();
      const templates = this._state.templates.filter((t) => {
        if (kindFilter !== "all" && this._kindOf(t) !== kindFilter) return false;
        if (!qq) return true;
        return t.name.toLowerCase().includes(qq)
          || (t.aliases || []).some((a) => a.toLowerCase().includes(qq))
          || ((cats[t.category] || {}).label || "").toLowerCase().includes(qq);
      });
      listEl.innerHTML = templates.map((t) => {
        const c = cats[t.category] || {};
        const sl = t.shelf_life || {};
        const badge = t.custom
          ? (t.builtin ? `<span class="tm-badge edit">aangepast</span>` : `<span class="tm-badge own">eigen</span>`)
          : "";
        return `<button class="tp-item" data-id="${t.id}">
          <span class="tp-emoji">${t.emoji || c.emoji || "🍽️"}</span>
          <span class="tp-name"><b>${esc(t.name)}${badge}</b><small>${(kinds[this._kindOf(t)] || {}).emoji || ""} ${esc(c.label || t.category)}</small></span>
          <span class="tp-sl">${["koelkast", "vriezer", "buiten"].map((l) => sl[l] ? `<i>${({ koelkast: "🧊", vriezer: "❄️", buiten: "🧺" })[l]}${sl[l]}d</i>` : "").join("")}</span>
        </button>`;
      }).join("") || `<div class="empty small"><p>Niets in deze groep.</p></div>`;
      listEl.querySelectorAll(".tp-item").forEach((b) =>
        b.addEventListener("click", () => {
          const t = this._state.templates.find((x) => x.id === b.dataset.id);
          this._openTemplateEditor(t, false, render);
        })
      );
    };
    render();
    searchEl.addEventListener("input", render);
    const kindsEl = h.modal.querySelector("#tm-kinds");
    kindsEl.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        kindFilter = b.dataset.kind;
        kindsEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        render();
      })
    );
    h.modal.querySelector("#tm-close").addEventListener("click", h.close);
    h.modal.querySelector("#tm-new").addEventListener("click", () => this._openTemplateEditor(null, true, render));
    const tmAi = h.modal.querySelector("#tm-ai");
    if (tmAi) tmAi.addEventListener("click", () => this._aiNewTemplate(render));
    setTimeout(() => searchEl.focus(), 60);
  }

  /* Create a template with AI: name in -> estimate -> prefilled editor to tweak & save. */
  _aiNewTemplate(onChanged) {
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-emoji">✨</div>
        <div class="m-title"><h3>Template met AI</h3><div class="s-sub">Typ een product; AI schat de houdbaarheid, jij past aan.</div></div>
        <button class="icon-btn" id="ai-close">✕</button>
      </div>
      <label class="field"><span>Product of gerecht</span><input id="ai-name" placeholder="bv. zelfgemaakte curry" enterkeyhint="go" autocomplete="off"></label>
      <div class="modal-actions"><button class="btn ai" id="ai-go">✨ Schat met AI</button></div>
    `);
    const q = (s) => h.modal.querySelector(s);
    const nameEl = q("#ai-name");
    q("#ai-close").addEventListener("click", h.close);
    const run = async () => {
      const name = (nameEl.value || "").trim();
      if (name.length < 2) { nameEl.focus(); return; }
      const btn = q("#ai-go");
      btn.disabled = true; btn.textContent = "✨ AI denkt na…";
      let res;
      try { res = await this._call("estimate", { name }); }
      catch (e) {
        btn.disabled = false; btn.textContent = "✨ Schat met AI";
        this._toast("AI: " + (e.message || e), { type: "bad" });
        return;
      }
      const est = res.estimate;
      h.close();
      this._openTemplateEditor({
        name, emoji: est.emoji, icon: est.icon, category: est.category,
        kind: est.kind, shelf_life: est.shelf_life, aliases: [], notes: est.notes,
        custom: false, builtin: false,
      }, true, onChanged);
    };
    q("#ai-go").addEventListener("click", run);
    nameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    setTimeout(() => nameEl.focus(), 60);
  }

  _openTemplateEditor(tpl, isNew, onChanged) {
    const cats = this._state.categories;
    const locs = this._state.locations, lm = this._state.location_meta;
    const t = tpl || { name: "", emoji: "", category: "overig", shelf_life: {}, aliases: [], notes: "" };
    const catOf = (k) => cats[k] || cats.overig;
    const kinds = this._state.kinds || {};
    const curKind = t.kind || this._kindOf(t);
    const sl = t.shelf_life || {};
    const catOptions = Object.keys(cats).map((k) =>
      `<option value="${k}" ${k === (t.category || "overig") ? "selected" : ""}>${cats[k].emoji} ${cats[k].label}</option>`).join("");
    const dayField = (loc) =>
      `<label class="field"><span>${lm[loc].emoji} ${lm[loc].label}</span><input type="number" inputmode="numeric" min="0" max="3650" class="te-day" data-loc="${loc}" value="${sl[loc] ?? ""}" placeholder="n.v.t."></label>`;
    const isBuiltin = !!t.builtin;
    const isOverride = !!(t.custom && t.builtin);
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-emoji" id="te-prev">${t.emoji || catOf(t.category).emoji}</div>
        <div class="m-title"><h3>${isNew ? "Nieuwe template" : "Template bewerken"}</h3>
          ${!isNew ? `<div class="s-sub">${isOverride ? "Aanpassing van standaard-template" : (t.builtin ? "Standaard-template — wijziging maakt een eigen versie" : "Eigen template")}</div>` : ""}
        </div>
        <button class="icon-btn" id="te-close">✕</button>
      </div>
      <div class="grid2">
        <label class="field"><span>Naam</span><input id="te-name" value="${esc(t.name)}" placeholder="bv. Zelfgemaakte pesto"></label>
        <label class="field"><span>Emoji</span><input id="te-emoji" maxlength="4" value="${esc(t.emoji || "")}" placeholder="🥫"></label>
      </div>
      <label class="field"><span>Soort</span>
        <div class="seg" id="te-kind">${Object.keys(kinds).map((k) => `<button type="button" data-kind="${k}" class="${curKind === k ? "on" : ""}">${kinds[k].emoji} ${kinds[k].short || kinds[k].label}</button>`).join("")}</div>
      </label>
      <label class="field"><span>Categorie</span><div class="select-wrap"><select id="te-cat">${catOptions}</select></div></label>
      <div class="te-sec">Houdbaarheid in dagen — leeg = niet geschikt</div>
      <div class="grid3">${locs.map(dayField).join("")}</div>
      <label class="field"><span>Ook herkennen als (komma-gescheiden)</span><input id="te-aliases" value="${esc((t.aliases || []).join(", "))}" placeholder="pasta bolognese, spaghetti"></label>
      <label class="field"><span>Notitie / bewaartip</span><input id="te-notes" value="${esc(t.notes || "")}" placeholder="Laat afkoelen voor invriezen"></label>
      <div class="modal-actions ${!isNew ? "with-del" : ""}">
        ${isOverride ? `<button class="btn ghost" id="te-reset">↺ Herstel</button>` : ""}
        ${!isNew ? `<button class="btn ghost danger-text" id="te-del">${isBuiltin ? "🙈 Verwijder" : "🗑 Verwijder"}</button>` : ""}
        <button class="btn primary" id="te-save">Opslaan</button>
      </div>
    `);
    const q = (s) => h.modal.querySelector(s);
    const prev = q("#te-prev");
    const syncPrev = () => { prev.textContent = (q("#te-emoji").value || "").trim() || catOf(q("#te-cat").value).emoji; };
    q("#te-emoji").addEventListener("input", syncPrev);
    q("#te-cat").addEventListener("change", syncPrev);
    let selKind = curKind;
    const kindEl = q("#te-kind");
    if (kindEl) kindEl.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        selKind = b.dataset.kind;
        kindEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      }));
    q("#te-close").addEventListener("click", h.close);
    q("#te-save").addEventListener("click", async () => {
      const name = (q("#te-name").value || "").trim();
      if (!name) { q("#te-name").focus(); return; }
      const shelf = {};
      h.modal.querySelectorAll(".te-day").forEach((inp) => {
        const v = inp.value.trim() === "" ? null : Math.min(3650, Math.max(0, parseInt(inp.value, 10) || 0));
        shelf[inp.dataset.loc] = v && v > 0 ? v : null;
      });
      const cat = q("#te-cat").value;
      const template = {
        name,
        emoji: (q("#te-emoji").value || "").trim() || catOf(cat).emoji,
        icon: (tpl && tpl.icon) || catOf(cat).icon,
        category: cat,
        kind: selKind,
        shelf_life: shelf,
        aliases: (q("#te-aliases").value || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
        notes: (q("#te-notes").value || "").trim(),
        source: "user",
      };
      if (tpl && tpl.id) template.id = tpl.id; // keep id → overrides builtin / updates own
      q("#te-save").disabled = true;
      try {
        await this._call("add_template", { template });
        h.close();
        this._toast(isNew ? "Template toegevoegd ✓" : "Template opgeslagen ✓");
        onChanged && onChanged();
      } catch (e) {
        q("#te-save").disabled = false;
        this._toast("Fout: " + (e.message || e), { type: "bad" });
      }
    });
    const reset = q("#te-reset");
    if (reset) reset.addEventListener("click", async () => {
      await this._call("remove_template", { template_id: tpl.id });
      h.close();
      this._toast("Hersteld naar standaard ✓");
      onChanged && onChanged();
    });
    const del = q("#te-del");
    if (del) del.addEventListener("click", async () => {
      if (isBuiltin) await this._call("hide_template", { template_id: tpl.id });
      else await this._call("remove_template", { template_id: tpl.id });
      h.close();
      this._toast(isBuiltin ? "Uit lijst gehaald ✓" : "Template verwijderd ✓");
      onChanged && onChanged();
    });
    setTimeout(() => q("#te-name").focus(), 60);
  }

  /* ---- ITEM DETAIL ---- */
  _openItemModal(i) {
    const lm = this._state.location_meta[i.location] || {};
    const col = STATUS_COLOR[i.status];
    const h = this._openModal(`
      <div class="detail-head" style="--c:${col}">
        <div class="d-emoji">${i.emoji || "🍽️"}</div>
        <div class="d-title"><h2>${esc(i.name)}</h2><div class="d-code">${esc(i.code)}</div></div>
        <button class="icon-btn" id="d-close">✕</button>
      </div>
      <div class="d-status" style="--c:${col}">${daysLabel(i.days_left)}${i.expiry_date ? " · " + fmtDate(i.expiry_date) : ""}</div>
      <div class="d-rows">
        <div class="d-row"><span>Locatie</span><b>${lm.emoji || ""} ${esc(lm.label || i.location)}</b></div>
        ${i.added_by_name ? `<div class="d-row"><span>Toegevoegd door</span><b class="who">${this._avatar(i.added_by_name, i.added_by_picture, 24)} ${esc(i.added_by_name)}</b></div>` : ""}
        ${i.contents && i.contents !== i.name ? `<div class="d-row"><span>Inhoud</span><b>${esc(i.contents)}</b></div>` : ""}
        <div class="d-row"><span>Erin gelegd</span><b>${fmtDate(i.added_date)}${i.age_days != null ? ` · ${i.age_days} dg geleden` : ""}</b></div>
        <div class="d-row"><span>Houdbaar tot</span><b>${i.expiry_date ? fmtDate(i.expiry_date) : "—"}</b></div>
        ${i.quantity ? `<div class="d-row"><span>Hoeveelheid</span><b>${esc(i.quantity)}</b></div>` : ""}
        ${i.notes ? `<div class="d-row"><span>Notitie</span><b>${esc(i.notes)}</b></div>` : ""}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="d-print">🏷️ Sticker</button>
        <button class="btn ghost" id="d-edit">✏️ Bewerken</button>
      </div>
      <div class="modal-actions done-row">
        <button class="btn good" id="d-eaten">🍽️ Opgegeten</button>
        <button class="btn tossed" id="d-tossed">🗑️ Weggegooid</button>
      </div>
    `);
    const q = (s) => h.modal.querySelector(s);
    q("#d-close").addEventListener("click", h.close);
    q("#d-print").addEventListener("click", () => this._printSticker(i.id));
    q("#d-edit").addEventListener("click", () => { h.close(); this._openAddModal({}, i); });
    q("#d-eaten").addEventListener("click", () => this._completeItem(i, "eaten", h.close));
    q("#d-tossed").addEventListener("click", () => this._completeItem(i, "tossed", h.close));
  }

  async _completeItem(item, action, close) {
    let ev = null;
    try {
      const res = await this._call("complete_item", { item_id: item.id, action });
      ev = res && res.event;
    } catch (e) {
      this._toast("Fout: " + (e.message || e), { type: "bad" });
      return;
    }
    close && close();
    const eaten = action === "eaten";
    this._toast(
      `${eaten ? "🍽️" : "🗑️"} ${esc(item.name)} ${eaten ? "opgegeten" : "weggegooid"}`,
      ev ? { actionLabel: "Ongedaan", onAction: () => this._call("restore_item", { event_id: ev.id }).catch(() => {}) } : {}
    );
  }

  async _eatScanned(raw, setStatus, count) {
    const val = String(raw || "").trim().toUpperCase();
    if (!(/^[A-Z]{2}\d{2}$/.test(val) || /^\d{2}[A-Z]{2}$/.test(val))) {
      setStatus(`Dit is geen eigen koelkast-label (${val})`);
      return;
    }
    const item = (this._state.items || []).find((i) => (i.code || "").toUpperCase() === val);
    if (!item) { setStatus(`Geen actief item met code ${val}`); return; }
    let ev = null;
    try {
      const res = await this._call("complete_item", { item_id: item.id, action: "eaten" });
      ev = res && res.event;
    } catch (e) { setStatus("Kon niet opeten — probeer opnieuw"); return; }
    count.n = (count.n || 0) + 1;
    setStatus(`🍽️ ${item.name} opgegeten (${count.n})`);
    this._toast(`🍽️ ${esc(item.name)} opgegeten`,
      ev ? { actionLabel: "Ongedaan", onAction: () => this._call("restore_item", { event_id: ev.id }).catch(() => {}) } : {});
  }

  /* ---- CLEAN MODE ---- */
  _openCleanModal() {
    const expired = this._state.items.filter((i) => i.status === "expired");
    const soon = this._state.items.filter((i) => i.status === "soon");
    const row = (i, checked) => {
      const lm = this._state.location_meta[i.location] || {};
      return `<label class="clean-row">
        <input type="checkbox" data-id="${i.id}" ${checked ? "checked" : ""}>
        <span class="cr-emoji">${i.emoji || "🍽️"}</span>
        <span class="cr-name"><b>${esc(i.name)}</b><small>${lm.emoji || ""} ${esc(lm.label || i.location)} · ${esc(i.code)}</small></span>
        <span class="cr-days" style="--c:${STATUS_COLOR[i.status]}">${daysLabel(i.days_left)}</span>
      </label>`;
    };
    const h = this._openModal(`
      <div class="modal-head"><div class="m-title"><h3>🧹 Koelkast opruimen</h3></div><button class="icon-btn" id="c-close">✕</button></div>
      ${expired.length ? `<div class="clean-sec">Over datum</div>${expired.map((i) => row(i, true)).join("")}` : ""}
      ${soon.length ? `<div class="clean-sec">Bijna over datum</div>${soon.map((i) => row(i, false)).join("")}` : ""}
      ${!expired.length && !soon.length ? `<div class="empty small"><div class="empty-emoji">✨</div><p>Alles is nog goed!</p></div>` : ""}
      ${(expired.length || soon.length) ? `<div class="modal-actions"><button class="btn danger" id="c-remove">Verwijder geselecteerde</button></div>` : ""}
    `, { wide: true });
    const q = (s) => h.modal.querySelector(s);
    q("#c-close").addEventListener("click", h.close);
    const rm = q("#c-remove");
    const updateBtn = () => {
      const n = h.modal.querySelectorAll("input[data-id]:checked").length;
      if (rm) { rm.textContent = n ? `Verwijder ${n} item${n === 1 ? "" : "s"}` : "Niets geselecteerd"; rm.disabled = !n; }
    };
    h.modal.querySelectorAll("input[data-id]").forEach((c) => c.addEventListener("change", updateBtn));
    updateBtn();
    if (rm) rm.addEventListener("click", async () => {
      const ids = [...h.modal.querySelectorAll("input[data-id]:checked")].map((c) => c.dataset.id);
      if (!ids.length) return;
      rm.disabled = true;
      const res = await this._call("remove_expired", { ids });
      h.close();
      this._toast(`🧹 ${res.count} item${res.count === 1 ? "" : "s"} opgeruimd`);
    });
  }

  /* ---- BARCODE SCANNER ---- */
  async _makeDetector() {
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

  _loadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!this._zxingPromise) {
      this._zxingPromise = new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = "/fridge_assistant_static/zxing.min.js";
        s.onload = () => resolve(window.ZXing || null);
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      });
    }
    return this._zxingPromise;
  }

  async _openScanner() {
    const bd = "BarcodeDetector" in window;
    const zxing = bd ? null : await this._loadZXing();   // decoder for iOS etc.
    const decodable = bd || !!zxing;
    const canLive = decodable && window.isSecureContext
      && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><div class="m-strong">📷 Scan</div>
          <div class="m-sub">Je koelkast-label om te zoeken, of een winkelbarcode</div></div>
        <button class="icon-btn" id="sc-close">✕</button>
      </div>
      <div class="seg sc-mode" id="sc-mode">
        <button type="button" data-mode="find" class="on">🔎 Zoeken</button>
        <button type="button" data-mode="eat">🍽️ Opeten</button>
      </div>
      <div class="scanbox${canLive ? "" : " hidden"}" id="sc-box">
        <video id="sc-video" playsinline muted></video><div class="scan-frame"></div>
      </div>
      <div class="scan-status" id="sc-status"></div>
      <div class="modal-actions">
        ${decodable ? `<label class="btn ghost filepick">📸 Foto<input id="sc-file" type="file" accept="image/*" capture="environment"></label>` : ""}
        <button class="btn ghost" id="sc-manual">⌨️ Code typen</button>
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
      if (mode === "eat") this._eatScanned(raw, setStatus, eatCount);
      else { stop(); this._onScan(raw, h); }
    };
    const modeEl = q("#sc-mode");
    modeEl.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.dataset.mode;
        modeEl.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        setStatus(mode === "eat"
          ? "🍽️ Scan je labels — elk item wordt meteen opgegeten"
          : "Richt op de barcode…");
      }));
    q("#sc-close").addEventListener("click", () => { stop(); h.close(); });

    q("#sc-manual").addEventListener("click", () => {
      stop();
      const box = q("#sc-box"); if (box) box.classList.add("hidden");
      q("#sc-status").innerHTML = `<div class="scan-manual"><input id="sc-code" placeholder="Code, bv. AB12" autocomplete="off" autocapitalize="characters" enterkeyhint="search"><button class="btn primary" id="sc-go">Zoek</button></div>`;
      const go = () => { const v = (q("#sc-code").value || "").trim(); if (v) handle(v); };
      q("#sc-go").addEventListener("click", go);
      q("#sc-code").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
      setTimeout(() => q("#sc-code") && q("#sc-code").focus(), 60);
    });

    const fileEl = q("#sc-file");
    if (fileEl) fileEl.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      q("#sc-status").textContent = "Foto lezen…";
      try {
        let raw = null;
        if (bd) {
          const det = await this._makeDetector();
          const codes = await det.detect(await createImageBitmap(f));
          if (codes && codes.length) raw = codes[0].rawValue;
        } else if (zxing) {
          const url = URL.createObjectURL(f);
          try { const r = await new zxing.BrowserMultiFormatReader().decodeFromImageUrl(url); raw = r && r.getText(); }
          finally { URL.revokeObjectURL(url); }
        }
        if (raw) { handle(raw); return; }
        q("#sc-status").textContent = "Geen barcode gevonden — probeer dichterbij en scherp.";
      } catch (err) { q("#sc-status").textContent = "Geen barcode gevonden — probeer dichterbij en scherp."; }
    });

    if (!canLive) {
      q("#sc-status").textContent = decodable
        ? "Maak een foto van de barcode 📸"
        : "Live scannen kan niet op dit toestel. Typ de code ⌨️.";
      if (!decodable) setTimeout(() => q("#sc-manual").click(), 0);
      return;
    }

    const video = q("#sc-video");
    q("#sc-status").textContent = "Richt op de barcode…";
    if (bd) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      } catch (err) {
        q("#sc-box").classList.add("hidden");
        q("#sc-status").textContent = "Geen camera-toegang. Gebruik 📸 Foto of ⌨️ Code.";
        return;
      }
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* autoplay quirks */ }
      const det = await this._makeDetector();
      const tick = async () => {
        if (stopped || !video.isConnected) { stop(); return; }
        try {
          const codes = await det.detect(video);
          if (codes && codes.length) handle(codes[0].rawValue);
        } catch (e) { /* transient decode error */ }
        if (!stopped) timer = setTimeout(tick, 170);
      };
      tick();
    } else {
      // ZXing manages getUserMedia + the continuous decode loop itself.
      const cb = (result) => {
        if (stopped) return;
        if (!video.isConnected) { stop(); return; }
        if (result) handle(result.getText());
      };
      try {
        reader = new zxing.BrowserMultiFormatReader();
        try { await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, video, cb); }
        catch (e) { await reader.decodeFromVideoDevice(null, video, cb); }
      } catch (err) {
        q("#sc-box").classList.add("hidden");
        q("#sc-status").textContent = "Geen camera-toegang. Gebruik 📸 Foto of ⌨️ Code.";
      }
    }
  }

  _onScan(raw, h) {
    const val = String(raw || "").trim().toUpperCase();
    if (h && h.close) h.close();
    // Our own label: 2 letters + 2 digits, either order (AB12 / 12AB).
    if (/^[A-Z]{2}\d{2}$/.test(val) || /^\d{2}[A-Z]{2}$/.test(val)) {
      const item = (this._state.items || []).find((i) => (i.code || "").toUpperCase() === val);
      if (item) { this._openItemModal(item); this._toast(`🔎 ${esc(item.name)} gevonden`); }
      else this._toast(`Geen actief item met code ${esc(val)} — misschien al opgegeten/weggegooid (📜)`, { type: "bad" });
      return;
    }
    // Public retail barcode: EAN-8/13 or UPC (8–14 digits).
    if (/^\d{8,14}$/.test(val)) { this._onRetailBarcode(val); return; }
    this._toast(`Onbekende code: ${esc(val)}`, { type: "bad" });
  }

  async _onRetailBarcode(code) {
    // Resolve server-side: our own memory first, then OpenFoodFacts (no key).
    this._toast(`🔎 Product opzoeken… (${code})`);
    let res = null;
    try { res = await this._call("lookup_barcode", { barcode: code }); }
    catch (e) { /* offline / not ready — fall through */ }
    const src = (res && (res.known || res.product)) || null;

    if (!src || !src.name) {
      this._openAddModal({ notes: `Winkelbarcode ${code}`, barcode: code });
      this._toast(`Geen productnaam gevonden (${code}) — vul zelf in`, { type: "bad" });
      return;
    }
    const known = !!(res && res.known);
    this._openAddModal({
      name: src.name,
      category: src.category || null,
      quantity: src.quantity || "",
      photo: src.photo || "",
      emoji: src.emoji || undefined,
      kind: src.kind || undefined,
      notes: known ? "" : `Winkelbarcode ${code}`,
      barcode: code,
    });
    this._toast(known ? `🔁 Eerder toegevoegd — herkend` : `🛒 ${src.name}`);
  }

  /* ---- HISTORY (paged) ---- */
  _relTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d)) return "";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "net";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min geleden`;
    const hh = Math.floor(m / 60);
    if (hh < 24) return `${hh} uur geleden`;
    const dd = Math.floor(hh / 24);
    if (dd === 1) return "gisteren";
    if (dd < 7) return `${dd} dagen geleden`;
    return `${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`;
  }

  _historyRow(e) {
    const it = e.item || {};
    const lm = (this._state.location_meta || {})[it.location] || {};
    const eaten = e.action === "eaten";
    const act = `<span class="hi-act ${eaten ? "eaten" : "tossed"}">${eaten ? "🍽️ Opgegeten" : "🗑️ Weggegooid"}</span>`;
    const who = e.by_name
      ? `<span class="who">${this._avatar(e.by_name, e.by_picture, 18)}${esc(e.by_name)}</span>`
      : `<span class="muted">—</span>`;
    return `<div class="hi-row">
      <span class="hi-emoji">${it.emoji || "🍽️"}</span>
      <div class="hi-main">
        <div class="hi-title">${esc(it.name || "?")} ${it.code ? `<span class="code">${esc(it.code)}</span>` : ""}</div>
        <div class="hi-sub2">${act}${it.location ? ` · ${lm.emoji || ""} ${esc(lm.label || it.location)}` : ""}</div>
      </div>
      <div class="hi-right">${who}<div class="hi-time">${esc(this._relTime(e.ts))}</div>
        <button class="hi-undo" data-restore="${esc(e.id)}" title="Terugzetten in de koelkast">↩︎ Terug</button>
      </div>
    </div>`;
  }

  _openHistory() {
    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><h3>📜 Geschiedenis</h3><div class="s-sub" id="hi-sub"></div></div>
        <button class="icon-btn" id="hi-close">✕</button>
      </div>
      <div class="tp-list" id="hi-list"><div class="loading">Laden…</div></div>
      <div class="modal-actions" id="hi-more-wrap" style="display:none">
        <button class="btn ghost" id="hi-more">Meer laden</button>
      </div>
    `, { wide: true });
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
      try { res = await this._call("history", { limit: PAGE, offset }); }
      catch (e) { listEl.innerHTML = `<div class="empty small"><p>Kon geschiedenis niet laden.</p></div>`; return; }
      total = res.total;
      loaded.push(...(res.events || []));
      offset += (res.events || []).length;
      if (!loaded.length) {
        listEl.innerHTML = `<div class="empty small"><div class="empty-emoji">📭</div><p>Nog niets opgegeten of weggegooid.</p></div>`;
      } else {
        listEl.innerHTML = loaded.map((e) => this._historyRow(e)).join("");
        listEl.querySelectorAll("[data-restore]").forEach((b) =>
          b.addEventListener("click", async () => {
            const id = b.dataset.restore;
            b.disabled = true;
            try { await this._call("restore_item", { event_id: id }); }
            catch (e) { b.disabled = false; this._toast("Herstellen mislukt", { type: "bad" }); return; }
            const idx = loaded.findIndex((x) => x.id === id);
            if (idx >= 0) loaded.splice(idx, 1);
            total = Math.max(0, total - 1);
            offset = Math.max(0, offset - 1);
            const row = b.closest(".hi-row"); if (row) row.remove();
            q("#hi-sub").textContent = total ? `${total} afgerond${total >= 500 ? " (laatste 500)" : ""}` : "";
            this._toast("↩︎ Teruggezet in de koelkast");
          }));
      }
      q("#hi-sub").textContent = total ? `${total} afgerond${total >= 500 ? " (laatste 500)" : ""}` : "";
      const wrap = q("#hi-more-wrap");
      if (offset < total) { wrap.style.display = ""; if (more) more.disabled = false; }
      else wrap.style.display = "none";
    };
    q("#hi-more").addEventListener("click", load);
    load();
  }

  _printSticker(id) {
    const item = (this._state.items || []).find((x) => x.id === id);
    const opts = this._state.options || {};
    const p = this._state.printer || {};
    const copies = opts.label_copies || 1;
    const note = opts.printer_enabled
      ? `Label <b>${esc(p.label || "99014")}</b> (${esc(p.label_size || "54 × 101 mm")}, getest) · printer automatisch gedetecteerd. Print ${copies}× per keer.`
      : `Label <b>${esc(p.label || "99014")}</b> (${esc(p.label_size || "54 × 101 mm")}).<br>De printer staat uit — installeer de <b>Label Printer</b> add-on en zet 'm aan bij ⚙️ instellingen.`;

    const h = this._openModal(`
      <div class="modal-head">
        <div class="m-title"><div class="m-strong">🏷️ Sticker printen</div>
          <div class="m-sub">${esc(item?.name || "")} · <code>${esc(item?.code || "")}</code></div>
        </div>
        <button class="icon-btn" id="p-close">✕</button>
      </div>
      <div class="label-preview" id="p-preview"><div class="muted">Voorbeeld laden…</div></div>
      <div class="print-note">${note}</div>
      <div class="modal-actions">
        <button class="btn ghost" id="p-cancel">Sluiten</button>
        <button class="btn primary" id="p-print">🖨️ Print${copies > 1 ? ` (${copies}×)` : ""}</button>
      </div>
    `, { wide: false });
    const q = (s) => h.modal.querySelector(s);
    q("#p-close").addEventListener("click", h.close);
    q("#p-cancel").addEventListener("click", h.close);

    (async () => {
      try {
        const r = await this._call("render_label", { item_id: id });
        q("#p-preview").innerHTML = `<img alt="Label ${esc(item?.code || "")}" src="data:image/png;base64,${r.png_base64}">`;
      } catch (e) {
        q("#p-preview").innerHTML = `<div class="muted">Voorbeeld niet beschikbaar: ${esc(e.message || e)}</div>`;
      }
    })();

    q("#p-print").addEventListener("click", async () => {
      const btn = q("#p-print");
      btn.disabled = true; btn.textContent = "Bezig…";
      try {
        const res = await this._call("print_sticker", { item_id: id });
        if (res.printed) {
          this._toast(`🖨️ Sticker ${res.code} geprint${res.copies > 1 ? ` (${res.copies}×)` : ""}`);
          h.close();
          return;
        }
        const map = {
          printer_disabled: "Printer staat uit — zet 'm aan bij ⚙️ instellingen.",
          printer_unreachable: "Label Printer add-on niet bereikbaar. Staat de add-on aan?",
          printer_not_connected: "De DYMO is niet gevonden. Check kabel/stroom en herstart de add-on.",
          render_failed: "Label renderen mislukte.",
        };
        this._toast("🖨️ " + (map[res.reason] || `Printen mislukte (${res.reason || "?"})`), { type: "bad" });
        btn.disabled = false; btn.textContent = `🖨️ Print${copies > 1 ? ` (${copies}×)` : ""}`;
      } catch (e) {
        this._toast("Print mislukt: " + (e.message || e), { type: "bad" });
        btn.disabled = false; btn.textContent = `🖨️ Print${copies > 1 ? ` (${copies}×)` : ""}`;
      }
    });
  }

  /* ---- TOAST ---- */
  _toast(msg, { actionLabel, onAction, type = "" } = {}) {
    const root = this.shadowRoot.getElementById("toast-root");
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    if (actionLabel) {
      const b = document.createElement("button");
      b.textContent = actionLabel;
      b.addEventListener("click", () => { onAction && onAction(); t.remove(); });
      t.appendChild(b);
    }
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 250); }, actionLabel ? 6000 : 3200);
  }
}

const STYLES = `
:host{
  --fa-accent:#007AFF; --fa-red:#FF3B30; --fa-orange:#FF9500; --fa-green:#34C759;
  --fa-bg:var(--primary-background-color,#f5f5f7);
  --fa-card:var(--card-background-color,#fff);
  --fa-text:var(--primary-text-color,#1d1d1f);
  --fa-muted:var(--secondary-text-color,#86868b);
  --fa-border:var(--divider-color,rgba(0,0,0,.1));
  display:block; height:100%; background:var(--fa-bg); color:var(--fa-text);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,system-ui,sans-serif;
}
*{box-sizing:border-box;}
.wrap{max-width:960px;margin:0 auto;padding:16px 16px 96px;}
.topbar{position:sticky;top:0;z-index:5;padding:14px 4px;background:linear-gradient(var(--fa-bg),var(--fa-bg) 70%,transparent);}
.brand{display:flex;align-items:center;gap:10px;}
.brand-emoji{font-size:26px;}
.brand h1{font-size:26px;font-weight:700;margin:0;letter-spacing:-.02em;}
.counts{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;}
.pill{background:var(--fa-card);border:1px solid var(--fa-border);border-radius:999px;padding:5px 12px;font-size:13px;color:var(--fa-muted);}
.pill b{color:var(--fa-text);}
.pill.warn{color:var(--fa-orange);} .pill.warn b{color:var(--fa-orange);}
.pill.bad{color:var(--fa-red);} .pill.bad b{color:var(--fa-red);}
.top-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.search{display:flex;align-items:center;gap:6px;background:var(--fa-card);border:1px solid var(--fa-border);border-radius:12px;padding:0 12px;height:40px;flex:1;min-width:140px;}
.search input{border:none;background:none;outline:none;color:var(--fa-text);font-size:15px;width:100%;}
.search.big{height:46px;margin:6px 0 12px;}
.filters{display:flex;gap:8px;overflow-x:auto;padding:6px 4px 12px;scrollbar-width:none;}
.filters::-webkit-scrollbar{display:none;}
.chip{white-space:nowrap;border:1px solid var(--fa-border);background:var(--fa-card);color:var(--fa-text);border-radius:999px;padding:7px 14px;font-size:14px;cursor:pointer;transition:.15s;}
.chip.active{background:var(--fa-accent);color:#fff;border-color:var(--fa-accent);}
.chip-n{opacity:.6;font-size:12px;margin-left:2px;}
.chip.active .chip-n{opacity:.85;}

.btn{border:none;border-radius:12px;padding:0 16px;height:40px;font-size:15px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:.15s;}
.btn.small{height:40px;padding:0 13px;font-size:14px;}
.btn.primary{background:var(--fa-accent);color:#fff;}
.btn.primary:hover{filter:brightness(1.08);transform:translateY(-1px);}
.btn.ghost{background:var(--fa-card);color:var(--fa-text);border:1px solid var(--fa-border);}
.btn.good{background:var(--fa-green);color:#fff;}
.btn.danger{background:var(--fa-red);color:#fff;width:100%;}
.btn.ai{background:linear-gradient(135deg,#7B61FF,#B06AFF);color:#fff;}
.btn:disabled{opacity:.5;cursor:default;transform:none;}
.icon-btn{border:none;background:transparent;color:var(--fa-muted);font-size:18px;cursor:pointer;width:40px;height:40px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;}
.icon-btn:hover{background:var(--fa-border);}
.link{background:none;border:none;color:var(--fa-accent);cursor:pointer;font-size:14px;padding:8px 2px;font-weight:500;}

.cards{display:flex;flex-direction:column;gap:8px;}
.card{display:flex;align-items:center;gap:12px;background:var(--fa-card);border:1px solid var(--fa-border);border-radius:16px;padding:12px 12px;cursor:pointer;transition:.15s;position:relative;}
.card:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,.08);}
.card-emoji{font-size:30px;width:44px;text-align:center;flex:none;}
.card-main{flex:1;min-width:0;}
.card-title{font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.card-sub{display:flex;gap:8px;align-items:center;margin-top:3px;flex-wrap:wrap;}
.tag{font-size:12px;color:var(--fa-muted);}
.code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;background:var(--fa-border);border-radius:6px;padding:1px 6px;letter-spacing:.05em;}
.muted{color:var(--fa-muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}
.card-right{text-align:right;flex:none;}
.who{display:inline-flex;align-items:center;gap:5px;}
.card-sub .who{font-size:12px;color:var(--fa-muted);}
.avatar{border-radius:50%;object-fit:cover;flex:none;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;background:var(--fa-border);}
.avatar-i{color:#fff;font-weight:700;line-height:1;}
.d-row b.who{gap:7px;}
.status{font-size:13px;font-weight:600;color:var(--c);}
.card-when{font-size:11px;color:var(--fa-muted);margin-top:2px;}
.card-print{font-size:15px;flex:none;}

.strip{margin-bottom:16px;}
.strip-head{font-size:13px;font-weight:600;color:var(--fa-muted);margin:2px 4px 8px;}
.strip-row{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}
.strip-row::-webkit-scrollbar{display:none;}
.ucard{flex:none;width:120px;background:var(--fa-card);border:1px solid var(--fa-border);border-top:3px solid var(--c);border-radius:14px;padding:12px 10px;cursor:pointer;transition:.15s;}
.ucard:hover{transform:translateY(-2px);}
.ucard-emoji{font-size:26px;}
.ucard-name{font-weight:600;font-size:14px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ucard-days{font-size:12px;color:var(--c);font-weight:600;margin-top:2px;}

.loading,.empty{text-align:center;color:var(--fa-muted);padding:60px 20px;}
.empty-emoji{font-size:52px;margin-bottom:12px;}
.empty h2{color:var(--fa-text);margin:0 0 6px;font-size:20px;}
.empty.small{padding:30px;}
.empty .btn{margin-top:14px;}

/* modal */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .18s;z-index:50;padding:0;}
.overlay.show{opacity:1;}
@media(min-width:640px){.overlay{align-items:center;padding:24px;}}
.modal{background:var(--fa-card);width:100%;max-width:520px;max-height:92vh;overflow-y:auto;border-radius:22px 22px 0 0;padding:18px;transform:translateY(24px);transition:transform .2s;box-shadow:0 -10px 40px rgba(0,0,0,.2);}
.modal.wide{max-width:600px;}
@media(min-width:640px){.modal{border-radius:22px;transform:translateY(12px) scale(.98);}}
.overlay.show .modal{transform:none;}
.modal-head{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.m-emoji{font-size:34px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:var(--fa-bg);border-radius:14px;flex:none;}
.m-title{flex:1;min-width:0;}
.m-title h2,.m-title h3{margin:0;font-size:19px;}
.m-name{width:100%;border:none;background:none;outline:none;font-size:19px;font-weight:600;color:var(--fa-text);border-bottom:2px solid var(--fa-border);padding:4px 0;}
.m-name:focus{border-color:var(--fa-accent);}
.m-strong{font-size:18px;font-weight:700;}
.m-sub{font-size:13px;color:var(--fa-muted);margin-top:2px;}
.m-sub code{font-family:ui-monospace,"SF Mono",Menlo,monospace;background:var(--fa-border);border-radius:5px;padding:1px 5px;}
.label-preview{display:flex;align-items:center;justify-content:center;min-height:220px;padding:14px;background:repeating-conic-gradient(var(--fa-bg) 0% 25%,var(--fa-border) 0% 50%) 0/22px 22px;border-radius:14px;}
.label-preview img{max-height:420px;width:auto;max-width:100%;border-radius:10px;box-shadow:0 4px 22px rgba(0,0,0,.25);background:#fff;}
.print-note{font-size:12.5px;color:var(--fa-muted);line-height:1.5;margin:12px 4px 0;text-align:center;}
.print-note b{color:var(--fa-text);}

.field{display:flex;flex-direction:column;gap:5px;margin:10px 0;}
.field>span{font-size:13px;color:var(--fa-muted);font-weight:500;}
.field input{height:44px;border:1.5px solid var(--fa-border);border-radius:12px;padding:0 14px;font-size:16px;background:var(--fa-bg);color:var(--fa-text);outline:none;transition:.15s;}
.field input:focus{border-color:var(--fa-accent);box-shadow:0 0 0 4px rgba(0,122,255,.1);}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.expiry-hint{font-size:13px;font-weight:600;min-height:18px;margin:-2px 2px 4px;}

.seg{display:flex;gap:6px;background:var(--fa-bg);border-radius:12px;padding:4px;margin:12px 0;}
.seg button{flex:1;border:none;background:none;color:var(--fa-text);padding:9px 4px;border-radius:9px;font-size:14px;cursor:pointer;transition:.15s;}
.seg button.on{background:var(--fa-card);box-shadow:0 1px 4px rgba(0,0,0,.12);font-weight:600;}

.suggest{margin:4px 0 6px;padding:12px;border-radius:14px;background:var(--fa-bg);display:flex;align-items:center;gap:10px;min-height:10px;}
.suggest:empty{display:none;}
.suggest.ok{background:rgba(52,199,89,.12);}
.suggest.ai{background:rgba(123,97,255,.1);flex-direction:column;align-items:stretch;}
.suggest.bad{background:rgba(255,59,48,.12);}
.s-emoji{font-size:24px;}
.s-body{flex:1;min-width:0;}
.s-sub{font-size:12.5px;color:var(--fa-muted);margin-top:2px;}
.s-badge{font-size:10px;text-transform:uppercase;letter-spacing:.06em;background:var(--fa-green);color:#fff;border-radius:6px;padding:2px 6px;font-weight:700;}
.s-badge.ai{background:#7B61FF;}
.ai-head{display:flex;align-items:center;gap:8px;font-size:15px;}
.ai-locs{display:flex;gap:8px;margin:10px 0;}
.ai-loc{flex:1;background:var(--fa-card);border-radius:10px;padding:8px 4px;text-align:center;}
.ai-loc span{font-size:18px;display:block;}
.ai-loc b{display:block;font-size:15px;margin:2px 0;}
.ai-loc small{color:var(--fa-muted);font-size:11px;}
.checkline{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--fa-muted);margin-top:6px;cursor:pointer;}
.spinner{width:20px;height:20px;border:2.5px solid var(--fa-border);border-top-color:#7B61FF;border-radius:50%;animation:spin .7s linear infinite;flex:none;}
@keyframes spin{to{transform:rotate(360deg);}}

.adv.hidden,.hidden{display:none;}
.modal-actions{display:flex;gap:10px;margin-top:18px;}
.modal-actions .btn{flex:1;}
.modal-actions.three .btn{font-size:14px;padding:0 8px;}

.tp-list{display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto;}
.tp-item{display:flex;align-items:center;gap:12px;background:var(--fa-bg);border:1px solid transparent;border-radius:12px;padding:10px;cursor:pointer;text-align:left;color:var(--fa-text);}
.tp-item:hover{border-color:var(--fa-accent);}
.tp-emoji{font-size:24px;width:34px;text-align:center;}
.tp-name{flex:1;display:flex;flex-direction:column;}
.tp-name small{color:var(--fa-muted);font-size:12px;}
.tp-sl{display:flex;gap:5px;}
.tp-sl i{font-style:normal;font-size:11px;color:var(--fa-muted);background:var(--fa-card);border-radius:6px;padding:2px 5px;}

.detail-head{display:flex;align-items:center;gap:12px;}
.d-emoji{font-size:40px;width:60px;height:60px;display:flex;align-items:center;justify-content:center;background:var(--fa-bg);border-radius:16px;}
.d-title{flex:1;} .d-title h2{margin:0;font-size:21px;}
.d-code{font-family:ui-monospace,monospace;font-size:13px;color:var(--fa-muted);letter-spacing:.08em;margin-top:2px;}
.d-status{margin:14px 0;padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--c) 14%,transparent);color:var(--c);font-weight:600;text-align:center;}
.d-rows{display:flex;flex-direction:column;}
.d-row{display:flex;justify-content:space-between;gap:12px;padding:11px 2px;border-bottom:1px solid var(--fa-border);font-size:15px;}
.d-row:last-child{border:none;}
.d-row span{color:var(--fa-muted);}
.d-row b{text-align:right;font-weight:600;}

/* done actions + history */
.btn.tossed{background:var(--fa-red);color:#fff;}
.done-row{margin-top:10px;}
.hi-row{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--fa-border);}
.hi-row:last-child{border:none;}
.hi-emoji{font-size:24px;width:34px;text-align:center;flex:none;}
.hi-main{flex:1;min-width:0;}
.hi-title{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hi-title .code{font-weight:400;}
.hi-sub2{font-size:12px;color:var(--fa-muted);margin-top:2px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.hi-act{font-weight:600;}
.hi-act.eaten{color:var(--fa-green);}
.hi-act.tossed{color:var(--fa-red);}
.hi-right{flex:none;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
.hi-right .who{font-size:12px;color:var(--fa-muted);}
.hi-time{font-size:11px;color:var(--fa-muted);}
.hi-undo{border:none;background:transparent;color:var(--fa-accent);font-size:12px;font-weight:600;cursor:pointer;padding:3px 6px;margin-top:2px;border-radius:8px;}
.hi-undo:hover{background:var(--fa-border);}
.hi-undo:disabled{opacity:.5;}
.sc-mode{margin:2px 0 10px;}

.clean-sec{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--fa-muted);margin:14px 2px 6px;font-weight:600;}
.clean-row{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--fa-border);}
.clean-row input{width:20px;height:20px;accent-color:var(--fa-red);}
.cr-emoji{font-size:22px;}
.cr-name{flex:1;display:flex;flex-direction:column;}
.cr-name small{color:var(--fa-muted);font-size:12px;}
.cr-days{font-size:12px;font-weight:600;color:var(--c);}

#toast-root{position:fixed;bottom:20px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:100;pointer-events:none;}
.toast{background:#1d1d1f;color:#fff;border-radius:12px;padding:12px 16px;font-size:14px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 30px rgba(0,0,0,.3);transform:translateY(20px);opacity:0;transition:.25s;pointer-events:auto;max-width:90%;}
.toast.show{transform:none;opacity:1;}
.toast.bad{background:var(--fa-red);}
.toast.info{background:var(--fa-accent);}
.toast button{background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer;}

/* ===================== mobile-first / companion app ===================== */
:host{overflow-x:hidden;-webkit-tap-highlight-color:transparent;}
.wrap{padding:0 max(14px,env(safe-area-inset-right)) calc(104px + env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));overflow-x:hidden;}
.topbar{padding:calc(10px + env(safe-area-inset-top)) 2px 6px;}
.topbar-row{display:flex;align-items:center;gap:6px;min-height:44px;}
.brand{gap:8px;}
.brand h1{font-size:22px;}
.spacer{flex:1;}
.menu-slot{display:flex;align-items:center;}
.menu-slot ha-menu-button{--mdc-icon-button-size:44px;color:var(--fa-text);margin-right:2px;}
.counts{margin:8px 0 0;}
.searchrow{display:flex;gap:8px;align-items:center;margin-top:8px;}
.search{height:44px;}
.search input{font-size:16px;}
.btn{height:44px;}
.btn.icon-only{width:44px;padding:0;font-size:18px;flex:none;}
.icon-btn{width:44px;height:44px;font-size:19px;}

/* Floating add button — thumb-reachable when you're standing at the fridge */
.fab{position:fixed;z-index:40;right:calc(18px + env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom));width:60px;height:60px;border-radius:20px;border:none;background:var(--fa-accent);color:#fff;font-size:34px;font-weight:300;line-height:0;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(0,122,255,.5);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;padding-bottom:4px;}
.fab:active{transform:scale(.92);}
/* secondary camera FAB, sits left of the add button */
.fab-scan{width:54px;height:54px;right:calc(90px + env(safe-area-inset-right));bottom:calc(23px + env(safe-area-inset-bottom));font-size:24px;background:var(--fa-card);color:var(--fa-text);border:1px solid var(--fa-border);box-shadow:0 8px 22px rgba(0,0,0,.2);}

/* scanner */
.scanbox{position:relative;background:#000;border-radius:16px;overflow:hidden;aspect-ratio:4/3;max-height:48vh;display:flex;align-items:center;justify-content:center;margin-bottom:2px;}
.scanbox.hidden{display:none;}
.scanbox video{width:100%;height:100%;object-fit:cover;}
.scan-frame{position:absolute;left:8%;right:8%;top:30%;bottom:30%;border:3px solid rgba(255,255,255,.92);border-radius:12px;}
.scan-status{min-height:20px;font-size:13px;color:var(--fa-muted);text-align:center;margin:8px 4px 0;}
.scan-manual{display:flex;gap:8px;}
.scan-manual input{flex:1;height:46px;border:1.5px solid var(--fa-border);border-radius:12px;padding:0 14px;font-size:16px;background:var(--fa-bg);color:var(--fa-text);text-transform:uppercase;letter-spacing:.05em;outline:none;}
.filepick{position:relative;overflow:hidden;}
.filepick input{position:absolute;inset:0;opacity:0;font-size:0;}

/* suggestion action buttons: accept implicitly, or override / reject a guess */
.s-actions{display:flex;gap:6px;align-items:center;flex:none;flex-wrap:wrap;justify-content:flex-end;}
.s-mini{border:1px solid var(--fa-border);background:var(--fa-card);color:var(--fa-text);border-radius:10px;min-width:40px;height:36px;padding:0 10px;font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;}
.s-mini.ghost{color:var(--fa-muted);}
.s-mini.ai{background:linear-gradient(135deg,#7B61FF,#B06AFF);color:#fff;border:none;}

/* bottom-sheet: clear the iPhone home indicator + contain scroll */
.modal{padding-bottom:calc(18px + env(safe-area-inset-bottom));max-height:min(92vh,92dvh);overscroll-behavior:contain;}
.modal-actions .btn{min-height:48px;}

/* toasts sit above the FAB */
#toast-root{bottom:calc(90px + env(safe-area-inset-bottom));}
.toast{max-width:88%;}

/* no sticky :hover state on touch devices */
@media (hover:none){
  .card:hover,.ucard:hover,.tp-item:hover,.btn.primary:hover,.icon-btn:hover{transform:none;box-shadow:none;}
  .icon-btn:hover{background:transparent;}
}

/* editable AI day inputs */
.ai-sub{font-size:12px;color:var(--fa-muted);margin:2px 0 8px;}
.ai-loc.active{outline:2px solid var(--fa-accent);outline-offset:-1px;}
.ai-loc-emoji{font-size:18px;display:block;}
.ai-days-wrap{display:inline-flex;align-items:baseline;gap:2px;justify-content:center;margin:4px 0 2px;}
.ai-days{width:46px;text-align:center;font-size:16px;font-weight:700;border:1.5px solid var(--fa-border);border-radius:8px;background:var(--fa-card);color:var(--fa-text);height:34px;padding:0 2px;-moz-appearance:textfield;}
.ai-days::-webkit-outer-spin-button,.ai-days::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.ai-days:focus{outline:none;border-color:var(--fa-accent);}
.ai-days-wrap i{font-style:normal;font-size:11px;color:var(--fa-muted);}

/* templates manager + editor */
.tm-badge{font-size:9px;text-transform:uppercase;letter-spacing:.04em;border-radius:5px;padding:1px 5px;font-weight:700;vertical-align:middle;margin-left:6px;}
.tm-badge.own{background:var(--fa-accent);color:#fff;}
.tm-badge.edit{background:var(--fa-orange);color:#fff;}
.te-sec{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--fa-muted);font-weight:600;margin:14px 2px 2px;}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.grid3 .field{margin:4px 0;}
.grid3 .field input{text-align:center;padding:0 6px;}
.select-wrap{position:relative;}
.select-wrap select{width:100%;height:44px;border:1.5px solid var(--fa-border);border-radius:12px;background:var(--fa-bg);color:var(--fa-text);font-size:16px;padding:0 32px 0 14px;-webkit-appearance:none;appearance:none;}
.select-wrap::after{content:"▾";position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--fa-muted);pointer-events:none;}
.modal-actions.with-del{flex-wrap:wrap;}
.btn.danger-text{color:var(--fa-red);}
.seg button{white-space:nowrap;}
.strip-group{margin-bottom:4px;}
.strip-sub{font-size:12px;font-weight:600;color:var(--fa-muted);margin:8px 4px 6px;}

/* desktop niceties */
@media (min-width:640px){
  .brand h1{font-size:26px;}
}
`;

customElements.define("fridge-assistant-panel", FridgeAssistantPanel);
