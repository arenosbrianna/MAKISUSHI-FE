// The prescriptive recommendations: what to do about the stock and the plan, in words.
// Each one names the ingredient, the action and the reason. Holding back overstock,
// topping up before a run-out, smaller orders for the ingredients that lose the most to waste, limiting slow movers, and
// weather and season advice from the measured effect on sales (mango shakes and juice, drinks).
import { D, LAST, BYID, IS, series, planRow, wasteIn, purchaseValue, fiso } from "../lib/model.js";
import { peso, qty, pct, sum, daysTxt } from "../lib/format.js";
import { stockStatus } from "./InvPage.jsx";
import { seasonImpact, HOT_DAY, seasonOfIso, nextSeason } from "../lib/seasons.js";

// kind -> chip colour
export const KIND_CLS = { "Order now": "bad", "Top up": "warn", "Hold back": "flat", "Smaller orders": "flat", "Limit orders": "flat", Weather: "good", Season: "flat" };
const ORDER = ["Order now", "Weather", "Top up", "Hold back", "Smaller orders", "Limit orders", "Season"];
const pc = (v) => (Math.round(v * 100) === 0 ? "0%" : (v >= 0 ? "+" : "−") + Math.abs(Math.round(v * 100)) + "%");

// the best-selling dishes that use an ingredient, with the plates that would use up a quantity of it
function dishesFor(id, left, sold) {
  return (D.dishes[id] || []).slice().sort((a, b) => (sold.get(b.id) || 0) - (sold.get(a.id) || 0)).slice(0, 3)
    .map((d) => ({ name: d.name, price: d.price, plates: d.q > 0 ? Math.floor(left / d.q) : 0, sold: sold.get(d.id) || 0 }));
}

export function buildRecommendations(F, wx) {
  const set_ = new Set(F.map((i) => i.id)), ids = [...set_], out = [];
  const sold = new Map();
  for (const r of IS) if (r[0] > LAST - 28) sold.set(r[1], (sold.get(r[1]) || 0) + r[2]);
  const push = (r) => out.push({ lvl: "flat", page: null, patch: null, ...r });

  // (Stock close to expiry, with the dishes to push, is sent through Telegram: no in-system alert.)

  // 2. stock status: run-out risk and overstock
  F.forEach((i) => {
    const st = stockStatus(i), p1 = planRow(i.id, 1), p2 = planRow(i.id, 2);
    if (p1 && p1.rule === "daily market buy") return;   // bought fresh at the market each day: no stock to top up or hold back
    if (st.r === "bad" || st.r === "warn") {
      push({
        kind: st.r === "bad" ? "Order now" : "Top up", lvl: st.r === "bad" ? "bad" : "warn", what: i.name,
        action: st.r === "bad" ? "Buy it now." : "Top up before the next delivery.",
        why: `${qty(st.close, i.uom)} left, about ${daysTxt(st.d)} ${st.d < 1.5 ? "day" : "days"} of stock; order level ${qty(st.below, i.uom)}.`,
        page: "inv", patch: { itab: "risk", sel: i.id },
      });
    } else if (st.over) {
      const slow = !(p1 && p1.qty > 0) && !(p2 && p2.qty > 0);
      push({
        kind: "Hold back", lvl: "flat", what: i.name,
        action: slow ? "No order for 14 days." : "Order less next time.",
        why: `${peso(st.excessVal)} more than the forecast will use (${daysTxt(st.d)} days of stock).`,
        page: "inv", patch: { itab: "risk", sel: i.id },
      });
    }
  });

  // 3. the ingredients that lose the most to waste in the last 90 days: smaller, more frequent orders
  const a = Math.max(0, LAST - 89), W = wasteIn(set_, a, LAST), byIng = {};
  W.forEach((x) => { const o = byIng[x[1]] || (byIng[x[1]] = { v: 0, spo: 0, exp: 0 }); o.v += x[2]; if (D.reasons[x[4]] && /expir/i.test(D.reasons[x[4]])) o.exp += x[2]; else o.spo += x[2]; });
  Object.entries(byIng).map(([id, o]) => ({ i: BYID[id], o, share: purchaseValue([+id], a, LAST) > 0 ? o.v / purchaseValue([+id], a, LAST) : 0 }))
    .filter((r) => r.share >= 0.1 && r.o.v >= 300).sort((x, y) => y.o.v - x.o.v).slice(0, 3).forEach((r) => {
      const expiry = r.o.exp >= r.o.spo;
      push({
        kind: "Smaller orders", lvl: "flat", what: r.i.name,
        action: expiry ? "Smaller packs, ordered more often." : "Check storage and prep.",
        why: `${peso(r.o.v)} lost in 90 days, ${pct(r.share, 0)} of purchases (mostly ${expiry ? "expiry" : "spoilage"}).`,
        page: "waste", patch: { wtab: "lost" },
      });
    });

  // 4. slow movers: stock for weeks and nothing to order
  F.forEach((i) => {
    const st = stockStatus(i), p1 = planRow(i.id, 1), p2 = planRow(i.id, 2);
    if (st.d >= 20 && st.d < 99 && st.close > 0 && !(p1 && p1.qty > 0) && !(p2 && p2.qty > 0) && !st.over) {
      push({ kind: "Limit orders", lvl: "flat", what: i.name, action: "Keep orders small.", why: `Lasts about ${daysTxt(st.d)} days; no order planned for 14 days.`, page: "inv", patch: { itab: "status" } });
    }
  });

  // 5. weather and season: mango shakes and juice, drinks and the mango ingredient (measured effect on sales)
  weatherRecs(wx, push);

  // 6. the coming months: raise or relax buffers (the monthly forecast)
  const L = D.longRange;
  if (L && L.months.length >= 4) {
    const m = L.months.map((_, k) => sum(Object.keys(L.qty).filter((id) => BYID[id]).map((id) => L.qty[id][k] * BYID[id].cost)));
    const full = m.slice(1), avg = sum(full) / full.length, next = full[0], ym = L.months[1];
    const r = next / avg - 1;
    if (Math.abs(r) >= 0.07) {
      const mn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+ym.slice(5, 7) - 1];
      push({
        kind: "Season", lvl: "flat", what: `${mn} ${ym.slice(0, 4)}`,
        action: r > 0 ? `Raise the buffers for ${mn}: busy month.` : `Relax the buffers for ${mn}: quiet month.`,
        why: `Expected use ${peso(next)}, ${pc(r)} on the average month (${peso(avg)}).`,
        page: "pred", patch: { ptab: "year" },
      });
    }
  }
  return out.sort((x, y) => ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind));
}

