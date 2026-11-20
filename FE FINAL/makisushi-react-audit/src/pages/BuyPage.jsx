// Purchasing: the supplier order sheet for this week and next (with the budget and the owner priority),
// and the suppliers and prices behind it.
import { useState } from "react";
import { D, M, LAST, BYID, fiso, fd, dtxt, idxOf, series, consumedValue, wk, nextDelivery, isWalkin, levelLabel, levelBacktest } from "../lib/model.js";
import { peso, kpeso, num, pct, qty, daysTxt, sum, packQty } from "../lib/format.js";
import { TabBar, BulletBar, Chip, Info, Kpi, Kpis } from "../components/ui.jsx";
import { ComboChart, Donut } from "../components/Charts.jsx";
import { ActionsView } from "./Recommendations.jsx";
import { RecommendationsPanel } from "./Recommendations.jsx";
import { PrepKpis, PrepTable } from "./PrepPanel.jsx";
import { SUBTABS } from "../lib/constants.js";
import { useApp } from "../AppContext.js";
import { copyText, printBlock } from "../lib/actions.js";
import { supplierMessages } from "../lib/messages.js";
import { PRIORITIES } from "../lib/constants.js";

// "Done x of y": which orders have been placed, remembered in this browser (the Tracking page records what was really ordered)
const orderKey = (p) => `makisushi.ordered.${M.plan_start}.${p.ing}.${p.week}`;
export function readDone(p) {
  try { return localStorage.getItem(orderKey(p)) === "1"; } catch (e) { return false; }
}
function writeDone(p, v) {
  try { localStorage.setItem(orderKey(p), v ? "1" : "0"); } catch (e) { /* not remembered */ }
}
const monthName = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });
// a supplier that was late on more than 1 order in 10 over the test year
const lateNote = (sup) => {
  const r = (D.suppliers || []).find((s) => String(s.sup) === String(sup));
  return r && r.onTime < 0.9 ? ` · ${Math.round(r.onTime * 100)}% on time` : "";
};

// the price list, grouped by supplier
export function PriceList({ F, exp }) {
  const per = (i) => (i.uom === "g" ? [i.cost * 1000, "kg"] : i.uom === "ml" ? [i.cost * 1000, "litre"] : [i.cost, i.uom === "pc" ? "piece" : i.uom]);
  const groups = {};
  F.forEach((i) => { (groups[i.sup] || (groups[i.sup] = { s: i, rows: [] })).rows.push(i); });
  const expRows = [["Supplier", "Contact", "Ingredient", "Pack", "Price per pack (PHP)", "Price per unit (PHP)", "Unit", "Minimum order (packs)", "Delivery"]];
  const sorted = Object.values(groups).sort((a, b) => (a.s.supname < b.s.supname ? -1 : 1));
  const body = sorted.map((g) => {
    const walk = isWalkin(g.s), wait = (i) => (walk ? "Walk-in" : i.lead === 0 ? "Same day" : i.lead + (i.lead === 1 ? " day" : " days") + " after ordering");
    const rows = g.rows.sort((a, b) => (a.name < b.name ? -1 : 1));
    return (
      <tbody key={g.s.sup}>
        <tr className="sup"><td colSpan={6}><div className="suphead"><span><b>{g.s.supname}</b> · {walk ? "walk-in grocery" : g.s.contact}
          <small>{g.rows.length} {g.rows.length === 1 ? "item" : "items"}{walk ? "" : " · delivers " + (g.s.interval === 1 ? "every day" : "every " + g.s.interval + " days")}</small></span></div></td></tr>
        {rows.map((i) => {
          const [pu, un] = per(i), pp = i.cost * i.pack;
          expRows.push([g.s.supname, g.s.contact, i.name, packQty(i.pack, i.uom), Math.round(pp * 100) / 100, Math.round(pu * 100) / 100, un, i.minpacks, wait(i)]);
          return (
            <tr key={i.id}>
              <td><b>{i.name}</b><small>{i.store}</small></td>
              <td>{packQty(i.pack, i.uom)}</td>
              <td className="n"><b>{peso(pp, pp < 100 ? 2 : 0)}</b></td>
              <td className="n">{peso(pu, pu < 100 ? 2 : 0)} <small>per {un}</small></td>
              <td className="n">{i.minpacks} {i.minpacks === 1 ? "pack" : "packs"}</td>
              <td>{wait(i)}</td>
            </tr>
          );
        })}
      </tbody>
    );
  });
  exp.current.prices = expRows;
  return (
    <div className="panel c12">
      <div className="ph">
        <h2>Price list</h2>
        <Info t="The standard price of each ingredient and how it is sold. The purchasing plan uses these prices to cost every order." />
        <button className="linkbtn noprint" style={{ margin: 0 }} onClick={() => exp.current.onExport("prices")}>Export</button>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Ingredient</th><th>Sold as</th><th className="n">Price per pack</th><th className="n">Price per unit</th><th className="n">Minimum order</th><th>Delivery</th></tr></thead>
          {body.length ? body : <tbody><tr><td colSpan={6} className="empty">No ingredients match these filters.</td></tr></tbody>}
        </table>
      </div>
      <div className="note">Standard prices used by the plan. If a supplier changes a price, update it in the data so the plan and the budget stay correct.</div>
    </div>
  );
}

