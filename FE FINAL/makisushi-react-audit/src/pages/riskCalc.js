// Running-out outlook for one ingredient over the forecast days, with and without the planned deliveries.
// Both lines are the same day-by-day count of stock (lib/model.js stockPath), so the chart, the warning and the weekly table agree.
import { D, stockPath } from "../lib/model.js";

export function riskRunOut(sel, wi) {
  const withp = stockPath(sel.id, true, wi), none = stockPath(sel.id, false, wi);
  const runOut = none.short.findIndex((u) => u > 1e-6), covered = withp.short.findIndex((u) => u > 1e-6);
  const plan1 = D.plan.find((p) => p.ing === sel.id && p.week === 1);
  const firstArr = D.deliveries.filter((x) => x[0] === sel.id).sort((p, q) => (p[3] < q[3] ? -1 : 1))[0];
  return { y: withp.use, del: withp.del, without: none.stock, withp: withp.stock, path: withp, runOut, covered, plan1, firstArr };
}
