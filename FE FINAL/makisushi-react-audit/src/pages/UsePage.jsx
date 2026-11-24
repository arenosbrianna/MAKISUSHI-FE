// Ingredient use (shown inside the "Sales & ingredient use" view): use over time, the busy weekdays and months,
// and which few ingredients carry most of the value.
import { N, LAST, WD, MONTHS, fd, dateOf, series, win, wdOf, consumedValue, BYID, abcOf } from "../lib/model.js";
import { peso, kpeso, num, pct, qty, sum } from "../lib/format.js";
import { ComboChart, HBars, DivCols, Donut } from "../components/Charts.jsx";
import { Kpi, Kpis, deltaEl, Legend, Info } from "../components/ui.jsx";
import { useApp } from "../AppContext.js";

// tab: "time" (use over time, weekdays, months) or "what" (most-used ingredients); tabbar: the shared tab bar of the page
export function UsePage({ F, tab }) {
  const { S, set } = useApp();
  const w = win(S), ids = F.map((i) => i.id), single = F.length === 1, daily = w.n <= 90, hasPrev = w.pb >= 0 && w.pa <= w.pb;
  const unit = single ? F[0].uom : "";
  const f = (v) => (single ? qty(v, unit) : peso(v));
  const amount = (a, b) => (single ? sum(Array.from({ length: b - a + 1 }, (_, k) => series(F[0].id).use[a + k])) : consumedValue(ids, a, b));
  const val = (id, i) => series(id).use[i] * (single ? 1 : BYID[id].cost);
  const step = daily ? 1 : 7;

  // the series on the chart: each day, or the average per week
  const x = [], v = [];
  for (let s = w.a; s <= w.b; s += step) {
    const e = Math.min(w.b, s + step - 1);
    x.push(fd(s));
    let t = 0;
    ids.forEach((id) => { for (let i = s; i <= e; i++) t += val(id, i); });
    v.push(t / (e - s + 1));
  }
  // weekday averages
  const wd = new Array(7).fill(0), cnt = new Array(7).fill(0);
  for (let i = w.a; i <= w.b; i++) {
    const k = wdOf(i);
    cnt[k]++;
    ids.forEach((id) => { wd[k] += val(id, i); });
  }
  const wdAvg = wd.map((vv, k) => vv / (cnt[k] || 1));
  const wdMax = Math.max(...wdAvg), wdMin = Math.min(...wdAvg);
  // busy and quiet months, from the days of the chosen period (and the chosen ingredients); a month with no days in it is left empty
  const ms = new Array(12).fill(0), mc = new Array(12).fill(0);
  for (let i = w.a; i <= w.b; i++) {
    const m = dateOf(i).getUTCMonth();
    mc[m]++;
    ids.forEach((id) => { ms[m] += val(id, i); });
  }
  const avgM = ms.map((vv, m) => (mc[m] ? vv / mc[m] : null)), okM = avgM.filter((v) => v !== null), meanM = okM.length ? sum(okM) / okM.length : 1;
  const monthItems = MONTHS.map((nm, k) => [nm, avgM[k] === null || !meanM ? null : avgM[k] / meanM - 1]);

  // what was used most, and the few ingredients that together make up 80% of the value used (darker bars)
  const usedAll = F.map((i) => [i.name, consumedValue([i.id], w.a, w.b), i.id]).sort((a, b) => b[1] - a[1]);
  const totalUsed = sum(usedAll.map((r) => r[1])) || 1;
  const inTop = abcOf(usedAll.map((r) => r[1])).map((c) => c === "A");
  const nA = inTop.filter(Boolean).length;
  const byIng = usedAll.slice(0, 10).map((r, k) => [r[0], r[1], r[2], inTop[k] ? "var(--accent)" : "#93A4D6"]);
  // the share of use of the five largest, and the rest together
  const shareItems = [...usedAll.slice(0, 5).map((r) => [r[0].replace(/ \(.*\)$/, ""), r[1]]), ["Other", sum(usedAll.slice(5).map((r) => r[1]))]].filter((x) => x[1] > 0);

  // staff meals and other use outside the menu (recorded as off-POS use), in the period
  const offIn = (id, a, b) => { let t = 0; for (let i = a; i <= b; i++) t += series(id).off[i] || 0; return t * (single ? 1 : BYID[id].cost); };
  const staff = sum(ids.map((id) => offIn(id, w.a, w.b))), staffP = hasPrev ? sum(ids.map((id) => offIn(id, w.pa, w.pb))) : null;
  const unitsIn = (arr, id, a, b) => { let t = 0; for (let i = a; i <= b; i++) t += arr[i] || 0; return t; };
  const staffRows = F.map((i) => { const o = unitsIn(series(i.id).off, i.id, w.a, w.b), u = unitsIn(series(i.id).use, i.id, w.a, w.b); return { i, v: o * (single ? 1 : i.cost), share: u > 0 ? o / u : 0 }; })
    .filter((r) => r.v > 0).sort((x, y) => y.v - x.v);
  const staffTop = staffRows.slice(0, 8).map((r) => [r.i.name, r.v, r.i.id]);

  // use now and before
  const used = amount(w.a, w.b), usedP = hasPrev ? amount(w.pa, w.pb) : null;
  const last7 = amount(LAST - 6, LAST), prev7 = amount(LAST - 13, LAST - 7);
  const movers = F.map((i) => ({ i, d: consumedValue([i.id], w.a, w.b) - (hasPrev ? consumedValue([i.id], w.pa, w.pb) : 0) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 2);
  const findings = [
    ["Change", `${f(used)} used in ${w.n} days${usedP ? `, ${used >= usedP ? "up" : "down"} ${Math.abs((used / usedP - 1) * 100).toFixed(1)}% on the period before${single ? "" : `, mostly ${movers.map((m) => `${m.i.name} (${m.d >= 0 ? "+" : "−"}${peso(Math.abs(m.d))})`).join(" and ")}`}` : ""}.`],
    ["Busiest day", `${WD[wdAvg.indexOf(wdMax)]} needs ${f(wdMax)} a day against ${f(wdMin)} on ${WD[wdAvg.indexOf(wdMin)]}. Have stock ready the day before.`],
    ["Focus", usedAll.length > 1 ? `${nA} ${nA === 1 ? "ingredient makes" : "ingredients make"} up 80% of the value used, led by ${usedAll[0][0]} (${pct(usedAll[0][1] / totalUsed, 0)}). Count and order these first.` : "Pick more than one ingredient to see which carry most of the value."],
  ];

  const staffShare = used > 0 ? staff / used : 0;
  return (
    <>
      <div className="pb-head">
        <Kpis>
          <Kpi label="Used in period" value={f(used)} delta={deltaEl(used, usedP, (q) => f(q), false)}
            info="Ingredient use in the period, at standard cost." />
          <Kpi label="Last 7 days" value={f(last7)} delta={deltaEl(last7, prev7, (q) => f(q), false)} info="Use in the most recent 7 days, against the 7 days before." />
          <Kpi label="Staff meals" value={f(staff)} icon="user" delta={<>{pct(staffShare, 1)} of use{staffP !== null ? " · " : ""}{staffP !== null ? deltaEl(staff, staffP, (q) => f(q), true) : null}</>}
            info="Staff meals and other off-menu use. It is part of what must be ordered." />
          <Kpi label="Busiest day" value={WD[wdAvg.indexOf(wdMax)]} icon="calendar" delta={<span className="t-flat">{f(wdMax)} a day against {f(wdMin)} on {WD[wdAvg.indexOf(wdMin)]}</span>}
            info="The weekday with the most use. Have stock ready the day before." />
        </Kpis>
      </div>
      <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        {tab === "time" && (
          <>
            <div className="panel c8">
              <div className="ph"><h2>Use over time{single ? " · " + F[0].name : " (₱)"}</h2></div>
              <ComboChart x={x} h={240} yfmt={(q) => (single ? num(q) : kpeso(q))}
                lines={daily
                  ? [{ vals: v, color: "#93A4D6", w: 1.6, nodots: true, name: "Per day", fmt: f },
                    { vals: v.map((_, i) => (i < 6 ? null : sum(v.slice(i - 6, i + 1)) / 7)), color: "#D97706", w: 2.8, nodots: true, name: "7-day average", fmt: f }]
                  : [{ vals: v, color: "var(--accent)", nodots: true, name: "Use", fmt: f }]} />
              <Legend items={daily ? [["Per day", "#93A4D6"], ["7-day average", "#D97706"]] : [["Average per day, by week", "var(--accent)"]]} />
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Dishes and staff meals</h2><Info t="Share of use that went to dishes sold and to off-menu use." /></div>
              <Donut items={[["Dishes sold", Math.max(0, used - staff)], ["Staff meals", staff]]} colors={["var(--accent)", "#F59E0B"]} size="auto" center={f(used)} sub="used" label="Dishes and staff meals" />
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Busiest days of the week</h2></div>
              <ComboChart x={WD} h={250} yfmt={(q) => (single ? num(q) : kpeso(q))}
                bars={[{ vals: wdAvg, colors: wdAvg.map((vv) => (vv === wdMax ? "var(--accent)" : "#93A4D6")), labels: true, lfmt: (q) => (single ? num(q) : "₱" + num(q)), name: "Average use", fmt: f }]}
                lines={[{ vals: WD.map(() => sum(wd) / (sum(cnt) || 1)), color: "#D97706", dash: true, w: 1.4, nodots: true, name: "Average day", fmt: f }]} />
              <Legend items={[["Busiest day", "var(--accent)"], ["Other days", "#93A4D6"], ["Average day", "#D97706"]]} />
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Busy and quiet months</h2><span className="note-inline">{fd(w.a, true)} to {fd(w.b, true)}</span></div>
              {okM.length > 1 ? <DivCols items={monthItems} label="Busy and quiet months" up="Busier than the average month" down="Quieter than the average month" /> : <div className="empty">Choose a longer period (at least two months) to compare months.</div>}
            </div>
            <div className="panel c4">
              <div className="ph"><h2>Staff meals by ingredient</h2><Info t="Off-menu use by ingredient, and its share of that ingredient's use." /></div>
              {staffTop.length ? <HBars fill items={staffTop} fmt={(q) => f(q)} axis={(q) => (single ? num(q) : kpeso(q))} click label="Staff meals by ingredient" labelWidth={140} color="#F59E0B"
                notes={staffRows.slice(0, 8).map((r) => pct(r.share, 0) + " of its use")} onRow={(id) => set({ ing: +id, sel: +id })} /> : <div className="empty">No use outside the menu recorded in this period.</div>}
            </div>
          </>
        )}
        {tab === "what" && (
          <>
            <div className="panel c8 r2">
              <div className="ph"><h2>What was used most (₱, selected period)</h2></div>
              <HBars fill items={byIng} fmt={(q) => peso(q)} axis={(q) => "₱" + num(q)} click label="Most used ingredients" labelWidth={140}
                notes={byIng.map((r) => pct(r[1] / totalUsed, 0) + " of use")} onRow={(id) => set({ ing: +id, sel: +id })} />
              {usedAll.length > 1 && <Legend items={[[nA + (nA === 1 ? " ingredient makes" : " ingredients make") + " up 80% of use: count and order these first", "var(--accent)"], ["The rest", "#93A4D6"]]} />}
            </div>
            <div className="panel c4 r2">
              <div className="ph"><h2>Share of use</h2></div>
              <Donut items={shareItems} colors={shareItems.map((x, k) => (x[0] === "Other" ? "#CBD5E1" : ["#1E3A8A", "#3B82F6", "#0EA5E9", "#14B8A6", "#A78BFA"][k]))} size="auto" center={peso(totalUsed)} sub="used" label="Share of use" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
