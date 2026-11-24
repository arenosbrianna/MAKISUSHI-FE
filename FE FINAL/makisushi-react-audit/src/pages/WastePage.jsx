// Expiry and waste: how much stock expires in the coming days and where waste comes from. Alerts for batches close to
// expiry (and the dishes to push) are sent through Telegram, not shown here. Where waste comes from (spoilage and expiry are kept apart, never added together).
import { useState } from "react";
import { D, LAST, BYID, MON, dateOf, dtxt, fd, win, wasteIn, batchesAt, weeksFrom, bucketsFor, purchaseValue } from "../lib/model.js";
import { peso, num, pct, sum, qty } from "../lib/format.js";
import { tabOf } from "../lib/constants.js";
import { StackCols, HBars, StackH } from "../components/Charts.jsx";
import { Info, Kpi, Kpis, deltaEl, AggSeg } from "../components/ui.jsx";
import { useApp } from "../AppContext.js";

// buckets for the stacked columns: calendar months (or quarters or years over two years); a month or year cut by the period is labelled with its days
export function wasteBuckets(a, b, per = "quarter") {
  const span = b - a + 1;
  if (span <= 125) {   // a short period: one column per day or week
    const bl = bucketsFor(a, b, 14), step = span <= 14 ? 1 : 7;
    return { keys: bl.map((x) => x.label), of: (i) => Math.min(bl.length - 1, Math.floor((i - a) / step)) };
  }
  const months = Math.round((b - a) / 30.4), q = months > 24, keys = [], idx = {};
  const ma = dateOf(a), mb = dateOf(b);
  const startCut = ma.getUTCDate() > 1, endCut = dateOf(b + 1).getUTCDate() !== 1;
  const kf = (i) => {
    const d = dateOf(i), y = d.getUTCFullYear(), m = d.getUTCMonth();
    if (q && per === "year") {
      const fromCut = y === ma.getUTCFullYear() && (ma.getUTCMonth() > 0 || startCut), toCut = y === mb.getUTCFullYear() && (mb.getUTCMonth() < 11 || endCut);
      return String(y) + (fromCut ? ` (from ${ma.getUTCDate()} ${MON[ma.getUTCMonth()]})` : toCut ? ` (to ${mb.getUTCDate()} ${MON[mb.getUTCMonth()]})` : "");
    }
    if (q) return `${y} Q${Math.floor(m / 3) + 1}`;
    let k = `${MON[m]} ${y}`;
    const first = y === ma.getUTCFullYear() && m === ma.getUTCMonth(), last = y === mb.getUTCFullYear() && m === mb.getUTCMonth();
    if (first && startCut && last && endCut) k += ` (${ma.getUTCDate()}-${mb.getUTCDate()})`;
    else if (first && startCut) k += ` (from ${ma.getUTCDate()} ${MON[m]})`;
    else if (last && endCut) k += ` (to ${mb.getUTCDate()} ${MON[m]})`;
    return k;
  };
  for (let i = a; i <= b; i++) { const k = kf(i); if (!(k in idx)) { idx[k] = keys.length; keys.push(k); } }
  return { keys, of: (i) => idx[kf(i)] };
}

// the value of stock on hand today, by days left before it expires
function expiryBuckets(set_) {
  const bk = [["3 days or less", 0, 3], ["4 to 7 days", 4, 7], ["8 to 30 days", 8, 30], ["31 to 90 days", 31, 90], ["More than 90 days", 91, 1e9]];
  return bk.map(([label, lo, hi]) => {
    const rows = batchesAt(LAST).filter((b) => set_.has(b[1]) && b[2] > 0 && b[4] - LAST >= lo && b[4] - LAST <= hi);
    return { label, v: sum(rows.map((b) => b[2] * BYID[b[1]].cost)), n: rows.length };
  });
}

