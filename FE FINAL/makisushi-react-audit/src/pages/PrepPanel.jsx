// Daily prep: what to thaw, prepare or top up for tomorrow. A cover chart (stock against need) and a short table; the detail
// (supplier, pack, minimum order, dishes and staff meals) is in the hover on each line.
import { D, LAST, series, dishUnits, staffPerDay, forecastHasStaff, isWalkin, planRow, batchesOf, fd } from "../lib/model.js";
import { peso, num, qty, pct, sum, packQty } from "../lib/format.js";
import { Kpi, Kpis, Chip, Info } from "../components/ui.jsx";
import { HBars } from "../components/Charts.jsx";
import { cleanName } from "../lib/upload.js";

// plates of a dish that an amount of the ingredient makes (the recipe amount, after trimming and yield)
const plateUse = (id, d) => d.q / ((D.upload.prof[id] && D.upload.prof[id].y) || 1);

// Staff meals are shown only when they are a real part of the need (5% or more); a few grams a day is noise in the records, not a meal.
const STAFF_MIN = 0.05;
// Promotion rule: some of the stock on hand will expire before the forecast uses it (batches used oldest first), and that stock is worth
// at least this much, so selling more of a dish that uses the ingredient saves it from being thrown out.
const PROMO_MIN_PESOS = 50;
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
    // stock that will expire before it is used: the batches on hand, oldest expiry first, used day by day at the forecast (first in, first out)
    const fy = D.fc[i.id].y, mu14 = fy.length ? sum(fy.slice(0, 14)) / Math.min(14, fy.length) : 0;
    const daily = (k) => (k < fy.length ? fy[k] : mu14) + (hasStaff ? 0 : staff);
    const bs = batchesOf(i.id).map((b) => ({ exp: b[4], q: b[2] }));
    let atRisk = 0, riskBy = null;
    const lastExp = bs.length ? Math.max(...bs.map((b) => b.exp)) : LAST;
    for (let day = LAST + 1, k = 0; day <= lastExp + 1; day++, k++) {
      bs.forEach((b) => { if (b.q > 0 && b.exp < day) { atRisk += b.q; riskBy = riskBy === null ? b.exp : Math.min(riskBy, b.exp); b.q = 0; } });
      let u = daily(k);
      for (const b of bs) { if (u <= 0) break; if (b.q > 0 && b.exp >= day) { const t = Math.min(b.q, u); b.q -= t; u -= t; } }
    }
    const extra = atRisk * i.cost, stockV = series(i.id).close[LAST] * i.cost;
    // the dish to promote is the one that uses this ingredient with the best margin per plate among those that are selling
    const best = list.filter((d) => d.u > 0).map((d) => ({ d, margin: d.price - (D.icost[d.id] || 0) })).sort((a, b) => b.margin - a.margin)[0];
    const promo = !!best && extra >= PROMO_MIN_PESOS && stockV > 0;
    const plates = promo ? Math.ceil(atRisk / plateUse(i.id, best.d)) : 0;
    // the buy, in whole packs of at least the minimum order
    const short = Math.max(0, total - on);
    const buyNeed = fresh ? total : short;
    const packs = buyNeed > 0 ? Math.max(i.minpacks || 1, Math.ceil(buyNeed / i.pack - 1e-9)) : 0;
    return { i, total, dishNeed, staff: hasStaff ? Math.min(staff, f0) : staff, on, fresh, short: short > 0, packs, buyQty: packs * i.pack, buyCost: packs * i.pack * i.cost,
      top, trend, extra, extraShare: stockV > 0 ? extra / stockV : 0, push: best, promo, plates, riskBy, noDish: list.length === 0 || w1 === 0 };
  }).filter((r) => r.total > 0).sort((a, b) => (b.short || b.fresh) - (a.short || a.fresh) || b.total * b.i.cost - a.total * a.i.cost);
}

// what to do today for one ingredient: a short label and amount
function todo(r) {
  const { i } = r, packs = `${r.packs} ${r.packs === 1 ? "pack" : "packs"}`;
  if (r.fresh) return { kind: "Buy", cls: "warn", text: `${packs} · ${peso(r.buyCost)}` };
  if (r.short) return { kind: isWalkin(i) ? "Top up" : "Order", cls: "bad", text: `${packs} · ${peso(r.buyCost)}` };
  // enough stock on hand for tomorrow: a frozen ingredient only has to be moved from the freezer to the chiller tonight
  // so that tomorrow's forecast use is ready to cook; a chilled one only has to be prepared
  const amt = qty(nice(r.total, i.uom, true), i.uom);
  return i.store === "frozen"
    ? { kind: "Thaw", cls: "flat", text: `${amt} tonight`, why: `Frozen, and the stock on hand (${qty(nice(r.on, i.uom), i.uom)}) covers tomorrow's forecast use (${amt}), so nothing has to be bought: move ${amt} from the freezer to the chiller tonight so it is ready to cook tomorrow.` }
    : { kind: "Prep", cls: "good", text: amt, why: `Chilled, and the stock on hand covers tomorrow's forecast use (${amt}): prepare it, nothing to buy.` };
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
      <Kpi label="To thaw or prep" value={String(thaw.length)} icon="snow" delta={<span>{thaw.filter((r) => r.i.store === "frozen").length} frozen, {thaw.filter((r) => r.i.store !== "frozen").length} chilled</span>} />
      <Kpi act={{ page: "buy", tab: "plan", patch: { week: 1 }, hint: "This week" }} label="To buy today" value={String(buys.length)} icon="cart" delta={<span>{peso(sum(buys.map((r) => r.buyCost)))} in whole packs, never below the minimum order</span>} />
      <Kpi label="Staff meals" value={pct(totV ? staffV / totV : 0, 0)} icon="user" delta={<span>{peso(staffV)} of tomorrow's need</span>} />
      <Kpi act={{ page: "inv", tab: "status", hint: "Expiry dates" }} label="Dishes to promote" value={String(pushes.length)} icon="tag" delta={<span>stock that would expire unused</span>} />
    </Kpis>
  );
}

