// Data model: the loaded dashboard data (D) and the calculations that the pages share.
// initModel() is called once after the data arrives from /api/dashboard; the exported
// bindings below then hold the loaded values.
import { sum } from "./format.js";

export let D = null, M = null, N = 0, LAST = 0, ING = [], BYID = {}, D0 = 0, XT = null, IS = [], IT = {}, UPL = null, Z = 2.33;

// safety factor for a service level (inverse of the normal distribution), e.g. 0.99 -> 2.33
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
export function zFor(p) {
  let lo = 0, hi = 6;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (0.5 * (1 + erf(m / Math.SQRT2)) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export function initModel(data) {
  D = data;
  M = data.meta;
  N = M.nd;
  LAST = N - 1;
  ING = data.ing;
  BYID = Object.fromEntries(ING.map((i) => [i.id, i]));
  D0 = Date.UTC(+M.d0.slice(0, 4), +M.d0.slice(5, 7) - 1, +M.d0.slice(8, 10));
  XT = D.ext;
  IS = D.isales;
  IT = D.items;
  UPL = D.upload;
  // A pack is a whole number of grams or pieces: 162.5 g is 162 g, 42.5 pieces is 42. The quantity of an ordered line is its packs times the pack.
  if (!data.packsWhole) {
    data.ing.forEach((i) => { const w = Math.floor(i.pack); if (w >= 1) i.pack = w; });
    const fixPlan = (plan) => plan.forEach((p) => { const i = BYID[p.ing]; if (i && p.packs && p.rule !== "daily market buy") p.qty = p.packs * i.pack; });
    const fixDel = (dl) => (dl || []).forEach((d) => { const i = BYID[d[0]]; if (i) d[4] = i.pack; });
    fixPlan(data.plan || []); fixDel(data.deliveries);
    (data.planRuns || []).forEach((r) => { fixPlan(r.plan || []); fixDel(r.deliveries); });
    data.packsWhole = true;
  }
  Z = zFor(M.service || 0.99);
  // The stored forecast is recipe demand. Stock is used in larger amounts (recipe demand / yield, after trimming),
  // and the purchase plan works in those used amounts, so every view converts the forecast the same way.
  if (!data.usedUnits) {
    // the forecast exactly as the warehouse stores it (recipe demand, forecast_qty): the forecast pages and the reports show this one,
    // valued at the standard cost, which is how Chapter 4 reports it
    data.fcRaw = JSON.parse(JSON.stringify(data.fc));
    const yOf = (id) => (data.upload.prof[id] && data.upload.prof[id].y > 0 ? data.upload.prof[id].y : 1);
    Object.keys(data.fc).forEach((id) => {
      const y = yOf(id), f = data.fc[id];
      f.y = f.y.map((v) => v / y); f.lo = f.lo.map((v) => v / y); f.hi = f.hi.map((v) => v / y);
    });
    Object.keys(data.btd).forEach((id) => {
      const y = yOf(id), b = data.btd[id];
      b.f = b.f.map((v) => (v === null || v === undefined ? null : v / y));
    });
    data.usedUnits = true;
  }
}

// The warehouse stores the 14-day plan at every service level from 80% to 100% (one run each). selectPlan swaps the plan, its deliveries,
// its budget check and the safety factor, so every page reads the chosen level.
export function selectPlan(id) {
  if (!D || !D.planRuns) return;
  const r = D.planRuns.find((x) => x.id === id) || D.planRuns.find((x) => x.id === D.defaultRun);
  if (!r || (D.opt && D.opt.run_id === r.id)) return;
  D.plan = r.plan;
  D.deliveries = r.deliveries;
  D.opt = { ...D.opt, run_id: r.id, owner: r.owner || null, bt: r.bt || levelBacktest(r.level), budget_check: r.budget_check, status: r.status, objective: r.objective, service: r.level, purchase_php: r.purchase_php };
  M.service = r.level;
  Z = zFor(r.level || 0.99);
}
export const levelLabel = (v) => (v > 0.9995 ? "100%" : Math.round(v * 100) + "%");
// what the study's backtest says about a service level (stockouts, expiry, net cost, fill rate, average stock), or null
export const levelBacktest = (v) => (D.serviceLevels ? D.serviceLevels.levels.find((l) => Math.abs(l.level - v) < 1e-6) || null : null);

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const dateOf = (i) => new Date(D0 + i * 864e5);
export const fd = (i, y) => {
  const d = dateOf(i);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}${y ? " " + d.getUTCFullYear() : ""}`;
};
export const fiso = (s) => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}`;
export const idxOf = (s) => Math.round((Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) - D0) / 864e5);
export const wdOf = (i) => (dateOf(i).getUTCDay() + 6) % 7;
export const dtxt = (i) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateOf(i).getUTCDay()]} ${fd(i)}`;
export const series = (id) => D.series[id];
// the budget is set per month; the dashboard shows the same amount per week (monthly x 12 / 52, to the nearest 100)
export const wk = (m) => Math.round(m * 12 / 52 / 100) * 100;

const WALKIN = new Set(["HI-TOP"]);   // Hi-Top is a walk-in grocery: a shopping list instead of a supplier message
export const isWalkin = (i) => WALKIN.has(i.supname);

export const filtered = (S) => ING.filter((i) => (!S.sup || i.sup === S.sup) && (!S.store || i.store === S.store) && (!S.ing || i.id === S.ing));

// the period on screen: a chosen year (or one month of it, compared with the same number of days just before), or the last N days
export function win(S) {
  if (S.year) {
    const y = S.year, m = S.month === "" ? null : +S.month, day = (ms) => Math.round((ms - D0) / 864e5);
    const a = Math.max(0, day(Date.UTC(y, m === null ? 0 : m, 1)));
    const b = Math.min(LAST, day(m === null ? Date.UTC(y, 11, 31) : Date.UTC(y, m + 1, 0)));
    const n = Math.max(1, b - a + 1);
    return { a, b, n, pa: Math.max(0, a - n), pb: a - 1 };
  }
  const n = Math.min(S.range, N);
  return { a: N - n, b: LAST, n, pa: Math.max(0, N - 2 * n), pb: N - n - 1 };
}

// calendar months between day a and b (optionally only the full months)
export function monthsFrom(a, b, fullOnly) {
  const out = [];
  let i = a;
  while (i <= b) {
    const d = dateOf(i), y = d.getUTCFullYear(), m = d.getUTCMonth();
    let e = i;
    while (e + 1 <= b && dateOf(e + 1).getUTCMonth() === m) e++;
    const full = dateOf(i).getUTCDate() === 1 && dateOf(e + 1).getUTCDate() === 1;
    if (!fullOnly || full) out.push({ label: `${MON[m]} ${y}`, a: i, b: e });
    i = e + 1;
  }
  return out;
}
// The columns of a chart over the period [a, b]: single days (up to dayMax days), weeks (up to about 4 months),
// calendar months (up to about 2 years), otherwise quarters. Every chart that follows the Period filter uses this.
export function bucketsFor(a, b, dayMax = 14) {
  const n = b - a + 1, out = [];
  if (n <= dayMax) { for (let i = a; i <= b; i++) out.push({ label: fd(i), a: i, b: i }); return out; }
  if (n <= 125) { for (let i = a; i <= b; i += 7) out.push({ label: fd(i), a: i, b: Math.min(b, i + 6) }); return out; }
  const q = n > 800;
  let i = a;
  while (i <= b) {
    const d = dateOf(i), y = d.getUTCFullYear(), m = d.getUTCMonth();
    let e = i;
    while (e + 1 <= b) {
      const nd = dateOf(e + 1);
      if (q ? nd.getUTCFullYear() !== y || Math.floor(nd.getUTCMonth() / 3) !== Math.floor(m / 3) : nd.getUTCMonth() !== m) break;
      e++;
    }
    out.push({ label: q ? `${y} Q${Math.floor(m / 3) + 1}` : `${MON[m]} '${String(y).slice(2)}`, a: i, b: e });
    i = e + 1;
  }
  return out;
}
// units sold per menu item (item id -> units) between two days
export function dishUnits(a, b) {
  const m = new Map();
  for (let k = 0; k < IS.length; k++) { const r = IS[k]; if (r[0] >= a && r[0] <= b) m.set(r[1], (m.get(r[1]) || 0) + r[2]); }
  return m;
}
// staff meals and other use outside the menu, per day (average of the last 28 days), in used amounts
export function staffPerDay(id) {
  const s = D.series[id].off, a = Math.max(0, LAST - 27);
  let t = 0;
  for (let i = a; i <= LAST; i++) t += s[i] || 0;
  return t / (LAST - a + 1);
}
// whether the forecast of this ingredient is of its recorded use (which already includes staff meals) or of dish demand only
export const forecastHasStaff = (id) => !!(D.upload.prof[id] && D.upload.prof[id].t === "other");
export function weeksFrom(a, b) {
  const out = [];
  for (let i = a; i <= b; i += 7) out.push({ label: fd(i), a: i, b: Math.min(b, i + 6) });
  return out;
}

