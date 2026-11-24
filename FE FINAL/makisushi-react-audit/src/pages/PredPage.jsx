// Forecast: how much of each ingredient will be used. Three tabs:
//  - Next 2 weeks: the daily forecast the purchase plan uses (14 days), with how far to trust each ingredient
//  - Up to 1 year: the monthly forecast for budgeting and supplier planning; not used for the weekly order
//  - Weather and calendar: does heat, a payday or a holiday change sales
import { D, N, LAST, MON, XT, BYID, dateOf, wdOf, fd, fiso, monthsFrom, demandAt, demandValue, yieldOf, dailyDemand, devSeries, pearson, fcRange } from "../lib/model.js";
import { peso, kpeso, num, pct, qty, sum } from "../lib/format.js";
import { heatHex, cellOf } from "../lib/color.js";
import { ComboChart, DivCols, HeatChart, CorrelationBar, HBars, Donut, MiniForecast } from "../components/Charts.jsx";
import { Kpi, Kpis, Legend, Chip, Info, TabBar, deltaEl, NoteTip } from "../components/ui.jsx";
import { useWeather } from "../lib/weather.js";
import { SEASONS, seasonOfIso, nextSeason, seasonImpact, HOT_DAY, RAIN_DAY} from "../lib/seasons.js";
import { weatherRecs } from "./recommend.js";
import { useApp } from "../AppContext.js";
import { MODEL_NAMES, LR_BAND } from "../lib/constants.js";
import { UploadForecastPanel } from "./UploadPanels.jsx";