export function PrepTable({ F }) {
  const rows = prepRows(F);
  // how much of tomorrow's need the stock on hand covers: at most 100%; covered with little to spare (under 1.5 times the need) is marked
  const cover = rows.map((r) => ({ r, x: r.total > 0 ? r.on / r.total : 9 })).sort((a, b) => a.x - b.x).slice(0, 12);
  const covState = (x) => (x < 1 ? ["buy", "var(--bad)"] : x < 1.5 ? ["tight", "#D97706"] : ["OK", "var(--accent)"]);
  return (
    <>
      <div className="panel c5">
        <div className="ph"><h2>Stock cover for tomorrow</h2><Info t="Share of tomorrow's need the stock covers. Under 100%: buy before tomorrow." /></div>
        <HBars fill max={100} notes={cover.map(({ x }) => covState(x)[0])} items={cover.map(({ r, x }) => [r.i.name, Math.min(100, x * 100), r.i.id, covState(x)[1]])}
          fmt={(v) => Math.round(v) + "%"} axis={(v) => v + "%"} label="Share of tomorrow's need covered by stock" labelWidth={140} />
        <div className="legend"><span><i style={{ background: "var(--bad)" }} />Under 100%: buy</span><span><i style={{ background: "#D97706" }} />Covered, tight</span><span><i style={{ background: "var(--accent)" }} />Covered</span></div>
      </div>
      <div className="panel c7">
        <div className="ph"><h2>Tomorrow, {rows.filter((r) => r.short || r.fresh).length} to buy</h2></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Ingredient</th><th className="n">Needed</th><th className="n">On hand</th><th data-t="Order or Top up: stock is short for tomorrow. Buy: fresh each day. Thaw: move it to the chiller tonight. Prep: covered.">Do</th><th data-t="The dish that uses most of it: units sold in the last 4 weeks, and the 4 weeks before.">Main dish</th><th data-t="Selling less or more: 15% change on the 4 weeks before. Promote: some will expire unused, so push the dish.">Signal</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((r) => {
                const a = todo(r), c = dishCheck(r), t = r.top[0];
                const staffTxt = r.staff > 0 ? ` · dishes ${qty(nice(r.dishNeed, r.i.uom, true), r.i.uom)} + staff meals ${qty(nice(r.staff, r.i.uom, true), r.i.uom)}` : "";
                const promoTxt = c.push && r.push ? ` · promote ${cleanName(r.push.d.name)}: ${peso(r.extra)} of ${r.i.name} (${Math.round(r.extraShare * 100)}% of the stock) will not be used before it expires; best margin ${peso(r.push.margin)} a plate` : "";
                const tip = `${r.i.supname} · pack ${packQty(r.i.pack, r.i.uom)} · minimum ${r.i.minpacks || 1} ${(r.i.minpacks || 1) === 1 ? "pack" : "packs"}${staffTxt}${promoTxt}`;
                return (
                  <tr key={r.i.id} data-t={tip}>
                    <td><b>{r.i.name}</b></td>
                    <td className="n" data-t={`Most likely ${qty(nice(r.total, r.i.uom, true), r.i.uom)} tomorrow; in 8 of 10 days between ${qty(nice(Math.max(0, D.fc[r.i.id].lo[0]) + (forecastHasStaff(r.i.id) ? 0 : r.staff), r.i.uom, false), r.i.uom)} and ${qty(nice(D.fc[r.i.id].hi[0] + (forecastHasStaff(r.i.id) ? 0 : r.staff), r.i.uom, true), r.i.uom)} (the forecast's 80% interval)`}>{qty(nice(r.total, r.i.uom, true), r.i.uom)}</td>
                    <td className="n">{qty(nice(r.on, r.i.uom, false), r.i.uom)}</td>
                    <td style={{ whiteSpace: "nowrap" }} data-t={a.why}><Chip cls={a.cls}>{a.kind}</Chip> {a.text}</td>
                    <td>{(() => { const d = c.push && r.push ? { name: cleanName(r.push.d.name), u: r.push.d.u, p: r.push.d.p } : t; return d ? <><b>{d.name}</b><small>{num(d.u)} sold{d.p >= 10 ? " · was " + num(d.p) : ""}</small></> : <span className="t-flat">staff meals only</span>; })()}</td>
                    <td className="sig">{c.push && r.push
                      ? <span data-t={`${peso(r.extra)} of ${r.i.name} would expire by ${fd(r.riskBy)} before it is used. Sell about ${r.plates} more ${r.plates === 1 ? "plate" : "plates"} of ${cleanName(r.push.d.name)} (margin ${peso(r.push.margin)} a plate): make it the day's special, have the counter recommend it, pair it with a drink as a combo, or give a small discount (up to 10%) that keeps the margin.`}><Chip cls="warn">Promote</Chip><small>{peso(r.extra)} by {fd(r.riskBy)}</small></span>
                      : c.cls === "t-bad" ? <Chip cls="bad">▼ Selling less</Chip> : c.cls === "t-good" ? <Chip cls="good">▲ Selling more</Chip> : <span className="t-flat">–</span>}</td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="empty">Nothing to prepare.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
