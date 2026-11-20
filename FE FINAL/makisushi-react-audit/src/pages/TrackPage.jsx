// Recommendation tracking and decision history: for each recommended order, was it followed and how much was really
// ordered; once the week is over the waste and stockout days are read from the records. Saved to
// dw.fact_recommendation_outcome through the server (the page itself never talks to the database).
import { useCallback, useEffect, useState } from "react";
import { D, M, LAST, BYID, idxOf, fiso, dateOf } from "../lib/model.js";
import { peso, num, pct, qty, sum } from "../lib/format.js";
import { Kpi, Kpis, Chip, Info, TabBar } from "../components/ui.jsx";
import { Donut, StackCols } from "../components/Charts.jsx";
import { useApp } from "../AppContext.js";
import { readDone } from "./BuyPage.jsx";

const iso = (i) => dateOf(i).toISOString().slice(0, 10);

// the stored plan that records are kept against: the loaded plan when it is stored in the warehouse, else the recommended (default) one
const storedRun = () => D.planRuns.find((r) => r.id === D.opt.run_id && Number.isInteger(r.id)) || D.planRuns.find((r) => r.id === D.defaultRun) || D.planRuns.find((r) => Number.isInteger(r.id));

// the plan's recommended lines: every ingredient with something to order in week 1 or 2
function planLines(run) {
  return run.plan.filter((p) => p.qty > 0 && BYID[p.ing]).map((p) => {
    const i = BYID[p.ing], start = idxOf(M.plan_start) + (p.week - 1) * 7;
    return { p, i, start, ws: iso(start), ended: start + 6 <= LAST };
  }).sort((a, b) => a.p.week - b.p.week || a.i.supname.localeCompare(b.i.supname) || a.i.name.localeCompare(b.i.name));
}

// what the records show for the ingredient in a week that is over: waste quantity and the number of days it ran out
function fromRecords(line) {
  const a = line.start, b = line.start + 6, id = line.i.id;
  const waste = sum(D.waste.filter((x) => x[1] === id && x[0] >= a && x[0] <= b).map((x) => x[3]));
  const days = new Set(D.so.filter((x) => x[1] === id && x[0] >= a && x[0] <= b).map((x) => x[0])).size;
  return { waste: Math.round(waste * 100) / 100, days: Math.min(7, days) };
}

