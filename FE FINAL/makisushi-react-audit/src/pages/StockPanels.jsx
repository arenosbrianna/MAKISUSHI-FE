// The stock-risk panels: extra stock (overstock) and the running-out warning for one ingredient.
// Used by the Stock risk page.
import { D, LAST, BYID, fd, fiso, series, stockValue, stockLevels, idxOf, batchesOf } from "../lib/model.js";
import { peso, num, pct, qty, daysTxt, daysWord, sum } from "../lib/format.js";
import { ComboChart, HBars } from "../components/Charts.jsx";
import { MeterBar, Legend, Info, NoteTip } from "../components/ui.jsx";
import { useApp } from "../AppContext.js";
import { riskRunOut } from "./riskCalc.js";

// days of stock against the wait for the next delivery, for every ingredient: the ones with the least cover first
export function CoverPanel({ F, cls = "c7" }) {
  const { set } = useApp();
  const rows = F.map((i) => {
    const mu = stockLevels(i).mu, close = Math.max(0, series(i.id).close[LAST]);
    const ds = D.deliveries.filter((x) => x[0] === i.id).map((x) => idxOf(x[3])).filter((x) => x > LAST);
    return { i, d: mu > 0 ? close / mu : 30, wait: ds.length ? Math.min(...ds) - LAST : i.lead };
  }).sort((a, b) => a.d - b.d).slice(0, 10);
  return (
    <div className={"panel " + cls}>
      <div className="ph"><h2>Days of stock against the next delivery</h2><Info t="Days the stock lasts at the forecast use. Red tick: next delivery. A bar ending before it runs out first." /></div>
      <HBars fill items={rows.map((r) => [r.i.name, Math.min(r.d, 30), r.i.id])} click labelWidth={150} axis={(v) => num(v) + " d"} fmt={(v) => daysWord(v)} notes={rows.map((r) => (r.d < r.wait ? "runs out first" : ""))} label="Days of stock"
        marks={[{ vals: rows.map((r) => r.wait), color: "var(--bad)", name: "Next delivery" }]} onRow={(id) => set({ ing: +id, sel: +id })} />
      <Legend items={[["Days of stock now", "var(--accent)"], ["Next delivery", "var(--bad)"]]} />
    </div>
  );
}

// extra stock above what the forecast needs before it spoils (at most 2 weeks)
export function TrimPanel({ F, cls = "c5" }) {
  const { S, set } = useApp();
  const ids = F.map((i) => i.id), fdays = D.fdates.length;
  const demand = (id, days) => sum(D.fc[id].y.slice(0, days)) * S.wi;
  const ex = F.map((i) => {
    const close = series(i.id).close[LAST], keep = demand(i.id, Math.min(Math.min(i.shelf, 14), fdays));
    return { i, close, excess: Math.max(0, close - keep), val: Math.max(0, close - keep) * i.cost };
  });
  const exVal = sum(ex.map((e) => e.val)), stockVal = stockValue(ids, LAST), frac = stockVal ? exVal / stockVal : 0;
  const top = ex.filter((e) => e.val > 0).sort((a, b) => b.val - a.val).slice(0, 6);
  return (
    <div className={"panel " + cls} id="p-trim">
      <div className="ph"><h2>Extra stock: money tied up</h2><Info t="Stock the forecast will not use before it spoils. Order less from 20% of stock value; hold orders from 40%." /></div>
      <MeterBar value={exVal} cap={stockVal} big={peso(exVal)} sub={`${pct(frac, 0)} of stock is more than the forecast needs`} warn={0.2} bad={0.4} />
      <div className="note" style={{ marginBottom: 8 }}>{frac >= 0.4 ? "Hold back orders for the items below." : frac >= 0.2 ? "Order a little less of the items below next time." : "The stock level is healthy."}</div>
      <HBars fill items={top.map((e) => [e.i.name, e.val, e.i.id])} shade="amber" click axis={(v) => "₱" + num(v)} label="Extra stock by ingredient"
        fmt={(v) => peso(v)} onRow={(id) => set({ ing: +id, sel: +id })} labelWidth={120} />
    </div>
  );
}

