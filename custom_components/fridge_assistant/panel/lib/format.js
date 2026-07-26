/* Small date/text helpers (timezone-safe, YYYY-MM-DD). */

import { MONTHS } from "../strings.js";

export function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
export function parseISO(d) {
  if (!d) return null;
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}
export function toISO(dt) {
  return dt.toISOString().slice(0, 10);
}
export function addDays(iso, n) {
  const dt = parseISO(iso);
  if (!dt) return null;
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}
export function daysBetween(fromISO, toISOv) {
  const a = parseISO(fromISO), b = parseISO(toISOv);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}
export function fmtDate(iso, lang) {
  const dt = parseISO(iso);
  if (!dt) return "—";
  return `${dt.getUTCDate()} ${MONTHS[lang][dt.getUTCMonth()]}`;
}
export function daysLabel(daysLeft, lang) {
  if (daysLeft === null || daysLeft === undefined) return lang === "nl" ? "geen datum" : "no date";
  if (daysLeft < 0) {
    const abs = Math.abs(daysLeft);
    return lang === "nl"
      ? `${abs} dag${abs === 1 ? "" : "en"} over datum`
      : `${abs} day${abs === 1 ? "" : "s"} past date`;
  }
  if (daysLeft === 0) return lang === "nl" ? "vandaag!" : "today!";
  if (daysLeft === 1) return lang === "nl" ? "nog 1 dag" : "1 day left";
  return lang === "nl" ? `nog ${daysLeft} dagen` : `${daysLeft} days left`;
}
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
