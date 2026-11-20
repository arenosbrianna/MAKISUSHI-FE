// Forecast: how much of each ingredient will be used. Three tabs:
//  - Next 2 weeks: the daily forecast the purchase plan uses (14 days), with how far to trust each ingredient
//  - Up to 1 year: the monthly forecast for budgeting and supplier planning (Chapter 4, Section 4.2.2.6); not used for the weekly order
//  - Weather and calendar: does heat, a payday or a holiday change sales (Chapter 4, Section 4.2.1.3)
// The model comparison and accuracy tables are in Chapter 4, not here.
import { D, N, LAST, MON, XT, BYID, dateOf, fd, fiso, monthsFrom, demandAt, demandValue, yieldOf, dailyDemand, devSeries, pearson } from "../lib/model.js";
import { peso, kpeso, num, pct, qty, sum } from "../lib/format.js";
import { heatHex, cellOf } from "../lib/color.js";
import { ComboChart, DivBars, HeatChart, CorrelationBar, HBars, Donut, MiniForecast } from "../components/Charts.jsx";
import { Kpi, Kpis, Legend, Chip, Info, TabBar, deltaEl } from "../components/ui.jsx";
import { useWeather } from "../lib/weather.js";
import { SEASONS, seasonOfIso, nextSeason, seasonImpact, HOT_DAY, RAIN_DAY} from "../lib/seasons.js";
import { weatherRecs } from "./recommend.js";
import { useApp } from "../AppContext.js";
import { MODEL_NAMES } from "../lib/constants.js";
import { UploadForecastPanel } from "./UploadPanels.jsx";

