// Overview: the one-screen summary. Sales, spend and waste over the chosen period, the key takeaways, what needs attention now,
// the best sellers and whether the plan is working. The orders and the daily prep list are on Purchasing.
import {
  D, M, LAST, BYID, D0, win, bucketsFor, partNote, dishUnits, IT, series, consumedValue, unmetValue, stockoutSplit, purchaseValue, wasteIn, soIn, wk, weeksFrom, fiso,
  runOutDay, emergencyValue, bucketUnit, nextDelivery, isWalkin, dateOf,
} from "../lib/model.js";
import { peso, kpeso, num, pct, qty, daysTxt, sum } from "../lib/format.js";
import { Kpi, Kpis, deltaEl, Chip, Info, Tiles, AggSeg } from "../components/ui.jsx";
import { ComboChart, HBars } from "../components/Charts.jsx";
import { cleanName } from "../lib/upload.js";
import { useApp } from "../AppContext.js";
import { stockStatus } from "./InvPage.jsx";
import { readDone } from "./BuyPage.jsx";
import { buildRecommendations } from "./recommend.js";
import { useWeather } from "../lib/weather.js";

const monthName = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });

// the four cards: buy, watch, budget, trim. Each opens the page behind it. (Near-expiry alerts are sent through Telegram.)
export function TodayActions({ F }) {
  const { goto, set } = useApp();
  const ids = F.map((i) => i.id), idset = new Set(ids), fdays = D.fdates.length;
  const buys = D.plan.filter((p) => p.week === 1 && idset.has(p.ing) && p.qty > 0 && p.rule !== "daily market buy");
  const buyCost = sum(buys.map((p) => p.cost));
  const outs = F.map((i) => ({ i, k: runOutDay(i.id, true) })).filter((o) => o.k >= 0).sort((a, b) => a.k - b.k);
  const ex = F.map((i) => ({ i, v: Math.max(0, series(i.id).close[LAST] - sum(D.fc[i.id].y.slice(0, Math.min(Math.min(i.shelf, 14), fdays)))) * i.cost }))
    .filter((e) => e.v > 0).sort((a, b) => b.v - a.v);
  const open = (page, patch) => { if (patch) set(patch); goto(page); };
  const card = (cls, head, main, sub, page, patch) => (
    <button className={cls} onClick={() => open(page, patch)}>
      <div className="h">{head}</div><div className="m">{main}</div><div className="s">{sub}</div>
    </button>
  );
  const bc = D.opt.budget_check;
  const largestBuy = buys.slice().sort((a, b) => b.cost - a.cost)[0];
  return (
    <div className="todo" aria-label="Today's actions">
      {card(buys.length ? "g" : "", "1 · Buy", buys.length ? `${buys.length} ingredients · ${peso(buyCost)}` : "Nothing to order",
        largestBuy ? `Largest: ${BYID[largestBuy.ing].name}` : "", "buy", { btab: "orders" })}
      {card(outs.length ? "b" : "g", "2 · Watch", outs.length ? `${outs.length} could run out` : "Nothing should run out",
        outs.length ? `${outs[0].i.name} by ${fiso(D.fdates[outs[0].k])}` : "", "inv", { itab: "risk", sel: outs.length ? outs[0].i.id : 0 })}
      {card(bc && bc.month_total_php > bc.monthly_budget_php * 0.9 ? "w" : "g", "3 · Budget", bc ? `${peso(bc.month_total_php)} of ${peso(bc.monthly_budget_php)}` : "–",
        bc ? `${Math.round(bc.month_total_php / bc.monthly_budget_php * 100)}% of the month's budget` : "", "buy", { btab: "plan" })}
      {card(ex.length && ex[0].v > 500 ? "w" : "g", "4 · Trim orders", ex.length ? `${peso(sum(ex.map((e) => e.v)))} extra stock` : "Stock matches forecast",
        ex.length ? `Most extra: ${ex[0].i.name}` : "", "inv", { itab: "risk" })}
    </div>
  );
}