// weather-driven advice. wx is the live weather (or null while it loads). Effects are the measured ones (lib/seasons.js).
export function weatherRecs(wx, push) {
  if (!wx) return;
  const imp = seasonImpact(), M = imp.by.mango, Dr = imp.by.drinks, MI = imp.by.mangoIng;
  const next7 = wx.days.filter((d) => d.date > wx.today).slice(0, 7), hot = next7.filter((d) => d.hi != null && d.hi >= HOT_DAY), peak = Math.max(...next7.map((d) => d.hi ?? 0));
  const mango = Object.values(BYID).find((i) => /mango/i.test(i.name));
  const season = seasonOfIso(wx.today), nx = nextSeason(wx.today);
  const mangoFc = mango ? sum(D.fc[mango.id].y.slice(0, 7)) : 0;
  if (hot.length >= 2 && M.hot !== null) {
    const extra = mango && MI.hot !== null ? (mangoFc * (hot.length / 7) * MI.hot) : 0;
    push({
      kind: "Weather", lvl: "good", what: "Mango Shake, Mango Juice and drinks",
      action: `Hot spell: promote Mango Shake and Juice; keep ${mango ? mango.name : "mango"} stocked${extra > 0 && mango ? ` (about ${qty(extra, mango.uom)} more this week)` : ""}.`,
      why: `${hot.length} of the next 7 days feel like ${HOT_DAY} °C or more; mango shakes and juice sold ${pc(M.hot)} on such days.`,
      page: "pred", patch: { ptab: "weather" },
    });
  } else if (season.key === "summer" && M.summer !== null) {
    push({
      kind: "Weather", lvl: "good", what: "Mango Shake, Mango Juice and drinks",
      action: "Summer: feature mango drinks; keep a little more mango.",
      why: `Mango shakes and juice sold ${pc(M.summer)} in March to May 2026.`,
      page: "pred", patch: { ptab: "weather" },
    });
  } else if (nx.next.key === "summer" && nx.days <= 45 && M.summer !== null) {
    push({
      kind: "Weather", lvl: "good", what: "Mango Shake, Mango Juice and drinks",
      action: `Summer in about ${nx.days} days: plan a mango promotion.`,
      why: `Mango shakes and juice sold ${pc(M.summer)} in March to May 2026.`,
      page: "pred", patch: { ptab: "weather" },
    });
  } else if (M.cool !== null && next7.every((d) => d.hi != null && d.hi < 33)) {
    push({ kind: "Weather", lvl: "flat", what: "Mango", action: "Cooler week: keep mango orders small.", why: `Mango shakes and juice sold ${pc(M.cool)} on cooler days.`, page: "pred", patch: { ptab: "weather" } });
  }
}
