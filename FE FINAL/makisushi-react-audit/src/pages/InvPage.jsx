// Stock risk: which ingredients may run out before the next delivery, which are overstocked, and which ran out most.
import { useState } from "react";
import {
  D, M, LAST, BYID, win, series, consumedValue, D0, lostMargin, stockoutSplit, emergencyBuy, soIn, stockValue, monthsFrom, weeksFrom, bucketsFor, idxOf, fiso,
  stockLevels, planRow, firstArrival, runOutDay, emergencyValue, avgStockValue, fd,
} from "../lib/model.js";
import { peso, kpeso, num, pct, qty, daysTxt, sum } from "../lib/format.js";
import { HBars, StackCols, Donut, StackH } from "../components/Charts.jsx";
import { Kpi, Kpis, deltaEl, TabBar, Chip, Legend, Info } from "../components/ui.jsx";
import { useApp } from "../AppContext.js";
import { RiskPanels, TrimPanel, CoverPanel } from "./StockPanels.jsx";
import { tabOf } from "../lib/constants.js";
import { nice } from "./PrepPanel.jsx";

// One ingredient: days of cover at the forecast use, the reorder level and target (the same forecast and
// service level as the purchase plan), and whether it runs out before its next planned delivery.
export function stockStatus(i) {
  const close = series(i.id).close[LAST], lv = stockLevels(i);
  const d = lv.mu > 0 ? close / lv.mu : 99;
  const ds = D.deliveries.filter((x) => x[0] === i.id).map((x) => idxOf(x[3])).filter((x) => x > LAST);
  const wait = ds.length ? Math.min(...ds) - LAST : 99;
  const out = runOutDay(i.id, false);
  const r = close <= 0 ? "bad" : out >= 0 && out + 1 < wait ? "warn" : "good";
  // overstock: stock the forecast will not use before it spoils (at most the next 2 weeks) is 40% or more of the stock and ₱300 or more
  const fdays = D.fdates.length, keep = sum(D.fc[i.id].y.slice(0, Math.min(Math.min(i.shelf, 14), fdays)));
  const excessVal = Math.max(0, close - keep) * i.cost;
  const over = r === "good" && close > 0 && excessVal >= 300 && excessVal >= 0.4 * close * i.cost;
  return { close, d, u: lv.mu, below: lv.reorder, par: lv.target, r, over, excessVal };
}

// what this week's purchase plan does for the ingredient
export function planAction(i) {
  const p1 = planRow(i.id, 1), p2 = planRow(i.id, 2);
  if (p1 && p1.qty > 0) {
    if (p1.rule === "daily market buy") return `Buy fresh each day: ${qty(p1.qty, i.uom)} this week`;
    const a = firstArrival(i.id, 1);
    return `This week's order: ${qty(p1.qty, i.uom)}${a ? ", arrives " + fiso(a) : ""}`;
  }
  if (p2 && p2.qty > 0) return `No order this week; ${qty(p2.qty, i.uom)} next week`;
  return "No order needed for 2 weeks";
}
export const statusText = (st) => (st.r === "bad" ? "Ran out" : st.r === "warn" ? "Short before delivery" : st.over ? "Overstocked" : "OK");
const sevOf = (st) => (st.r === "bad" ? 0 : st.r === "warn" ? 1 : st.over ? 2 : 3);