// ---- metrics ----
// Recipe demand: the amount the menu asked for, before the trimming loss. It is the basis of the warehouse forecast (forecast_qty) and of
// Chapter 4, so the forecast pages draw the history on it too (use x yield, valued at the standard cost).
export const yieldOf = (id) => (D.upload.prof[id] && D.upload.prof[id].y > 0 ? D.upload.prof[id].y : 1);
export const demandAt = (id, i) => (D.series[id].use[i] || 0) * yieldOf(id);
export function demandValue(ids, a, b) {
  let v = 0;
  for (const id of ids) { const c = BYID[id].cost; for (let i = a; i <= b; i++) v += demandAt(id, i) * c; }
  return v;
}
export function consumedValue(ids, a, b) {
  let v = 0;
  for (const id of ids) { const s = series(id).use, c = BYID[id].cost; for (let i = a; i <= b; i++) v += s[i] * c; }
  return v;
}
export function unmetValue(ids, a, b) {
  const set = new Set(ids);
  return sum(D.so.filter((x) => x[0] >= a && x[0] <= b && set.has(x[1])).map((x) => x[3] * BYID[x[1]].cost));
}
export function purchaseValue(ids, a, b) {
  let v = 0;
  for (const id of ids) { const s = series(id).rec, c = BYID[id].cost; for (let i = a; i <= b; i++) v += s[i] * c; }
  return v;
}
export const wasteIn = (set, a, b) => D.waste.filter((w) => w[0] >= a && w[0] <= b && set.has(w[1]));
export const soIn = (set, a, b) => D.so.filter((w) => w[0] >= a && w[0] <= b && set.has(w[1]));
export function stockValue(ids, at) { return sum(ids.map((id) => series(id).close[at] * BYID[id].cost)); }
export function daysOfStock(ids, at) {
  const use = consumedValue(ids, Math.max(0, at - 27), at) / 28;
  return use > 0 ? stockValue(ids, at) / use : 0;
}
// expiry status of a batch. chilled items last 3-5 days, frozen 90-180
export function riskOf(store, left) {
  if (store === "chilled") return left <= 1 ? "bad" : left <= 2 ? "warn" : "good";
  return left <= 7 ? "bad" : left <= 21 ? "warn" : "good";
}
export const batchesAt = (at) => D.batches.filter((b) => b[0] === at);
export function riskIngredients(ids, at) {
  const set = new Set(ids), out = {};
  for (const b of batchesAt(at)) {
    if (!set.has(b[1]) || b[2] <= 0) continue;
    const ing = BYID[b[1]], left = b[4] - at, r = riskOf(ing.store, left);
    if (r === "good") continue;
    const o = out[b[1]] || (out[b[1]] = { qty: 0, left: 99, r: "warn" });
    o.qty += b[2]; o.left = Math.min(o.left, left); if (r === "bad") o.r = "bad";
  }
  return out;
}
export function nextDelivery(ids, week) {
  const ds = D.deliveries.filter((x) => ids.includes(x[0]) && x[1] === week).map((x) => idxOf(x[3]));
  return ds.length ? Math.min(...ds) : null;
}