const classOf = (id) => (D.upload.prof[id] && D.upload.prof[id].c) || "";
const TABS = [["forecast", "Next 2 weeks"], ["byIng", "By ingredient"], ["year", "Up to 1 year"], ["weather", "Weather and calendar"]];
const HORIZONS = [[1, "1 month"], [3, "3 months"], [6, "6 months"], [12, "1 year"]];
const mlabel = (ym) => `${MON[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
const horizonText = (n) => (n === 1 ? "month" : n === 12 ? "12 months" : n + " months");

// confidence from how far the weekly forecast missed on the test year (the study's own measure, WMAPE):
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
  const last7 = sum(ids.map((id) => { let v = 0; for (let i = LAST - 6; i <= LAST; i++) v += demandAt(id, i) * c(id); return v; }));
  const next7 = sum(fy.slice(0, 7)), next14 = sum(fy.slice(0, n14));
  const chg = last7 ? next7 / last7 - 1 : 0;

  const fmarks = [];
  D.fdates.forEach((_, k) => { const fl = D.ext.ff[k] || 0; if (fl & 2) fmarks.push([k, "Payday"]); else if (fl & 1) fmarks.push([k, "Holiday"]); });
  // the last 28 days of use, then the forecast (both in used amounts)
  const HD = 28;
  const hist = Array.from({ length: HD }, (_, k) => sum(ids.map((id) => demandAt(id, LAST - HD + 1 + k) * c(id))));
  const histX = [...Array.from({ length: HD }, (_, k) => fd(LAST - HD + 1 + k)), ...D.fdates.map(fiso)];
  const histAct = [...hist, ...Array(nF).fill(null)];
  const histFc = [...Array(HD).fill(null), ...fy];
  const histLo = [...hist, ...D.fdates.map((_, k) => sum(ids.map((id) => D.fcRaw[id].lo[k] * c(id))))];
  const histHi = [...hist, ...D.fdates.map((_, k) => sum(ids.map((id) => D.fcRaw[id].hi[k] * c(id))))];
  const histMarks = [[HD - 1, "Today"], ...fmarks.map(([k, l]) => [k + HD, l])];

  // per ingredient: expected use, the range, and how far to trust it
  const rows = F.map((i) => {
    const y = D.fcRaw[i.id].y, lo = D.fcRaw[i.id].lo, hi = D.fcRaw[i.id].hi;
    return { i, d7: sum(y.slice(0, 7)), d14: sum(y.slice(0, n14)), lo: sum(lo.slice(0, n14)), hi: sum(hi.slice(0, n14)), conf: confidence(i.id) };
  }).filter((r) => r.d14 > 0).sort((a, b) => b.d14 * b.i.cost - a.d14 * a.i.cost);
  const low = rows.filter((r) => r.conf.cls === "bad");

  // one line of accuracy on the test year, from the study's own evaluation
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
  const confNote = (id) => confidence(id).label;

  // what to do about it, in a sentence each (the "Recommendations" card)
  const recs = [];
  recs.push(`Next 7 days: ${f(next7)}, ${chg >= 0 ? "up" : "down"} ${Math.abs(chg * 100).toFixed(0)}% on the last 7 days. ${chg >= 0.05 ? "Check this week's order covers it." : chg <= -0.05 ? "Order a little less." : "Order as usual."}`);
  if (fmarks.length) recs.push(`${fmarks.map(([k, l]) => `${l} on ${fiso(D.fdates[k])}`).slice(0, 3).join(", ")}: have a little more stock ready.`);
  if (low.length) recs.push(`Hard to forecast: ${low.slice(0, 3).map((r) => r.i.name).join(", ")}. Keep a bigger cushion.`);
  if (rows.length && !single) recs.push(`Biggest use: ${rows[0].i.name} (${peso(rows[0].d14 * rows[0].i.cost)}). Check its delivery first.`);

  const lineOf = (d, color) => [{ vals: d.act, color: "var(--accent)", name: "What was used", fmt: f }, { vals: d.fc, lo: d.lo, hi: d.hi, color, name: "Forecast", fmt: f }];
  return (
    <>
      <div className="pb-head">
        <Kpis>
          <Kpi label="Next 7 days" value={f(next7)} delta={<span className="t-flat">{chg >= 0 ? "▲" : "▼"} {Math.abs(chg * 100).toFixed(0)}% vs last 7 days</span>}
            info="Expected use for the next 7 days, in the amounts taken from stock, compared with what was used in the last 7 days." />
          <Kpi label={`Next ${n14} days`} value={f(next14)} delta={<span className="t-flat">the purchase-plan window</span>}
            info="Expected use over the 14 days the purchase plan covers." />
          <Kpi label="Hard to forecast" value={`${low.length} of ${rows.length}`} delta={<span className="t-flat">low confidence: keep a bigger cushion</span>}
            info="Ingredients whose weekly forecast missed by more than 40% on the test year. They are used unevenly, so a larger cushion matters more than a better forecast." />
          {wm !== null && <Kpi label="Weekly WMAPE" value={pct(wm, 1)} delta={<span className="t-flat">test year, weighted by value</span>}
            info={`Weekly WMAPE of ${MODEL_NAMES[E.model] || E.model} on the study's test year (${E.test}), weighted by the value of each ingredient. The forecast is refitted every week on data before the forecast date only.`} />}
        </Kpis>
        {tabbar}
      </div>
      <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1.25fr) minmax(0, 1fr)" }}>
        <div className="panel c8">
          <div className="ph"><h2>Forecast of total use{single ? " · " + F[0].name : " (₱)"}</h2>
            <Info t="Both lines are recipe use at the standard cost. Dotted lines mark paydays and holidays. The shaded band is the range the use should fall in 4 times out of 5. The purchase plan covers the first 14 days." /></div>
          <ComboChart x={histX} h={240} yfmt={(q) => (single ? num(q) : kpeso(q))} marks={histMarks} lines={lineOf({ act: histAct, fc: histFc, lo: histLo, hi: histHi }, "var(--warn)")} />
          <Legend items={[["What was used (last 4 weeks)", "var(--accent)"], ["Forecast", "var(--warn)"], ["Likely range", "var(--warn)"]]} />
        </div>
        <div className="panel c4">
          <div className="ph"><h2>Recommendations</h2></div>
          <ul className="insights">{recs.map((r, k) => <li key={k} className="flat"><i />{r}</li>)}</ul>
        </div>
        {up && <UploadForecastPanel up={up} />}
        <div className="panel c8">
          <div className="ph"><h2>Biggest expected use, next {n14} days</h2><Info t="The ingredients with the most use over the 14 days, with how far the forecast can be trusted. Click one to focus on it." /></div>
          <HBars items={topRows} fmt={single ? (v) => qty(v, F[0].uom) : (v) => peso(v)} axis={single ? num : kpeso} click onRow={(id) => set({ sel: +id, ing: +id })}
            notes={topRows.map((r) => confNote(r[2]))} label="Biggest expected use" labelWidth={130} />
        </div>
        <div className="panel c4">
          <div className="ph"><h2>By supplier, next {n14} days</h2></div>
          <Donut items={supItems} size="auto" center={kpeso(supTotal)} sub="expected use" label="Expected use by supplier" />
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
        <div className="fgrid">
          {rows.length ? rows.map((r) => (
            <button key={r.i.id} type="button" className="fcard" data-t={"Likely range over " + n14 + " days"} onClick={() => set({ sel: r.i.id, ing: r.i.id, ptab: "forecast" })}>
              <span className="fc-h"><b>{r.i.name}</b><Chip cls={r.conf.cls}>{r.conf.label}</Chip></span>
              <span className="fc-c"><MiniForecast x={x} act={r.act} fc={r.fc} lo={r.lo} hi={r.hi} todayIdx={HIST - 1} fmt={(v) => qty(v, r.i.uom)} /></span>
              <span className="fc-f"><span>7 days <b>{qty(r.d7, r.i.uom)}</b></span><span>{n14} days <b>{qty(r.d14, r.i.uom)}</b></span></span>
            </button>
          )) : <div className="empty">No forecast for these ingredients.</div>}
        </div>
        <div className="legend"><span><i style={{ background: "#1E3A8A" }} />Used</span><span><i style={{ background: "#B45309" }} />Forecast</span><span><i style={{ background: "#E8B88A" }} />Likely range</span></div>
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
  const c = (id) => (single ? 1 : BYID[id].cost);
  const f = (v) => (single ? qty(v, F[0].uom) : peso(v));
  // the monthly model forecasts recipe demand (the warehouse forecast_qty), shown as it is at the standard cost, like Table 4.2.2.6.3 of Chapter 4;
  // the history is drawn on the same basis (use x yield)
  const qk = (id, k) => (L.qty[id] && L.qty[id][k]) || 0;
  const monthly = (k) => sum(ids.map((id) => qk(id, k) * c(id)));
  const fc = L.months.map((_, k) => monthly(k));
  const part0 = L.origin.slice(8, 10) !== "01";          // the first forecast month starts on the origin date, so it is part of a month
  const originTxt = `${+L.origin.slice(8, 10)} ${MON[+L.origin.slice(5, 7) - 1]}`;
  // the last 12 full months of use, one for each forecast month a year later
  const past = monthsFrom(Math.max(0, LAST - 400), LAST, true).slice(-12);
  const act = past.map((m) => (single ? sum(Array.from({ length: m.b - m.a + 1 }, (_, k) => demandAt(F[0].id, m.a + k))) : demandValue(ids, m.a, m.b)));
  const pl = (m) => m.label.slice(0, 3) + " " + m.label.slice(-2);
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
  const findings = [
    ["Expected", `${f(total)} ${rangeText}${cmpChg !== null ? `, ${cmpChg >= 0 ? "up" : "down"} ${Math.abs(cmpChg * 100).toFixed(1)}% on a year earlier` : ""}`],
    ["Peak", elig.length > 1 ? `Peak ${mlabel(L.months[peak])} (${f(fc[peak])}) · low ${mlabel(L.months[quiet])} (${f(fc[quiet])})` : `${mlabel(L.months[m0])}: ${f(fc[m0])}`],
  ];

  return (
    <>
      <div className="pb-head">
        <Kpis>
          <Kpi label="Next month" value={f(t1)} delta={<span className="t-flat">typical error {pct(L.error_by_horizon_months["1"], 1)}</span>} info={`Expected use over the first month (it starts on ${originTxt}).`} />
          <Kpi label="Next 3 months" value={f(t3)} delta={<span className="t-flat">typical error {pct(L.error_by_horizon_months["3"], 1)}</span>} info="Expected use over the next three months." />
          <Kpi label="Next 12 months" value={f(t12)} delta={<span className="t-flat">typical error {pct(L.error_by_horizon_months["12"], 1)}</span>} info="Expected use over the next twelve months. Forecasts beyond one year are not supported." />
        </Kpis>
        {tabbar}
      </div>
      <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <div className="panel c8">
          <div className="ph">
            <h2>Monthly use: last 12 months and forecast to {mlabel(L.months[m1])}{single ? " · " + F[0].name : " (₱)"}<small style={{ fontWeight: 500, color: "var(--muted)", marginLeft: 8 }}>made {+L.origin.slice(8, 10)} {MON[+L.origin.slice(5, 7) - 1]} {L.origin.slice(0, 4)}</small></h2>
            <div className="rangepick noprint">
              <label>From <b>{mlabel(L.months[m0])}</b><input type="range" min={0} max={11} step={1} value={m0} aria-label="First month" onChange={(e) => { const v = +e.target.value; set({ lr0: v, lr1: Math.max(v, m1) }); }} /></label>
              <label>To <b>{mlabel(L.months[m1])}</b><input type="range" min={0} max={11} step={1} value={m1} aria-label="Last month" onChange={(e) => { const v = +e.target.value; set({ lr1: v, lr0: Math.min(v, m0) }); }} /></label>
            </div>
          </div>
          <ComboChart x={x} h={200} yfmt={(q) => (single ? num(q) : kpeso(q))} shade={m0 > 0 || m1 < 11 ? [act.length + m0, act.length + m1, ""] : undefined}
            lines={[{ vals: actLine, color: "var(--accent)", name: "What was used", fmt: f, w: 2.4 }, { vals: fcLine, color: "var(--warn)", name: "Forecast", fmt: f, w: 2.4, dash: true }]} />
          <Legend items={[["What was used", "var(--accent)"], ["Forecast", "var(--warn)"]]} />
          <div className="note">At this horizon the total of each ingredient has typically been within {pct(err, 1)} of what was used (test year, Chapter 4). Valued at standard cost.</div>
        </div>
        <div className="panel c4 recbox">
          <div className="ph"><h2>Recommendations</h2></div>
          <ul>{findings.map(([h, t], k) => <li key={k}>{t}</li>)}</ul>
        </div>
        <div className="panel c5">
          <div className="ph"><h2>Month by month</h2></div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Month</th><th className="n">Expected use</th><th className="n">Same month last year</th></tr></thead>
              <tbody>
                {L.months.slice(m0, nH).map((m, j) => { const k = m0 + j; return (
                  <tr key={m}>
                    <td><b>{mlabel(m)}</b>{k === 0 && part0 ? <small>from {originTxt}</small> : null}</td>
                    <td className="n">{f(fc[k])}</td>
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
              <thead><tr><th>Ingredient</th><th className="n">Expected use</th><th className="n">Per month</th><th className="n">Value</th></tr></thead>
              <tbody>
                {rows.length ? rows.map((r) => (
                  <tr key={r.i.id} className="click" onClick={() => set({ sel: r.i.id, ing: r.i.id })}>
                    <td><b>{r.i.name}</b><small>{r.i.store}</small></td>
                    <td className="n">{qty(r.tot, r.i.uom)}</td>
                    <td className="n">{qty(r.per, r.i.uom)}</td>
                    <td className="n">{peso(r.v)}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="empty">No forecast for these ingredients.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="note">Recipe use at the standard cost, as in Chapter 4 (Table 4.2.2.6.3). Monthly Holt-Winters model with a damped trend and a yearly season; sales have been level since 2023, so the forecast is flat rather than growing. Not supported beyond one year.</div>
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
const spct = (v) => (v === null || v === undefined ? "–" : (v >= 0 ? "+" : "−") + Math.abs(Math.round(v * 100)) + "%");
// a cell colour for a change in sales: green for more, orange for less, white near zero
const liftColor = (v) => (v === null || v === undefined ? "#F8FAFC" : Math.abs(v) < 0.03 ? "#F8FAFC" : v > 0 ? `rgba(16,185,129,${Math.min(0.55, 0.12 + v * 1.6)})` : `rgba(245,158,11,${Math.min(0.55, 0.12 - v * 1.6)})`);

function LiveWeatherPanel({ wx, error, loading }) {
  const cur = seasonOfIso(wx ? wx.today : new Date().toISOString().slice(0, 10));
  if (loading) return <div className="panel c7 empty">Loading the weather from Open-Meteo…</div>;
  if (!wx) return <div className="panel c7"><div className="ph"><h2>Weather now and ahead</h2></div><div className="empty">The weather service could not be reached{error ? ": " + error : ""}.</div></div>;
  const days = wx.days.filter((d, k) => k >= 5);      // the last 2 days, today and the next 16
  const next7 = wx.days.filter((d) => !d.past).slice(0, 7);
  const hotN = next7.filter((d) => d.hi != null && d.hi >= HOT_DAY).length;
  const recs = []; weatherRecs(wx, (r) => recs.push(r));
  return (
    <div className="panel c7">
      <div className="ph">
        <h2>Weather · {wx.location}</h2>
        <span className="wx-now"><b>{Math.round(wx.now.temp)} °C</b> now · feels <b>{Math.round(wx.now.feels)} °C</b> · humidity <b>{Math.round(wx.now.humidity)}%</b></span>
        <Info t={"Live from Open-Meteo's forecast service (no key), refreshed every 30 minutes; updated " + new Date(wx.fetched_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) + ". Bars are the feels-like temperature (heat index) at 2 pm, the same measure as the sales history. PAGASA heat classes: caution below 33 °C, extreme caution 33 to 41 °C, danger 42 °C and above. A day at " + HOT_DAY + " °C or more counts as a hot day for the sales effect. Seasons follow PAGASA's climate types for Metro Manila."} />
      </div>
      <div className="seasonbar">
        {SEASONS.map((s) => <span key={s.key} className={"seasonpill " + s.key + (s.key === cur.key ? " now" : "")} title={s.label + " · " + s.local + " · " + s.months}>{s.key === "summer" ? "Summer" : s.key === "rainy" ? "Rainy" : "Cool dry"} <small>{s.months.replace(" to ", "–").replace("March", "Mar").replace("May", "May").replace("June", "Jun").replace("November", "Nov").replace("December", "Dec").replace("February", "Feb")}</small></span>)}
        <span className={hotN >= 2 ? "t-bad" : "t-flat"} style={{ marginLeft: "auto", fontSize: 12 }}>{hotN} of the next 7 days at {HOT_DAY} °C or more</span>
      </div>
      <div className="wxtiles">
        {wx.days.filter((d) => !d.past).slice(0, 14).map((d) => (
          <div key={d.date} className="wxtile" style={{ borderTopColor: dayColor(d) }}>
            <span>{d.today ? "Today" : wd(d.date) + " " + fiso(d.date)}</span><b>{d.hi == null ? "–" : d.hi.toFixed(0) + "°"}</b><small>{d.rain >= 1 ? d.rain.toFixed(0) + " mm" : "dry"}</small>
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
  const wkend = days((i) => XT.f[i] & 4), wkday = days((i) => !(XT.f[i] & 4));
  const eff = (label, idxs) => { const v = idxs.map((i) => y[i]).filter((z) => z !== null); return { label, n: v.length, v: v.length ? mean(v) - yBase : null }; };
  const wkEff = { label: "Weekend (Sat, Sun)", n: wkend.length, v: mean(wkend.map((i) => a[i])) / mean(wkday.map((i) => a[i])) - 1 };
  const rows = [eff("Payday", days((i) => XT.f[i] & 2)), eff("Holiday", days((i) => XT.f[i] & 1)), wkEff,
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

  const heatItems = [["Under 33 °C", rows[3]], ["33 to 41 °C", rows[4]], ["42 °C and up", rows[5]]]
    .map(([l, q]) => [q.n < 20 || q.v === null ? l + " (few)" : l, q.n < 20 || q.v === null ? null : q.v]);
  const calItems = [["Payday", rows[0]], ["Holiday", rows[1]], ["Weekend", rows[2]]]
    .map(([l, q]) => [q.n < 20 || q.v === null ? l + " (few)" : l, q.n < 20 || q.v === null ? null : q.v]);
  const heatVerdict = Math.abs(r) < 0.1 ? "No link" : r > 0 ? "A little more on hot days" : "A little less on hot days";

  return (
    <>
      <LiveWeatherPanel wx={wx} error={error} loading={loading} />
      <ImpactPanel from={S.wyear ? wa : undefined} to={S.wyear ? wb : undefined} />
      <div className="panel c4">
        <div className="ph"><h2>Paydays and holidays</h2><span className="note-inline">net sales · {basis}</span><Info t="Paydays lift use a little and public holidays lower it; both effects are small next to the day-to-day variation, so a payday week needs a little more stock on the payday itself, not a different plan." /></div>
        <DivBars items={calItems} labelWidth={70} label="Sales on these days compared with other days" up="Sells more" down="Sells less" />
      </div>
      <div className="panel c8">
        <div className="ph"><h2>Hot and busy months</h2><span className="note-inline">{S.wyear ? S.wyear : "all years"}</span><Info t="Feels-like temperature, the Philippine season and busy-ness (100 = average month) by calendar month. Weather: Open-Meteo, Quezon City." /></div>
        <HeatChart labelWidth={78} rowH={44} cols={MON} rows={[
          { name: "Feels like °C", cells: hv.map((v, m) => (v === null ? cellOf("#E5E7EB", "–", `${MON[m]}: no heat data`) : cellOf(heatHex((v - hmn) / (hmx - hmn || 1)), v.toFixed(0), `${MON[m]}: average heat index ${v.toFixed(1)} °C`))) },
          { name: "PH season", cells: MON.map((_, m) => { const s = seasonOfIso("2026-" + String(m + 1).padStart(2, "0") + "-15"); return cellOf(s.key === "summer" ? "#F6C28B" : s.key === "rainy" ? "#BCD0F0" : "#BFE3DC", s.key === "summer" ? "Hot" : s.key === "rainy" ? "Rain" : "Cool", MON[m] + ": " + s.label); }) },
          { name: "Busy-ness", cells: dv.map((v, m) => (v === null ? cellOf("#E5E7EB", "–", `${MON[m]}: no sales in this year`) : cellOf(heatHex((v - dmn) / (dmx - dmn || 1)), v.toFixed(0), `${MON[m]}: demand ${v.toFixed(0)} (100 is a typical month)`))) },
        ]} />
      </div>
    </>
  );
}