// Stock risk's own headline numbers
function InvKpis({ F }) {
  const { S } = useApp();
  const w = win(S), ids = F.map((i) => i.id), set_ = new Set(ids), hasPrev = w.pb >= 0 && w.pa <= w.pb;
  const sv = stockValue(ids, LAST);
  const use28 = consumedValue(ids, LAST - 27, LAST) / 28;
  const doh = use28 > 0 ? sv / use28 : 0;
  const lv = F.map((i) => ({ i, l: stockLevels(i) }));
  const muV = sum(lv.map((x) => x.l.mu * x.i.cost)) || 1;
  const lowD = sum(lv.map((x) => x.l.reorder * x.i.cost)) / muV, highD = sum(lv.map((x) => x.l.target * x.i.cost)) / muV;
  const turns = (a, b) => { const av = avgStockValue(ids, a, b); return av > 0 ? (consumedValue(ids, a, b) / (b - a + 1)) * 30 / av : 0; };
  const tn = turns(w.a, w.b), tnP = hasPrev ? turns(w.pa, w.pb) : null;
  const so = soIn(set_, w.a, w.b).length;
  const cost = lostMargin(set_, w.a, w.b) + emergencyValue(set_, w.a, w.b);
  const costP = hasPrev ? lostMargin(set_, w.pa, w.pb) + emergencyValue(set_, w.pa, w.pb) : null;
  const sp = stockoutSplit(set_, w.a, w.b), spP = hasPrev ? stockoutSplit(set_, w.pa, w.pb) : null;
  const tabNow = tabOf("inv", S);
  const wks = weeksFrom(Math.max(0, LAST - 12 * 7 + 1), LAST);
  if (tabNow === "outs") {
    return (
      <Kpis>
        <Kpi label="Stockouts" value={num(sp.all)} delta={deltaEl(sp.all, spP ? spP.all : null, num, true)}
          info="Every time an ingredient ran out in the period, whether an emergency buy covered it or not." />
        <Kpi label="Emergency buys" value={num(sp.em)} delta={<span className="t-flat">{peso(sp.emV)} spent · dish still served</span>}
          info="Stockouts covered by buying the ingredient at the market the same day. They are counted as stockouts, and the amount paid is the cost." />
        <Kpi label="Lost sales" value={num(sp.lost)} delta={<span className="t-flat">{peso(sp.lostV)} margin lost</span>}
          info="Stockouts that could not be covered, so the dishes were not sold. The cost is the margin lost." />
        <Kpi label="Cost of running out" value={peso(cost)} delta={deltaEl(cost, costP, (v) => peso(v), true)}
          info="Emergency buys plus the margin lost on lost sales." />
      </Kpis>
    );
  }
  return (
    <Kpis>
      <Kpi label="Stock on hand" value={peso(sv)} delta={<span className="t-flat">{daysTxt(doh)} days of use</span>}
        spark={wks.map((x) => stockValue(ids, x.b))}
        info="Value of the stock on hand today, at standard cost. The small line is the stock value at the end of each of the last 12 weeks." />
      <Kpi label="Days on hand" value={daysTxt(doh) + " d"}
        delta={<span className={doh < lowD ? "t-bad" : doh > highD ? "t-warn" : "t-good"}>healthy {daysTxt(lowD)} to {daysTxt(highD)} d</span>}
        info="How many days the stock lasts at the last 4 weeks' use. The healthy range runs from the reorder level to the target stock, weighted by value." />
      <Kpi label="Stock turns" value={tn.toFixed(1) + " a month"} delta={deltaEl(tn, tnP, (v) => v.toFixed(1), false)}
        info="How many times a month the stock is used up: use in the period divided by the average stock value. Higher means leaner stock." />
      <Kpi label="Cost of running out" value={peso(cost)} delta={<>{`${num(so)} stock-outs · `}{deltaEl(cost, costP, (v) => peso(v), true)}</>}
        info="Emergency buys plus the margin lost on lost sales whenever an ingredient ran out in the period." />
    </Kpis>
  );
}