// ---- stock levels, from the same forecast and service level as the purchase plan ----
// safety stock = z x daily forecast spread x the square root of (lead time + days between deliveries)
// reorder level ("order when below") = forecast use over the lead time + safety stock
// target stock = forecast use until the delivery after next + safety stock, and at least the reorder level plus one
// minimum order (stock comes in whole packs), never more than the shelf life allows
export function stockLevels(i) {
  const f = D.fc[i.id], n = Math.min(14, f.y.length);
  const mu = n ? sum(f.y.slice(0, n)) / n : 0;
  const sd = n ? sum(f.y.slice(0, n).map((_, k) => (f.hi[k] - f.lo[k]) / (2 * 1.2816))) / n : 0;
  const L = Math.max(1, i.lead), R = Math.max(1, i.interval);
  const ss = Z * sd * Math.sqrt(L + R);
  const cap = mu * Math.max(1, i.shelf);
  const reorder = Math.min(mu * L + ss, cap);
  const target = Math.min(Math.max(mu * (L + R) + ss, reorder + i.pack * Math.max(1, i.minpacks || 1)), Math.max(cap, reorder));
  return { mu, ss, reorder, target };
}
export const planRow = (id, week = 1) => D.plan.find((p) => p.ing === id && p.week === week);
export function firstArrival(id, week = 1) {
  const d = D.deliveries.filter((x) => x[0] === id && x[1] === week).map((x) => x[3]).sort()[0];
  return d || null;
}
// the forecast day (0 = tomorrow) when stock first runs out, with the planned deliveries, or -1
export function runOutDay(id, withDeliveries = true, scale = 1) {
  const fdays = D.fdates.length, y = D.fc[id].y, del = new Array(fdays).fill(0);
  if (withDeliveries) D.deliveries.filter((x) => x[0] === id).forEach((x) => { const k = idxOf(x[3]) - LAST - 1; if (k >= 0 && k < fdays) del[k] += x[4]; });
  let c = series(id).close[LAST];
  for (let k = 0; k < fdays; k++) { c = c - y[k] * scale + del[k]; if (c < 0) return k; }
  return -1;
}

