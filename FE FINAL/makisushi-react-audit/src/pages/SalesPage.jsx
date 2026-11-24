// Sales and ingredient use: net sales over time and by category, the top-selling dishes, and (under the same tab bar)
// the kitchen's ingredient use: busy weekdays and months, and the few ingredients that carry most of the value.
import { D, MON, dateOf, D0, win, IS, IT, LAST, PAL, bucketsFor, partNote, bucketUnit } from "../lib/model.js";
import { YCOL, tabOf, chanName, chanColor } from "../lib/constants.js";
import { peso, kpeso, num, pct, sum } from "../lib/format.js";
import { cleanName } from "../lib/upload.js";
import { ComboChart, HBars, Donut, StackCols, GroupCols, DivBars, rankWithShare } from "../components/Charts.jsx";
import { Kpi, Kpis, deltaEl, Info, AggSeg } from "../components/ui.jsx";
import { useApp } from "../AppContext.js";
import { UploadSalesPanel } from "./UploadPanels.jsx";
import { UsePage } from "./UsePage.jsx";

// dish totals in the window: quantity and net sales (one menu category and one channel when chosen; -1 is all)
function itemTotals(a, b, ci, chi = -1) {
  const m = new Map();
  for (let k = 0; k < IS.length; k++) {
    const r = IS[k];
    if (r[0] < a || r[0] > b || (chi >= 0 && r[4] !== chi)) continue;
    const it = IT[r[1]];
    if (!it || (ci >= 0 && it[1] !== ci)) continue;
    const o = m.get(r[1]);
    if (o) { o.q += r[2]; o.n += r[3]; } else m.set(r[1], { q: r[2], n: r[3] });
  }
  return m;
}

// a long dish name, cut to fit one row of a chart
const cut = (n, max = 29) => (n && n.length > max ? n.slice(0, max - 1).trimEnd() + "…" : n);

