// Reports: ready-made reports for the owner, the kitchen and the suppliers. Pick one on the left to see its numbers, its chart and its table,
// and download it as a PDF (the chart and the whole table) or as a spreadsheet (CSV). Reports that cover a period follow the Period filter.
import { useRef } from "react";
import { D, LAST, BYID, ING, win, fd, fdAsOf, fiso, series, wasteIn, purchaseValue, firstArrival, staffPerDay, isWalkin, fcRange } from "../lib/model.js";
import { peso, kpeso, num, pct, qty, sum, packQty } from "../lib/format.js";
import { Info } from "../components/ui.jsx";
import { Icon } from "../components/Icons.jsx";
import { HBars, ComboChart, Donut, rankWithShare } from "../components/Charts.jsx";
import { useApp } from "../AppContext.js";
import { downloadCsv, copyText } from "../lib/actions.js";
import { supplierMessages } from "../lib/messages.js";
import { prepRows } from "./PrepPanel.jsx";
import { stockStatus, statusText, planAction } from "./InvPage.jsx";
import { confidence } from "./PredPage.jsx";

const stamp = () => new Date().toISOString().slice(0, 10);

// the report as a printable page (the browser's print dialog offers Save as PDF): title, the numbers, the chart and the whole table
function printReport(r, chartEl, dataDate, toast) {
  const area = document.getElementById("printarea");
  if (!area) return;
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const [head, ...body] = r.rows;
  area.innerHTML = `<h2>${esc(r.title)}</h2><p>Makisushi Japanese Restaurant · data as of ${esc(dataDate)}${r.period ? " · " + esc(r.period) : ""} · made ${esc(new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }))}</p>`
    + `<p><b>${r.facts.map(([l, v]) => esc(l) + ": " + esc(v)).join("  ·  ")}</b></p>`
    + `<h3>${esc(r.chartTitle)}</h3><div class="rep-chart">${chartEl && chartEl.lastElementChild ? chartEl.lastElementChild.outerHTML : ""}</div>`
    + (r.messages && r.messages.length ? `<h3>Messages for the suppliers</h3>${r.messages.map((m) => `<pre>${esc(m.text)}</pre>`).join("")}` : "")
    + `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body.map((x) => `<tr>${x.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  document.body.classList.add("printmode");
  try { window.print(); } catch (e) { toast("Printing is not available here."); }
  setTimeout(() => document.body.classList.remove("printmode"), 600);
}

function buildReports(F, S) {
  const w = win(S), ids = F.map((i) => i.id), set_ = new Set(ids), period = `${fd(w.a, true)} to ${fd(w.b, true)}`;
  const out = [];

  // 1. purchase orders
  {
    const lines = D.plan.filter((p) => set_.has(p.ing) && p.qty > 0).sort((a, b) => (BYID[a.ing].supname < BYID[b.ing].supname ? -1 : BYID[a.ing].supname > BYID[b.ing].supname ? 1 : a.week - b.week));
    const rows = [["Week", "Supplier", "Contact", "Ingredient", "Packs", "Pack size", "Quantity", "Unit", "Cost (PHP)", "Delivery", "How"],
      ...lines.map((p) => { const i = BYID[p.ing], a = firstArrival(p.ing, p.week); return [p.week, i.supname, isWalkin(i) ? "walk-in grocery" : i.contact, i.name, p.packs, packQty(i.pack, i.uom), Math.round(p.qty), i.uom, Math.round(p.cost), a ? fiso(a) + " " + a.slice(0, 4) : "", isWalkin(i) ? "buy in store" : "order from supplier"]; })];
    const by = {};
    lines.forEach((p) => { by[p.ing] = (by[p.ing] || 0) + p.cost; });
    const items = Object.entries(by).map(([id, v]) => [BYID[id].name, v, +id]).sort((a, b) => b[1] - a[1]).slice(0, 12);
    out.push({ id: "orders", title: "Purchasing plan", desc: "The next 14 days of orders by supplier, in whole packs, with cost and delivery date, and the message for each supplier.", rows, file: "purchasing_plan", messages: supplierMessages(F, 1),
      facts: [["Orders", num(lines.length)], ["Cost", peso(sum(lines.map((p) => p.cost)))], ["Suppliers", num(new Set(lines.map((p) => BYID[p.ing].sup)).size)]],
      chartTitle: "Purchase value by ingredient, next 14 days",
      chart: <HBars fill items={items} fmt={peso} axis={kpeso} label="Purchase value by ingredient" labelWidth={170} /> });
  }
  // 2. daily prep
  {
    const pr = prepRows(F);
    const rows = [["Ingredient", "Storage", "Needed", "For dishes", "For staff meals", "On hand", "Unit", "Buy packs", "Buy quantity", "Cost (PHP)", "Supplier"],
      ...pr.map((r) => [r.i.name, r.i.store, Math.round(r.total), Math.round(r.dishNeed), Math.round(r.staff), Math.round(r.on), r.i.uom, r.packs, Math.round(r.buyQty), Math.round(r.buyCost), r.i.supname])];
    const top = pr.slice().sort((a, b) => b.total * b.i.cost - a.total * a.i.cost).slice(0, 10);
    out.push({ id: "prep", title: "Daily prep list", desc: "What to thaw, prepare or buy for tomorrow: dishes plus staff meals, in whole packs.", rows, file: "daily_prep",
      facts: [["To buy", num(pr.filter((r) => r.short || r.fresh).length)], ["To thaw or prepare", num(pr.filter((r) => !r.short && !r.fresh).length)], ["Buy cost", peso(sum(pr.map((r) => r.buyCost)))]],
      chartTitle: "Needed tomorrow (bars) and on hand (tick), in pesos",
      chart: <HBars fill items={top.map((r) => [r.i.name, r.total * r.i.cost, r.i.id])} fmt={peso} axis={kpeso} label="Needed tomorrow" labelWidth={170}
        marks={[{ vals: top.map((r) => Math.min(r.on * r.i.cost, Math.max(...top.map((x) => x.total * x.i.cost)) * 1.2)), color: "var(--bad)", name: "On hand" }]} /> });
  }
  // 3. waste and expiry
  {
    const W = wasteIn(set_, w.a, w.b), isExp = (x) => D.reasons[x[4]] && /expir/i.test(D.reasons[x[4]]);
    const rows = [["Ingredient", "Waste (PHP)", "Spoilage (PHP)", "Expiry (PHP)", "Bought (PHP)", "Waste share of purchases"]];
    F.forEach((i) => {
      const mine = W.filter((x) => x[1] === i.id), t = sum(mine.map((x) => x[2])), ex = sum(mine.filter(isExp).map((x) => x[2])), pu = purchaseValue([i.id], w.a, w.b);
      if (t > 0) rows.push([i.name, Math.round(t), Math.round(t - ex), Math.round(ex), Math.round(pu), pu ? Math.round(t / pu * 1000) / 10 + "%" : ""]);
    });
    const body = rows.slice(1).sort((a, b) => b[1] - a[1]);
    const exp = sum(W.filter(isExp).map((x) => x[2])), tot = sum(W.map((x) => x[2]));
    const rk = rankWithShare(body.slice(0, 10).map((r) => [r[0], r[1]]), sum(body.map((r) => r[1])));
    out.push({ id: "waste", title: "Waste and expiry", desc: "Waste by ingredient for the period, with spoilage and expiry kept apart.", rows: [rows[0], ...body], file: "waste_expiry", period,
      facts: [["Waste", peso(tot)], ["Spoilage", peso(tot - exp)], ["Expiry", peso(exp)]],
      chartTitle: "Waste by ingredient",
      chart: body.length ? <HBars fill items={rk.items} notes={rk.notes} fmt={peso} axis={kpeso} label="Waste by ingredient" labelWidth={170} /> : <div className="empty">No waste recorded in this period.</div> });
  }
  // 4. stock status
  {
    const st = F.map((i) => ({ i, st: stockStatus(i) }));
    const rows = [["Ingredient", "On hand", "Unit", "Value (PHP)", "Lasts about (days)", "Order when below", "Target stock", "Status", "This week's plan"],
      ...st.map(({ i, st: s }) => [i.name, Math.round(s.close), i.uom, Math.round(s.close * i.cost), s.d >= 99 ? "" : Math.round(s.d), Math.round(s.below), Math.round(s.par), statusText(s), planAction(i)])];
    const least = st.slice().sort((a, b) => a.st.d - b.st.d).slice(0, 12);
    out.push({ id: "stock", title: "Stock status", desc: "Every ingredient: stock on hand, how long it lasts, order level, target and status.", rows, file: "stock_status",
      facts: [["Flagged", num(st.filter(({ st: s }) => s.r !== "good" || s.over).length)], ["Stock value", peso(sum(st.map(({ i, st: s }) => s.close * i.cost)))], ["Ingredients", num(st.length)]],
      chartTitle: "Days of stock on hand, least first",
      chart: <HBars fill items={least.map(({ i, st: s }) => [i.name, Math.min(s.d, 30), i.id])} fmt={(v) => (v >= 30 ? "30+ days" : (Math.round(v * 10) / 10) + " days")} axis={(v) => num(v) + " d"} label="Days of stock" labelWidth={170} /> });
  }
  // 5. sales summary
  {
    const inW = (a, b) => D.sales.filter((r) => r[0] >= a && r[0] <= b);
    const cur = inW(w.a, w.b), prev = w.pb >= 0 && w.pa <= w.pb ? inW(w.pa, w.pb) : [];
    const by = (rows) => { const o = {}; rows.forEach((r) => { const c = (o[r[1]] ||= { n: 0, q: 0 }); c.n += r[3]; c.q += r[4]; }); return o; };
    const a = by(cur), b = by(prev), tot = sum(Object.values(a).map((x) => x.n));
    const keys = Object.keys(a).map(Number).sort((x, y) => a[y].n - a[x].n);
    const rows = [["Menu category", "Net sales (PHP)", "Items sold", "Share of sales", "Change on the period before"],
      ...keys.map((k) => [D.cats[k], Math.round(a[k].n), a[k].q, tot ? Math.round(a[k].n / tot * 1000) / 10 + "%" : "", b[k] && b[k].n > 0 ? Math.round((a[k].n / b[k].n - 1) * 1000) / 10 + "%" : ""])];
    const pn = sum(Object.values(b).map((x) => x.n));
    out.push({ id: "sales", title: "Sales summary", desc: "Net sales and items sold by menu category for the period, against the period before.", rows, file: "sales_summary", period,
      facts: [["Net sales", peso(tot)], ["Items sold", num(sum(Object.values(a).map((x) => x.q)))], ["Change", pn > 0 ? (tot >= pn ? "+" : "−") + Math.abs((tot / pn - 1) * 100).toFixed(1) + "%" : "–"]],
      chartTitle: "Net sales by menu category",
      chart: keys.length ? <HBars fill items={keys.slice(0, 10).map((k) => [D.cats[k], a[k].n])} fmt={peso} axis={kpeso} label="Net sales by category" labelWidth={170}
        notes={keys.slice(0, 10).map((k) => (b[k] && b[k].n > 0 ? (a[k].n >= b[k].n ? "▲ " : "▼ ") + Math.abs(Math.round((a[k].n / b[k].n - 1) * 100)) + "%" : ""))} /> : <div className="empty">No sales in this period.</div> });
  }
  // 6. forecast
  {
    const n14 = Math.min(14, D.fdates.length);
    const rows = [["Ingredient", "Unit", "Next 7 days", "Next 14 days", "Likely range, low", "Likely range, high", "Trust"],
      ...F.map((i) => { const f = D.fcRaw[i.id], t = sum(f.y.slice(0, n14)), g = fcRange([i.id], 14); return [i.name, i.uom, Math.round(sum(f.y.slice(0, 7))), Math.round(t), g ? Math.round(t * g.lo) : "", g ? Math.round(t * g.hi) : "", confidence(i.id).label]; })];
    const day = (key, k) => sum(F.map((i) => D.fcRaw[i.id][key][k] * i.cost));
    const x = D.fdates.slice(0, n14).map(fiso);
    out.push({ id: "forecast", title: "Forecast, next 14 days", desc: "Expected use of each ingredient, the likely range and how far to trust it.", rows, file: "forecast_14_days",
      facts: (() => { const ids = F.map((i) => i.id), t7 = sum(F.map((i) => sum(D.fcRaw[i.id].y.slice(0, 7)) * i.cost)), t14 = sum(F.map((i) => sum(D.fcRaw[i.id].y.slice(0, n14)) * i.cost)), g7 = fcRange(ids, 7), g14 = fcRange(ids, 14), rr = (v, g) => (g ? " (likely " + peso(Math.round(v * g.lo / 100) * 100) + "–" + peso(Math.round(v * g.hi / 100) * 100) + ")" : "");
        return [["Next 7 days", peso(t7) + rr(t7, g7)], ["Next 14 days", peso(t14) + rr(t14, g14)], ["Window", `${fiso(D.fdates[0])} to ${fiso(D.fdates[n14 - 1])}`]]; })(),
      chartTitle: "Expected use per day, in pesos, with the range it fell in on 8 of 10 days over the past year",
      chart: (() => { const g1 = fcRange(F.map((i) => i.id), 1), y = x.map((_, k) => day("y", k)); return <ComboChart x={x} h={240} yfmt={kpeso} lines={[{ vals: y, lo: y.map((v, k) => (g1 ? v * g1.lo : day("lo", k))), hi: y.map((v, k) => (g1 ? v * g1.hi : day("hi", k))), color: "var(--warn)", name: "Forecast", fmt: peso }]} />; })() });
  }
  // 7. ingredient use and staff meals
  {
    const rows = [["Ingredient", "Unit", "Used in the period", "Staff meals and other use outside the menu", "Share", "Value of use (PHP)"]];
    const rec = [];
    F.forEach((i) => {
      let u = 0, o = 0;
      for (let d = w.a; d <= w.b; d++) { u += series(i.id).use[d] || 0; o += series(i.id).off[d] || 0; }
      rows.push([i.name, i.uom, Math.round(u), Math.round(o), u ? Math.round(o / u * 1000) / 10 + "%" : "", Math.round(u * i.cost)]);
      rec.push({ i, u, o });
    });
    const body = rows.slice(1).sort((a, b) => b[5] - a[5]);
    const tu = sum(rec.map((r) => r.u * r.i.cost)), to = sum(rec.map((r) => r.o * r.i.cost));
    const top = rec.filter((r) => r.o > 0).sort((a, b) => b.o * b.i.cost - a.o * a.i.cost).slice(0, 10);
    out.push({ id: "use", title: "Ingredient use and staff meals", desc: "What the kitchen used in the period, and how much of it was staff meals and other use outside the menu.", rows: [rows[0], ...body], file: "ingredient_use", period,
      facts: [["Used", peso(tu)], ["Staff meals", peso(to)], ["Share", pct(tu ? to / tu : 0, 1)]],
      chartTitle: "Staff meals and other use outside the menu, by ingredient",
      chart: top.length ? <HBars fill items={top.map((r) => [r.i.name, r.o * r.i.cost, r.i.id])} fmt={peso} axis={kpeso} label="Staff meals by ingredient" labelWidth={170} color="#F59E0B"
        notes={top.map((r) => pct(r.u ? r.o / r.u : 0, 0) + " of its use")} /> : <div className="empty">No use outside the menu in this period.</div> });
  }
  // 8. price list
  {
    const list = ING.filter((i) => set_.has(i.id)).sort((a, b) => (a.supname < b.supname ? -1 : a.supname > b.supname ? 1 : a.name < b.name ? -1 : 1));
    const rows = [["Supplier", "Contact", "Ingredient", "Pack", "Price per pack (PHP)", "Minimum order (packs)", "Delivery"],
      ...list.map((i) => [i.supname, isWalkin(i) ? "walk-in grocery" : i.contact, i.name, packQty(i.pack, i.uom), Math.round(i.cost * i.pack * 100) / 100, i.minpacks, isWalkin(i) ? "walk-in" : i.lead === 0 ? "same day" : i.lead + " day" + (i.lead === 1 ? "" : "s") + " after ordering"])];
    const bySup = {};
    list.forEach((i) => { bySup[i.supname] = (bySup[i.supname] || 0) + 1; });
    out.push({ id: "prices", title: "Supplier price list", desc: "Each supplier's items, pack sizes, prices and minimum orders.", rows, file: "supplier_prices",
      facts: [["Suppliers", num(Object.keys(bySup).length)], ["Items", num(list.length)], ["Minimum order", "1 pack"]],
      chartTitle: "Items by supplier",
      chart: <Donut items={Object.entries(bySup).sort((x, y) => y[1] - x[1])} size="auto" center={String(list.length)} sub="items" fmt={num} label="Items by supplier" /> });
  }
  return out;
}

export function ReportsPage({ F }) {
  const { S, set, toast } = useApp();
  const chartRef = useRef(null);
  const reports = buildReports(F, S);
  const r = reports.find((x) => x.id === S.report) || reports[0];
  const asof = fdAsOf(LAST);
  return (
    <div className="grid canvas" style={{ gridTemplateRows: "auto minmax(0, 1.25fr) minmax(0, 1fr)" }}>
      <div className="panel c3 r3 replist">
        <div className="ph"><h2>Reports</h2></div>
        {reports.map((x) => (
          <button key={x.id} type="button" className="rep-item" aria-pressed={x.id === r.id} onClick={() => set({ report: x.id })}>
            <Icon name="reports" size={18} /><span><b>{x.title}</b><small>{x.period ? "Period filter" : "Today"} · {num(x.rows.length - 1)} rows</small></span>
          </button>
        ))}
      </div>
      <div className="panel c9">
        <div className="ph">
          <h2>{r.title}</h2>{r.period && <Info t={"Covers " + r.period + "."} />}
          <div className="rep-actions noprint">
            <button className="btn pri" type="button" onClick={() => printReport(r, chartRef.current, asof, toast)}>Download PDF</button>
            {r.messages && r.messages.length ? <button className="btn" type="button" onClick={() => copyText(r.messages.map((m) => m.text).join("\n\n"), false, toast)}>Copy supplier messages</button> : null}
            <button className="btn" type="button" onClick={() => downloadCsv(`makisushi_${r.file}_${stamp()}.csv`, r.rows, toast)}>Download CSV</button>
          </div>
        </div>
        <p className="rep-d">{r.desc} <span className="chip flat" data-t={"Data as of " + asof + (r.period ? ", " + r.period : "")}>Made {new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span></p>
        <dl className="rep-f">{r.facts.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
      </div>
      <div className="panel c9" ref={chartRef}>
        <div className="ph"><h2>{r.chartTitle}</h2></div>
        {r.chart}
      </div>
      <div className="panel c9">
        <div className="ph"><h2>The report</h2><span className="note-inline">first {Math.min(10, r.rows.length - 1)} of {num(r.rows.length - 1)} rows · all in the download</span></div>
        <div className="tablewrap">
          <table>
            <thead><tr>{r.rows[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{r.rows.slice(1, 11).map((row, k) => <tr key={k}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
