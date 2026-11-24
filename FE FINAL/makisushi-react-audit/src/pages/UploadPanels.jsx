// Loyverse upload: the dialog, the file panel on the Sales page, and the forecast check on the Forecast page.
import { useState } from "react";
import { D, LAST, fd } from "../lib/model.js";
import { peso, num, pct, qty, sum } from "../lib/format.js";
import { ComboChart } from "../components/Charts.jsx";
import { Kpi, Kpis, Chip, Legend, BarRows } from "../components/ui.jsx";
import { analyzeUpload, reconcile, saveUpload, upSalesData, upForecastData, cleanName, isMgmt } from "../lib/upload.js";
import { useApp } from "../AppContext.js";

// ---- the dialog: pick a file, see what it contains, then use it ----
export function UploadModal({ onClose, onUse }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null);

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setBusy(true);
    setCurrent(null);
    let text;
    try { text = await f.text(); } catch (err) {
      setResult({ kind: "error", html: "This file could not be read." });
      setBusy(false);
      return;
    }
    const res = analyzeUpload(text, f.name);
    setBusy(false);
    if (res.missing.length) { setResult({ kind: "missing", name: f.name, missing: res.missing }); return; }
    if (!res.lines) { setResult({ kind: "empty", name: f.name, bad: res.bad }); return; }
    const rowsArr = [...res.agg.values()], days = [...res.days].sort((a, b) => a - b), rc = reconcile(rowsArr);
    const um = [...res.unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, v]) => `${cleanName(k.split("|")[1]) || k.split("|")[0]} (${peso(v)})`);
    setResult({
      kind: "ok", name: f.name, res, days, rc, um,
      unmatchedPct: pct(res.net ? res.unmatchedNet / res.net : 0, 1),
    });
    setCurrent(res);
  };

  return (
    <div className="dss-modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dss-modal" role="dialog" aria-modal="true" aria-label="Upload Loyverse CSV">
        <h2>Upload Loyverse CSV</h2>
        <p>Choose the Loyverse "Sales by item" CSV. It is read in your browser and not sent anywhere.</p>
        <div className="upfile"><input type="file" accept=".csv,text/csv" aria-label="Loyverse CSV file" onChange={onFile} /></div>
        <div role="status">
          {busy && <div className="result">Reading the file…</div>}
          {result && result.kind === "error" && <div className="result"><span className="no">✕ {result.html}</span></div>}
          {result && result.kind === "missing" && (
            <div className="result"><b>{result.name}</b><br /><span className="no">✕ Missing columns: {result.missing.join(", ")}</span><br />
              Please export "Sales by item" from Loyverse with these columns.</div>
          )}
          {result && result.kind === "empty" && (
            <div className="result"><b>{result.name}</b><br /><span className="no">✕ No readable sales lines were found{result.bad ? ` (${result.bad} rows have an unreadable date or number)` : ""}.</span></div>
          )}
          {result && result.kind === "ok" && (
            <div className="result">
              <b>{result.name}</b><br />
              {num(result.res.lines)} sale lines · {fd(result.days[0], true)} to {fd(result.days[result.days.length - 1], true)} · {result.days.length} days · {peso(result.res.net)} net sales
              <br /><span className="ok">✓ All required columns are present{result.res.bad ? ` (${result.res.bad} rows skipped: unreadable date or number)` : ""}</span>
              <ul>
                {result.rc.overlap ? <li>{result.rc.match} of {result.rc.overlap} days that the dashboard already has match its sales (within 1%).{result.rc.match < result.rc.overlap ? " The others differ by more than 1%, so compare those days before relying on the file." : ""}</li> : null}
                {result.rc.fresh ? <li><b>{result.rc.fresh} new days</b> after {fd(LAST, true)}: they will be checked against the forecast.</li> : <li>No days after {fd(LAST, true)} in this file, so the forecast check will not have new days.</li>}
                {result.res.unmatched.size ? <li>{result.res.unmatched.size} items are not in the menu list ({result.unmatchedPct} of sales){result.um.length ? ": " + result.um.join(", ") : ""}. They count in sales but not in ingredient use.</li> : <li>Every item matches the menu list.</li>}
              </ul>
            </div>
          )}
        </div>
        <p className="small">Stock and the purchase plan do not change; they refresh when the data refresh is run.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn pri" disabled={!current} onClick={() => current && onUse(saveUpload(current))}>Check this file in the dashboard</button>
        </div>
      </div>
    </div>
  );
}