const classOf = (id) => (D.upload.prof[id] && D.upload.prof[id].c) || "";
const TABS = [["forecast", "Next 2 weeks"], ["byIng", "By ingredient"], ["year", "Up to 1 year"], ["weather", "Weather and calendar"]];
const HORIZONS = [[1, "1 month"], [3, "3 months"], [6, "6 months"], [12, "1 year"]];
const mlabel = (ym) => `${MON[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
// the "Not in the forecast" line of both What to expect panels, word for word the same: events the past use cannot show
const NOT_IN = "new dishes, price changes, supplier stops or typhoon closures";
// a change said with "about": pesos to the nearest ₱100, quantities to two significant figures
const aboutQ = (v, single) => { if (!single) return Math.round(v / 100) * 100; if (!v) return 0; const p = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 1); return Math.round(v / p) * p; };
const horizonText = (n) => (n === 1 ? "month" : n === 12 ? "12 months" : n + " months");

// confidence from how far the weekly forecast missed over the past year (weighted average miss):
// High up to 25%, Medium up to 40%, Low above that
export function confidence(id) {
  const p = D.perm && D.perm[id] && D.perm[id][D.engine.model];
  if (!p) return { label: "–", cls: "flat", miss: null };
  const m = p[0];
  return m <= 0.25 ? { label: "High", cls: "good", miss: m } : m <= 0.4 ? { label: "Medium", cls: "warn", miss: m } : { label: "Low", cls: "bad", miss: m };
}

export function PredPage({ F }) {
  const { S, set } = useApp();
  const tab = TABS.some((t) => t[0] === S.ptab) ? S.ptab : "forecast";
  const tabbar = <TabBar id="ptabs" list={TABS} value={tab} onChange={(v) => set({ ptab: v })} />;
  if (tab === "weather") return <><div className="pb-head">{tabbar}</div><div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1.3fr) minmax(0, 1fr)" }}><WeatherPanels S={S} set={set} /></div></>;
  if (tab === "year") return <YearAhead F={F} S={S} set={set} tabbar={tabbar} />;
  if (tab === "byIng") return <ByIngredient F={F} tabbar={tabbar} />;
  return <NextTwoWeeks F={F} tabbar={tabbar} />;
}

function NextTwoWeeks({ F, tabbar }) {
  const { up, set } = useApp();
  const E = D.engine, ids = F.map((i) => i.id), single = F.length === 1;
  const f = (v) => (single ? qty(v, F[0].uom) : peso(v));
  const c = (id) => (single ? 1 : BYID[id].cost);
  const nF = D.fdates.length, n14 = Math.min(14, nF);
  const fy = D.fdates.map((_, k) => sum(ids.map((id) => D.fcRaw[id].y[k] * c(id))));
  const next7 = sum(fy.slice(0, 7)), next14 = sum(fy.slice(0, n14));
  // the same number of days before today, to compare the 14 days of the plan with
  const lastN = sum(ids.map((id) => { let v = 0; for (let i = LAST - n14 + 1; i <= LAST; i++) v += demandAt(id, i) * c(id); return v; }));

  const fmarks = [];
  D.fdates.forEach((_, k) => { const fl = D.ext.ff[k] || 0; if (fl & 2) fmarks.push([k, "Payday"]); else if (fl & 1) fmarks.push([k, "Holiday"]); });
  // the last 28 days of use, then the forecast (both in used amounts)
  const HD = 28;
  const hist = Array.from({ length: HD }, (_, k) => sum(ids.map((id) => demandAt(id, LAST - HD + 1 + k) * c(id))));
  const histX = [...Array.from({ length: HD }, (_, k) => fd(LAST - HD + 1 + k)), ...D.fdates.map(fiso)];
  const histAct = [...hist, ...Array(nF).fill(null)];
  const histFc = [...Array(HD).fill(null), ...fy];
  // the likely range: for one ingredient, the model's own 80% interval; for a total of several, the measured range of the past year
  // (the model's intervals of single ingredients cannot simply be added)
  const r1 = single ? null : fcRange(ids, 1), r7 = fcRange(ids, 7), r14 = fcRange(ids, 14);
  const histLo = [...hist, ...D.fdates.map((_, k) => (r1 ? fy[k] * r1.lo : sum(ids.map((id) => D.fcRaw[id].lo[k] * c(id)))))];
  const histHi = [...hist, ...D.fdates.map((_, k) => (r1 ? fy[k] * r1.hi : sum(ids.map((id) => D.fcRaw[id].hi[k] * c(id)))))];
  const rng = (v, r) => (r ? `${f(rnd(v * r.lo))}–${f(rnd(v * r.hi))}` : "–");
  const rnd = (v) => (single ? v : Math.round(v / 100) * 100);
  const histMarks = [[HD - 1, "Today"], ...fmarks.map(([k, l]) => [k + HD, l])];

  // per ingredient: expected use, the range, and how far to trust it
  const rows = F.map((i) => {
    const y = D.fcRaw[i.id].y, lo = D.fcRaw[i.id].lo, hi = D.fcRaw[i.id].hi;
    return { i, d7: sum(y.slice(0, 7)), d14: sum(y.slice(0, n14)), lo: sum(lo.slice(0, n14)), hi: sum(hi.slice(0, n14)), conf: confidence(i.id) };
  }).filter((r) => r.d14 > 0).sort((a, b) => b.d14 * b.i.cost - a.d14 * a.i.cost);
  const low = rows.filter((r) => r.conf.cls === "bad");

  // the average weekly miss over the past year
  const ev = F.map((i) => D.perm && D.perm[i.id]).filter(Boolean);
  const wmapeOf = (m) => {
    let a = 0, b = 0;
    F.forEach((i) => { const p = D.perm && D.perm[i.id] && D.perm[i.id][m], t = D.btd[i.id]; if (!p || p[0] === undefined || !t) return; const w = sum(t.a) * yieldOf(i.id) * i.cost; a += p[0] * w; b += w; });
    return b > 0 ? a / b : null;
  };
  const avg = wmapeOf;
  const wm = avg(E.model), wn = avg("SNAIVE");

  // the same chart for one storage type (chilled or frozen)
  const sub = (list) => {
    const cc = (id) => (single ? 1 : BYID[id].cost);
    const h = Array.from({ length: HD }, (_, k) => sum(list.map((id) => demandAt(id, LAST - HD + 1 + k) * cc(id))));
    const y = D.fdates.map((_, k) => sum(list.map((id) => D.fcRaw[id].y[k] * cc(id))));
    return {
      act: [...h, ...Array(nF).fill(null)], fc: [...Array(HD).fill(null), ...y],
      lo: [...h, ...D.fdates.map((_, k) => sum(list.map((id) => D.fcRaw[id].lo[k] * cc(id))))],
      hi: [...h, ...D.fdates.map((_, k) => sum(list.map((id) => D.fcRaw[id].hi[k] * cc(id))))],
    };
  };
  const bySup = {};
  rows.forEach((r) => { const n = r.i.supname || "Other"; bySup[n] = (bySup[n] || 0) + r.d14 * r.i.cost; });
  const confCount = { High: 0, Medium: 0, Low: 0 };
  rows.forEach((r) => { const l = confidence(r.i.id).label; if (confCount[l] !== undefined) confCount[l]++; });
  const confItems = [["High", confCount.High, "#10B981"], ["Medium", confCount.Medium, "#F59E0B"], ["Low", confCount.Low, "#DC2626"]].filter((x) => x[1] > 0);
  const supItems = Object.entries(bySup).sort((x, y) => y[1] - x[1]), supTotal = sum(supItems.map((x) => x[1]));
  const stores = ["chilled", "frozen"].map((st) => [st, ids.filter((id) => BYID[id].store === st)]).filter(([, l]) => l.length);
  const topRows = rows.slice(0, 8).map((r) => [r.i.name, single ? r.d14 : r.d14 * r.i.cost, r.i.id]);
  const confNote = (id) => { const r = fcRange([id], 14), row = rows.find((x) => x.i.id === id), v = row ? (single ? row.d14 : row.d14 * row.i.cost) : 0; return r ? "likely " + (single ? qty(v * r.lo, F[0].uom) + "–" + qty(v * r.hi, F[0].uom) : kpeso(v * r.lo) + "–" + kpeso(v * r.hi).slice(1)) : ""; };

  // the forecast as a four-part message a manager can act on: what is expected, how far it can be off,
  // what the data does not hold, and what to do if the week goes outside it
  const miss = typeof wm === "number" && wm > 0 ? wm : 0.24;
  const recs = [];
  // the same four-line form as Up to 1 year: Expected (with the change in pesos or kg), Range ("likely X to Y", as on the cards),
  // Not in the forecast, and one line for the tab (here the backup plan)
  const dN = aboutQ(Math.abs(next14 - lastN), single);
  recs.push({ k: "Expected", t: `${f(next14)} in the next ${n14} days, ${!lastN || !dN ? `about the same as the last ${n14} days` : `about ${f(dN)} ${next14 >= lastN ? "more" : "less"} than the last ${n14} days`}${fmarks.length ? "; " + fmarks.map(([k, l]) => `${l.toLowerCase()} ${fiso(D.fdates[k])}`).slice(0, 2).join(", ") : ""}` });
  recs.push({ k: "Range", t: r14 ? `likely ${f(rnd(next14 * r14.lo))} to ${f(rnd(next14 * r14.hi))} in the next ${n14} days${low.length ? "; hard to forecast: " + low.slice(0, 3).map((r) => r.i.name.replace(/ \(.*\)$/, "")).join(", ") : ""}` : "not enough past weeks to measure it" });
  recs.push({ k: "Not in the forecast", t: NOT_IN });
  recs.push({ k: "Backup plan", t: `if use runs high, buy chilled items the same day at the grocery; test frozen items at +40% on Running out` });

  const lineOf = (d, color) => [{ vals: d.act, color: "var(--accent)", name: "What was used", fmt: f }, { vals: d.fc, lo: d.lo, hi: d.hi, color, name: "Forecast", fmt: f }];
  return (
    <>
      <div className="pb-head">
        <Kpis>
          <Kpi label="Next 7 days" value={f(next7)} delta={<span className="t-flat">likely {rng(next7, r7)}</span>}
            info={`Actual use was in this range in ${r7 ? r7.inside : "–"} of ${r7 ? r7.n : "–"} weeks over the past year.`} />
          <Kpi label={`Next ${n14} days`} value={f(next14)} delta={<span className="t-flat">likely {rng(next14, r14)}</span>}
            info={`The 14 days the plan covers. Actual use was in this range in ${r14 ? r14.inside : "–"} of ${r14 ? r14.n : "–"} periods over the past year.`} />
          <Kpi act={{ page: "pred", tab: "byIng", hint: "By ingredient" }} label="Hard to forecast" value={`${low.length} of ${rows.length}`} delta={<span className="t-flat">low confidence: keep a bigger cushion</span>}
            info="Weekly forecast missed by over 40% in the past year. Keep a bigger cushion for these." />
          {wm !== null && <Kpi label="Forecast error" value={pct(wm, 1)} delta={<span className="t-flat">average miss per week, past year</span>}
            info={`A week forecast at ₱10,000 was off by about ${peso(10000 * wm)} either way.`} />}
        </Kpis>
        {tabbar}
      </div>
      <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1.25fr) minmax(0, 1fr)" }}>
        <div className="panel c8">
          <div className="ph"><h2>Forecast of total use{single ? " · " + F[0].name : " (₱)"}</h2>
            <Info t="Shaded band: where use falls 4 times in 5. Dotted lines: paydays and holidays." /></div>
          <ComboChart x={histX} h={240} yfmt={(q) => (single ? num(q) : kpeso(q))} marks={histMarks} lines={lineOf({ act: histAct, fc: histFc, lo: histLo, hi: histHi }, "var(--warn)")} />
          <Legend items={[["What was used (last 4 weeks)", "var(--accent)"], ["Forecast", "var(--warn)"], ["Likely range", "var(--warn)"]]} />
        </div>
        <div className="panel c4">
          <div className="ph"><h2>What to expect</h2><Info t="Likely: where two weeks' use fell 8 times in 10 over the past year." /></div>
          <ul className="insights">{recs.map((r, k) => <li key={k} className="flat"><i aria-hidden="true">{k + 1}</i><span><b>{r.k}:</b> {r.t}</span></li>)}</ul>
        </div>
        {up && <UploadForecastPanel up={up} />}
        <div className="panel c8">
          <div className="ph"><h2>Biggest expected use, next {n14} days</h2><Info t="Most use in the next 14 days, with each forecast's likely range. Click one to focus on it." /></div>
          <HBars items={topRows} fmt={single ? (v) => qty(v, F[0].uom) : (v) => peso(v)} axis={single ? num : kpeso} click onRow={(id) => set({ sel: +id, ing: +id })}
            notes={topRows.map((r) => confNote(r[2]))} label="Biggest expected use" labelWidth={130} />
        </div>
        <div className="panel c4">
          <div className="ph"><h2>By supplier, next {n14} days</h2></div>
          <HBars fill items={supItems.map(([n, v]) => [n, v])} fmt={(v) => kpeso(v) + " · " + (supTotal ? (v / supTotal * 100).toFixed(0) : 0) + "%"} axis={kpeso} labelWidth={110} label="Expected use by supplier" />
        </div>
      </div>
    </>
  );
}

// Expected use by ingredient: the table of the next 7 and 14 days, the likely range and how far to trust each forecast
function ByIngredient({ F }) {
  const { set } = useApp();
  const n14 = Math.min(14, D.fdates.length), HIST = 21;
  const x = [...Array.from({ length: HIST }, (_, k) => fd(LAST - HIST + 1 + k)), ...D.fdates.slice(0, n14).map(fiso)];
  const rows = F.map((i) => {
    const f = D.fcRaw[i.id], pad = (arr) => [...Array(HIST).fill(null), ...arr];
    const act = [...Array.from({ length: HIST }, (_, k) => demandAt(i.id, LAST - HIST + 1 + k)), ...Array(n14).fill(null)];
    const fcv = pad(f.y.slice(0, n14)), lo = pad(f.lo.slice(0, n14)), hi = pad(f.hi.slice(0, n14));
    fcv[HIST - 1] = act[HIST - 1]; lo[HIST - 1] = act[HIST - 1]; hi[HIST - 1] = act[HIST - 1];   // the forecast starts where the use ends
    return { i, act, fc: fcv, lo, hi, d7: sum(f.y.slice(0, 7)), d14: sum(f.y.slice(0, n14)), conf: confidence(i.id) };
  }).filter((r) => r.d14 > 0).sort((p, q) => q.d14 * q.i.cost - p.d14 * p.i.cost);
  return (
    <div className="grid canvas">
      <div className="panel c12">
        <div className="ph"><h2>Expected use by ingredient: last 3 weeks and next {n14} days</h2></div>
        <div className={"fgrid" + (rows.length === 1 ? " one" : "")}>
          {rows.length ? rows.map((r) => (
            <button key={r.i.id} type="button" className="fcard" data-t={"Likely range over " + n14 + " days"} onClick={() => set({ sel: r.i.id, ing: r.i.id, ptab: "forecast" })}>
              <span className="fc-h"><b title={r.i.name}>{r.i.name.replace(/ \(.*\)$/, "")}</b><Chip cls={r.conf.cls}>{r.conf.label}</Chip></span>
              <span className="fc-c"><MiniForecast x={x} act={r.act} fc={r.fc} lo={r.lo} hi={r.hi} todayIdx={HIST - 1} fmt={(v) => qty(v, r.i.uom)} /></span>
              <span className="fc-f"><span>{n14} days <b>{qty(r.d14, r.i.uom)}</b></span><span>{(() => { const g = fcRange([r.i.id], 14); return g ? "likely " + qty(r.d14 * g.lo, r.i.uom).replace(/ (g|kg|pcs?)$/, "") + "–" + qty(r.d14 * g.hi, r.i.uom) : ""; })()}</span></span>
            </button>
          )) : <div className="empty">No forecast for these ingredients.</div>}
        </div>
        <div className="legend"><span><i style={{ background: "#1E3A8A" }} />Used</span><span><i style={{ background: "#B45309" }} />Forecast</span><span><i style={{ background: "#E8B88A" }} />Likely range</span><span data-t="Weekly error up to 25% (High), 25 to 40% (Medium), above 40% (Low)">High / Medium / Low = forecast reliability</span></div>
      </div>
    </div>
  );
}

// The monthly forecast for the next 1 to 12 months: for budgeting and supplier planning. The weekly order uses the 14-day forecast.
function YearAhead({ F, S, set, tabbar }) {
  const L = D.longRange;
  // the months the forecast is read over: two sliders choose the first and the last of the 12 forecast months
  const m0 = Math.max(0, Math.min(11, S.lr0 === undefined ? 0 : S.lr0)), m1 = Math.max(m0, Math.min(11, S.lr1 === undefined ? 11 : S.lr1));
  const nH = m1 + 1, cnt = m1 - m0 + 1;
  if (!L) {
    return <><div className="pb-head">{tabbar}</div><div className="grid canvas"><div className="panel c12 empty">The 12-month forecast is not loaded. Run scripts/build_long_range.py and restart the server.</div></div></>;
  }
  const ids = F.map((i) => i.id), single = F.length === 1;
  const band = F.length === LR_BAND.n;   // the range was measured for the 20 perishables together
  const c = (id) => (single ? 1 : BYID[id].cost);
  const f = (v) => (single ? qty(v, F[0].uom) : peso(v));
  // the monthly model forecasts recipe demand (the warehouse forecast_qty), shown as it is at the standard cost;
  // the history is drawn on the same basis (use x yield)
  const qk = (id, k) => (L.qty[id] && L.qty[id][k]) || 0;
  const monthly = (k) => sum(ids.map((id) => qk(id, k) * c(id)));
  const fc = L.months.map((_, k) => monthly(k));
  const part0 = L.origin.slice(8, 10) !== "01";          // the first forecast month starts on the origin date, so it is part of a month
  const originTxt = `${+L.origin.slice(8, 10)} ${MON[+L.origin.slice(5, 7) - 1]}`;
  // the last 12 full months of use, one for each forecast month a year later
  const past = monthsFrom(Math.max(0, LAST - 400), LAST, true).slice(-12);
  const act = past.map((m) => (single ? sum(Array.from({ length: m.b - m.a + 1 }, (_, k) => demandAt(F[0].id, m.a + k))) : demandValue(ids, m.a, m.b)));
  const pl = (m) => m.label.slice(0, 3) + " 20" + m.label.slice(-2);
  const x = [...past.map(pl), ...L.months.slice(0, nH).map(mlabel)];
  // the first forecast month is part of a month (it starts on the origin date): scale it to a full month so the line does not dip
  const dim = new Date(Date.UTC(+L.origin.slice(0, 4), +L.origin.slice(5, 7), 0)).getUTCDate(), od = +L.origin.slice(8, 10);
  const fcShown = fc.slice(0, nH).map((v, k) => (k === 0 && part0 ? (v * dim) / (dim - od + 1) : v));
  const actLine = [...act, ...Array(nH).fill(null)];
  const fcLine = [...Array(act.length - 1).fill(null), act[act.length - 1], ...fcShown];
  const vals = [...act, ...fc.slice(0, nH)];
  const colors = vals.map((_, k) => (k < act.length ? "var(--accent)" : k === act.length && part0 ? "#F6C28B" : "var(--warn)"));
  const errKey = [1, 3, 6, 12].find((k) => k >= nH) || 12, err = L.error_by_horizon_months[String(errKey)];
  const total = sum(fc.slice(m0, nH)), t1 = fc[0], t3 = sum(fc.slice(0, 3)), t12 = sum(fc);
  // a total as a likely range: the forecast plus or minus the typical error of each ingredient's total at that horizon (past year)
  const yr = (v, h) => { const e = L.error_by_horizon_months[h]; return single ? qty(v * (1 - e), F[0].uom).replace(/ (g|kg|pcs?)$/, "") + "–" + qty(v * (1 + e), F[0].uom) : kpeso(v * (1 - e)) + "–" + kpeso(v * (1 + e)).slice(1); };
  // change against the same months a year earlier, leaving out a first month that is only part of a month
  const from = Math.max(m0, part0 ? 1 : 0);
  const cmpF = sum(fc.slice(from, nH)), cmpA = sum(act.slice(from, nH));
  const cmpChg = nH - from > 0 && cmpA ? cmpF / cmpA - 1 : null;
  // busiest and quietest full month of the year
  const elig = fc.map((_, k) => k).filter((k) => k >= m0 && k <= m1 && !(part0 && k === 0));
  const peak = elig.reduce((b, k) => (fc[k] > fc[b] ? k : b), elig[0]), quiet = elig.reduce((b, k) => (fc[k] < fc[b] ? k : b), elig[0]);

  const rows = F.map((i) => {
    const tot = sum(Array.from({ length: cnt }, (_, j) => qk(i.id, m0 + j)));
    return { i, tot, per: tot / cnt, v: tot * i.cost };
  }).filter((r) => r.tot > 0).sort((a, b) => b.v - a.v);

  const rangeText = m0 === m1 ? "in " + mlabel(L.months[m0]) : mlabel(L.months[m0]) + " to " + mlabel(L.months[m1]);
  // what to expect over the chosen months, in the same four-line form as the Next 2 weeks tab; the range of the total is the
  // typical miss of past forecasts for a total of that many months (the same as the cards)
  const eH = L.error_by_horizon_months, eFor = (n) => (n <= 1 ? eH["1"] : n <= 2 ? eH["2"] : n <= 3 ? eH["3"] : n < 12 ? Math.max(eH["3"], eH["6"]) : eH["12"]);
  const rndY = (v) => (single ? v : Math.round(v / (v >= 100000 ? 1000 : 100)) * (v >= 100000 ? 1000 : 100));
  const findings = [
    ["Expected", `${f(total)} ${m0 === m1 ? "" : "from "}${rangeText}${cmpChg === null ? "" : Math.abs(cmpChg) < 0.005 ? ", about the same as the same months last year"
      : `, about ${f(aboutQ(Math.abs(cmpF - cmpA), single))} ${cmpF >= cmpA ? "more" : "less"} than the same months last year`}`],
    ["Range", `likely ${f(rndY(total * (1 - eFor(cnt))))} to ${f(rndY(total * (1 + eFor(cnt))))} ${m0 === m1 ? "" : "from "}${rangeText}`],
    ["Not in the forecast", NOT_IN],
    ...(elig.length > 1 ? [["Busiest and quietest", `${mlabel(L.months[peak])} (${f(fc[peak])}) and ${mlabel(L.months[quiet])} (${f(fc[quiet])})`]] : []),
  ];

  return (
    <>
      <div className="pb-head">
        <Kpis>
          <Kpi label="Next month" value={f(t1)} delta={<span className="t-flat">likely {yr(t1, "1")}</span>} info={`From ${originTxt}. Range: the typical error one month ahead, ${pct(L.error_by_horizon_months["1"], 1)}.`} />
          <Kpi label="Next 3 months" value={f(t3)} delta={<span className="t-flat">likely {yr(t3, "3")}</span>} info={`Range: the typical error three months ahead, ${pct(L.error_by_horizon_months["3"], 1)}.`} />
          <Kpi label="Next 12 months" value={f(t12)} delta={<span className="t-flat">likely {yr(t12, "12")}</span>} info={`Range: the typical error twelve months ahead, ${pct(L.error_by_horizon_months["12"], 1)}.`} />
        </Kpis>
        {tabbar}
      </div>
      <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1.25fr) minmax(0, 1fr)" }}>
        <div className="panel c8">
          <div className="ph">
            <h2>Monthly use: last 12 months and forecast to {mlabel(L.months[m1])}{single ? " · " + F[0].name : " (₱)"}<small style={{ fontWeight: 500, color: "var(--muted)", marginLeft: 8 }}>made {+L.origin.slice(8, 10)} {MON[+L.origin.slice(5, 7) - 1]} {L.origin.slice(0, 4)}</small></h2>
            <div className="rangepick noprint">
              <label>From <b>{mlabel(L.months[m0])}</b><input type="range" min={0} max={11} step={1} value={m0} aria-label="First month" onChange={(e) => { const v = +e.target.value; set({ lr0: v, lr1: Math.max(v, m1) }); }} /></label>
              <label>To <b>{mlabel(L.months[m1])}</b><input type="range" min={0} max={11} step={1} value={m1} aria-label="Last month" onChange={(e) => { const v = +e.target.value; set({ lr1: v, lr0: Math.min(v, m0) }); }} /></label>
            </div>
          </div>
          <ComboChart x={x} h={200} yfmt={(q) => (single ? num(q) : kpeso(q))} shade={m0 > 0 || m1 < 11 ? [act.length + m0, act.length + m1, ""] : undefined}
            lines={[{ vals: actLine, color: "var(--accent)", name: "What was used", fmt: f, w: 2.4 },
              band ? { vals: fcLine, lo: fcLine.map((v, k) => (v === null ? null : k < act.length ? v : v * LR_BAND.lo)), hi: fcLine.map((v, k) => (v === null ? null : k < act.length ? v : v * LR_BAND.hi)), color: "var(--warn)", name: "Forecast", fmt: f, w: 2.4, dash: true }
                : { vals: fcLine, color: "var(--warn)", name: "Forecast", fmt: f, w: 2.4, dash: true }]} />
          <Legend items={[["What was used", "var(--accent)"], ["Forecast", "var(--warn)"], ...(band ? [["Likely range (±9%)", "#F6C28B"]] : [])]} />
          {band ? <NoteTip label="How the range was measured" t={`Forecasts made in Sep 2024 and Sep 2025 were within 9% of actual use in ${LR_BAND.inside} of ${LR_BAND.of} months.`} />
            : <NoteTip label="Why there is no range here" t={`The ±9% range holds for all ${LR_BAND.n} ingredients together. Clear the filters to see it.`} />}
          <NoteTip t={"Each ingredient's total is typically within " + pct(err, 1) + " of actual use this far ahead."} />
        </div>
        <div className="panel c4">
          <div className="ph"><h2>What to expect</h2><Info t="Likely: as close as past forecasts this far ahead usually came." /></div>
          <ul className="insights">{findings.map(([h, t], k) => <li key={k} className="flat"><i aria-hidden="true">{k + 1}</i><span><b>{h}:</b> {t}</span></li>)}</ul>
        </div>
        <div className="panel c5">
          <div className="ph"><h2>Month by month</h2></div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Month</th><th className="n">Expected use</th>{band && <th className="n" data-t="Actual use was within 9% of the forecast in 20 of 24 past months">Likely range</th>}<th className="n">Same month last year</th></tr></thead>
              <tbody>
                {L.months.slice(m0, nH).map((m, j) => { const k = m0 + j; return (
                  <tr key={m}>
                    <td><b>{mlabel(m)}</b>{k === 0 && part0 ? <small>from {originTxt}</small> : null}</td>
                    <td className="n">{f(fc[k])}</td>
                    {band && <td className="n t-flat">{kpeso(fc[k] * LR_BAND.lo)}–{kpeso(fc[k] * LR_BAND.hi)}</td>}
                    <td className="n">{k === 0 && part0 ? <span className="t-flat">part month</span> : f(act[k])}</td>
                  </tr>
                ); })}
                {cnt > 1 && <tr><td><b>Total</b></td><td className="n"><b>{f(total)}</b></td><td className="n"><b>{f(sum(act.slice(from, nH)))}</b>{part0 ? <small>without {mlabel(L.months[0])}</small> : null}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel c7">
          <div className="ph"><h2>Expected use by ingredient, {rangeText}</h2></div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Ingredient</th><th className="n">Expected use</th><th className="n">Per month</th><th className="n">Value</th><th className="n" data-t="Plus or minus the typical error this many months ahead">Likely value</th></tr></thead>
              <tbody>
                {rows.length ? rows.map((r) => (
                  <tr key={r.i.id} className="click" onClick={() => set({ sel: r.i.id, ing: r.i.id })}>
                    <td><b>{r.i.name}</b></td>
                    <td className="n">{qty(r.tot, r.i.uom)}</td>
                    <td className="n">{qty(r.per, r.i.uom)}</td>
                    <td className="n">{peso(r.v)}</td>
                    <td className="n t-flat">{kpeso(r.v * (1 - err))}–{kpeso(r.v * (1 + err)).slice(1)}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="empty">No forecast for these ingredients.</td></tr>}
              </tbody>
            </table>
          </div>
          <NoteTip t="Sales have been level since 2023, so the forecast is flat. Up to one year ahead only." />
        </div>
      </div>
    </>
  );
}

// ---- Weather and calendar: one screen. Row 1: live weather with the Philippine season, and the measured effect on sales.
//      Row 2: does heat change sales, paydays and holidays, and the hot and busy months. ----
const CLASS_COL = { caution: "#93A4D6", "extreme caution": "#F2B35E", hot: "#E2793A", danger: "#C0392B" };
const dayColor = (d) => (d.past ? "#CBD5E1" : d.hi == null ? "#CBD5E1" : d.hi >= 42 ? CLASS_COL.danger : d.hi >= HOT_DAY ? CLASS_COL.hot : d.hi >= 33 ? CLASS_COL["extreme caution"] : CLASS_COL.caution);
const wd = (iso) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(iso + "T00:00:00Z").getUTCDay()];
const spct = (v) => (v === null || v === undefined ? "–" : Math.round(v * 100) === 0 ? "0%" : (v >= 0 ? "+" : "−") + Math.abs(Math.round(v * 100)) + "%");
// a cell colour for a change in sales: green for more, orange for less, white near zero
const liftColor = (v) => (v === null || v === undefined ? "#F8FAFC" : Math.abs(v) < 0.03 ? "#F8FAFC" : v > 0 ? `rgba(16,185,129,${Math.min(0.55, 0.12 + v * 1.6)})` : `rgba(245,158,11,${Math.min(0.55, 0.12 - v * 1.6)})`);

function LiveWeatherPanel({ wx, error, loading }) {
  const cur = seasonOfIso(wx ? wx.today : new Date().toISOString().slice(0, 10));
  if (loading) return <div className="panel c7 empty">Loading the weather from Open-Meteo…</div>;
  if (!wx) return <div className="panel c7"><div className="ph"><h2>Weather now and ahead</h2></div><div className="empty">The weather service could not be reached{error ? ": " + error : ""}.</div></div>;
  const days = wx.days.filter((d, k) => k >= 5);      // the last 2 days, today and the next 16
  const next7 = wx.days.filter((d) => d.date > wx.today).slice(0, 7);
  const hotN = next7.filter((d) => d.hi != null && d.hi >= HOT_DAY).length;
  const recs = []; weatherRecs(wx, (r) => recs.push(r));
  return (
    <div className="panel c7">
      <div className="ph">
        <h2>{wx.mode === "asof" ? `Weather, ${fiso(wx.today)} and the 14 days of the plan` : "Weather now and the next 14 days"} · {wx.location}</h2>
        <span className="wx-now">{wx.mode === "asof" ? fiso(wx.today) + " at 2 pm: " : ""}<b>{Math.round(wx.now.temp)} °C</b>{wx.mode === "asof" ? "" : " now"} · feels <b>{Math.round(wx.now.feels)} °C</b> · humidity <b>{Math.round(wx.now.humidity)}%</b></span>
        <Info t={(wx.mode === "asof" ? "Open-Meteo weather on the data's dates, Quezon City." : "Open-Meteo forecast, Quezon City, updated " + new Date(wx.fetched_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) + ".") + " Feels-like °C at 2 pm, coloured by PAGASA heat class."} />
      </div>
      <div className="seasonbar">
        {SEASONS.map((s) => <span key={s.key} className={"seasonpill " + s.key + (s.key === cur.key ? " now" : "")} title={s.label + " · " + s.local + " · " + s.months}>{s.key === "summer" ? "Summer" : s.key === "rainy" ? "Rainy" : "Cool dry"} <small>{s.months.replace(" to ", "–").replace("March", "Mar").replace("May", "May").replace("June", "Jun").replace("November", "Nov").replace("December", "Dec").replace("February", "Feb")}</small></span>)}
        <span className={hotN >= 2 ? "t-bad" : "t-flat"} style={{ marginLeft: "auto", fontSize: 12 }}>{hotN} of the first 7 days at {HOT_DAY} °C or more</span>
      </div>
      <div className="wxtiles">
        {wx.days.filter((d) => d.date > wx.today).slice(0, 14).map((d) => (
          <div key={d.date} className="wxtile" style={{ borderTopColor: dayColor(d) }}>
            <span>{wd(d.date) + " " + fiso(d.date)}</span><b>{d.hi == null ? "–" : d.hi.toFixed(0) + "°"}</b><small>{d.rain >= 1 ? d.rain.toFixed(0) + " mm" : "dry"}</small>
          </div>
        ))}
      </div>
      {recs.length > 0 && <div className="banner good" style={{ marginTop: 6 }}>{recs[0].action}</div>}
    </div>
  );
}

function ImpactPanel({ from, to }) {
  const imp = seasonImpact(from, to), keys = ["all", "drinks", "mango", "mangoIng"];
  const cols = [["hot", "Hot days", "vs usual weekday"], ["cool", "Cool days", "vs usual weekday"], ["rain", "Rainy days", "vs usual weekday"], ["summer", "Summer", "vs rest of year"]];
  return (
    <div className="panel c5">
      <div className="ph"><h2>Does the weather change sales?</h2><span className="note-inline">{fd(imp.fromIdx, true)} to {fd(imp.toIdx, true)}</span></div>
      <div className="tablewrap fitc">
        <table className="heattbl">
          <thead><tr><th></th>{cols.map(([k, l, s]) => <th key={k} className="n">{l}<small>{s}</small></th>)}</tr></thead>
          <tbody>
            {keys.map((k) => { const g = imp.by[k]; return (
              <tr key={k}>
                <td><b>{g.label}</b></td>
                {cols.map(([c]) => (
                  <td key={c} className="n" style={{ background: g.thin || g[c] === null || g[c] === undefined ? "#F8FAFC" : liftColor(g[c]) }}><b>{g.thin || g[c] === null || g[c] === undefined ? "–" : spct(g[c])}</b></td>
                ))}
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <div className="legend" style={{ marginTop: 6 }}><span><i style={{ background: "rgba(16,185,129,.45)" }} />sells more</span><span><i style={{ background: "rgba(245,158,11,.45)" }} />sells less</span><span>Hot: {HOT_DAY} °C or more · Cool: under 33 °C · Rainy: {RAIN_DAY} mm or more</span></div>
    </div>
  );
}

// Weather and calendar: live weather and season, the effect on sales, heat, paydays, holidays, and months that are hot or busy
function WeatherPanels({ S, set }) {
  const { wx, error, loading } = useWeather();
  const key = S.heat || "all";
  const a = dailyDemand(key), y = devSeries(a);
  // the days the paydays and weather figures are based on: every year (September 2021 to the latest day) or the chosen year
  const d0 = dateOf(0).getTime(), dayOfMs = (ms) => Math.round((ms - d0) / 864e5);
  const wa = S.wyear ? Math.max(0, dayOfMs(Date.UTC(+S.wyear, 0, 1))) : 0, wb = S.wyear ? Math.min(LAST, dayOfMs(Date.UTC(+S.wyear, 11, 31))) : LAST;
  const basis = fd(wa, true) + " to " + fd(wb, true);
  const pairs = [];
  for (let i = wa; i <= wb; i++) if (y[i] !== null && XT.hi[i] !== null) pairs.push([XT.hi[i], y[i], i]);
  const r = pearson(pairs.map((q) => q[0]), pairs.map((q) => q[1]));
  const mean = (arr) => (arr.length ? sum(arr) / arr.length : null);
  const yAll = y.slice(wa, wb + 1).filter((z) => z !== null), yBase = mean(yAll) || 0;
  const days = (fn) => { const o = []; for (let i = wa; i <= wb; i++) if (!(XT.f[i] & 8) && fn(i)) o.push(i); return o; };
  const eff = (label, idxs) => { const v = idxs.map((i) => y[i]).filter((z) => z !== null); return { label, n: v.length, v: v.length ? mean(v) - yBase : null }; };
  // each day of the week against the average day (Saturday and Sunday are not lumped together: Saturday sells about
  // like an average day, Sunday and Monday are the slowest); paydays and holidays against the same weekday in the nearby weeks
  const WDN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const wdMean = WDN.map((_, k) => mean(days((i) => wdOf(i) === k).map((i) => a[i])));
  const wdAvg = mean(wdMean.filter((v) => v !== null));
  const rows = [eff("Payday", days((i) => XT.f[i] & 2)), eff("Holiday", days((i) => XT.f[i] & 1)),
    eff("Caution heat (below 33 °C)", days((i) => XT.hi[i] !== null && XT.hi[i] < 33)),
    eff("Extreme caution heat (33 to 41 °C)", days((i) => XT.hi[i] !== null && XT.hi[i] >= 33 && XT.hi[i] < 42)),
    eff("Danger heat (42 °C and above)", days((i) => XT.hi[i] !== null && XT.hi[i] >= 42))];

  // calendar months: average heat index and busy-ness (each day relative to its own year's average)
  const yrMean = {};
  for (let i = wa; i <= wb; i++) { const yy = dateOf(i).getUTCFullYear(); (yrMean[yy] || (yrMean[yy] = [])).push(a[i]); }
  Object.keys(yrMean).forEach((k) => { yrMean[k] = mean(yrMean[k]) || 1; });
  const mH = Array.from({ length: 12 }, () => []), mD = Array.from({ length: 12 }, () => []);
  for (let i = wa; i <= wb; i++) {
    const d = dateOf(i), m = d.getUTCMonth();
    if (XT.hi[i] !== null) mH[m].push(XT.hi[i]);
    if (!(XT.f[i] & 8)) mD[m].push(a[i] / yrMean[d.getUTCFullYear()] * 100);
  }
  const hv = mH.map((v) => mean(v)), dv = mD.map((v) => mean(v));
  const hvOk = hv.filter((v) => v !== null), hmn = hvOk.length ? Math.min(...hvOk) : 0, hmx = hvOk.length ? Math.max(...hvOk) : 1;
  const dvOk = dv.filter((v) => v !== null), dmn = dvOk.length ? Math.min(...dvOk) : 0, dmx = dvOk.length ? Math.max(...dvOk) : 1;

  const heatItems = [["Under 33 °C", rows[2]], ["33 to 41 °C", rows[3]], ["42 °C and up", rows[4]]]
    .map(([l, q]) => [q.n < 20 || q.v === null ? l + " (few)" : l, q.n < 20 || q.v === null ? null : q.v]);
  const calItems = WDN.map((nm, k) => [nm, wdMean[k] === null || !wdAvg ? null : wdMean[k] / wdAvg - 1]);
  const pctS = (v) => (Math.round(v * 100) > 0 ? "+" : Math.round(v * 100) < 0 ? "−" : "") + Math.abs(Math.round(v * 100)) + "%";
  const heatVerdict = Math.abs(r) < 0.1 ? "No link" : r > 0 ? "A little more on hot days" : "A little less on hot days";

  return (
    <>
      <LiveWeatherPanel wx={wx} error={error} loading={loading} />
      <ImpactPanel from={S.wyear ? wa : undefined} to={S.wyear ? wb : undefined} />
      <div className="panel c4">
        <div className="ph"><h2>Busy and slow days</h2><span className="note-inline">vs a usual day · {basis}</span></div>
        <DivCols items={calItems} yaxis={false} upColor="#2E9E7A" downColor="#D9822B" label="Sales on each day of the week against a usual day" up="Sells more" down="Sells less" />
        <div className="daypair">
          {[["Payday", "paydays", rows[0]], ["Holiday", "holidays", rows[1]]].map(([l, pl, q]) => {
            const few = q.n < 20 || q.v === null;
            return (
              <div key={l} className="tile" data-t={few ? `Only ${q.n} ${pl} in this period, too few to measure.` : `${q.n} ${pl}, against the same weekday in the weeks around them.`}>
                <b>{few ? "–" : pctS(q.v)}</b><span><i style={{ background: few ? "#CBD5E1" : q.v >= 0 ? "#2E9E7A" : "#D9822B" }} />{l}{few ? " (too few)" : ""}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel c8">
        <div className="ph"><h2>Hot and busy months</h2><span className="note-inline">{S.wyear ? S.wyear : "all years"}</span><Info t="Average feels-like °C, season and sales (100 = an average month) by month." /></div>
        <HeatChart labelWidth={78} rowH={44} cols={MON} rows={[
          { name: "Feels like °C", cells: hv.map((v, m) => (v === null ? cellOf("#E5E7EB", "–", `${MON[m]}: no heat data`) : cellOf(heatHex((v - hmn) / (hmx - hmn || 1)), v.toFixed(0), `${MON[m]}: average heat index ${v.toFixed(1)} °C`))) },
          { name: "PH season", cells: MON.map((_, m) => { const s = seasonOfIso("2026-" + String(m + 1).padStart(2, "0") + "-15"); return cellOf(s.key === "summer" ? "#F6C28B" : s.key === "rainy" ? "#BCD0F0" : "#BFE3DC", s.key === "summer" ? "Hot" : s.key === "rainy" ? "Rain" : "Cool", MON[m] + ": " + s.label); }) },
          { name: "Sales (100 = avg)", cells: dv.map((v, m) => (v === null ? cellOf("#E5E7EB", "–", `${MON[m]}: no sales in this year`) : cellOf(heatHex((v - dmn) / (dmx - dmn || 1)), v.toFixed(0), `${MON[m]}: demand ${v.toFixed(0)} (100 is a typical month)`))) },
        ]} />
      </div>
    </>
  );
}