export function SalesPage({ F }) {
  const { S, set, up, goto } = useApp();
  const tab = tabOf("sales", S);
  if (tab === "time" || tab === "what") {
    if (!F.length) return <div className="panel empty">No ingredients match these filters. Press Clear filters.</div>;
    return <UsePage F={F} tab={tab} />;
  }

  const w = win(S), cats = D.cats, ci = S.cat ? cats.indexOf(S.cat) : -1;
  const chans = D.chans || [], chi = S.chan ? chans.indexOf(S.chan) : -1;
  // a sales row is in the filters when it is of the chosen menu category and channel
  const inCat = (r) => (ci < 0 || r[1] === ci) && (chi < 0 || r[2] === chi);
  const rows = D.sales.filter((r) => r[0] >= w.a && r[0] <= w.b && inCat(r));
  const prev = D.sales.filter((r) => r[0] >= w.pa && r[0] <= w.pb && inCat(r));
  const net = sum(rows.map((r) => r[3])), lines = sum(rows.map((r) => r[5])), qn = sum(rows.map((r) => r[4]));
  const netP = sum(prev.map((r) => r[3])), linesP = sum(prev.map((r) => r[5])), qnP = sum(prev.map((r) => r[4]));
  const hasPrev = w.pb >= 0 && w.pa <= w.pb;

  // categories: share in the period
  const catNow = {};
  rows.forEach((r) => { catNow[r[1]] = (catNow[r[1]] || 0) + r[3]; });
  const byCat = Object.keys(catNow).map(Number).sort((a, b) => catNow[b] - catNow[a]).slice(0, 8);

  // dishes in the period, by number sold, and how each moved against the period before
  const named = new Map();
  itemTotals(w.a, w.b, ci, chi).forEach((o, id) => {
    const nm = cleanName(IT[id][0]), k = nm.toLowerCase(), c = named.get(k);
    if (c) { c.q += o.q; c.n += o.n; } else named.set(k, { name: nm, q: o.q, n: o.n });
  });
  const allD = [...named.values()].filter((x) => x.q > 0);
  const byNet = allD.slice().sort((x, y) => y.n - x.n), byQty = allD.slice().sort((x, y) => y.q - x.q);
  const mostSold = byQty.slice(0, 10);
  // the least sold: only regular dishes (sold in at least 80% of the full months of the data), so occasional and
  // discontinued dishes do not fill the list; a regular dish that sold nothing in the period shows as 0
  const monthOf = (d) => { const x = dateOf(d); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
  const lastM = monthOf(LAST) - 1, seen = new Map();
  for (let k = 0; k < IS.length; k++) {
    const r = IS[k], m = monthOf(r[0]);
    if (m > lastM || (chi >= 0 && r[4] !== chi)) continue;
    let st = seen.get(r[1]); if (!st) { st = new Set(); seen.set(r[1], st); }
    st.add(m);
  }
  const monthsAll = lastM - monthOf(0) + 1, regular = new Map();
  seen.forEach((st, id) => {
    const it = IT[id];
    if (!it || !it[2] || (ci >= 0 && it[1] !== ci) || st.size < 0.8 * monthsAll) return;
    const nm = cleanName(it[0]), k = nm.toLowerCase();
    if (!regular.has(k)) regular.set(k, nm);
  });
  const topNames = new Set(mostSold.map((x) => x.name.toLowerCase()));
  const leastSold = [...regular.entries()].filter(([k]) => !topNames.has(k)).map(([k, nm]) => ({ name: nm, q: (named.get(k) || { q: 0 }).q })).sort((x, y) => x.q - y.q).slice(0, 8);
  const prevQ = new Map();
  if (hasPrev) itemTotals(w.pa, w.pb, ci, chi).forEach((o, id) => { const k = cleanName(IT[id][0]).toLowerCase(); prevQ.set(k, (prevQ.get(k) || 0) + o.q); });
  const movers = hasPrev ? allD.map((d) => ({ name: d.name, q: d.q, p: prevQ.get(d.name.toLowerCase()) || 0 })).filter((d) => d.p >= 10 && d.q + d.p >= 20).map((d) => ({ ...d, g: d.q - d.p })).sort((x, y) => y.g - x.g) : [];
  const moverItems = [...movers.filter((d) => d.g > 0).slice(0, 4), ...movers.filter((d) => d.g < 0).slice(-4)].map((d) => [d.name, d.g]);
  const rankNet = rankWithShare(byNet.slice(0, 12).map((x) => [x.name, x.n]), sum(byNet.map((x) => x.n)));

  // Everything below follows the Period and Menu category filters. The period is set against the same days of every earlier year
  // back to 2021 (year over year); for "All data" each calendar year is shown as recorded (2021 starts in September, 2026 ends on 8 September).
  const dayOf = (ms) => Math.round((ms - D0) / 864e5);
  const shiftY = (i, k) => { const d = dateOf(i); return dayOf(Date.UTC(d.getUTCFullYear() - k, d.getUTCMonth(), d.getUTCDate())); };
  const yrOf = (i) => dateOf(i).getUTCFullYear();
  const yLab = (x, y) => { const ya = yrOf(x), yb = yrOf(y); return ya === yb ? String(yb) : ya + "-" + String(yb).slice(2); };
  const multi = w.n > 366;
  const firstY = yrOf(w.a), lastY = yrOf(w.b);
  let yoyW = [];
  if (multi) {
    for (let y = firstY; y <= lastY; y++) {
      const j0 = dayOf(Date.UTC(y, 0, 1)), j1 = dayOf(Date.UTC(y, 11, 31)), a = Math.max(j0, w.a), b = Math.min(j1, w.b);
      yoyW.push({ a, b, year: y, label: String(y) + (a > j0 || b < j1 ? "*" : "") });
    }
  } else {
    // every year back to 2021: a year the data only partly covers (2021 starts on 1 September) is shown with * for the days it has
    yoyW = [5, 4, 3, 2, 1, 0].map((k) => ({ a0: shiftY(w.a, k), b0: shiftY(w.b, k) })).filter((c) => c.b0 >= 0 && c.a0 <= LAST)
      .map((c) => ({ a: Math.max(0, c.a0), b: c.b0, part: c.a0 < 0, year: yrOf(c.b0), label: yLab(c.a0, c.b0) + (c.a0 < 0 ? "*" : "") }));
  }
  const yearCol = (c) => YCOL[c.year] || "var(--accent)";
  // net sales per day for the chosen menu category, so each window is a quick sum
  const dayNet = new Float64Array(LAST + 1);
  D.sales.forEach((r) => { if (inCat(r)) dayNet[r[0]] += r[3]; });
  const netIn = (x, y) => { let t = 0; for (let i = Math.max(0, x); i <= Math.min(LAST, y); i++) t += dayNet[i]; return t; };
  const winCats = (c) => { const o = {}; D.sales.forEach((r) => { if (r[0] >= c.a && r[0] <= c.b && inCat(r)) o[r[1]] = (o[r[1]] || 0) + r[3]; }); return o; };
  const winDishes = (c) => {
    const o = {};
    itemTotals(c.a, c.b, ci, chi).forEach((v, id) => { const nm = cleanName(IT[id][0]); o[nm] = (o[nm] || 0) + v.n; });
    return o;
  };

  // the growth number: the period against the same days one year earlier (for All data, 1 January to the latest day of each year)
  const curW = multi ? { a: dayOf(Date.UTC(lastY, 0, 1)), b: w.b } : { a: w.a, b: w.b };
  const prevW = { a: shiftY(curW.a, 1), b: shiftY(curW.b, 1) };
  const yoyNet = netIn(curW.a, curW.b), yoyPrev = prevW.a >= 0 ? netIn(prevW.a, prevW.b) : 0;
  const yoy = yoyPrev > 0 ? yoyNet / yoyPrev - 1 : null;

  // the trend: one line per year over the same days (months across the year for All data)
  let trendX, trendLines, trendNote = "";
  if (multi) {
    trendX = MON;
    trendLines = yoyW.map((c) => {
      const vals = new Array(12).fill(null);
      for (let i = c.a; i <= c.b; i++) { const m = dateOf(i).getUTCMonth(); vals[m] = (vals[m] || 0) + dayNet[i]; }
      if (c.b === LAST && dateOf(LAST + 1).getUTCDate() !== 1) vals[dateOf(LAST).getUTCMonth()] = null;
      return { vals, label: c.label, color: c.year >= lastY - 1 ? yearCol(c) : "#94A3B8" };
    });
  } else {
    const cur = yoyW[yoyW.length - 1], base = bucketsFor(cur.a, cur.b, 31);
    trendX = base.map((x) => x.label); trendNote = partNote(base);
    trendLines = yoyW.filter((c) => !c.part).map((c) => { const bl = bucketsFor(c.a, c.b, 31); return { vals: base.map((_, k) => (bl[k] ? netIn(bl[k].a, bl[k].b) : null)), label: c.label, color: yearCol(c) }; });
  }

  // year over year: the total per year, or split by category (by dish when one category is chosen)
  const by = S.yoyBy === "cat" ? "cat" : "total";
  const yoyBy = ci >= 0 ? "dish" : "category";
  const totals = yoyW.map((c) => netIn(c.a, c.b));
  const yoyData = by === "cat" ? yoyW.map((c) => (ci >= 0 ? winDishes(c) : winCats(c))) : [];
  const nowData = yoyData[yoyData.length - 1] || {};
  const yoyKeys = Object.keys(nowData).sort((x, y) => nowData[y] - nowData[x]).slice(0, 5);
  const yoyName = (k) => (ci >= 0 ? k : cats[k]);

  // sales by category over the period (the four biggest categories, the rest together), one column per day, week, month or quarter
  const stk = bucketsFor(w.a, w.b, 31, S.agg), stkUnit = bucketUnit(w.n, 31, S.agg);
  const totW = winCats({ a: w.a, b: w.b });
  const top4 = Object.keys(totW).map(Number).sort((x, y) => totW[y] - totW[x]).slice(0, 4);
  const stackSeries = [...top4.map((c, j) => ({ name: cats[c], color: PAL[j], vals: new Array(stk.length).fill(0), c })), { name: "Other", color: "#94A3B8", vals: new Array(stk.length).fill(0), c: -1 }];
  stk.forEach((bk, k) => {
    D.sales.forEach((r) => {
      if (r[0] < bk.a || r[0] > bk.b || !inCat(r)) return;
      (stackSeries.find((x) => x.c === r[1]) || stackSeries[4]).vals[k] += r[3];
    });
  });
  const byChan = S.mixBy === "chan" && chans.length > 1;
  const chanSeries = chans.map((c, j) => ({ name: chanName(c), color: chanColor(c, j), vals: new Array(stk.length).fill(0), j }));
  if (byChan) stk.forEach((bk, k) => { D.sales.forEach((r) => { if (r[0] >= bk.a && r[0] <= bk.b && inCat(r)) chanSeries[r[2]].vals[k] += r[3]; }); });
  const chanTot = chanSeries.map((x) => sum(x.vals)), chanAll = sum(chanTot);
  const stackUsed = byChan ? chanSeries.filter((x, j) => chanTot[j] > 0).map((x) => ({ ...x, name: x.name + " · " + (chanTot[x.j] / chanAll * 100).toFixed(1) + "%" }))
    : stackSeries.filter((x) => sum(x.vals) > 0);
  // the five biggest categories, and every other category together as Other (the shares add up to all of the net sales)
  const catRank = Object.keys(catNow).map(Number).sort((x, y) => catNow[y] - catNow[x]);
  const donutTop = catRank.slice(0, 5).map((k) => [cats[k], catNow[k]]);
  const donutRest = sum(catRank.slice(5).map((k) => catNow[k]));
  if (donutRest > 0) donutTop.push(["Other", donutRest]);

  return (
    <>
      <div className="pb-head">
        <Kpis>
          <Kpi label="Net sales" value={peso(net)} delta={hasPrev ? deltaEl(net, netP, (x) => peso(x), false) : ""} info="Sales after discounts in the selected period." onGo={goto} />
          <Kpi label="Order lines" value={num(lines)} delta={hasPrev ? deltaEl(lines, linesP, num, false) : ""}
            info="One line per dish on a receipt. The sales export has no receipt number, so lines are counted." onGo={goto} />
          <Kpi label="Average per order line" value={peso(lines ? net / lines : 0, 0)} delta={hasPrev && linesP ? deltaEl(net / (lines || 1), netP / linesP, (x) => peso(x, 0), false) : ""}
            info="Net sales per order line, not per receipt." onGo={goto} />
          <Kpi label="Items sold" value={num(qn)} delta={hasPrev ? deltaEl(qn, qnP, num, false) : ""} info="Total quantity of menu items sold." onGo={goto} />
          <Kpi label="Year-over-year growth" value={yoy === null ? "–" : (yoy >= 0 ? "+" : "−") + Math.abs(yoy * 100).toFixed(1) + "%"}
            delta={<span className="t-flat">{yoy === null ? "no earlier year in the data" : yLab(curW.a, curW.b) + " against " + yLab(prevW.a, prevW.b)}</span>}
            info="Against the same days a year earlier." onGo={goto} />
        </Kpis>
      </div>
      <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        {up && <UploadSalesPanel up={up} />}
        {tab === "overview" && (
          <>
            <div className="panel c8">
              <div className="ph"><h2>Sales trend{trendLines.length > 1 ? " by year" : ""}</h2><Info t="One line per year over the same days. A year the data does not cover is left out." /></div>
              <ComboChart x={trendX} h={240} yfmt={kpeso} lines={trendLines.map((l, k) => ({ vals: l.vals, color: l.color, w: l.color === "#94A3B8" ? 1.2 : k === trendLines.length - 1 ? 2.8 : 2.2, name: l.label, fmt: peso }))} />
              <div className="legend">{trendLines.filter((l) => l.color !== "#94A3B8").map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}{trendLines.some((l) => l.color === "#94A3B8") && <span><i style={{ background: "#94A3B8" }} />Earlier years ({trendLines.filter((l) => l.color === "#94A3B8").map((l) => l.label).join(", ")})</span>}{trendNote && <span>{trendNote}</span>}</div>
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Sales by category</h2><Info t="Share of net sales in the period." /></div>
              {donutTop.length ? <HBars fill items={donutTop.map(([n, v]) => [n, v])} fmt={(v) => kpeso(v) + " · " + (net ? (v / net * 100).toFixed(1) : 0) + "%"} axis={kpeso} labelWidth={120} label="Sales by category" /> : <div className="empty">No sales in this period.</div>}
            </div>
            <div className="panel c7">
              <div className="ph"><h2>Sales by {byChan ? "channel" : "category"} per {stkUnit}</h2>{w.n > 800 && <AggSeg S={S} set={set} />}
                {chans.length > 1 && <div className="seg noprint" id="mixseg" role="group" aria-label="Split the sales by">
                  <button aria-pressed={!byChan} onClick={() => set({ mixBy: "cat" })}>Category</button>
                  <button aria-pressed={byChan} onClick={() => set({ mixBy: "chan" })}>Channel</button>
                </div>}
                <Info t={byChan ? "Dine-in: eaten at the restaurant. GrabFood: delivered through the Grab app." : "The four biggest categories; the rest are grouped as Other."} /></div>
              {stackUsed.length ? <StackCols keys={stk.map((x) => x.label)} series={stackUsed} fmt={peso} axis={kpeso} label={"Sales by " + (byChan ? "channel" : "category") + " over time"} w={900} /> : <div className="empty">No sales in this period.</div>}
              {stackUsed.length > 0 && partNote(stk) && <div className="legend"><span>{partNote(stk)}</span></div>}
            </div>
            <div className="panel c5">
              <div className="ph"><h2>Year over year</h2>
                <div className="seg noprint" id="yoyseg">
                  <button aria-pressed={by === "total"} onClick={() => set({ yoyBy: "total" })}>Total</button>
                  <button aria-pressed={by === "cat"} onClick={() => set({ yoyBy: "cat" })}>By {yoyBy}</button>
                </div>
                <Info t={multi ? "Calendar years; 2021* starts in September and 2026* ends on 8 September." : "The same days in each year, so years compare fairly."} />
              </div>
              {yoyW.length && sum(totals) > 0 ? (by === "total" ? (
                <>
                  <ComboChart x={yoyW.map((c) => c.label)} h={200} yfmt={kpeso}
                    bars={[{ vals: totals, colors: yoyW.map(yearCol), labels: true, lfmt: kpeso, name: "Net sales", fmt: peso }]} />
                  <div className="legend"><span>* part year</span></div>
                  <div className="yoy-chips">{yoyW.map((c, j) => (j && totals[j - 1] > 0 && !c.label.endsWith("*") && !yoyW[j - 1].label.endsWith("*") ? <span key={c.label}>{c.label} <b className={totals[j] >= totals[j - 1] ? "t-good" : "t-bad"}>{totals[j] >= totals[j - 1] ? "+" : "−"}{Math.min(100, Math.abs((totals[j] / totals[j - 1] - 1) * 100)).toFixed(1)}%</b></span> : null))}</div>
                </>
              ) : (
                <GroupCols keys={yoyKeys.map(yoyName)} fmt={peso} axis={kpeso} label={"Year over year sales by " + yoyBy}
                  series={yoyW.map((c, j) => ({ name: c.label, color: yearCol(c), vals: yoyKeys.map((k) => yoyData[j][k] || 0) }))} />
              )) : <div className="empty">No sales in this period.</div>}
            </div>
          </>
        )}
        {tab === "products" && (
          <>
            <div className="panel c4">
              <div className="ph"><h2>Most sold dishes</h2><Info t="The 10 dishes with the most units sold in the period." /></div>
              <HBars fill items={mostSold.map((x) => [cut(x.name), x.q])} fmt={(vv) => num(vv)} axis={(vv) => num(vv)} color="var(--accent)" label="Most sold dishes" labelWidth={195} />
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Least sold dishes</h2><Info t="Dishes on the menu that sell nearly every month, with the fewest units in the period." /></div>
              {leastSold.length ? <HBars fill items={leastSold.map((x) => [cut(x.name), x.q])} fmt={(vv) => num(vv)} axis={(vv) => num(vv)} color="#F59E0B" label="Least sold dishes" labelWidth={195} /> : <div className="empty">{chi >= 0 ? "The dishes sold on " + chanName(S.chan) + " nearly every month are all in the most sold list." : "No regular dishes."}</div>}
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Dishes moving most (units)</h2><Info t="Units sold minus the period before, for dishes that sold at least 10 units before." /></div>
              {moverItems.length ? <DivBars items={moverItems} label="Dishes moving most" up="Selling more" down="Selling less" labelWidth={170} floor={5} unitFmt={(v) => (v > 0 ? "+" : "") + Math.round(v)} /> : <div className="empty">{hasPrev ? "No dish changed enough to show." : "No earlier period to compare."}</div>}
            </div>
            <div className="panel c12">
              <div className="ph"><h2>Net sales by dish</h2><Info t="The 12 dishes with the most net sales (after discounts) in the period." /></div>
              {byNet.length > 1 ? <HBars fill items={rankNet.items.map((it) => [cut(it[0], 34), ...it.slice(1)])} notes={rankNet.notes} fmt={peso} axis={kpeso} label="Net sales by dish" labelWidth={240} /> : <div className="empty">No sales in this period.</div>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