// the budget the spend is compared against: Low, Base (the plan's own) or High
function BudgetSeg({ S, set }) {
  return (
    <div className="seg noprint" id="budseg">
      {Object.keys(M.budget).map((k) => <button key={k} aria-pressed={S.scen === k} title={k + " budget " + peso(M.budget[k]) + " a month"} onClick={() => set({ scen: k })}>{k}</button>)}
    </div>
  );
}

// the 14 days the purchase plan covers (the plan looks two weeks ahead and is re-solved every week)
const planEnd = () => idxOf(M.plan_start) + 13;
function WeekSeg({ S, set }) {
  return (
    <div className="seg noprint" id="weekseg">
      <button aria-pressed={S.week === 0} onClick={() => set({ week: 0 })}>14 days · {fiso(M.plan_start)} to {fd(planEnd())}</button>
      <button aria-pressed={S.week === 1} onClick={() => set({ week: 1 })}>This week</button>
      <button aria-pressed={S.week === 2} onClick={() => set({ week: 2 })}>Next week</button>
    </div>
  );
}

// The whole 14-day plan in one table (Chapter 4, Table 4.2.3.2.1): packs for each week, the quantity and the cost.
// Orders are placed and ticked off week by week, in the "This week" and "Next week" views.
// the value of the orders by supplier, as a ring with each supplier's share
function SupplierDonut({ F, weeks, title }) {
  const ids = new Set(F.map((i) => i.id)), by = {};
  D.plan.filter((p) => weeks.includes(p.week) && ids.has(p.ing) && p.cost > 0 && BYID[p.ing]).forEach((p) => { const n = BYID[p.ing].supname || "Other"; by[n] = (by[n] || 0) + p.cost; });
  const e = Object.entries(by).sort((x, y) => y[1] - x[1]), top = e.slice(0, 5), rest = sum(e.slice(5).map((x) => x[1]));
  if (rest > 0) top.push(["Other", rest]);
  if (!top.length) return null;
  return <><div className="sub" style={{ marginTop: 10 }}>{title}</div><Donut items={top} size="auto" center={kpeso(sum(e.map((x) => x[1])))} sub="orders" label={title} /></>;
}

