// Loyverse "Sales by item" CSV: read in the browser and matched to the menu. Nothing is sent anywhere.
import { D, D0, LAST, UPL, dateOf, fd, ING } from "./model.js";
import { sum } from "./format.js";

export const UP_KEY = "makisushi.upload.v1";
export const REQUIRED = ["Item name", "SKU", "Category", "Items sold", "Gross sales", "Discounts", "Net sales", "DATE"];
const MONS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export const normName = (s) => String(s || "").toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[^a-z0-9]/g, "");
export const cleanName = (s) => String(s || "").replace(/\[[^\]]*\]\s*/g, "").trim();

export function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export const cleanNum = (v) => {
  const s = String(v == null ? "" : v).replace(/[₱,\s]/g, "");
  if (s === "" || s === "-") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export function loyDate(v) {
  const s = String(v || "").trim();
  let y, m, d, k;
  if ((k = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(s))) { d = +k[1]; m = MONS[k[2].toLowerCase()]; y = +k[3]; if (y < 100) y += 2000; }
  else if ((k = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) { y = +k[1]; m = +k[2] - 1; d = +k[3]; }
  else if ((k = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { m = +k[1] - 1; d = +k[2]; y = +k[3]; }
  else return null;
  if (m === undefined || Number.isNaN(m)) return null;
  return Math.round((Date.UTC(y, m, d) - D0) / 864e5);
}

export function analyzeUpload(text, name) {
  const rows = parseCsv(text);
  const res = { name, missing: [], lines: 0, bad: 0, unmatched: new Map(), unmatchedNet: 0, agg: new Map(), days: new Set(), net: 0, items: 0 };
  if (!rows.length) { res.missing = REQUIRED.slice(); return res; }
  const head = rows[0].map((h) => h.trim().toLowerCase()), idx = Object.fromEntries(head.map((h, k) => [h, k]));
  res.missing = REQUIRED.filter((c) => !(c.toLowerCase() in idx));
  if (res.missing.length) return res;
  const g = (r, c) => r[idx[c.toLowerCase()]];
  for (const r of rows.slice(1)) {
    const day = loyDate(g(r, "DATE")), items = cleanNum(g(r, "Items sold")), net = cleanNum(g(r, "Net sales")), gross = cleanNum(g(r, "Gross sales")), disc = cleanNum(g(r, "Discounts"));
    if (day === null || [items, net, gross, disc].some(Number.isNaN)) { res.bad++; continue; }
    const sku = String(g(r, "SKU") || "").trim().replace(/\.0+$/, ""), nm = String(g(r, "Item name") || "").trim(), cat = String(g(r, "Category") || "").trim();
    res.lines++; res.days.add(day); res.net += net; res.items += items;
    const hit = UPL.sku[sku];
    const itemId = hit ? hit[0] : (UPL.names[normName(nm)] === undefined ? null : UPL.names[normName(nm)]);
    if (itemId === null) { const key = sku + "|" + nm; res.unmatched.set(key, (res.unmatched.get(key) || 0) + net); res.unmatchedNet += net; }
    const key = day + "|" + (sku || nm);
    const a = res.agg.get(key) || { day, sku, name: nm, cat, itemId, items: 0, net: 0, gross: 0, disc: 0 };
    a.items += items; a.net += net; a.gross += gross; a.disc += disc;
    res.agg.set(key, a);
  }
  return res;
}

export const isMgmt = (r) => String(r.cat).toUpperCase() === "MANAGEMENT";
export function existingNetByDay() {
  const m = {};
  D.sales.forEach((r) => { m[r[0]] = (m[r[0]] || 0) + r[3]; });
  return m;
}
export function reconcile(rowsArr) {
  const ex = existingNetByDay(), up = {};
  rowsArr.forEach((r) => { if (!isMgmt(r)) up[r.day] = (up[r.day] || 0) + r.net; });
  let overlap = 0, match = 0, fresh = 0;
  Object.keys(up).forEach((k) => {
    const d = +k;
    if (d > LAST) { fresh++; return; }
    if (d < 0) return;
    overlap++;
    const e = ex[d] || 0;
    if (Math.abs(up[d] - e) <= Math.max(5, 0.01 * e)) match++;
  });
  return { overlap, match, fresh, up, ex };
}

// the saved file is kept in this browser only
export function loadSavedUpload() {
  try {
    const s = localStorage.getItem(UP_KEY);
    if (!s) return null;
    const o = JSON.parse(s);
    const rows = o.rows.map((a) => ({ day: a[0], sku: a[1], name: a[2], cat: a[3], itemId: a[4], items: a[5], net: a[6], gross: a[7], disc: a[8] }));
    const days = [...new Set(rows.map((r) => r.day))].sort((a, b) => a - b);
    return { name: o.name, rows, from: days[0], to: days[days.length - 1], net: sum(rows.map((r) => r.net)), items: sum(rows.map((r) => r.items)), nDays: days.length, lines: rows.length };
  } catch (e) {
    return null;
  }
}
export function saveUpload(res) {
  const rows = [...res.agg.values()], days = [...res.days].sort((a, b) => a - b);
  const up = { name: res.name, rows, from: days[0], to: days[days.length - 1], net: res.net, items: res.items, nDays: days.length, lines: res.lines };
  try {
    const s = JSON.stringify({ name: res.name, rows: rows.map((r) => [r.day, r.sku, r.name, r.cat, r.itemId, r.items, r.net, r.gross, r.disc]) });
    if (s.length < 3.5e6) localStorage.setItem(UP_KEY, s);
  } catch (e) { /* not remembered */ }
  return up;
}
export function forgetUpload() {
  try { localStorage.removeItem(UP_KEY); } catch (e) { /* ignore */ }
}

// ---- data for the two upload panels ----
export function upSalesData(u) {
  const rc = reconcile(u.rows), top = {};
  u.rows.forEach((r) => {
    if (isMgmt(r)) return;
    const k = r.sku || r.name;
    top[k] = top[k] || { name: cleanName(r.name), net: 0 };
    top[k].net += r.net;
  });
  const topRows = Object.values(top).sort((a, b) => b.net - a.net).slice(0, 8).map((x) => [x.name, x.net]);
  const days = Object.keys(rc.up).map(Number).sort((a, b) => a - b), weekly = days.length > 120;
  const key = (d) => (weekly ? d - ((dateOf(d).getUTCDay() + 6) % 7) : d);
  const buckets = new Map();
  days.forEach((d) => {
    const k = key(d), o = buckets.get(k) || { up: 0, ex: 0, hasEx: false };
    o.up += rc.up[d];
    if (d <= LAST && d >= 0) { o.ex += rc.ex[d] || 0; o.hasEx = true; }
    buckets.set(k, o);
  });
  const ks = [...buckets.keys()].sort((a, b) => a - b);
  return {
    rc, topRows, weekly,
    chart: { x: ks.map((k) => fd(k)), up: ks.map((k) => buckets.get(k).up), ex: ks.map((k) => (buckets.get(k).hasEx ? buckets.get(k).ex : null)) },
  };
}
export function upForecastData(u, k0, kN) {
  const days = [...new Set(u.rows.filter((r) => r.day >= k0 && r.day <= kN).map((r) => r.day))].sort((a, b) => a - b);
  if (!days.length) return { days };
  const act = {};
  u.rows.filter((r) => r.day >= k0 && r.day <= kN && r.itemId !== null && r.itemId !== undefined).forEach((r) => (UPL.bom[r.itemId] || []).forEach(([ing, q]) => {
    const pr = UPL.prof[ing];
    if (!pr || pr.t !== "menu") return;
    const m = act[ing] || (act[ing] = {});
    m[r.day] = (m[r.day] || 0) + r.items * q / pr.y;
  }));
  const comp = ING.filter((i) => UPL.prof[i.id] && UPL.prof[i.id].t === "menu"), skipped = ING.length - comp.length;
  const perDayF = days.map((d) => sum(comp.map((i) => D.fc[i.id].y[d - k0] * i.cost)));
  const perDayA = days.map((d) => sum(comp.map((i) => ((act[i.id] || {})[d] || 0) * i.cost)));
  const rowsT = comp.map((i) => {
    const f = sum(days.map((d) => D.fc[i.id].y[d - k0])), a = sum(days.map((d) => (act[i.id] || {})[d] || 0));
    return { i, f, a, diff: a ? f / a - 1 : null };
  }).filter((r) => r.f > 0 || r.a > 0).sort((x, y) => Math.abs(y.a - y.f) * y.i.cost - Math.abs(x.a - x.f) * x.i.cost);
  const miss = sum(days.map((_, k) => Math.abs(perDayF[k] - perDayA[k]))) / Math.max(1, sum(perDayA));
  return { days, perDayA, perDayF, rowsT, miss, skipped };
}