export function InvPage({ F }) {
  const { S, set, exp } = useApp();
  const [soView, setSoView] = useState("all");
  const ids = F.map((i) => i.id), set_ = new Set(ids), w = win(S), hasPrev = w.pb >= 0 && w.pa <= w.pb;
  const rows = F.map((i) => ({ i, st: stockStatus(i) }));
  const tableRows = rows.slice().sort((a, b) => sevOf(a.st) - sevOf(b.st) || a.st.d - b.st.d);
  const flagged = tableRows.filter((r) => sevOf(r.st) < 3);
  const shown = S.invAll ? tableRows : flagged;
  const low = rows.slice().sort((a, b) => a.st.d - b.st.d).slice(0, 6);
  const tab = tabOf("inv", S);

  // stockouts by ingredient, split by what happened: an emergency buy (still served) or a lost sale
  const so = soIn(set_, w.a, w.b), soP = hasPrev ? soIn(set_, w.pa, w.pb).length : null;
  const byIng = {};
  so.forEach((x) => { const o = (byIng[x[1]] || (byIng[x[1]] = { em: 0, lost: 0 })); if ((x[5] || 0) > 0) o.em++; else o.lost++; });
  const outRows = Object.entries(byIng).map(([id, o]) => ({ i: BYID[id], ...o, n: o.em + o.lost })).sort((a, b) => b.n - a.n).slice(0, 10);
  const cost = lostMargin(set_, w.a, w.b) + emergencyValue(set_, w.a, w.b);
  const sp = stockoutSplit(set_, w.a, w.b);
  // the events one by one: when, what, and how it ended (an emergency buy kept the dish on the menu; a lost sale did not)
  const evAll = so.slice().sort((a, b) => b[0] - a[0] || b[3] - a[3]);
  const evShown = evAll.filter((x) => (soView === "all" ? true : soView === "em" ? (x[5] || 0) > 0 : !((x[5] || 0) > 0))).slice(0, 9);
  // year by year over all the data (the other filters still apply); 2021 starts in September and 2026 ends on 8 September
  const yrAll = D.so.filter((x) => set_.has(x[1]));
  const y0 = new Date(D0).getUTCFullYear(), y1 = new Date(D0 + LAST * 864e5).getUTCFullYear();
  const yrs = Array.from({ length: y1 - y0 + 1 }, (_, k) => y0 + k);
  const yrOf = (x) => new Date(D0 + x[0] * 864e5).getUTCFullYear();
  const yrKeys = yrs.map((y) => (y === y0 || y === y1 ? y + "*" : String(y)));
  const yrEm = yrs.map((y) => yrAll.filter((x) => yrOf(x) === y && (x[5] || 0) > 0).length);
  const yrLost = yrs.map((y) => yrAll.filter((x) => yrOf(x) === y && !((x[5] || 0) > 0)).length);
  const topOut = outRows.slice(0, 2).map((r) => `${r.i.name} (${r.n} times)`);
  // how fast each ingredient turns over in the period
  const turnRows = F.map((i) => { const av = avgStockValue([i.id], w.a, w.b); return [i.name, av > 0 ? (consumedValue([i.id], w.a, w.b) / w.n) * 30 / av : 0, i.id]; })
    .filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 12);
  // what running out cost each month
  const sm = bucketsFor(w.a, w.b, 31);
  const smEm = sm.map((m) => emergencyValue(set_, m.a, m.b)), smLost = sm.map((m) => lostMargin(set_, m.a, m.b));

  const findings = [
    ["Change", `Ran out ${num(so.length)} times (${num(sp.em)} emergency buys, ${num(sp.lost)} lost sales)${soP !== null ? `, ${so.length <= soP ? soP - so.length + " fewer" : so.length - soP + " more"} than the period before` : ""}; running out cost ${peso(cost)}.`],
    ["Cause", topOut.length ? `${topOut.join(" and ")} ran out most often.` : "No stock-outs in this period."],
    ["Action", flagged.length ? `${flagged.length} ${flagged.length === 1 ? "ingredient needs" : "ingredients need"} attention: ${flagged.slice(0, 3).map((r) => r.i.name).join(", ")}.` : "No ingredient should run short before its next delivery."],
  ];

  exp.current.stock = [["Ingredient", "On hand", "Unit", "Value (PHP)", "Daily use (forecast)", "Days left", "Order when below", "Target stock", "Status", "This week's plan"],
    ...tableRows.map(({ i, st }) => [i.name, Math.round(st.close), i.uom, Math.round(st.close * i.cost), i.uom === "pc" ? Math.round(st.u) : Math.round(st.u * 10) / 10,
      st.d >= 99 ? "" : Math.round(st.d), Math.round(st.below), Math.round(st.par), statusText(st), planAction(i)])];

  const cnt = (f) => rows.filter(({ st }) => f(st)).length;
  const statusItems = [["OK", cnt((st) => st.r === "good" && !st.over), "#10B981"], ["Short before delivery", cnt((st) => st.r === "warn"), "#F59E0B"], ["Out now", cnt((st) => st.r === "bad"), "#DC2626"], ["Extra stock", cnt((st) => st.r === "good" && st.over), "#3B82F6"]].filter((x) => x[1] > 0);
  const action = (st) => (st.r === "bad" ? "Buy now" : st.r === "warn" ? "Buy a top-up before the delivery" : st.over ? "Hold back orders" : "");
  return (
    <>
      <div className="pb-head">
        <InvKpis F={F} />
      </div>
      <div className="grid canvas" style={{ gridTemplateRows: tab === "risk" ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)" }}>
        {tab === "status" && (
          <>
            <div className="panel c3">
              <div className="ph"><h2>Stock status</h2><Info t="How many of the ingredients shown are out or short before the next delivery, have extra stock, or are fine." /></div>
              <Donut items={statusItems} colors={statusItems.map((x) => x[2])} size="auto" center={String(rows.length)} sub="ingredients" label="Stock status" />
            </div>
            <CoverPanel F={F} cls="c5" />
            <TrimPanel F={F} cls="c4" />
            <div className="panel c12">
              <div className="ph">
                <h2>{S.invAll ? "All ingredients" : "Ingredients that need attention"}</h2>
                <Chip cls={flagged.some((r) => r.st.r !== "good") ? "warn" : "good"}>{flagged.length ? `${flagged.length} flagged` : "All OK"}</Chip>
                <button className="linkbtn noprint" style={{ margin: 0 }} onClick={() => set({ invAll: !S.invAll })}>{S.invAll ? "Show only flagged" : `Show all ${tableRows.length}`}</button>
                <button className="linkbtn noprint" style={{ margin: 0 }} onClick={() => exp.current.onExport("stock")}>Export</button>
              </div>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Ingredient</th><th className="n">On hand</th><th className="n">Lasts about</th><th className="n">Order when below</th><th className="n">Target stock</th><th className="n">Lead time</th><th>Status</th><th>This week's plan</th></tr></thead>
                  <tbody>
                    {shown.length ? shown.map(({ i, st }) => (
                      <tr key={i.id} className="click" onClick={() => set({ sel: i.id, itab: "risk" })}>
                        <td><b>{i.name}</b><small>{i.store}</small></td>
                        <td className="n">{qty(st.close, i.uom)}</td>
                        <td className="n">{st.d >= 99 ? "–" : daysTxt(st.d) + " d"}</td>
                        <td className="n">{qty(st.below, i.uom)}</td>
                        <td className="n">{qty(st.par, i.uom)}</td>
                        <td className="n">{i.lead === 0 ? "Same day" : i.lead + (i.lead === 1 ? " day" : " days")}</td>
                        <td>
                          <Chip cls={st.r === "good" && !st.over ? "good" : st.r === "good" ? "warn" : st.r}>{st.r === "good" && !st.over ? "OK" : st.r === "warn" ? "Short" : st.r === "bad" ? "Ran out" : "Extra"}</Chip>
                        </td>
                        <td>{planAction(i)}</td>
                      </tr>
                    )) : <tr><td colSpan={8} className="empty">{tableRows.length ? "Nothing needs attention. Every ingredient has enough stock and none is overstocked." : "No ingredients match these filters."}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="note">Order when below and Target stock come from the forecast and the plan's {pct(M.service || 0.99, 0)} service level, so they agree with the purchase plan. Extra stock means the forecast will not use at least 40% of the stock (₱300 or more) before it spoils. Click a row to see its stock day by day.</div>
            </div>
          </>
        )}
        {tab === "risk" && (
          <>
            <RiskPanels F={F} />
          </>
        )}
        {tab === "outs" && (
          <>
            <div className="panel c4">
              <div className="ph"><h2>How the stockouts ended</h2><span className="note-inline">chosen period</span></div>
              {sp.all ? (
                <>
                  <Donut items={[["Emergency buy", sp.em], ["Lost sale", sp.lost]]} colors={["#1E3A8A", "#DC2626"]} size="auto" center={num(sp.all)} sub="stockouts" label="How the stockouts ended" />
                  <div className="note"><b>Emergency buy:</b> the dish was still served. <b>Lost sale:</b> it was not.</div>
                </>
              ) : <div className="empty">No stock-outs in this period.</div>}
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Year by year</h2><span className="note-inline">all years</span></div>
              <StackCols keys={yrKeys} fmt={num} axis={num} label="Stockouts each year: emergency buys and lost sales" w={420}
                series={[{ name: "Emergency buy (still served)", vals: yrEm, color: "#1E3A8A" }, { name: "Lost sale", vals: yrLost, color: "#DC2626" }]} />
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Stockouts by ingredient</h2></div>
              {outRows.length ? (
                <StackH items={outRows.map((r) => [r.i.name, r.i.id])} label="Stockouts by ingredient and outcome" labelWidth={150} onRow={(id) => set({ ing: +id, sel: +id })}
                  series={[{ name: "Emergency buy (still served)", color: "#1E3A8A", vals: outRows.map((r) => r.em) }, { name: "Lost sale", color: "#DC2626", vals: outRows.map((r) => r.lost) }]} />
              ) : <div className="empty">No stock-outs in this period.</div>}
            </div>
            <div className="panel c7">
              <div className="ph"><h2>Latest stockouts</h2>
                <div className="seg noprint" id="soseg">
                  <button aria-pressed={soView === "all"} onClick={() => setSoView("all")}>All</button>
                  <button aria-pressed={soView === "em"} onClick={() => setSoView("em")}>Emergency buy</button>
                  <button aria-pressed={soView === "lost"} onClick={() => setSoView("lost")}>Lost sale</button>
                </div>
              </div>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Date</th><th>Ingredient</th><th className="n">Short by</th><th className="n">Bought</th><th>How it ended</th></tr></thead>
                  <tbody>
                    {evShown.length ? evShown.map((x, k) => {
                      const i = BYID[x[1]], em = (x[5] || 0) > 0;
                      return (
                        <tr key={k}>
                          <td>{fd(x[0], true)}</td>
                          <td><b>{i.name}</b></td>
                          <td className="n">{qty(Math.max(nice(x[6] - x[7], i.uom, true), i.uom === "pc" ? 1 : 5), i.uom)}</td>
                          <td className="n">{em ? (() => { const eb = emergencyBuy(x); return <>{eb.packs} {eb.packs === 1 ? "pack" : "packs"}<small>{qty(eb.qty, i.uom)}</small></>; })() : <span className="t-flat">–</span>}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{em ? <><Chip cls="good">Emergency buy</Chip> <small>{peso(emergencyBuy(x).paid)} recorded cost</small></> : <><Chip cls="bad">Lost sale</Chip> <small>{peso(x[4])} margin lost</small></>}</td>
                        </tr>
                      );
                    }) : <tr><td colSpan={5} className="empty">{so.length ? "None of this kind in the period." : "No stock-outs in this period."}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="note">An emergency buy is made in whole supplier packs (at least the minimum order), and the rest of the pack goes into stock. The cost is the recorded cost of the shortfall.</div>
            </div>
            <div className="panel c5">
              <div className="ph"><h2>What stockouts cost each month</h2><span className="note-inline">{peso(sp.emV)} bought + {peso(sp.lostV)} lost</span></div>
              <StackCols keys={sm.map((m) => m.label)} fmt={(v) => peso(v)} axis={kpeso} label="Money lost to stockouts each month: emergency buys and lost sales" w={520}
                series={[{ name: "Emergency buys (cost paid)", vals: smEm, color: "#1E3A8A" }, { name: "Lost sales (margin lost)", vals: smLost, color: "#DC2626" }]} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