// The five operations numbers for the period in Filters, each with its trend over the last 12 weeks
export function OpsKpis({ F }) {
  const { S, goto } = useApp();
  const w = win(S), ids = F.map((i) => i.id), set_ = new Set(ids), hasPrev = w.pb >= 0 && w.pa <= w.pb;
  const salesIn = (a, b) => sum(D.sales.filter((r) => r[0] >= a && r[0] <= b).map((r) => r[3]));
  const so = soIn(set_, w.a, w.b).length, soP = hasPrev ? soIn(set_, w.pa, w.pb).length : null;
  const served = consumedValue(ids, w.a, w.b), lost = unmetValue(ids, w.a, w.b), em = emergencyValue(set_, w.a, w.b), split = stockoutSplit(set_, w.a, w.b);
  const fill = served + lost > 0 ? served / (served + lost) : 1;
  const wv = sum(wasteIn(set_, w.a, w.b).map((x) => x[2])), pu = purchaseValue(ids, w.a, w.b);
  const wvP = hasPrev ? sum(wasteIn(set_, w.pa, w.pb).map((x) => x[2])) : null;
  const puP = hasPrev ? purchaseValue(ids, w.pa, w.pb) : 0;
  const sp = (pu / w.n) * 7, spP = hasPrev ? (puP / (w.pb - w.pa + 1)) * 7 : null;
  const bud = wk(M.budget.Base);
  const sn = salesIn(w.a, w.b), snP = hasPrev ? salesIn(w.pa, w.pb) : null;
  const fcost = sn ? pu / sn : 0, fcostP = snP ? puP / snP : null;
  // the last 12 full weeks, for the small trend lines
  const wks = weeksFrom(Math.max(0, LAST - 12 * 7 + 1), LAST);
  const tr = (fn) => wks.map((x) => fn(x.a, x.b));
  return (
    <Kpis>
      <Kpi act={{ page: "inv", tab: "outs", hint: "Stockouts" }} label="Ran out" value={num(so)} delta={deltaEl(so, soP, num, true)}
        spark={tr((a, b) => soIn(set_, a, b).length)} sparkColor="var(--bad)"
        />
      <Kpi act={{ page: "inv", tab: "outs", patch: { soView: "lost" }, hint: "Lost sales" }} label="Demand served" value={pct(fill, 2)} delta={<span className="t-flat">{num(split.em)} emergency · {num(split.lost)} lost</span>}
        spark={tr((a, b) => { const s = consumedValue(ids, a, b), l = unmetValue(ids, a, b); return s + l > 0 ? s / (s + l) : 1; })}
        info="Share of ingredient demand served from stock. Emergency buys count as served." />
      <Kpi act={{ page: "waste", tab: "where", hint: "Waste" }} label="Waste" value={peso(wv)} delta={<>{`${pct(pu ? wv / pu : 0)} of purchases · `}{deltaEl(wv, wvP, (v) => peso(v), true)}</>} goto="waste" onGo={goto}
        spark={tr((a, b) => sum(wasteIn(set_, a, b).map((x) => x[2])))} sparkColor="var(--warn)"
        />
      <Kpi act={{ page: "sales", tab: "time", hint: "Ingredient use" }} label="Ingredient cost" value={pct(fcost)} delta={<>{"of sales · "}{deltaEl(fcost, fcostP, (v) => (v * 100).toFixed(1), true, " pts")}</>} goto="buy" onGo={goto}
        spark={tr((a, b) => { const s = salesIn(a, b); return s ? purchaseValue(ids, a, b) / s : 0; })}
        info="Spend on perishable ingredients as a share of sales." />
      <Kpi act={{ page: "buy", tab: "plan", hint: "Budget" }} label="Weekly spend" value={peso(sp)} delta={<>{`${pct(sp / bud, 0)} of ${peso(bud)} budget · `}{deltaEl(sp, spP, (v) => peso(v), true)}</>} goto="buy" onGo={goto}
        spark={tr((a, b) => purchaseValue(ids, a, b))}
        info={"Average spend per week, against the weekly budget of " + peso(bud) + "."} />
    </Kpis>
  );
}