// ---- service and loss ----
// A stock-out event ends in one of two ways (dw.fact_stockout_event.outcome): an EMERGENCY_PURCHASE (bought at the market, the dish was still served;
// cost = emergency_cost_php) or LOST_SALES (demand not served; cost = shortage_cost_php, the margin lost). Both are counted as stock-outs.
export const lostMargin = (set, a, b) => sum(D.so.filter((x) => x[0] >= a && x[0] <= b && set.has(x[1])).map((x) => x[4] || 0));
// An emergency buy is made from the supplier in whole packs, at least the minimum order, not just the amount that was short; the rest of the pack
// goes into stock. The cost stays the warehouse's recorded cost of the shortfall (pricing whole packs would count stock that is still there as spent).
export function emergencyBuy(x) {
  const i = BYID[x[1]], gap = (x[6] || 0) - (x[7] || 0);
  if (!i || !(gap > 0)) return { packs: 0, qty: 0, paid: x[5] || 0 };
  const packs = Math.max(i.minpacks || 1, Math.ceil(gap / i.pack - 1e-9)), bought = packs * i.pack;
  return { packs, qty: bought, paid: x[5] || 0 };
}
export const stockoutSplit = (set, a, b) => {
  const ev = D.so.filter((x) => x[0] >= a && x[0] <= b && set.has(x[1])), em = ev.filter((x) => (x[5] || 0) > 0), lost = ev.filter((x) => !((x[5] || 0) > 0));
  return { all: ev.length, em: em.length, lost: lost.length, emV: sum(em.map((x) => emergencyBuy(x).paid)), lostV: sum(lost.map((x) => x[4] || 0)) };
};
export const emergencyValue = (set, a, b) => sum(D.so.filter((x) => x[0] >= a && x[0] <= b && set.has(x[1]) && (x[5] || 0) > 0).map((x) => emergencyBuy(x).paid));
// share of ingredient-days without a stock-out
export function serviceAchieved(ids, a, b) {
  const set = new Set(ids), days = b - a + 1;
  const out = new Set(D.so.filter((x) => x[0] >= a && x[0] <= b && set.has(x[1])).map((x) => x[1] + ":" + x[0])).size;
  return ids.length && days > 0 ? 1 - out / (ids.length * days) : 1;
}
export function avgStockValue(ids, a, b) {
  let s = 0;
  for (let i = a; i <= b; i++) s += stockValue(ids, i);
  return s / Math.max(1, b - a + 1);
}
// ABC class of rows sorted from largest: A covers the first 80% of the total, B the next 15%, C the rest
export function abcOf(vals) {
  const tot = sum(vals) || 1;
  let acc = 0;
  return vals.map((v) => { const before = acc / tot; acc += v; return before < 0.8 ? "A" : before < 0.95 ? "B" : "C"; });
}

