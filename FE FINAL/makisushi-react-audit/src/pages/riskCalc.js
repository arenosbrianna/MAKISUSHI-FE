// Running-out outlook for one ingredient over the forecast days, with and without the planned deliveries.
import { D, LAST, series, idxOf } from "../lib/model.js";

export function riskRunOut(sel, wi) {
  const fdays = D.fdates.length;
  const y = D.fc[sel.id].y.map((v) => v * wi);
  const start = series(sel.id).close[LAST];

  // deliveries arriving on each forecast day
  const del = new Array(fdays).fill(0);
  D.deliveries.filter((x) => x[0] === sel.id).forEach((x) => {
    const k = idxOf(x[3]) - LAST - 1;
    if (k >= 0 && k < fdays) del[k] += x[4];
  });

  // stock path without new orders, and with the deliveries
  let a = start, b = start;
  const without = [], withp = [];
  for (let k = 0; k < fdays; k++) {
    a -= y[k];
    b = b - y[k] + del[k];
    without.push(Math.max(a, 0));
    withp.push(Math.max(b, 0));
  }

  // first day stock goes below zero: without orders, and with the deliveries
  let c = start, runOut = -1;
  for (let k = 0; k < fdays; k++) { c -= y[k]; if (c < 0) { runOut = k; break; } }
  let c2 = start, covered = -1;
  for (let k = 0; k < fdays; k++) { c2 = c2 - y[k] + del[k]; if (c2 < 0) { covered = k; break; } }

  const plan1 = D.plan.find((p) => p.ing === sel.id && p.week === 1);
  const firstArr = D.deliveries.filter((x) => x[0] === sel.id).sort((p, q) => (p[3] < q[3] ? -1 : 1))[0];
  return { y, without, withp, runOut, covered, plan1, firstArr };
}
