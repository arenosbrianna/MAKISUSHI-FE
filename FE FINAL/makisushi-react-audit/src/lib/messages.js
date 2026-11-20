// The message to send each supplier for a week's orders (or the shopping list for the walk-in grocery), ready to copy and paste.
import { D, BYID, nextDelivery, dtxt, isWalkin } from "./model.js";
import { qty, sum, packQty } from "./format.js";

export function supplierMessages(F, week = 1) {
  const ids = new Set(F.map((i) => i.id)), groups = {};
  D.plan.filter((p) => p.week === week && ids.has(p.ing) && p.qty > 0 && BYID[p.ing]).forEach((p) => {
    const i = BYID[p.ing];
    (groups[i.sup] || (groups[i.sup] = { sup: i, rows: [] })).rows.push({ p, i });
  });
  return Object.values(groups).map((g) => {
    const walk = isWalkin(g.sup), nxt = nextDelivery(g.rows.map((r) => r.i.id), week);
    const buy = g.rows.filter((r) => r.p.rule !== "daily market buy"), fresh = g.rows.filter((r) => r.p.rule === "daily market buy");
    let text = "";
    if (buy.length) {
      text = walk
        ? `Grocery list - ${g.sup.supname}${nxt === null ? "" : " (buy on " + dtxt(nxt) + ")"}\n` + buy.map((r) => `[ ] ${r.i.name}: ${r.p.packs} x ${packQty(r.i.pack, r.i.uom)} (${qty(r.p.qty, r.i.uom)} in total)`).join("\n")
          + fresh.map((r) => `\n[ ] ${r.i.name}: about ${qty(r.p.qty, r.i.uom)} for the week (buy fresh each day)`).join("")
        : `Hello ${g.sup.supname}, this is Makisushi. We would like to order for delivery ${nxt === null ? "as soon as possible" : "on " + dtxt(nxt)}:\n`
          + buy.map((r) => `- ${r.p.packs} x ${packQty(r.i.pack, r.i.uom)} ${r.i.name}`).join("\n") + "\nThank you!";
    }
    return { sup: g.sup.sup, name: g.sup.supname, walk, text, total: sum(g.rows.map((r) => r.p.cost)) };
  }).filter((m) => m.text).sort((a, b) => b.total - a.total);
}