// what needs action now: run-outs, expiring stock, budget, a waste spike, and old data
function attentionItems(F) {
  const ids = F.map((i) => i.id), set_ = new Set(ids), out = [];
  F.forEach((i) => {
    const k = runOutDay(i.id, true);
    if (k < 0) return;
    const st = stockStatus(i);
    out.push({ lvl: k <= 2 ? "bad" : "warn", what: i.name,
      detail: `Out by ${fiso(D.fdates[k])} · ${qty(st.close, i.uom)} left`,
      page: "inv", patch: { itab: "risk", sel: i.id } });
  });
  const bc = D.opt.budget_check;
  if (bc && bc.headroom_php < 0) out.push({ lvl: "bad", what: "Budget", detail: `${peso(-bc.headroom_php)} over budget`, page: "buy", patch: { btab: "orders" } });
  const wk1 = sum(D.plan.filter((p) => p.week === 1 && set_.has(p.ing)).map((p) => p.cost)), wkb = wk(M.budget.Base);
  if (wk1 > wkb) out.push({ lvl: "warn", what: "Budget", detail: `${peso(wk1)} against ${peso(wkb)} a week`, page: "buy", patch: { btab: "orders" } });
  // suppliers that often deliver late and have orders in this week's plan
  (D.suppliers || []).filter((s) => s.onTime < 0.9).forEach((s) => {
    const rows = D.plan.filter((p) => p.week === 1 && set_.has(p.ing) && p.cost > 0 && BYID[p.ing] && String(BYID[p.ing].sup) === String(s.sup));
    if (!rows.length) return;
    out.push({ lvl: "warn", what: s.name, detail: `${pct(s.onTime, 0)} on time · order a day early`, page: "buy", patch: { btab: "plan" } });
  });
  // waste in the last 7 days against the usual share over the last year
  const share = (a, b) => { const p = purchaseValue(ids, a, b); return p ? sum(wasteIn(set_, a, b).map((x) => x[2])) / p : 0; };
  const s7 = share(LAST - 6, LAST), s365 = share(Math.max(0, LAST - 364), LAST);
  if (s365 > 0 && s7 > s365 * 1.5) out.push({ lvl: "warn", what: "Waste", detail: `${pct(s7, 1)} of buys this week · usual ${pct(s365, 1)}`, page: "waste", patch: { wtab: "lost" } });
  // how old the data is
  const age = Math.floor((Date.now() - (D0 + LAST * 864e5)) / 864e5);
  if (age > 2) out.push({ lvl: "warn", what: "Data", detail: `${age} days old`, page: null });
  const sev = { bad: 0, warn: 1 };
  return out.sort((a, b) => sev[a.lvl] - sev[b.lvl]);
}

