/* Shared UI surfaces: modal/bottom-sheet, right-hand drawer, date field
 * wiring and toasts. All functions take the panel instance as their first
 * argument (for shadowRoot access); state lives on the panel, not here. */

import { esc, fmtDate, parseISO } from "./format.js";

/* On desktop, data-rich views open in a drawer that slides in from the right
 * (Attio-style side peek): no scrim, the list stays visible and clickable, and
 * opening another view swaps the drawer's content in place. On narrow screens
 * everything stays a bottom sheet. */
const DRAWER_MQ = "(min-width: 900px)";

export function openSurface(panel, innerHTML, { prefer = "modal", wide = false, onClose = null } = {}) {
  if (prefer === "drawer" && window.matchMedia(DRAWER_MQ).matches) {
    const h = openDrawer(panel, innerHTML);
    if (onClose) panel._onDrawerClosed = onClose;
    return h;
  }
  return openModal(panel, innerHTML, { wide, onClose });
}

export function openDrawer(panel, innerHTML) {
  let d = panel._drawerEl;
  if (d) {
    // Reuse the open drawer: let the previous view clean up, then swap.
    if (panel._onDrawerClosed) { const f = panel._onDrawerClosed; panel._onDrawerClosed = null; f(); }
    panel._refreshSurface = null;
  } else {
    d = document.createElement("aside");
    d.className = "drawer";
    d.setAttribute("role", "complementary");
    panel.shadowRoot.getElementById("modal-root").appendChild(d);
    requestAnimationFrame(() => d.classList.add("show"));
    panel.classList.add("fa-drawer-open");
    panel._drawerEl = d;
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(panel); };
    document.addEventListener("keydown", onKey);
    panel._drawerKeyHandler = onKey;
  }
  d.innerHTML = innerHTML;
  d.scrollTop = 0;
  return { modal: d, close: () => closeDrawer(panel) };
}

export function closeDrawer(panel) {
  const d = panel._drawerEl;
  if (!d) return;
  panel._drawerEl = null;
  panel._refreshSurface = null;
  if (panel._drawerKeyHandler) {
    document.removeEventListener("keydown", panel._drawerKeyHandler);
    panel._drawerKeyHandler = null;
  }
  panel.classList.remove("fa-drawer-open");
  d.classList.remove("show");
  setTimeout(() => d.remove(), 200);
  if (panel._onDrawerClosed) { const f = panel._onDrawerClosed; panel._onDrawerClosed = null; f(); }
}

export function openModal(panel, innerHTML, { wide = false, onClose = null } = {}) {
  const root = panel.shadowRoot.getElementById("modal-root");
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog">${innerHTML}</div>`;
  root.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 180);
    if (onClose) onClose();
  };
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  // Keep scroll/pull-to-refresh gestures from reaching the page behind the
  // sheet. Deliberately NOT done by touching document.body (the companion
  // app relies on body scrollability for pull-to-refresh, and a global
  // lock can stick if an overlay is ever removed outside close()); the
  // overlay covers the whole viewport, so containing the gestures here is
  // enough and holds no global state. Gestures inside a scrollable part of
  // the modal scroll natively; overscroll-behavior stops the chaining.
  const containScroll = (e) => {
    let el = e.target;
    while (el && el !== overlay) {
      if (el.scrollHeight > el.clientHeight + 1) return;
      if (el.scrollWidth > el.clientWidth + 1) return; // horizontal scrollers (sticker previews)
      el = el.parentElement;
    }
    e.preventDefault();
  };
  overlay.addEventListener("touchmove", containScroll, { passive: false });
  overlay.addEventListener("wheel", containScroll, { passive: false });
  const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
  return { overlay, modal: overlay.querySelector(".modal"), close };
}

/* Native date inputs render inconsistently (iOS ignores widths, empty
   fields show nothing useful), so the input sits invisible on top of an
   own display layer: formatted date in the user's language, a clear
   placeholder when empty, and an optional ✕. The native picker stays —
   taps land on the (transparent) input itself. */
export function wireDateField(inp, placeholder, lang) {
  const wrap = inp.closest(".datefield");
  const disp = wrap.querySelector(".df-display");
  const thisYear = new Date().getFullYear();
  const sync = () => {
    const v = inp.value;
    wrap.classList.toggle("has-value", !!v);
    if (v) {
      const dt = parseISO(v);
      const year = dt && dt.getUTCFullYear() !== thisYear ? ` ${dt.getUTCFullYear()}` : "";
      disp.innerHTML = `<span class="df-ico"><ha-icon icon="mdi:calendar-outline"></ha-icon></span><b>${fmtDate(v, lang)}${year}</b>`;
    } else {
      disp.innerHTML = `<span class="df-ico"><ha-icon icon="mdi:calendar-outline"></ha-icon></span><span class="df-ph">${esc(placeholder)}</span>`;
    }
  };
  // Programmatic writes (suggestions, AI estimates) assign .value directly
  // and fire no events; intercept the property on this one instance so the
  // display can never go stale, whatever code sets the date.
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(inp, "value", {
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); sync(); },
  });
  inp.addEventListener("input", sync);
  inp.addEventListener("change", sync);
  // Desktop browsers only open the calendar from their own icon (which is
  // invisible here) — ask for the picker explicitly on click/tap.
  inp.addEventListener("click", () => { try { inp.showPicker?.(); } catch (_) {} });
  const clr = wrap.querySelector(".df-clear");
  if (clr) clr.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    inp.value = "";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  sync();
  return sync;
}

export function toast(panel, msg, { actionLabel, onAction, type = "" } = {}) {
  const root = panel.shadowRoot.getElementById("toast-root");
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