// ---- colours and scales ----
export const PAL = ["#1E3A8A", "#F59E0B", "#10B981", "#3B82F6", "#A78BFA", "#0EA5E9", "#94A3B8", "#14B8A6", "#D946EF", "#84CC16"];   // distinct hues, one per category; no red (red means a warning)
const RAMPS = { blue: ["#1E3A8A", "#C7D2FE"], amber: ["#B45309", "#FDE68A"], green: ["#047857", "#BBF7D0"] };
export const ramp = (f, name = "blue") => {
  const [dark, light] = RAMPS[name] || RAMPS.blue;
  return `color-mix(in srgb, ${dark} ${Math.round(30 + 70 * Math.max(0, Math.min(1, f)))}%, ${light})`;
};   // f = 1 darkest, 0 lightest
export function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  return (m <= 1 ? 1 : m <= 1.2 ? 1.2 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10) * p;
}

// ---- daily demand, usual-day comparisons, heat correlation ----
export function dailyDemand(key) {
  const a = new Array(N).fill(0);
  if (key === "all") D.sales.forEach((r) => { a[r[0]] += r[3]; });
  else if (key[0] === "c") { const k = +key.slice(2); D.sales.forEach((r) => { if (r[1] === k) a[r[0]] += r[3]; }); }
  else { const id = +key.slice(2), u = series(id).use; for (let i = 0; i < N; i++) a[i] = u[i]; }
  return a;
}
// the usual level of a day: the middle value (median) of the same weekday in the 4 weeks before and after, ignoring closed days and days with no sales
export function nbBase(a, i) {
  const v = [];
  for (let j = 1; j <= 4; j++) for (const k of [i - 7 * j, i + 7 * j]) if (k >= 0 && k < N && !(XT.f[k] & 8) && a[k] > 0) v.push(a[k]);
  if (v.length < 4) return 0;
  v.sort((x, y) => x - y);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
export function devSeries(a, robust) {
  const y = new Array(N).fill(null), closed = (i) => XT.f[i] & 8;
  if (robust) {
    for (let i = 0; i < N; i++) { if (closed(i)) continue; const b = nbBase(a, i); if (b > 0) y[i] = a[i] / b - 1; }
    return y;
  }
  for (let i = 0; i < N; i++) {
    if (closed(i)) continue;
    let s = 0, c = 0;
    for (let j = 1; j <= 4; j++) for (const k of [i - 7 * j, i + 7 * j]) if (k >= 0 && k < N && !closed(k)) { s += a[k]; c++; }
    if (c >= 4 && s > 0) y[i] = a[i] / (s / c) - 1;
  }
  return y;
}
export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = sum(xs) / n, my = sum(ys) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}