// ---- Sales page: the uploaded file against the dashboard's own sales ----
export function UploadSalesPanel({ up }) {
  const { openUpload, removeUpload } = useApp();
  const u = up;
  const data = upSalesData(u);
  const rc = data.rc;
  const salesNet = sum(u.rows.filter((r) => !isMgmt(r)).map((r) => r.net));
  const items = sum(u.rows.filter((r) => !isMgmt(r)).map((r) => r.items));
  const c = data.chart;
  const v = c.x.length > 40;
  return (
    <div className="panel c12 pb-scroll">
      <div className="pb-inner">
        <div className="ph">
          <h2>Your uploaded Loyverse file</h2>
          <span className="chip warn">Check only</span>
          <button className="btn sm" onClick={openUpload}>Choose another file</button>
          <button className="btn sm" onClick={removeUpload}>Remove file</button>
        </div>
        <div className="note" style={{ margin: "0 0 10px" }}><b>{u.name}</b> · {fd(u.from, true)} to {fd(u.to, true)} · {u.nDays} days · {num(u.lines)} lines.
          This file stays in your browser: it does not change the database, the stock or the purchase plan, which still use data to {fd(LAST, true)}.</div>
        <Kpis>
          <Kpi label="Net sales in file" value={peso(salesNet)} delta="" info="Sales after discounts in the uploaded file, without the Management category." />
          <Kpi label="Items sold" value={num(items)} delta="" info="Total quantity of items in the uploaded file." />
          <Kpi label="Same as dashboard" value={rc.overlap ? `${rc.match} of ${rc.overlap}` : "–"} delta={<span className="t-flat">days that overlap</span>}
            info="Days that the dashboard already has and that match the file's net sales within 1%." />
          <Kpi label="New days" value={num(rc.fresh)} delta={<span className="t-flat">after {fd(LAST, true)}</span>}
            info="Days newer than the dashboard's sales, checked against the forecast." />
        </Kpis>
        <div className="grid">
          <div className="panel c8" style={{ boxShadow: "none" }}>
            <div className="ph"><h2>{data.weekly ? "Net sales per week" : "Net sales per day"}</h2></div>
            <ComboChart x={c.x} h={230} yfmt={(q) => "₱" + num(q / 1000) + "k"}
              {...(v
                ? { lines: [{ vals: c.up, color: "var(--accent)", name: "Uploaded file", fmt: peso }, { vals: c.ex, color: "var(--series2)", dash: true, name: "Dashboard's sales", fmt: peso }] }
                : { bars: [{ vals: c.up, color: "var(--accent)", op: 0.7, name: "Uploaded file", fmt: peso }], lines: [{ vals: c.ex, color: "var(--series2)", dash: true, name: "Dashboard's sales", fmt: peso }] })} />
            <Legend items={[["Uploaded file", "var(--accent)"], ["Dashboard's own sales (same days)", "var(--series2)"]]} />
          </div>
          <div className="panel c4" style={{ boxShadow: "none" }}>
            <div className="ph"><h2>Top items in the file</h2></div>
            <BarRows items={data.topRows} fmt={(x) => peso(x)} color="var(--accent)" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Forecast page: the uploaded file turned into ingredient use, against the forecast ----
export function UploadForecastPanel({ up }) {
  const k0 = LAST + 1, kN = LAST + D.fdates.length;
  const d = upForecastData(up, k0, kN);
  if (!d.days.length) {
    return (
      <div className="panel c12">
        <div className="ph"><h2>Check the forecast against your sales</h2></div>
        <div className="note" style={{ margin: 0 }}>Your file has no days after {fd(LAST, true)}. Upload a newer export.</div>
      </div>
    );
  }
  const days = d.days;
  const tr = d.rowsT.slice(0, 10).map((r) => {
    const pc = r.diff === null ? null : r.diff * 100;
    const cl = pc === null ? "flat" : Math.abs(pc) <= 15 ? "good" : "warn";
    const label = pc === null ? "no sales" : pc > 0 ? "Forecast " + pc.toFixed(0) + "% too high" : pc < -0 ? "Forecast " + Math.abs(pc).toFixed(0) + "% too low" : "Right on";
    return (
      <tr key={r.i.id}>
        <td><b>{r.i.name}</b></td>
        <td className="n">{qty(r.f, r.i.uom)}</td>
        <td className="n">{qty(r.a, r.i.uom)}</td>
        <td><Chip cls={cl}>{label}</Chip></td>
      </tr>
    );
  });
  return (
    <div className="panel c12 pb-scroll">
      <div className="ph">
        <h2>Check the forecast against your sales</h2>
        <Chip cls="warn">Check only</Chip>
        <Chip cls={d.miss <= 0.25 ? "good" : "warn"}>Daily miss on these days: {pct(d.miss, 0)}</Chip>
      </div>
      <div className="note" style={{ margin: "0 0 10px" }}>{days.length} day{days.length === 1 ? "" : "s"} from your file ({fd(days[0])} to {fd(days[days.length - 1])}), turned into ingredient use with the recipes and yields. The plan is not re-run from this file.</div>
      <ComboChart x={days.map((x) => fd(x))} h={220} yfmt={(q) => "₱" + num(q)}
        bars={[{ vals: d.perDayA, color: "var(--accent)", op: 0.6, name: "From your sales", fmt: peso }]}
        lines={[{ vals: d.perDayF, color: "var(--warn)", name: "Expected", fmt: peso }]} />
      <Legend items={[["Used, from your sales (₱)", "var(--accent)"], ["What was expected (₱)", "var(--warn)"]]} />
      <div className="tablewrap" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>Ingredient</th><th className="n">Expected</th><th className="n">From your sales</th><th>How the forecast did</th></tr></thead>
          <tbody>{tr}</tbody>
        </table>
      </div>
      <div className="note">{d.skipped} ingredients left out: their forecast includes staff meals and other use.</div>
    </div>
  );
}
