// The stock-risk panels: extra stock (overstock) and the running-out warning for one ingredient.
// Used by the Stock risk page.
import { D, LAST, BYID, fd, fiso, series, stockValue, stockLevels, idxOf } from "../lib/model.js";
import { peso, num, pct, qty, daysTxt, sum } from "../lib/format.js";
import { ComboChart, HBars } from "../components/Charts.jsx";
import { MeterBar, Legend, Info } from "../components/ui.jsx";
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
      <div className="ph"><h2>Days of stock against the next delivery</h2><Info t="How many days the stock on hand lasts at the forecast use. The red tick is when the next planned delivery arrives: an ingredient whose bar ends before the tick runs out first." /></div>
      <HBars fill items={rows.map((r) => [r.i.name, Math.min(r.d, 30), r.i.id])} click labelWidth={150} axis={(v) => num(v) + " d"} fmt={(v) => daysTxt(v) + " d"} label="Days of stock"
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
      <div className="ph"><h2>Extra stock: money tied up</h2><Info t="Stock above what the forecast needs before it spoils (at most the next 2 weeks). Healthy is below 20% of the stock value; order less from 20%; hold back orders from 40%." /></div>
      <MeterBar value={exVal} cap={stockVal} big={peso(exVal)} sub={`${pct(frac, 0)} of the ${peso(stockVal)} in stock is more than the forecast needs`} warn={0.2} bad={0.4} />
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
    const xsF = D.fdates.map(fiso);
    outlook = (
      <>
        {out.runOut < 0 ? (
          <div className="banner good">✔ <span><b>{sel.name}</b> has enough stock for the next {fdays} days.</span></div>
        ) : out.covered < 0 ? (
          <div className="banner warn">⚠ <span><b>{sel.name}</b> would run out on <b>{xsF[out.runOut]}</b> without a new order. Order <b>{out.plan1 && out.plan1.qty ? qty(out.plan1.qty, sel.uom) : "per the list"}</b>{out.firstArr ? ", arriving " + fiso(out.firstArr[3]) : ""}, and stock stays above zero.</span></div>
        ) : (
          <div className="banner bad"><span><b>{sel.name}</b> runs out on <b>{xsF[out.covered]}</b> even with the planned orders. Add an order or an early top-up.</span></div>
        )}
        <ComboChart x={xsF} h={250} yfmt={(v) => qty(v, sel.uom).replace(/ (g|pcs|servings)$/, "")}
          shade={[0, sel.lead, `${sel.lead}-day wait for delivery`]}
          refs={[{ y: lv.reorder, label: "Order when below", color: "var(--bad)" }]}
          lines={[{ vals: out.without, color: "var(--series2)", dash: true, name: "Without new orders", fmt: (v) => qty(v, sel.uom) },
            { vals: out.withp, color: "var(--accent)", name: "With recommended orders", fmt: (v) => qty(v, sel.uom) }]} />
        <Legend items={[["Stock without new orders", "var(--series2)"], ["Stock with recommended orders", "var(--accent)"], ["Order when below", "var(--bad)"]]} />
      </>
    );
  }

  const options = [[0.8, "20% less"], [1, "As forecast"], [1.2, "20% more"], [1.4, "40% more"]];

  return (
    <>
      <div className="panel c8">
        <div className="ph"><h2>Running-out warning</h2></div>
        <div className="risk-ctl">
          <label>Ingredient
            <select id="selIng" value={sel ? sel.id : ""} onChange={(e) => set({ sel: +e.target.value })}>
              {F.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <div className="wi-group">
            <span className="t-flat">If use is</span>
            <div className="seg" id="wiseg" title="What if customers use more or less than the forecast? The orders are not recalculated; this only tests whether the plan still holds.">
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
  const p1 = D.plan.find((p) => p.ing === sel.id && p.week === 1), p2 = D.plan.find((p) => p.ing === sel.id && p.week === 2);
  if (!p1 || !p2) return null;
  const I0 = Math.max(0, p1.end - p1.qty + p1.demand - p1.short + p1.waste);
  const wk1 = LAST + 1 + (sel.lead || 0);
  const cols = [[p1, I0], [p2, p1.end]];
  const none = (v) => (v > 0 ? qty(v, sel.uom) : "None");
  const rowsDef = [
    ["Opening stock", (c) => qty(c[1], sel.uom)],
    ["Expected use", (c) => qty(c[0].demand, sel.uom)],
    ["Orders arriving", (c) => none(c[0].qty)],
    ["Expected waste", (c) => none(c[0].waste)],
    ["Not covered by stock", (c) => none(c[0].short)],
    ["Closing stock", (c) => qty(c[0].end, sel.uom)],
    ["Days of cover at the end", (c) => (c[0].demand ? daysTxt(c[0].end / (c[0].demand / 7)) + " d" : "–")],
    ["Value of closing stock", (c) => peso(c[0].end * sel.cost)],
  ];
  return (
    <div className="panel c4 fillt">
      <div className="ph"><h2>The plan, week by week · {sel.name}</h2></div>
      <div className="tablewrap">
        <table>
          <thead><tr><th></th><th className="n">Week of {fd(wk1)}</th><th className="n">Week of {fd(wk1 + 7)}</th></tr></thead>
          <tbody>
            {rowsDef.map(([label, f]) => (
              <tr key={label}><td>{label}</td>{cols.map((c, k) => <td key={k} className="n">{f(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel.lead ? <div className="note">The plan's first week starts {sel.lead} {sel.lead === 1 ? "day" : "days"} from now, when an order placed today can arrive.</div> : null}
    </div>
  );
}