// Waste's own headline numbers
function WasteKpis({ F }) {
  const { S } = useApp();
  const w = win(S), ids = F.map((i) => i.id), set_ = new Set(ids), hasPrev = w.pb >= 0 && w.pa <= w.pb;
  const wv = sum(wasteIn(set_, w.a, w.b).map((x) => x[2])), pu = purchaseValue(ids, w.a, w.b);
  const wvP = hasPrev ? sum(wasteIn(set_, w.pa, w.pb).map((x) => x[2])) : null, puP = hasPrev ? purchaseValue(ids, w.pa, w.pb) : 0;
  const sh = pu ? wv / pu : 0, shP = hasPrev && puP ? wvP / puP : null;
  const wks = weeksFrom(Math.max(0, LAST - 12 * 7 + 1), LAST);
  const reasonSum = (re) => sum(wasteIn(set_, w.a, w.b).filter((x) => D.reasons[x[4]] && re.test(D.reasons[x[4]])).map((x) => x[2]));
  const exp = reasonSum(/expir/i), spo = wv - exp;
  const byIng = {};
  wasteIn(set_, w.a, w.b).forEach((x) => { byIng[x[1]] = (byIng[x[1]] || 0) + x[2]; });
  const top = Object.entries(byIng).sort((a, b) => b[1] - a[1])[0];
  return (
    <Kpis>
      <Kpi act={{ page: "waste", tab: "when", hint: "By date" }} label="Spoilage · Expiry" value={peso(spo) + " · " + peso(exp)} delta={<span className="t-flat">never added together</span>}
        info="Spoilage: went bad before expiry. Expiry: kept past its shelf life. Never added together." />
      <Kpi label="Waste" value={peso(wv)} delta={deltaEl(wv, wvP, (v) => peso(v), true)} spark={wks.map((x) => sum(wasteIn(set_, x.a, x.b).map((z) => z[2])))} sparkColor="var(--warn)"
        info="Waste in pesos in the period. Small line: each of the last 12 weeks." />
      <Kpi label="Share of purchases" value={pct(sh, 1)} delta={deltaEl(sh, shP, (v) => (v * 100).toFixed(1), true, " points")}
        info="Waste as a share of what was bought in the period. Lower is better." />
      <Kpi act={{ page: "waste", tab: "when", patch: top ? { ing: +top[0], sel: +top[0] } : {}, hint: "Its records" }} label="Biggest loss" value={top ? BYID[top[0]].name : "–"} delta={<span className="t-flat">{top ? `${peso(top[1])} · ${pct(wv ? top[1] / wv : 0, 0)} of the waste` : "no waste recorded"}</span>}
        info="The ingredient that lost the most value in the period." />
    </Kpis>
  );
}

// When each piece of waste happened: one line per record of the waste log, newest first, for the period and ingredients chosen above
function WasteWhen({ F }) {
  const { S, set } = useApp();
  const [kind, setKind] = useState("all");   // all records, only spoiled, or only expired
  const w = win(S), set_ = new Set(F.map((i) => i.id));
  const inPeriod = wasteIn(set_, w.a, w.b);
  const isExp = (x) => /expir/i.test(D.reasons[x[4]] || "");
  const nExp = inPeriod.filter(isExp).length, nSpo = inPeriod.length - nExp;
  // the total is added in the records' own order, as the cards above add it, so the two always show the same peso
  const Wk = inPeriod.filter((x) => kind === "all" || (kind === "expired" ? isExp(x) : !isExp(x)));
  const W = Wk.slice().sort((a, b) => b[0] - a[0] || b[2] - a[2]);
  const reasonName = (x) => { const r = D.reasons[x[4]] || ""; return /expir/i.test(r) ? "Expired" : /spoil/i.test(r) ? "Spoiled" : r[0].toUpperCase() + r.slice(1).replace(/_/g, " "); };
  const total = sum(Wk.map((x) => x[2]));
  return (
    <div className="panel c12">
      <div className="ph">
        <h2>When it was wasted</h2>
        <Info t="The waste log, newest first. Expired: kept past its shelf life. Spoiled: went bad before then." />
        <div className="seg noprint" id="wasteseg" role="group" aria-label="Type of waste" style={{ marginLeft: "auto" }}>
          <button aria-pressed={kind === "all"} onClick={() => setKind("all")}>All · {num(inPeriod.length)}</button>
          <button aria-pressed={kind === "spoiled"} onClick={() => setKind("spoiled")}>Spoiled · {num(nSpo)}</button>
          <button aria-pressed={kind === "expired"} onClick={() => setKind("expired")}>Expired · {num(nExp)}</button>
        </div>
        <span className="t-flat">{W.length ? `${num(W.length)} records · ${peso(total)}` : ""}</span>
      </div>
      <div className="tablewrap" style={{ maxHeight: 640, overflow: "auto" }}>
        <table>
          <thead><tr><th>Day it became waste</th><th>Ingredient</th><th>What happened</th><th className="n">Quantity</th><th className="n">Value</th></tr></thead>
          <tbody>
            {W.length ? W.slice(0, 300).map((x, k) => {
              const i = BYID[x[1]];
              return (
                <tr key={k} onClick={() => set({ ing: x[1], sel: x[1] })} style={{ cursor: "pointer" }}>
                  <td>{dtxt(x[0])}{dateOf(x[0]).getUTCFullYear() !== dateOf(LAST).getUTCFullYear() ? " " + dateOf(x[0]).getUTCFullYear() : ""}</td>
                  <td>{i.name}</td>
                  <td>{reasonName(x)}</td>
                  <td className="n">{qty(x[3], i.uom)}</td>
                  <td className="n">{peso(x[2])}</td>
                </tr>
              );
            }) : <tr><td colSpan={5} className="empty">No waste of this type recorded in this period.</td></tr>}
          </tbody>
        </table>
      </div>
      {W.length > 300 && <div className="t-flat" style={{ padding: "8px 12px" }}>Showing the latest 300 of {num(W.length)} records; narrow the period to see the rest.</div>}
    </div>
  );
}