function FourteenDayPlan({ F, S, set, exp }) {
  const { toast } = useApp();
  const msgBy = Object.fromEntries(supplierMessages(F, 1).map((m) => [m.sup, m]));
  const idset = new Set(F.map((i) => i.id)), cmpBud = M.budget[S.scen], bc = D.opt.budget_check;
  const lines = {};
  D.plan.filter((p) => idset.has(p.ing) && BYID[p.ing]).forEach((p) => { (lines[p.ing] || (lines[p.ing] = { i: BYID[p.ing], w: {} })).w[p.week] = p; });
  const all = Object.values(lines);
  const cost = (l) => sum([1, 2].map((k) => (l.w[k] ? l.w[k].cost : 0))), qtyOf = (l) => sum([1, 2].map((k) => (l.w[k] ? l.w[k].qty : 0)));
  const packsOf = (l) => sum([1, 2].map((k) => (l.w[k] ? l.w[k].packs : 0)));
  const isDaily = (l) => !!(l.w[1] && l.w[1].rule === "daily market buy");
  const groups = {};
  all.forEach((l) => { (groups[l.i.sup] || (groups[l.i.sup] = { sup: l.i, rows: [] })).rows.push(l); });
  const total = sum(all.map(cost)), nPacks = sum(all.filter((l) => !isDaily(l)).map(packsOf));
  const ordered = all.filter((l) => qtyOf(l) > 0), hiddenN = all.length - ordered.length;
  const expRows = [["Supplier", "Ingredient", "Packs, week 1", "Packs, week 2", "Quantity", "Unit", "Cost (PHP)"]];
  const body = Object.values(groups).sort((a, b) => sum(b.rows.map(cost)) - sum(a.rows.map(cost))).map((g) => {
    const rows = (S.allrows ? g.rows : g.rows.filter((l) => qtyOf(l) > 0)).sort((a, b) => cost(b) - cost(a));
    if (!rows.length) return null;
    const walk = isWalkin(g.sup);
    return (
      <tbody key={g.sup.sup}>
        <tr className="sup"><td colSpan={5}><div className="suphead"><span><b>{g.sup.supname}</b> · {walk ? "walk-in grocery" : g.sup.contact}
          <small>{peso(sum(g.rows.map(cost)))} · {g.sup.lead === 0 || walk ? "same day" : g.sup.lead + " d lead"}{lateNote(g.sup.sup)}</small></span>{msgBy[g.sup.sup] ? <button className="linkbtn noprint" onClick={() => copyText(msgBy[g.sup.sup].text, walk, toast)}>{walk ? "Copy shopping list" : "Copy message"}</button> : null}</div></td></tr>
        {rows.map((l) => {
          const i = l.i, daily = isDaily(l), q = qtyOf(l);
          expRows.push([g.sup.supname, i.name, daily ? "" : (l.w[1] ? l.w[1].packs : 0), daily ? "" : (l.w[2] ? l.w[2].packs : 0), Math.round(q), i.uom, Math.round(cost(l))]);
          return (
            <tr key={i.id} className={q > 0 ? "" : "mute"}>
              <td><b>{i.name}</b><small>{i.store}</small></td>
              <td className="n">{daily ? <span className="chip good">Buy fresh each day</span> : q > 0 ? (l.w[1] ? l.w[1].packs : 0) : "–"}</td>
              <td className="n">{daily ? "" : q > 0 ? (l.w[2] ? l.w[2].packs : 0) : "–"}</td>
              <td className="n">{q > 0 ? qty(q, i.uom) : <span className="chip flat">No order needed</span>}{q > 0 && !daily ? <small>{packQty(i.pack, i.uom)} per pack</small> : null}</td>
              <td className="n"><b>{q > 0 ? peso(cost(l)) : "–"}</b></td>
            </tr>
          );
        })}
      </tbody>
    );
  }).filter(Boolean);
  exp.current.plan14 = [...expRows, ["Total", "", "", "", "", "", Math.round(total)]];
  const bud14 = cmpBud * 14 / 30.4167;
  return (
    <div className="grid canvas">
      <div className="panel c8" id="p-order14">
        <div className="ph">
          <h2>Purchase plan · next 14 days</h2>
          <WeekSeg S={S} set={set} />
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Ingredient</th><th className="n">Packs, week 1</th><th className="n">Packs, week 2</th><th className="n">Quantity</th><th className="n">Purchase value</th></tr></thead>
            {body.length ? <>{body}<tbody><tr className="hl"><td><b>Total</b></td><td className="n" colSpan={2}><b>{num(nPacks)} packs</b></td><td className="n">{ordered.length} ingredients</td><td className="n"><b>{peso(total)}</b></td></tr></tbody></> : <tbody><tr><td colSpan={5} className="empty">No ingredients match these filters.</td></tr></tbody>}
          </table>
        </div>
        {hiddenN || S.allrows ? <button className="linkbtn noprint" onClick={() => set({ allrows: !S.allrows })}>{S.allrows ? "Show only ingredients to order" : "Show " + hiddenN + " with no order needed"}</button> : null}
        <div className="note">The plan looks 14 days ahead and is re-solved every week; only the first week is carried out. To place orders and tick them off, or to copy the message for a supplier, choose "This week" or "Next week".</div>
      </div>
      <div className="panel c4">
        <div className="ph"><h2>Budget</h2><BudgetSeg S={S} set={set} /><Info t={"The plan was made for the Base budget (" + peso(M.budget.Base) + " a month). The switch changes the budget these bars are compared against, not the orders."} /></div>
        <BulletBar value={total} target={bud14} big={peso(total)} sub={"vs " + peso(bud14) + " for 14 days"} fmt={kpeso} />
        {bc && <BulletBar value={bc.month_total_php} target={cmpBud} big={peso(bc.month_total_php)} sub={monthName(bc.month) + " vs " + peso(cmpBud)} fmt={kpeso} />}
        <SupplierDonut F={F} weeks={[1, 2]} title="Spend by supplier, 14 days" />
        <div className="note">{bc ? peso(cmpBud - bc.month_total_php) + " left in " + monthName(bc.month) + ". " : ""}Purchases of the month so far, the daily market buys and the planned orders all count towards the budget.</div>
      </div>
    </div>
  );
}