export function TrackPage() {
  const { toast, S, set } = useApp();
  const [data, setData] = useState({ loading: true, error: null, rows: [] });
  const [draft, setDraft] = useState({});     // key -> { implemented, qty }
  const [busy, setBusy] = useState("");
  const run = storedRun(), lines = planLines(run), otherPlan = run.id !== D.opt.run_id;

  const load = useCallback(() => {
    fetch("/api/tracking").then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || r.statusText);
      setData({ loading: false, error: null, rows: j.rows });
    }).catch((e) => setData((d) => ({ ...d, loading: false, error: e.message })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const key = (l) => `${l.i.id}-${l.p.week}`;
  const runId = run.id;
  const saved = (l) => data.rows.find((r) => r.opt_run_id === runId && r.ingredient_id === l.i.id && r.week_start === l.ws);
  // the form state of a line: what the user is editing, else the saved row, else the tick on the Purchasing page
  const state = (l) => {
    const d = draft[key(l)], s = saved(l);
    if (d) return d;
    if (s) return { implemented: s.implemented, qty: s.actual_order_qty === null ? "" : String(s.actual_order_qty) };
    if (readDone(l.p)) return { implemented: true, qty: String(l.p.qty) };
    return { implemented: null, qty: "" };
  };
  const edit = (l, patch) => setDraft((d) => ({ ...d, [key(l)]: { ...state(l), ...patch } }));

  const save = async (l) => {
    const st = state(l);
    if (st.implemented === null) { toast("Choose Yes or No first."); return; }
    const rec = l.ended ? fromRecords(l) : { waste: null, days: null };
    setBusy(key(l));
    try {
      const r = await fetch("/api/tracking", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opt_run_id: runId, ingredient_id: l.i.id, week_no: l.p.week, implemented: st.implemented,
          actual_order_qty: st.implemented ? (st.qty === "" ? l.p.qty : Number(st.qty)) : (st.qty === "" ? 0 : Number(st.qty)),
          actual_waste_qty: rec.waste, actual_stockout_days: rec.days,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || r.statusText);
      setDraft((d) => { const n = { ...d }; delete n[key(l)]; return n; });
      toast(`Saved: ${l.i.name}, week of ${fiso(l.ws)}.`);
      load();
    } catch (e) {
      toast("Not saved: " + e.message);
    } finally {
      setBusy("");
    }
  };

  const weeks = [...new Set(lines.map((l) => l.p.week))];
  const ttab = S.ttab === "hist" || weeks.some((w) => S.ttab === "w" + w) ? S.ttab : "w" + (weeks[0] || 1);
  const savedLines = lines.map((l) => ({ l, s: saved(l) })).filter((x) => x.s);
  const nFollowed = savedLines.filter((x) => x.s.implemented).length;
  const plannedV = sum(savedLines.map((x) => x.l.p.cost)), actualV = sum(savedLines.map((x) => (x.s.actual_order_qty || 0) * x.l.i.cost));
  const withDays = (flag) => savedLines.filter((x) => x.s.implemented === flag && x.s.actual_stockout_days !== null);
  const avgDays = (rows) => (rows.length ? sum(rows.map((x) => x.s.actual_stockout_days)) / rows.length : null);
  const dF = avgDays(withDays(true)), dN = avgDays(withDays(false));

  // history by week over every saved row
  const byWeek = {};
  data.rows.forEach((r) => {
    const o = byWeek[r.week_start] || (byWeek[r.week_start] = { ws: r.week_start, n: 0, yes: 0, days: 0, last: r.recorded_at });
    o.n++; if (r.implemented) o.yes++; o.days += r.actual_stockout_days || 0; if (r.recorded_at > o.last) o.last = r.recorded_at;
  });
  const history = Object.values(byWeek).sort((a, b) => (a.ws < b.ws ? 1 : -1));

  const findings = [
    ["Recorded", `${savedLines.length} of ${lines.length} recommended orders have a record.`],
    ["Followed", savedLines.length ? `${nFollowed} of ${savedLines.length} recorded orders were followed (${pct(nFollowed / savedLines.length, 0)}).` : "Nothing recorded yet. Record each order after you place it."],
    ["Why it matters", "The plan was tested only on past data. Each record builds the live evidence that confirms or corrects it."],
  ];

  if (data.loading) return <div className="panel empty">Loading the tracking records…</div>;
  if (data.error) return <div className="panel"><h2>The tracking records could not be loaded</h2><p className="note">{data.error}</p><button className="linkbtn" onClick={load}>Try again</button></div>;

  return (
    <>
      <div className="pb-head">
        <Kpis>
          <Kpi label="Recorded" value={`${savedLines.length} of ${lines.length}`} delta={<span className="t-flat">recommended orders in this plan</span>}
            info="How many of the plan's recommended orders have a record of what was done." />
          <Kpi label="Followed" value={savedLines.length ? pct(nFollowed / savedLines.length, 0) : "–"} delta={<span className="t-flat">{nFollowed} of {savedLines.length} recorded</span>}
            info="Share of the recorded orders that were placed as recommended." />
          <Kpi label="Spent vs planned" value={savedLines.length ? peso(actualV) : "–"} delta={<span className="t-flat">{savedLines.length ? `planned ${peso(plannedV)}` : "no records yet"}</span>}
            info="What was really ordered (at standard cost) against the plan, for the recorded orders." />
          <Kpi label="Stockout days per order" value={dF === null && dN === null ? "–" : dF === null ? "–" : dF.toFixed(1)}
            delta={<span className="t-flat">{dN === null ? "followed orders" : `followed · ${dN.toFixed(1)} when not followed`}</span>}
            info="Average days an ingredient ran out in the week, for orders that were followed against those that were not. Filled in from the records once the week is over." />
        </Kpis>
        <TabBar id="ttabs" list={[...weeks.map((w) => ["w" + w, (w === 1 ? "This week" : "Next week") + " · " + fiso(lines.find((l) => l.p.week === w).ws)]), ["hist", "History"]]} value={ttab} onChange={(v) => set({ ttab: v })} />
      </div>
      <div className="grid canvas" style={ttab === "hist" ? { gridTemplateRows: "minmax(0, 1fr)" } : undefined}>
        {weeks.filter((w) => ttab === "w" + w).map((wkNo) => {
          const rows = lines.filter((l) => l.p.week === wkNo);
          return (
            <div className="panel c12" key={wkNo}>
              <div className="ph">
                <h2>Week of {fiso(rows[0].ws)}</h2>
                <Chip cls="flat">{rows.filter((l) => saved(l)).length} of {rows.length} recorded</Chip>
                <Info t="Choose Yes if you placed the order as recommended, or No if you did not or changed it. Enter the quantity you really ordered. Waste and stockout days are filled in from the records once the week is over." />
              </div>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Ingredient</th><th>Recommended</th><th>Followed?</th><th className="n">Really ordered</th><th className="n">Waste</th><th className="n">Stockout days</th><th></th></tr></thead>
                  <tbody>
                    {rows.map((l) => {
                      const st = state(l), s = saved(l), rec = l.ended ? fromRecords(l) : null, dirty = !!draft[key(l)];
                      return (
                        <tr key={key(l)}>
                          <td><b>{l.i.name}</b><small>{l.i.supname}</small></td>
                          <td>{l.p.rule === "daily market buy" ? <><b>{qty(l.p.qty, l.i.uom)}</b> <small>buy fresh each day</small></> : <><b>{l.p.packs} × {qty(l.i.pack, l.i.uom)}</b> <small>{qty(l.p.qty, l.i.uom)} · {peso(l.p.cost)}</small></>}</td>
                          <td>
                            <div className="seg">
                              <button aria-pressed={st.implemented === true} onClick={() => edit(l, { implemented: true, qty: st.qty === "" || st.implemented === false ? String(l.p.qty) : st.qty })}>Yes</button>
                              <button aria-pressed={st.implemented === false} onClick={() => edit(l, { implemented: false, qty: st.implemented === true ? "" : st.qty })}>No</button>
                            </div>
                          </td>
                          <td className="n">
                            <input type="number" min="0" step="any" className="numin" aria-label={`Quantity of ${l.i.name} really ordered`} value={st.qty}
                              disabled={st.implemented === null} placeholder={st.implemented === null ? "" : "0"} onChange={(e) => edit(l, { qty: e.target.value })} /> <small>{l.i.uom}</small>
                          </td>
                          <td className="n">{rec ? `${num(rec.waste, 1)} ${l.i.uom}` : s && s.actual_waste_qty !== null ? `${num(s.actual_waste_qty, 1)} ${l.i.uom}` : <span className="t-flat">after the week</span>}</td>
                          <td className="n">{rec ? rec.days : s && s.actual_stockout_days !== null ? s.actual_stockout_days : <span className="t-flat">after the week</span>}</td>
                          <td className="n">
                            <button className="btn pri" disabled={busy === key(l) || st.implemented === null || (!!s && !dirty)} onClick={() => save(l)}>{busy === key(l) ? "Saving…" : s && !dirty ? "Saved" : "Save"}</button>
                            {s && !dirty && <small>{new Date(s.recorded_at).toLocaleDateString("en", { day: "numeric", month: "short" })}</small>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {!lines.length && <div className="panel c12 empty">The loaded plan has no orders to record.</div>}
        {ttab === "hist" && (
          <>
            <div className="panel c4">
              <div className="ph"><h2>Recommendations followed</h2><Info t="Share of all saved records where the recommended order was placed." /></div>
              {history.length ? <Donut items={[["Followed", sum(history.map((h) => h.yes))], ["Not followed", sum(history.map((h) => h.n - h.yes))]]} colors={["#10B981", "#F59E0B"]} size="auto" center={pct(sum(history.map((h) => h.yes)) / Math.max(1, sum(history.map((h) => h.n))), 0)} sub="followed" label="Recommendations followed" /> : <div className="empty">No decisions recorded yet.</div>}
            </div>
            <div className="panel c8">
          <div className="ph"><h2>Decision history</h2><Info t="Every saved record, by week of the plan." /></div>
          {history.length ? (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Week of</th><th className="n">Orders recorded</th><th className="n">Followed</th><th className="n">Not followed</th><th className="n">Stockout days</th><th>Last recorded</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.ws}>
                      <td><b>{fiso(h.ws)}</b> {h.ws.slice(0, 4)}</td>
                      <td className="n">{h.n}</td><td className="n">{h.yes}</td><td className="n">{h.n - h.yes}</td><td className="n">{h.days}</td>
                      <td>{new Date(h.last).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No decisions recorded yet. Record each order above after you place it.</div>}
          <div className="note">{otherPlan ? "Records are kept against the Balanced plan stored in the warehouse, which is the one the study recommends. " : ""}Records are saved to the Supabase table dw.fact_recommendation_outcome. Waste and stockout days come from the stock and waste records, so they appear once the week has passed and the daily data has been uploaded.</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