// "Orders this week": the week's purchase plan by supplier, in the order the orders must be placed: order by the first
// delivery date minus the supplier's lead time, so the order arrives in time ("today" is the latest day of the data)
const WDS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortDay = (i) => WDS[dateOf(i).getUTCDay()] + " " + dateOf(i).getUTCDate();
function OrdersThisWeek({ F }) {
  const { goto, set } = useApp();
  const idset = new Set(F.map((i) => i.id));
  const lines = D.plan.filter((p) => p.week === 1 && p.qty > 0 && idset.has(p.ing) && BYID[p.ing]);
  const market = lines.filter((p) => p.rule === "daily market buy"), orders = lines.filter((p) => p.rule !== "daily market buy");
  const bySup = {};
  orders.forEach((p) => { const i = BYID[p.ing]; (bySup[i.sup] || (bySup[i.sup] = { i, rows: [] })).rows.push(p); });
  const rows = Object.values(bySup).map((g) => {
    const t = nextDelivery(g.rows.map((p) => p.ing), 1), walk = isWalkin(g.i);
    const by = t === null ? LAST : Math.max(LAST, t - (walk ? 0 : g.i.lead || 0));
    return { g, t, walk, by, cost: sum(g.rows.map((p) => p.cost)), done: g.rows.every(readDone) };
  }).sort((x, y) => x.by - y.by || y.cost - x.cost);
  const total = sum(lines.map((p) => p.cost)), nDone = rows.filter((r) => r.done).length;
  const when = (r) => (r.done ? ["good", "Done"] : r.by <= LAST ? ["bad", "Today"] : r.by === LAST + 1 ? ["warn", "Tomorrow"] : ["flat", shortDay(r.by)]);
  const open = () => { set({ btab: "plan", week: 1 }); goto("buy"); };
  return (
    <div className="panel c3">
      <div className="ph">
        <h2>Orders this week</h2>
        {lines.length > 0 && <Chip cls="flat">{peso(total)}</Chip>}
        <Info t="Each supplier's order, with the day to place it so it arrives in time." />
      </div>
      {rows.length || market.length ? (
        <ul className="attn">
          {rows.map((r) => { const [c, l] = when(r); return (
            <li key={r.g.i.sup}>
              <Chip cls={c}>{l}</Chip>
              <div><b>{r.g.i.supname}</b><span>{peso(r.cost)}{r.walk ? " · in store" : r.t === null ? "" : " · arrives " + shortDay(r.t)}</span></div>
            </li>
          ); })}
          {market.length > 0 && (
            <li key="market">
              <Chip cls="flat">Daily</Chip>
              <div><b>Market</b><span>{market.map((p) => BYID[p.ing].name.replace(/ \(.*\)$/, "")).join(", ")} · {peso(sum(market.map((p) => p.cost)))}</span></div>
            </li>
          )}
        </ul>
      ) : <div className="empty">Nothing to order this week.</div>}
      <div className="legend"><span>{nDone} of {rows.length} placed</span><button className="linkbtn" onClick={open}>Open the order sheet</button></div>
    </div>
  );
}

// Key insights: one short line each, with an icon for good (check), watch (warning sign) or act now (exclamation mark)
const INS_ICON = { good: ["✓", "good"], warn: ["⚠", "watch"], bad: ["!", "act now"], flat: ["i", "note"] };
function insights(F) {
  const ids = F.map((i) => i.id), set_ = new Set(ids), out = [];
  const short = (n) => n.replace(/ \(.*\)/, "");
  const net = (a, b) => sum(D.sales.filter((r) => r[0] >= a && r[0] <= b).map((r) => r[3]));
  const s28 = net(LAST - 27, LAST), p28 = net(LAST - 55, LAST - 28);
  if (p28 > 0) { const g = s28 / p28 - 1; out.push({ tone: g >= 0 ? "good" : "bad", text: "Sales " + (g >= 0 ? "up " : "down ") + Math.abs(g * 100).toFixed(1) + "% on the 4 weeks before" }); }
  const risk = F.map((i) => ({ i, k: runOutDay(i.id, true) })).filter((o) => o.k >= 0).sort((x, y) => x.k - y.k);
  out.push(risk.length ? { tone: "bad", text: "Top up " + risk.slice(0, 3).map((o) => short(o.i.name)).join(", ") + (risk.length > 3 ? " +" + (risk.length - 3) : "") } : { tone: "good", text: "No ingredient should run out" });
  const sp28 = stockoutSplit(set_, LAST - 27, LAST);
  if (sp28.all > 0) out.push({ tone: sp28.lost > 0 ? "bad" : "warn", text: "Ran out " + sp28.all + " times in 4 weeks: " + sp28.em + " emergency buys, " + sp28.lost + " lost sales" });
  const w28 = wasteIn(set_, LAST - 27, LAST), byI = {};
  w28.forEach((x) => { byI[x[1]] = (byI[x[1]] || 0) + x[2]; });
  const top = Object.entries(byI).sort((x, y) => y[1] - x[1])[0], pu = purchaseValue(ids, LAST - 27, LAST);
  if (top) out.push({ tone: "warn", text: "Waste " + pct(pu ? sum(w28.map((x) => x[2])) / pu : 0, 1) + " of buys in 4 weeks, most from " + short(BYID[top[0]].name) });
  const bc = D.opt.budget_check;
  if (bc) out.push({ tone: bc.month_total_php > bc.monthly_budget_php ? "bad" : "good", text: (bc.month_total_php > bc.monthly_budget_php ? "Plan is over the monthly budget" : "Plan is within the monthly budget") + " (" + pct(bc.month_total_php / bc.monthly_budget_php, 0) + ")" });
  return out;
}