// the supplier orders for the chosen week, with copy-message and tick-off, and the budget as bullet graphs
export function OrdersPanel({ F, S, set, exp, msgs }) {
  const { toast } = useApp();
  const [, bump] = useState(0);
  if (S.week === 0) return <FourteenDayPlan F={F} S={S} set={set} exp={exp} />;
  const idset = new Set(F.map((i) => i.id)), cmpBud = M.budget[S.scen], wkb = wk(cmpBud), bc = D.opt.budget_check;
  const wkSpend = sum(D.plan.filter((p) => p.week === S.week && idset.has(p.ing)).map((p) => p.cost));
  const wkName = S.week === 1 ? "this week" : "next week";
  const arrive = (p) => {
    const d = D.deliveries.filter((x) => x[0] === p.ing && x[1] === p.week).sort((a, b) => (a[3] < b[3] ? -1 : 1))[0];
    return d ? fiso(d[3]) : null;
  };
  const groups = {};
  D.plan.filter((p) => p.week === S.week && idset.has(p.ing)).forEach((p) => {
    const i = BYID[p.ing];
    (groups[i.sup] || (groups[i.sup] = { sup: i, rows: [] })).rows.push({ p, i });
  });
  let nOrd = 0, nDone = 0, hiddenN = 0;
  const expRows = [];
  const blocks = Object.values(groups).map((g) => {
    const rows = g.rows.sort((a, b) => (b.p.qty > 0) - (a.p.qty > 0) || b.p.cost - a.p.cost);
    const orders = rows.filter((r) => r.p.qty > 0), shown = S.allrows ? rows : orders;
    hiddenN += rows.length - orders.length;
    if (!shown.length) return null;
    const total = sum(orders.map((r) => r.p.cost)), nxt = nextDelivery(rows.map((r) => r.i.id), S.week), lead = g.sup.lead;
    const msgOrders = orders.filter((r) => r.p.rule !== "daily market buy");
    nOrd += orders.length;
    const walk = isWalkin(g.sup);
    if (msgOrders.length) {
      msgs.current[g.sup.sup] = walk
        ? `Grocery list - ${g.sup.supname}${nxt === null ? "" : " (buy on " + dtxt(nxt) + ")"}\n` + msgOrders.map((r) => `[ ] ${r.i.name}: ${r.p.packs} x ${packQty(r.i.pack, r.i.uom)} (${qty(r.p.qty, r.i.uom)} in total)`).join("\n")
          + orders.filter((r) => r.p.rule === "daily market buy").map((r) => `\n[ ] ${r.i.name}: about ${qty(r.p.qty, r.i.uom)} for the week (buy fresh each day)`).join("")
        : `Hello ${g.sup.supname}, this is Makisushi. We would like to order for delivery ${nxt === null ? "as soon as possible" : "on " + dtxt(nxt)}:\n`
          + msgOrders.map((r) => `- ${r.p.packs} x ${packQty(r.i.pack, r.i.uom)} ${r.i.name}`).join("\n") + "\nThank you!";
    }
    const when = nxt === null ? "" : ` · ${dtxt(nxt)}`;
    const items = shown.map(({ p, i }) => {
      const buy = p.qty > 0, daily = p.rule === "daily market buy", a = arrive(p), done = buy && readDone(p);
      if (buy && done) nDone++;
      const onHand = series(i.id).close[LAST], u = consumedValue([i.id], LAST - 27, LAST) / 28 / i.cost, daysLast = u > 0 ? onHand / u : 99;
      const prevEnd = S.week === 2 ? ((D.plan.find((x) => x.ing === i.id && x.week === 1) || {}).end || 0) : 0;
      const why = daily ? `Fresh produce bought at the market each day. Expected use ${wkName}: ${qty(p.demand, i.uom)}.`
        : !buy ? (S.week === 1 ? `Enough stock. ${qty(onHand, i.uom)} on hand lasts about ${daysTxt(daysLast)} days, and expected use ${wkName} is ${qty(p.demand, i.uom)}.` : `The stock left after this week's plan (${qty(prevEnd, i.uom)}) covers next week's expected use of ${qty(p.demand, i.uom)}.`)
          : (S.week === 1 ? `${qty(onHand, i.uom)} on hand lasts about ${daysTxt(daysLast)} days. ` : `Stock left after this week's plan: ${qty(prevEnd, i.uom)}. `) + `Expected use ${wkName}: ${qty(p.demand, i.uom)}. ${a ? (walk ? "Buy it on " : "Delivery arrives ") + a + ". " : ""}About ${qty(p.end, i.uom)} would be left as a cushion.`;
      if (buy) expRows.push([g.sup.supname, g.sup.contact, i.name, daily ? "" : p.packs, daily ? "" : Math.round(i.pack), Math.round(p.qty), i.uom, Math.round(p.cost), a || "", S.week, daily ? "buy fresh at the market" : walk ? "buy in store" : "order from supplier"]);
      const leadText = walk ? "Walk-in" : i.lead === 0 ? "Same day" : i.lead + (i.lead === 1 ? " day" : " days");
      return (
        <tr key={`${p.ing}-${p.week}`} className={`${buy ? "" : "mute"} ${done ? "done" : ""}`}>
          <td className="chk noprint">
            {buy && (
              <input type="checkbox" aria-label={`${walk ? "Bought" : "Ordered"} ${i.name}`} checked={done}
                onChange={(e) => { writeDone(p, e.target.checked); bump((n) => n + 1); }} />
            )}
          </td>
          <td><b>{i.name}</b><small>{i.store}</small></td>
          <td>
            {!buy ? <span className="chip flat">No order needed</span>
              : daily ? <><b>{qty(p.qty, i.uom)}</b> <span className="chip good">Buy fresh</span> <small>{peso(p.cost)}</small></>
                : <><b>{p.packs} × {packQty(i.pack, i.uom)}</b> <small>{peso(p.cost)}{a ? " · " + a : ""}</small></>}
          </td>
          <td className="n">{leadText}</td>
        </tr>
      );
    });
    return {
      total,
      html: (
        <tbody key={g.sup.sup}>
          <tr className="sup"><td colSpan={5}><div className="suphead">
            <span><b>{g.sup.supname}</b> · {walk ? "walk-in grocery" : g.sup.contact}<small>{orders.length} · {peso(total)}{when}{lateNote(g.sup.sup)}</small></span>
            {msgOrders.length ? <button className="linkbtn noprint" onClick={() => copy(g.sup.sup, walk)}>{walk ? "Copy shopping list" : "Copy message"}</button> : null}
          </div></td></tr>
          {items}
        </tbody>
      ),
    };
  });
  const copy = (key, walk) => copyText(msgs.current[key] || "", walk, toast);
  exp.current.orders = [["Supplier", "Contact", "Ingredient", "Packs", "Pack size", "Quantity", "Unit", "Cost (PHP)", "Date", "Week", "How"], ...expRows];
  const body = blocks.filter(Boolean).sort((a, b) => b.total - a.total).map((b) => b.html);
  const toggle = hiddenN || S.allrows ? (
    <button className="linkbtn noprint" onClick={() => set({ allrows: !S.allrows })}>
      {S.allrows ? "Show only ingredients to order" : `Show ${hiddenN} with no order needed`}
    </button>
  ) : null;

  // where the month's spend should be by the end of the plan's first week, if spending were even across the month
  let pace = null;
  if (bc) {
    const y = +bc.month.slice(0, 4), m = +bc.month.slice(5, 7) - 1, dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const endWk = new Date(Date.UTC(+M.plan_start.slice(0, 4), +M.plan_start.slice(5, 7) - 1, +M.plan_start.slice(8, 10) + 6));
    const dayInMonth = endWk.getUTCMonth() === m ? endWk.getUTCDate() : dim;
    pace = cmpBud * (dayInMonth / dim);
  }
  return (
    <div className="grid canvas">
      <div className="panel c8" id="p-order">
        <div className="ph">
          <h2>Supplier orders</h2>
          <Chip cls={nOrd && nDone === nOrd ? "good" : "flat"}>Done {nDone} of {nOrd}</Chip>
          <WeekSeg S={S} set={set} />
        </div>
        <div className="tablewrap" style={{ maxHeight: 660, overflow: "auto" }}>
          <table>
            <thead><tr><th className="noprint"></th><th>Ingredient</th><th>Order quantity</th><th className="n">Lead time</th></tr></thead>
            {body.length ? body : <tbody><tr><td colSpan={5} className="empty">No ingredients match these filters.</td></tr></tbody>}
          </table>
        </div>
        {toggle}
      </div>
      <div className="panel c4">
        <div className="ph"><h2>Budget</h2><BudgetSeg S={S} set={set} /><Info t={`The plan was made for the Base budget (${peso(M.budget.Base)} a month). The switch changes the budget these bars are compared against, not the orders.`} /></div>
        <BulletBar value={wkSpend} target={wkb} big={peso(wkSpend)} sub={`vs ${peso(wkb)} a week`} fmt={kpeso} />
        {bc && <BulletBar value={bc.month_total_php} target={cmpBud} pace={pace} big={peso(bc.month_total_php)}
          sub={`${monthName(bc.month)} vs ${peso(cmpBud)}`} fmt={kpeso} />}
        <SupplierDonut F={F} weeks={[S.week === 2 ? 2 : 1]} title="Spend by supplier, this week" />
        <div className="note">{bc ? `${peso(cmpBud - bc.month_total_php)} left in ${monthName(bc.month)}. ` : ""}The black tick is the budget; the dashed line is where the month's spend would be by the end of this week if it were spread evenly.</div>
      </div>
    </div>
  );
}