export function WastePage({ F }) {
  const { S, set } = useApp();
  const tab = tabOf("waste", S);
  const w = win(S), set_ = new Set(F.map((i) => i.id)), ids = [...set_];
  const W = wasteIn(set_, w.a, w.b), bk = wasteBuckets(w.a, w.b, S.agg), longW = Math.round((w.b - w.a) / 30.4) > 24;
  const byIng = {};
  W.forEach((x) => { byIng[x[1]] = (byIng[x[1]] || 0) + x[2]; });
  const ingTot = Object.entries(byIng).map(([id, v]) => [BYID[id].name, v, +id]).sort((a, b) => b[1] - a[1]);
  const wTotal = sum(ingTot.map((x) => x[1]));
  // waste as a share of what was bought, by ingredient
  const shareRows = ingTot.map(([name, v, id]) => { const p = purchaseValue([id], w.a, w.b); return [name, p > 0 ? v / p : 0, id]; })
    .filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const isExpiry = (x) => D.reasons[x[4]] && /expir/i.test(D.reasons[x[4]]);
  const topW = ingTot.slice(0, 10), expBy = {};
  W.filter(isExpiry).forEach((x) => { expBy[x[1]] = (expBy[x[1]] || 0) + x[2]; });
  const stackW = [{ name: "Spoilage", color: "#E0662F", vals: topW.map(([, v, id]) => v - (expBy[id] || 0)) }, { name: "Expiry", color: "#2199AD", vals: topW.map(([, , id]) => expBy[id] || 0) }];
  const buckets = expiryBuckets(set_);
  const bucketTotal = sum(buckets.map((b) => b.v));

  // spoilage (went bad before its expiry date) and expiry (kept past its shelf life), kept apart
  const reasonCol = ["#E0662F", "#2199AD", "#94A3B8", "#10B981", "#A78BFA"];
  const rsn = D.reasons.map((r, k) => ({ name: r[0].toUpperCase() + r.slice(1).replace(/_/g, " "), vals: bk.keys.map(() => 0), color: reasonCol[k % 5] }));
  W.forEach((x) => { if (rsn[x[4]]) rsn[x[4]].vals[bk.of(x[0])] += x[2]; });
  const rsnUsed = rsn.filter((r) => sum(r.vals) > 0).sort((a, b) => (/spoil/i.test(b.name) ? 1 : 0) - (/spoil/i.test(a.name) ? 1 : 0)).slice(0, 5)
    .map((r) => ({ ...r, color: /spoil/i.test(r.name) ? "#E0662F" : /expir/i.test(r.name) ? "#2199AD" : r.color }));


  return (
    <>
      <div className="pb-head">
        <WasteKpis F={F} />
      </div>
      {tab === "when" && <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1fr)" }}><WasteWhen F={F} /></div>}
      {tab === "where" && <div className="grid canvas" style={{ gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <div className="panel c7">
          <div className="ph"><h2>Where most of the waste comes from</h2><Info t="Waste by ingredient, largest first." /></div>
          {ingTot.length ? <StackH items={topW.map(([name, , id]) => [name, id])} series={stackW} fmt={(v) => peso(v)} axis={(v) => "₱" + num(v)} label="Waste by ingredient and type" labelWidth={150} onRow={(id) => set({ ing: +id, sel: +id })} /> : <div className="empty">No waste recorded in this period.</div>}
        </div>
        <div className="panel c5">
          <div className="ph"><h2>Stock by days left, today</h2><Info t="Stock on hand by days left before expiry. Near-expiry alerts go to Telegram." /></div>
          <HBars fill items={buckets.map((b, k) => [b.label, b.v, k, k === 0 ? "var(--bad)" : k === 1 ? "#F59E0B" : "var(--accent)"])} fmt={(v) => peso(v)} axis={(v) => (v >= 1000 ? "₱" + num(v / 1000) + "k" : "₱" + num(v))} label="Stock value by days left" labelWidth={110} />
        </div>
        <div className="panel c7">
          <div className="ph"><h2>Spoilage and expiry</h2>{longW && <AggSeg S={S} set={set} />}<Info t="Spoilage: went bad before expiry. Expiry: kept past its shelf life. Never added together." /></div>
          {rsnUsed.length ? (
            <StackCols keys={bk.keys} series={rsnUsed.map((r) => ({ ...r, name: r.name + " · " + peso(sum(r.vals)) }))} fmt={(v) => peso(v)} axis={(v) => "₱" + num(v)} label="Waste by reason" w={900} />
          ) : <div className="empty">No waste recorded in this period.</div>}
        </div>
        <div className="panel c5">
          <div className="ph"><h2>Waste as a share of what was bought</h2><Info t="Waste as a share of purchases. Short-life items lose most; smaller, more frequent deliveries help." /></div>
          {shareRows.length ? (
            <HBars fill items={shareRows} fmt={(v) => pct(v, 1)} axis={(v) => pct(v, 0)} click label="Waste share of purchases" labelWidth={150} color="var(--warn)"
              onRow={(id) => set({ ing: +id, sel: +id })} />
          ) : <div className="empty">No waste recorded in this period.</div>}
        </div>
      </div>}
    </>
  );
}
