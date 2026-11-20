// Daily prep: what to thaw, prepare or top up for tomorrow. A cover chart (stock against need) and a short table; the detail
// (supplier, pack, minimum order, dishes and staff meals) is in the hover on each line.
import { D, LAST, series, dishUnits, staffPerDay, forecastHasStaff, isWalkin, planRow } from "../lib/model.js";
import { peso, num, qty, pct, sum } from "../lib/format.js";
import { Kpi, Kpis, Chip } from "../components/ui.jsx";
import { HBars } from "../components/Charts.jsx";
import { cleanName } from "../lib/upload.js";

// plates of a dish that an amount of the ingredient makes (the recipe amount, after trimming and yield)
const plateUse = (id, d) => d.q / ((D.upload.prof[id] && D.upload.prof[id].y) || 1);

// Staff meals are shown only when they are a real part of the need (5% or more); a few grams a day is noise in the records, not a meal.
const STAFF_MIN = 0.05;
// Promotion rule: the stock on hand is more than the forecast will use before it expires (or in 14 days), the surplus is at least this much
// in pesos and at least this share of the stock, so the dish that uses the ingredient is worth promoting.
const PROMO_MIN_PESOS = 300, PROMO_MIN_SHARE = 0.3;
// whole pieces, and grams in steps of 5 (under 100 g), 10 (under 1 kg) or 100 g; up for an amount to prepare, down for stock counted
export function nice(v, uom, up) {
  if (!(v > 0)) return 0;
  if (uom === "pc") return up ? Math.ceil(v - 1e-9) : Math.floor(v + 1e-9);
  const step = v < 100 ? 5 : v < 1000 ? 10 : 100;
  return (up ? Math.ceil(v / step - 1e-9) : Math.floor(v / step + 1e-9)) * step;
}

export function prepRows(F) {
  const u1 = dishUnits(LAST - 27, LAST), u0 = dishUnits(LAST - 55, LAST - 28);
  return F.map((i) => {
    const f0 = D.fc[i.id].y[0] || 0, staffRaw = staffPerDay(i.id);
    const hasStaff = forecastHasStaff(i.id);
    const staff = staffRaw / (hasStaff ? f0 || 1 : f0 + staffRaw || 1) >= STAFF_MIN ? staffRaw : 0;
    const dishNeed = hasStaff ? Math.max(0, f0 - staff) : f0, total = hasStaff ? f0 : f0 + staff;
    const on = Math.max(0, series(i.id).close[LAST]);
    const p1 = planRow(i.id, 1), fresh = !!(p1 && p1.rule === "daily market buy");
    // the dishes this ingredient is used in: how much of it each one takes (by units sold in the last 4 weeks), and how they are selling
    const list = (D.dishes[i.id] || []).map((d) => ({ ...d, u: u1.get(d.id) || 0, p: u0.get(d.id) || 0 }));
    const weight = (d) => d.u * d.q, w1 = sum(list.map(weight)), w0 = sum(list.map((d) => d.p * d.q));
    const top = list.filter((d) => d.u > 0).sort((a, b) => weight(b) - weight(a)).slice(0, 3)
      .map((d) => ({ name: cleanName(d.name), share: w1 ? weight(d) / w1 : 0, plates: w1 ? (dishNeed * (weight(d) / w1)) / plateUse(i.id, d) : 0, trend: d.p >= 10 ? Math.max(-1, Math.min(1, d.u / d.p - 1)) : null, u: d.u, p: d.p }));
    const priorUnits = sum(list.map((d) => d.p));
    const trend = priorUnits >= 10 && w0 > 0 ? Math.max(-1, Math.min(1, w1 / w0 - 1)) : null;
    // stock that the forecast will not use before it spoils
    const horizon = Math.min(i.shelf, 14, D.fdates.length);
    const useAhead = sum(D.fc[i.id].y.slice(0, horizon)) + staff * horizon * (hasStaff ? 0 : 1);
    const extra = Math.max(0, series(i.id).close[LAST] - useAhead) * i.cost, stockV = series(i.id).close[LAST] * i.cost;
    // the dish to promote is the one that uses this ingredient with the best margin per plate among those that are selling
    const best = list.filter((d) => d.u > 0).map((d) => ({ d, margin: d.price - (D.icost[d.id] || 0) })).sort((a, b) => b.margin - a.margin)[0];
    const promo = !!best && extra >= PROMO_MIN_PESOS && stockV > 0 && extra / stockV >= PROMO_MIN_SHARE;
    // the buy, in whole packs of at least the minimum order
    const short = Math.max(0, total - on);
    const buyNeed = fresh ? total : short;
    const packs = buyNeed > 0 ? Math.max(i.minpacks || 1, Math.ceil(buyNeed / i.pack - 1e-9)) : 0;
    return { i, total, dishNeed, staff: hasStaff ? Math.min(staff, f0) : staff, on, fresh, short: short > 0, packs, buyQty: packs * i.pack, buyCost: packs * i.pack * i.cost,
      top, trend, extra, extraShare: stockV > 0 ? extra / stockV : 0, push: best, promo, noDish: list.length === 0 || w1 === 0 };
  }).filter((r) => r.total > 0).sort((a, b) => (b.short || b.fresh) - (a.short || a.fresh) || b.total * b.i.cost - a.total * a.i.cost);
}

// what to do today for one ingredient: a short label and amount
function todo(r) {
  const { i } = r, packs = `${r.packs} ${r.packs === 1 ? "pack" : "packs"}`;
  if (r.fresh) return { kind: "Buy", cls: "warn", text: `${packs} · ${peso(r.buyCost)}` };
  if (r.short) return { kind: isWalkin(i) ? "Top up" : "Order", cls: "bad", text: `${packs} · ${peso(r.buyCost)}` };
  return i.store === "frozen" ? { kind: "Thaw", cls: "flat", text: "" } : { kind: "Prep", cls: "good", text: "" };
}