// The owner picks the priority of the plan: Minimize waste (76% service level), Balanced (80%, recommended) or Maximize availability (95%).
// Each one is a stored plan; choosing one loads its orders, deliveries and budget on every page. The numbers are the study's test-year backtest (Chapter 4, Figure 4.2.3.5.1).
const PRIO_RUN = (key) => (key === "bal" ? D.defaultRun : key === "min" ? "min_spoilage" : "max_availability");
function PrioritySwitch({ set }) {
  const cur = D.opt.run_id, H = D.serviceLevels ? D.serviceLevels.historical : { episodes: 296, expiry: 11905 };
  const keys = PRIORITIES.map((p) => PRIO_RUN(p.key));
  return (
    <div className="prio-switch" role="radiogroup" aria-label="Owner priority">
      {PRIORITIES.map((p) => {
        const id = PRIO_RUN(p.key), run = (D.planRuns || []).find((r) => r.id === id), on = id === cur;
        return (
          <button key={p.key} type="button" role="radio" aria-checked={on} data-t={"Before: " + num(H.episodes) + " stockouts, " + peso(H.expiry) + " waste in a year"} className={"prio-opt" + (on ? " on" : "")} disabled={!run} onClick={() => set({ planRun: id })}>
            <span className="po-h"><b>{p.label}</b>{p.recommended && <Chip cls="good">Recommended</Chip>}{on && <Chip cls="flat">Loaded</Chip>}</span>
            <span className="po-s">{levelLabel(run ? run.level : 0)} service level</span>
            <span className="po-row"><span className="po-n"><b>{num(p.episodes)}</b> stockouts</span><span className="po-n"><b>{peso(p.expiry)}</b> waste in a year</span><span className="po-n"><b>{run ? kpeso(run.purchase_php) : "–"}</b> 14 days</span></span>
          </button>
        );
      })}
      {!keys.includes(cur) && <div className="prio-custom">Custom: {levelLabel(D.opt.service || 0)}</div>}
    </div>
  );
}

