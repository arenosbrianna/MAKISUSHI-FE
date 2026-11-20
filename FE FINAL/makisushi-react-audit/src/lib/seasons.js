// The Philippine seasons and what the weather (hot days, cool days, rainy days, summer) does to sales.
// Seasons follow PAGASA's climate types for Metro Manila: hot dry (summer, "tag-init") March to May, rainy ("tag-ulan") June to November,
// cool dry ("tag-lamig") December to February.
// The impact is measured from the dashboard's own sales and the heat index of each day (the feels-like temperature at 14:00, Open-Meteo).
// The effect is measured over the period from which the daily weather and sales move together (from December 2025).
import { D, N, D0, LAST, XT, ING, dateOf } from "./model.js";

export const SEASONS = [
  { key: "summer", label: "Hot dry season (summer)", local: "tag-init", months: "March to May", from: 3, to: 5 },
  { key: "rainy", label: "Rainy season", local: "tag-ulan", months: "June to November", from: 6, to: 11 },
  { key: "cool", label: "Cool dry season", local: "tag-lamig", months: "December to February", from: 12, to: 2 },
];
export const seasonOfMonth = (m) => (m >= 3 && m <= 5 ? SEASONS[0] : m >= 6 && m <= 11 ? SEASONS[1] : SEASONS[2]);
export const seasonOfDay = (i) => seasonOfMonth(dateOf(i).getUTCMonth() + 1);
export const seasonOfIso = (iso) => seasonOfMonth(+iso.slice(5, 7));
export const HOT_DAY = 38;   // feels-like °C at 14:00 from which a day counts as hot
export const RAIN_DAY = 10;   // mm of rain in a day from which it counts as a rainy day
export const REAL_POS_FROM = "2025-12-01";

// days until the next season starts (from an ISO date)
export function nextSeason(iso) {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7), cur = seasonOfMonth(m);
  const start = cur.key === "summer" ? [y, 6] : cur.key === "rainy" ? [y, 12] : m === 12 ? [y + 1, 3] : [y, 3];
  const days = Math.round((Date.UTC(start[0], start[1] - 1, 1) - Date.UTC(y, m - 1, +iso.slice(8, 10))) / 864e5);
  return { next: seasonOfMonth(start[1]), days };
}

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
let cache = { D: null, m: new Map() };

// Units sold per day for the groups the owner asked about, then: summer against the rest of the year, and hot days against the usual
// level of the same weekday (the same weekday in the 4 weeks before and after, open days only), as a ratio of totals.
export function seasonImpact(fromIdx, toIdx) {
  if (cache.D !== D) cache = { D, m: new Map() };
  const real = fromIdx !== undefined ? fromIdx : Math.round((Date.UTC(+REAL_POS_FROM.slice(0, 4), +REAL_POS_FROM.slice(5, 7) - 1, 1) - D0) / 864e5);
  const last = toIdx !== undefined ? toIdx : LAST, ck = real + ":" + last;
  if (cache.m.has(ck)) return cache.m.get(ck);
  const cats = D.cats, f = XT.f, hi = XT.hi;
  const itemIds = (re) => new Set(Object.entries(D.items).filter(([, it]) => re.test(it[0])).map(([id]) => +id));
  const catUnits = (name) => { const k = cats.indexOf(name), a = new Array(N).fill(0); if (k >= 0) D.sales.forEach((r) => { if (r[1] === k) a[r[0]] += r[4]; }); return a; };
  const itemUnits = (set) => { const a = new Array(N).fill(0); D.isales.forEach((r) => { if (set.has(r[1])) a[r[0]] += r[2]; }); return a; };
  const all = new Array(N).fill(0);
  D.sales.forEach((r) => { all[r[0]] += r[3]; });
  const mangoDrinks = itemIds(/mango (shake|juice)/i);
  const mangoIng = ING.find((i) => /mango/i.test(i.name));
  const groups = [
    { key: "mango", label: "Mango shakes and juice", unit: "units", a: itemUnits(mangoDrinks) },
    { key: "drinks", label: "Drinks & Shakes", unit: "units", a: catUnits("Drinks & Shakes") },
    { key: "desserts", label: "Desserts", unit: "units", a: catUnits("Desserts") },
    { key: "mangoIng", label: "Mango (ingredient use)", unit: "g", a: mangoIng ? D.series[mangoIng.id].use : new Array(N).fill(0) },
    { key: "all", label: "All menu sales", unit: "₱", a: all },
  ];
  const base = (a, i) => {
    const v = [];
    for (let j = 1; j <= 4; j++) for (const k of [i - 7 * j, i + 7 * j]) if (k >= 0 && k < N && !(f[k] & 8)) v.push(a[k]);
    return v.length >= 4 ? mean(v) : null;
  };
  const lift = (a, pred) => {
    let A = 0, B = 0, n = 0;
    for (let i = real; i <= last; i++) {
      if (f[i] & 8 || !pred(i)) continue;
      const b = base(a, i);
      if (b === null || b <= 0) continue;
      A += a[i]; B += b; n++;
    }
    return { n, v: B > 0 ? A / B - 1 : null };
  };
  const open = []; for (let i = real; i <= last; i++) if (!(f[i] & 8)) open.push(i);
  const out = groups.map((g) => {
    const sm = mean(open.filter((i) => seasonOfDay(i).key === "summer").map((i) => g.a[i])), rest = mean(open.filter((i) => seasonOfDay(i).key !== "summer").map((i) => g.a[i]));
    const perDay = mean(open.map((i) => g.a[i])) || 0;
    const hot = lift(g.a, (i) => hi[i] != null && hi[i] >= HOT_DAY), cool = lift(g.a, (i) => hi[i] != null && hi[i] < 33);
    const rain = lift(g.a, (i) => XT.rain && XT.rain[i] != null && XT.rain[i] >= RAIN_DAY);
    // too few sales to measure anything (desserts sell about 0.2 units a day in 2026); about one unit a day (mango shakes and juice) is small but measurable
    const thin = g.unit === "units" && perDay < 0.5;
    return { key: g.key, label: g.label, unit: g.unit, perDay, thin, summer: sm !== null && rest ? sm / rest - 1 : null, summerAvg: sm, restAvg: rest,
      hot: hot.v, hotN: hot.n, cool: cool.v, coolN: cool.n, rain: rain.v, rainN: rain.n };
  });
  const res = { D, from: REAL_POS_FROM, fromIdx: real, toIdx: last, days: open.length, hotDays: open.filter((i) => hi[i] != null && hi[i] >= HOT_DAY).length, groups: out, by: Object.fromEntries(out.map((g) => [g.key, g])) };
  cache.m.set(ck, res);
  return res;
}