// The six numbers an owner reads first, as tiles
function tiles(F) {
  const ids = F.map((i) => i.id), set_ = new Set(ids), out = [];
  const net = (a, b) => sum(D.sales.filter((r) => r[0] >= a && r[0] <= b).map((r) => r[3]));
  const s28 = net(LAST - 27, LAST), p28 = net(LAST - 55, LAST - 28), g = p28 > 0 ? s28 / p28 - 1 : null;
  out.push({ value: kpeso(s28), label: "Sales, 4 weeks" + (g === null ? "" : " · " + (g >= 0 ? "▲ " : "▼ ") + Math.abs(g * 100).toFixed(1) + "%"), tone: g === null ? "" : g >= 0 ? "good" : "bad", tip: "Last 4 weeks against the 4 weeks before (" + kpeso(p28) + ")" });
  const risk = F.map((i) => ({ i, k: runOutDay(i.id, true) })).filter((o) => o.k >= 0).sort((x, y) => x.k - y.k);
  out.push({ value: String(risk.length), label: "Could run out", tone: risk.length ? "bad" : "good", tip: risk.slice(0, 6).map((o) => o.i.name).join(", ") });
  const w28 = sum(wasteIn(set_, LAST - 27, LAST).map((x) => x[2])), pu28 = purchaseValue(ids, LAST - 27, LAST);
  out.push({ value: kpeso(w28), label: "Waste, 4 weeks · " + pct(pu28 ? w28 / pu28 : 0, 1) + " of buys", tone: "warn" });
  const plan = D.opt.purchase_php || sum(D.plan.map((p) => p.cost));
  out.push({ value: kpeso(plan), label: "Plan, next 14 days" });
  const bc = D.opt.budget_check;
  if (bc) out.push({ value: pct(bc.month_total_php / bc.monthly_budget_php, 0), label: "Of the month's budget", tone: bc.month_total_php > bc.monthly_budget_php * 0.9 ? "warn" : "good", tip: peso(bc.month_total_php) + " of " + peso(bc.monthly_budget_php) });
  const use = sum(ids.map((id) => sum(D.series[id].use.slice(LAST - 27)) * BYID[id].cost)), staff = sum(ids.map((id) => sum(D.series[id].off.slice(LAST - 27)) * BYID[id].cost));
  if (use > 0) out.push({ value: pct(staff / use, 0), label: "Staff meals, of use", tip: peso(staff) + " in 4 weeks" });
  return out;
}