// What each service level from 80% to 99% trades off in the study's test-year backtest (Chapter 4, Figure 4.2.3.3.6), and the switch
// that loads that level's 14-day plan from the warehouse. A higher level runs out less but expires more; the study's rule is that expiry
// must not be above today's way of ordering, which holds up to 88%.
const LEVEL_NOTE = { 0.8: "Balanced, recommended", 0.88: "highest with expiry below today's", 0.98: "lowest net cost on the tuning year" };
function ServiceLevelPanel({ set }) {
  const SL = D.serviceLevels, runs = (D.planRuns || []).filter((r) => !r.owner);
  if (!SL || runs.length < 2) return null;
  const H = SL.historical, cur = D.opt.run_id, owner = D.opt.owner;
  const rows = runs.map((r) => ({ run: r, bt: levelBacktest(r.level) })).filter((r) => r.bt);
  const selIdx = Math.max(0, rows.findIndex((r) => r.run.id === cur));
  const now = rows[selIdx], bt = owner && D.opt.bt ? D.opt.bt : now.bt, lbl = levelLabel(owner ? D.opt.service : now.run.level);
  const base = rows.find((r) => Math.abs(r.run.level - 0.8) < 1e-9) || rows[0];
  const chg = (x, y) => Math.round(Math.abs(x / y - 1) * 100);
  const within = bt.expiry <= H.expiry;
  const x = rows.map((r) => levelLabel(r.run.level));
  const dEp = bt.episodes - base.bt.episodes, dEx = bt.expiry - base.bt.expiry;
  const shown = rows.filter((r, k) => k === selIdx || [0.8, 0.84, 0.88, 0.9, 0.94, 0.98, 0.99].some((l) => Math.abs(r.run.level - l) < 1e-9));
  const barCol = (v, k, over) => (k === selIdx && !owner ? "var(--accent)" : over ? "#F2B8A2" : "#93A4D6");
  return (
    <>
      <div className="panel c5">
        <div className="ph"><h2>What each service level changes</h2>
          <Info t={"The warehouse stores the 14-day plan at every service level from 80% to 99%; the admin can load any of them. The figures are the study's test-year backtest (" + SL.period + ") against how the restaurant ordered before. Waste here is stock kept past its shelf life."} /></div>
        <div className="tablewrap fitc">
          <table>
            <thead><tr><th>Level</th><th className="n">Stockouts</th><th className="n">Waste in a year</th><th className="n">Net cost</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.run.id} className={"click" + (r.run.id === cur ? " sel" : "")} onClick={() => set({ planRun: r.run.id })}>
                  <td><b>{levelLabel(r.run.level)}</b></td>
                  <td className="n">{num(r.bt.episodes)}</td>
                  <td className={"n " + (r.bt.expiry <= H.expiry ? "" : "t-bad")}>{peso(r.bt.expiry)}</td>
                  <td className="n">{peso(r.bt.net_cost)}</td>
                </tr>
              ))}
              <tr><td><b>Before</b></td><td className="n">{num(H.episodes)}</td><td className="n">{peso(H.expiry)}</td><td className="n">{peso(H.net_cost)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel c7 whatif">
        <div className="ph"><h2>Service level</h2></div>
        <label className="wi-l"><b>{lbl}</b>{owner ? <small> · owner priority loaded</small> : null}</label>
        <input id="selLevel" className="wi-range" type="range" min={0} max={rows.length - 1} step={1} value={selIdx}
          onChange={(e) => set({ planRun: rows[+e.target.value].run.id })} aria-label="Service level" />
        <div className="wi-ends"><span>{levelLabel(rows[0].run.level)}</span><span>{levelLabel(rows[rows.length - 1].run.level)}</span></div>
        <div className="wi-verdict"><Chip cls={within ? "good" : "warn"}>{within ? "Waste below before: inside the study rule" : "Waste above before: over the study rule"}</Chip></div>
        <dl className="facts">
          <dt>Stockouts</dt><dd><b>{num(bt.episodes)}</b> <small>before {num(H.episodes)}</small></dd>
          <dt>Waste in a year</dt><dd><b>{peso(bt.expiry)}</b> <small>before {peso(H.expiry)}</small></dd>
          <dt>Demand met</dt><dd><b>{pct(bt.fill, 1)}</b> <small>before {pct(H.fill, 1)}</small></dd>
          <dt>Next 14 days</dt><dd><b>{peso(D.opt.purchase_php || sum(D.plan.map((p) => p.cost)))}</b> <small>{num(sum(D.plan.map((p) => p.packs)))} packs</small></dd>
        </dl>
      </div>
      <div className="panel c6">
        <div className="ph"><h2>Stockout episodes</h2><Info t="Times an ingredient ran out in the test year at each service level. Fewer is better. The dark bar is the level that is loaded." /></div>
        <ComboChart x={x} h={200} yfmt={num} bars={[{ vals: rows.map((r) => r.bt.episodes), colors: rows.map((r, k) => barCol(r.bt.episodes, k, false)), name: "Stockout episodes", fmt: num }]}
          refs={[{ y: H.episodes, label: "", color: "var(--bad)" }]} />
        <div className="legend"><span><i style={{ background: "var(--bad)" }} />Before: {num(H.episodes)} episodes</span></div>
      </div>
      <div className="panel c6">
        <div className="ph"><h2>Waste in a year</h2><Info t="Waste in pesos a year (stock kept past its shelf life, as the backtest simulates it). Lower is better. Red bars waste more than the restaurant's current way of ordering." /></div>
        <ComboChart x={x} h={200} yfmt={kpeso} bars={[{ vals: rows.map((r) => r.bt.expiry), colors: rows.map((r, k) => barCol(r.bt.expiry, k, r.bt.expiry > H.expiry)), name: "Waste in a year", fmt: peso }]}
          refs={[{ y: H.expiry, label: "", color: "var(--bad)" }]} />
        <div className="legend"><span><i style={{ background: "var(--bad)" }} />Before: {peso(H.expiry)}</span><span><i style={{ background: "#F2B8A2" }} />More than before</span></div>
      </div>
    </>
  );
}