// is the dish selling, and does it need a push?
function dishCheck(r) {
  if (r.noDish) return { arrow: "", cls: "flat", push: false, txt: "no dish" };
  const t0 = r.top[0] ? r.top[0].trend : null, tr = t0 === null ? null : t0;
  const dishUp = tr !== null && tr >= 0.15, dishDown = tr !== null && tr <= -0.15;
  return { arrow: tr === null ? "" : dishDown ? "▼" : dishUp ? "▲" : "▬", cls: dishDown ? "t-bad" : dishUp ? "t-good" : "t-flat", push: r.promo, txt: tr === null ? "" : Math.abs(Math.round(tr * 100)) + "%" };
}

export function PrepKpis({ F }) {
  const rows = prepRows(F);
  const buys = rows.filter((r) => r.short || r.fresh), thaw = rows.filter((r) => !r.short && !r.fresh);
  const staffV = sum(rows.map((r) => r.staff * r.i.cost)), totV = sum(rows.map((r) => r.total * r.i.cost));
  const pushes = rows.filter((r) => dishCheck(r).push);
  return (
    <Kpis>
      <Kpi label="To thaw or prep" value={String(thaw.length)} icon="check" delta={<span>{thaw.filter((r) => r.i.store === "frozen").length} frozen, {thaw.filter((r) => r.i.store !== "frozen").length} chilled</span>} />
      <Kpi label="To buy today" value={String(buys.length)} icon="cart" delta={<span>{peso(sum(buys.map((r) => r.buyCost)))} in whole packs, never below the minimum order</span>} />
      <Kpi label="Staff meals" value={pct(totV ? staffV / totV : 0, 0)} icon="user" delta={<span>{peso(staffV)} of tomorrow's need</span>} />
      <Kpi label="Dishes to promote" value={String(pushes.length)} icon="tag" delta={<span>use up extra stock before it expires</span>} />
    </Kpis>
  );
}

export function PrepTable({ F }) {
  const rows = prepRows(F);
  const cover = rows.map((r) => ({ r, c: r.total > 0 ? (r.on / r.total) * 100 : 400 })).sort((a, b) => a.c - b.c).slice(0, 12);
  return (
    <>
      <div className="panel c5">
        <div className="ph"><h2>Lowest stock cover for tomorrow</h2></div>
        <HBars fill max={400} items={cover.map(({ r, c }) => [r.i.name, Math.min(c, 400), r.i.id, c < 100 ? "var(--bad)" : c < 200 ? "#F59E0B" : "var(--accent)"])}
          fmt={(v) => (v >= 400 ? "400%+" : Math.round(v) + "%")} axis={(v) => v + "%"} label="Stock on hand as a share of tomorrow's need" labelWidth={140} />
        <div className="legend"><span><i style={{ background: "var(--bad)" }} />Under 100%: buy</span><span><i style={{ background: "#F59E0B" }} />100-200%</span><span><i style={{ background: "var(--accent)" }} />Over 200%</span></div>
      </div>
      <div className="panel c7">
        <div className="ph"><h2>Tomorrow, {rows.filter((r) => r.short || r.fresh).length} to buy</h2></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Ingredient</th><th className="n">Needed</th><th className="n">On hand</th><th>Do</th><th data-t="The dish that uses most of the ingredient, with the units sold in the last 4 weeks against the 4 weeks before. Selling less or more is a change of 15% or more. Promote: the stock is more than the forecast will use before it expires, so the dish that uses it with the best margin is promoted.">Dish and its sales</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((r) => {
                const a = todo(r), c = dishCheck(r), t = r.top[0];
                const staffTxt = r.staff > 0 ? ` · dishes ${qty(nice(r.dishNeed, r.i.uom, true), r.i.uom)} + staff meals ${qty(nice(r.staff, r.i.uom, true), r.i.uom)}` : "";
                const promoTxt = c.push && r.push ? ` · promote ${cleanName(r.push.d.name)}: ${peso(r.extra)} of ${r.i.name} (${Math.round(r.extraShare * 100)}% of the stock) will not be used before it expires; best margin ${peso(r.push.margin)} a plate` : "";
                const tip = `${r.i.supname} · pack ${qty(r.i.pack, r.i.uom)} · minimum ${r.i.minpacks || 1} ${(r.i.minpacks || 1) === 1 ? "pack" : "packs"}${staffTxt}${promoTxt}`;
                return (
                  <tr key={r.i.id} data-t={tip}>
                    <td><b>{r.i.name}</b></td>
                    <td className="n">{qty(nice(r.total, r.i.uom, true), r.i.uom)}</td>
                    <td className="n">{qty(nice(r.on, r.i.uom, false), r.i.uom)}</td>
                    <td style={{ whiteSpace: "nowrap" }}><Chip cls={a.cls}>{a.kind}</Chip> {a.text}</td>
                    <td>{c.push && r.push ? <><Chip cls="warn">Promote</Chip> <b>{cleanName(r.push.d.name)}</b><small>{peso(r.extra)} of {r.i.name} will not be used before it expires</small></> : t ? <><b>{t.name}</b><small>{num(t.u)} sold in 4 weeks{t.p >= 10 ? " (was " + num(t.p) + ")" : ""}{c.cls === "t-bad" ? <> <Chip cls="bad">Selling less</Chip></> : c.cls === "t-good" ? <> <Chip cls="good">Selling more</Chip></> : null}</small></> : <span className="t-flat">staff meals only</span>}</td>
                  </tr>
                );
              }) : <tr><td colSpan={5} className="empty">Nothing to prepare.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