export function TodayPage({ F }) {
  const { S, set, goto } = useApp();
  const { wx: weather } = useWeather();
  const tips = buildRecommendations(F, weather).filter((r) => ["Smaller orders", "Weather", "Season"].includes(r.kind))
    .map((r) => ({ lvl: "tip", what: r.what, detail: r.action, page: r.page, patch: r.patch }));
  const items = [...attentionItems(F), ...tips];
  const ids = F.map((i) => i.id), set_ = new Set(ids);
  // what was bought and what was thrown away, over the period in the filters row
  const w = win(S), wks = bucketsFor(w.a, w.b, 14, S.agg), unit = bucketUnit(w.n, 14, S.agg), long = w.n > 800;
  const wx = wks.map((x) => x.label);
  const wBuy = wks.map((x) => purchaseValue(ids, x.a, x.b)), wWaste = wks.map((x) => sum(wasteIn(set_, x.a, x.b).map((z) => z[2])));
  // best sellers of the last 4 weeks, against the 4 weeks before
  const u1 = dishUnits(LAST - 27, LAST), u0 = dishUnits(LAST - 55, LAST - 28), byName = new Map();
  u1.forEach((q, id) => { if (!IT[id] || IT[id][1] < 0) return; const nm = cleanName(IT[id][0]), o = byName.get(nm) || { q: 0, p: 0 }; o.q += q; byName.set(nm, o); });
  u0.forEach((q, id) => { if (!IT[id]) return; const o = byName.get(cleanName(IT[id][0])); if (o) o.p += q; });
  const best = [...byName.entries()].sort((x, y) => y[1].q - x[1].q).slice(0, 8);
  const ins = insights(F), tk = tiles(F), wkBudget = wk(M.budget.Base), avgName = "average of the last 4 " + unit + "s";
  return (
    <>
      <div className="pb-head">
        <OpsKpis F={F} />
      </div>
      <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1.1fr) minmax(0, 1fr)" }}>
        <div className="panel c5">
          <div className="ph"><h2>Needs attention</h2><Chip cls={items.some((x) => x.lvl === "bad") ? "bad" : items.length ? "warn" : "good"}>{items.length ? [["bad", "act now"], ["warn", "watch"], ["tip", "tips"]].map(([l, w]) => [items.filter((x) => x.lvl === l).length, w]).filter((c) => c[0]).map((c) => c.join(" ")).join(" · ") : "All clear"}</Chip></div>
          {items.length ? (
            <ul className="attn">
              {items.map((x, k) => (
                <li key={k}>
                  <Chip cls={x.lvl === "tip" ? "good" : x.lvl}>{x.lvl === "bad" ? "Act now" : x.lvl === "tip" ? "Tip" : "Watch"}</Chip>
                  <div><b>{x.what}</b><span>{x.detail}</span></div>
                  {x.page && <button className="linkbtn" onClick={() => { if (x.patch) set(x.patch); goto(x.page); }}>Open</button>}
                </li>
              ))}
            </ul>
          ) : <div className="empty">Nothing needs attention today.</div>}
        </div>
        <div className="panel c4">
          <div className="ph"><h2>Key insights</h2></div>
          <ul className="insights">{ins.map((x, k) => <li key={k} className={x.tone}><i aria-label={INS_ICON[x.tone][1]}>{INS_ICON[x.tone][0]}</i>{x.text}</li>)}</ul>
        </div>
        <OrdersThisWeek F={F} />
        <div className="panel c6">
          <div className="ph"><h2>Spend per {unit}</h2>{long && <AggSeg S={S} set={set} />}</div>
          <ComboChart x={wx} h={200} yfmt={kpeso} bars={[{ vals: wBuy, color: "var(--accent)", name: "Bought", fmt: peso }]} refs={unit === "week" ? [{ y: wkBudget, label: "", color: "var(--bad)" }] : unit === "month" ? [{ y: M.budget.Base, label: "", color: "var(--bad)" }] : []} />
          {unit === "week" && <div className="legend"><span><i style={{ background: "var(--bad)" }} />Weekly budget {kpeso(wkBudget)} (each bar is one week)</span>{partNote(wks) && <span>{partNote(wks)}</span>}</div>}
          {unit === "month" && <div className="legend"><span><i style={{ background: "var(--bad)" }} />Monthly budget {kpeso(M.budget.Base)} (each bar is one month)</span>{partNote(wks) && <span>{partNote(wks)}</span>}</div>}
          {unit !== "week" && unit !== "month" && partNote(wks) && <div className="legend"><span>{partNote(wks)}</span></div>}
        </div>
        <div className="panel c6">
          <div className="ph"><h2>Waste per {unit}</h2>{long && <AggSeg S={S} set={set} />}<Info t={unit === "year" ? "Waste at standard cost." : "Waste at standard cost. The line averages each bar with the 3 before it."} /></div>
          <ComboChart x={wx} h={200} yfmt={kpeso} bars={[{ vals: wWaste, color: "#CC7A2E", name: "Waste", fmt: peso }]}
            lines={unit === "year" ? [] : [{ vals: wWaste.map((_, k) => (k < 3 ? null : sum(wWaste.slice(k - 3, k + 1)) / 4)), color: "#7C2D12", name: avgName, fmt: peso, w: 2.4, nodots: true }]} />
          <div className="legend"><span><i style={{ background: "#CC7A2E" }} />Waste</span>{unit !== "year" && <span><i style={{ background: "#7C2D12" }} />{avgName[0].toUpperCase() + avgName.slice(1)}</span>}{partNote(wks) && <span>{partNote(wks)}</span>}</div>
        </div>
      </div>
    </>
  );
}