// Supplier delivery record over the test year: each purchase order against the first delivery after it
function SupplierRecord() {
  const S = D.suppliers || [];
  if (!S.length) return null;
  const advice = (s) => (s.onTime < 0.9 ? "Order a day early for items that must not run out" : s.qtyRatio < 0.98 ? "Check quantities on delivery" : "Reliable");
  return (
    <div className="panel c12">
      <div className="ph"><h2>Supplier delivery record</h2><Info t="Each purchase order in the test year matched with the first delivery of that ingredient after it." /></div>
      <div className="tablewrap fitc">
        <table>
          <thead><tr><th>Supplier</th><th className="n">Orders</th><th className="n">Promised</th><th className="n">Average wait</th><th className="n">On time</th><th className="n">Longest wait</th><th className="n">Delivered vs ordered</th><th>What to do</th></tr></thead>
          <tbody>
            {S.map((s) => (
              <tr key={s.sup}>
                <td><b>{s.name}</b></td>
                <td className="n">{num(s.orders)}</td>
                <td className="n">{s.lead} {s.lead === 1 ? "day" : "days"}</td>
                <td className="n">{s.avgDays.toFixed(1)} days</td>
                <td className={`n ${s.onTime < 0.9 ? "t-bad" : "t-good"}`}>{pct(s.onTime, 0)}</td>
                <td className="n">{s.maxDays} days</td>
                <td className="n">{pct(s.qtyRatio, 1)}</td>
                <td>{advice(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="note">On time means delivered within the promised lead time. {D.pricesChanged ? "" : "Prices did not change over the period: every delivery was at the standard price, so there is no price trend to track."}</div>
    </div>
  );
}

export function BuyPage({ F }) {
  const { S, set, exp, msgs } = useApp();
  // one screen per tab: the plan, the recommended actions, the service level, and the suppliers and prices
  const tabs = SUBTABS.buy.list;
  const tab = S.btab === "orders" ? "plan" : tabs.some((t) => t[0] === S.btab) ? S.btab : "plan";
  return (
    <>
      <div className="pb-head">
        {tab === "plan" && <PrioritySwitch set={set} />}
        {tab === "prep" && <PrepKpis F={F} />}
      </div>
      {tab === "plan" && <OrdersPanel F={F} S={S} set={set} exp={exp} msgs={msgs} />}
      {tab === "prep" && <div className="grid canvas"><PrepTable F={F} /></div>}
      {tab === "level" && <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)" }}><ServiceLevelPanel set={set} /></div>}
    </>
  );
}