// Running-out outlook for one ingredient with the what-if buttons, and its week-by-week table beside it
export function RiskPanels({ F }) {
  const { S, set } = useApp();
  const ids = F.map((i) => i.id), fdays = D.fdates.length;
  const sel = BYID[S.sel] && ids.includes(S.sel) ? BYID[S.sel] : F[0];

  let outlook = <div className="empty">Pick an ingredient to see its stock outlook.</div>;
  if (sel) {
    const out = riskRunOut(sel, S.wi), lv = stockLevels(sel);
    const nD = out.withp.length, xsF = D.fdates.slice(0, nD).map(fiso), mk = out.path.market;
    outlook = (
      <>
        {mk ? (
          <div className="banner good">✔ <span><b>{sel.name}</b> is bought fresh each day at the market (about {qty(sum(out.path.use) / nD, sel.uom)} a day), so it does not run out; the columns are the stock already on hand.</span></div>
        ) : out.runOut < 0 ? (
          <div className="banner good">✔ <span><b>{sel.name}</b> has enough stock for the next {nD} days.</span></div>
        ) : out.covered < 0 ? (
          <div className="banner warn">⚠ <span><b>{sel.name}</b> would run out on <b>{xsF[out.runOut]}</b> without a new order. Order <b>{out.plan1 && out.plan1.qty ? qty(out.plan1.qty, sel.uom) : "per the list"}</b>{out.firstArr ? ", arriving " + fiso(out.firstArr[3]) : ""}, and stock stays above zero.</span></div>
        ) : out.covered < Math.max(1, sel.lead || 0) && out.path.short.slice(Math.max(1, sel.lead || 0)).every((u) => u <= 1e-6) ? (
          <div className="banner warn">⚠ <span><b>{sel.name}</b> is short on <b>{xsF[out.covered]}</b>, before the first order can arrive{out.firstArr ? " on " + fiso(out.firstArr[3]) : ""}: top it up today ({qty(sum(out.path.short), sel.uom)}, see Daily prep). From then on the planned orders cover the use{out.withp[nD - 1] > out.withp[0] + 1e-6 ? " and rebuild the stock toward its target of " + qty(lv.target, sel.uom) : ""}.</span></div>
        ) : (
          <div className="banner bad"><span><b>{sel.name}</b> runs out on <b>{xsF[out.covered]}</b> even with the planned orders. Add an order or an early top-up.</span></div>
        )}
        {/* one column a day: the stock left at the end of the day with the planned orders; the text above a column is the delivery
            that arrives that day, or the amount that is short. Blue: enough; amber: below the order level; red text: not covered. */}
        <ComboChart x={xsF} h={250} yfmt={(v) => qty(v, sel.uom).replace(/ (g|pcs|servings)$/, "")}
          refs={mk ? [] : [{ y: lv.reorder, label: "", color: "var(--bad)" }]}
          bars={[{ vals: out.withp, name: "Stock left at the end of the day", fmt: (v) => qty(v, sel.uom),
            colors: out.withp.map((v, k) => (out.path.short[k] > 1e-6 ? "#DC2626" : !mk && v < lv.reorder ? "#D97706" : "var(--accent)")),
            texts: out.withp.map((_, k) => (out.path.short[k] > 1e-6 ? ["short " + qty(out.path.short[k], sel.uom), "#B91C1C"] : out.del[k] > 0 ? ["+" + qty(out.del[k], sel.uom), "#047857"] : null)) }]} />
        <Legend items={[["Stock left at the end of the day", "var(--accent)"], ...(mk ? [] : [["Below the order level", "#D97706"], ["Dashed line: order when below " + qty(lv.reorder, sel.uom), "var(--bad)"]]), ["Short: not covered", "#DC2626"], ["+ delivery that arrives that day", "#047857"]]} />
      </>
    );
  }

  // what if the kitchen uses more or less than the forecast: the stock lines are redrawn with use scaled by the factor;
  // the recommended orders stay the same, so the chart shows whether the plan still holds
  const options = [[0.8, "−20%"], [1, "As forecast"], [1.2, "+20%"], [1.4, "+40%"]];

  return (
    <>
      <div className="panel c8">
        <div className="ph"><h2>Stock in the next {sel ? riskRunOut(sel, S.wi).withp.length : D.fdates.length} days</h2><Info t="Stock left at the end of each day if the plan is followed: yesterday's stock, minus forecast use, plus deliveries. Oldest batches are used first." /></div>
        <div className="risk-ctl">
          <label>Ingredient
            <select id="selIng" value={sel ? sel.id : ""} onChange={(e) => set({ sel: +e.target.value })}>
              {F.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <div className="wi-group">
            <span className="t-flat">Use vs forecast</span> <Info t="Redraws the stock if use is lower or higher than forecast, with the same orders. −20%: a slow week. +20%: a busy week. +40%: an unusual rush." />
            <div className="seg" id="wiseg">
              {options.map(([v, l]) => <button key={v} data-wi={v} aria-pressed={S.wi === v} onClick={() => set({ wi: v })}>{l}</button>)}
            </div>
          </div>
        </div>
        {outlook}
      </div>
      {sel ? <WeekTable sel={sel} /> : <div className="panel c4 empty">Pick an ingredient.</div>}
    </>
  );
}

// the plan's two weeks for one ingredient, as a table (beside the running-out chart)
function WeekTable({ sel }) {
  const { S } = useApp();
  const pth = riskRunOut(sel, S.wi || 1).path, L = Math.max(0, sel.lead || 0), n = pth.stock.length;
  const wk1 = LAST + 1 + L;
  // a plan week starts on the day its first order can arrive (today + the lead time); the days before that get their own
  // column, so the table covers the same days as the chart and a shortfall before the first delivery shows in both
  // a column heading as a date range: "11–17 Sep", or "28 Sep–4 Oct" across two months
  const rng = (a, b) => (fd(a).split(" ")[1] === fd(b).split(" ")[1] ? fd(a).split(" ")[0] + "–" + fd(b) : fd(a) + "–" + fd(b));
  const span = (k0, k1, head) => {
    const part = (arr) => sum(arr.slice(k0, k1));
    return { head, open: k0 === 0 ? pth.start : pth.stock[k0 - 1], use: part(pth.use), del: part(pth.del) + part(pth.mkt), waste: part(pth.waste), short: part(pth.short), end: k1 > 0 ? pth.stock[k1 - 1] : pth.start, days: k1 - k0 };
  };
  const cols = [...(L > 0 ? [span(0, Math.min(n, L), "Before " + fd(wk1))] : []),
    ...[0, 1].map((w) => span(Math.min(n, L + 7 * w), Math.min(n, L + 7 * (w + 1)), rng(wk1 + 7 * w, Math.min(LAST + n, wk1 + 7 * w + 6))))];
  const none = (v) => (v > 0 ? qty(v, sel.uom) : "None");
  const rowsDef = [
    ["Opening stock", (c) => qty(c.open, sel.uom)],
    ["Expected use", (c) => qty(c.use, sel.uom)],
    ["Arriving", (c) => none(c.del)],
    ["Expected waste", (c) => none(c.waste)],
    ["Short", (c) => none(c.short)],
    ["Closing stock", (c) => qty(c.end, sel.uom)],
    ["Days of cover", (c) => (c.use > 0 ? daysWord(c.end / (c.use / c.days)) : "–")],
    ["Closing value", (c) => peso(c.end * sel.cost)],
  ];
  return (
    <div className="panel c4 fillt">
      <div className="ph"><h2>The plan, week by week · {sel.name}</h2>{sel.lead ? <Info t={"An order placed today arrives on " + fd(wk1) + ". The first column is the days before it, covered by stock on hand."} /> : null}</div>
      <div className="tablewrap">
        <table>
          <thead><tr><th></th>{cols.map((c) => <th key={c.head} className="n">{c.head}</th>)}</tr></thead>
          <tbody>
            {rowsDef.map(([label, f]) => (
              <tr key={label}><td style={{ whiteSpace: "nowrap" }}>{label}</td>{cols.map((c, k) => <td key={k} className="n">{f(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sub" style={{ marginTop: 12 }}>Stock on hand by expiry date</div>
      <div className="tablewrap" style={{ flex: "none" }}>
        <table>
          <thead><tr><th>Expires</th><th className="n">Quantity</th><th className="n">Days left</th></tr></thead>
          <tbody>
            {batchesOf(sel.id).length ? batchesOf(sel.id).map((b, k) => (
              <tr key={k}><td><b>{fd(b[4], true)}</b><small>received {fd(b[3])}</small></td><td className="n">{qty(b[2], sel.uom)}</td><td className={"n" + (b[4] - LAST <= 3 ? " t-bad" : "")}>{daysWord(b[4] - LAST)}</td></tr>
            )) : <tr><td colSpan={3} className="empty">No stock on hand.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
