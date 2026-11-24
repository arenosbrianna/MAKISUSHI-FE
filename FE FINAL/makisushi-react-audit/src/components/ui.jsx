// Shared page pieces: tooltip, KPI cards, chips, tabs, meters, bar rows and legends.
import { Children, useEffect, useRef } from "react";
import { HBars, MeterChart, BulletChart, Sparkline } from "./Charts.jsx";
import { Icon, kpiIcon } from "./Icons.jsx";
import { useApp } from "../AppContext.js";
import { SUBTABS } from "../lib/constants.js";

// Hover tooltip: any element with data-tip (info icons) or data-t (cells) shows its text, as before.
export function TipLayer() {
  const ref = useRef(null);
  useEffect(() => {
    const tip = ref.current;
    if (!tip) return undefined;
    // one sentence per line with space between, so a longer explanation reads in short pieces
    const spaced = (text) => String(text).replace(/([.!?;])\s+(?=[A-Z0-9₱−+"(])/g, "$1\n\n").replace(/\s+·\s+(?=[A-Z])/g, "\n");
    const show = (e, text) => {
      tip.textContent = spaced(text);
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX + 12;
      let y = e.clientY + 14;
      if (x + w > window.innerWidth - 8) x = Math.max(8, e.clientX - w - 12);
      if (y + h > window.innerHeight - 8) y = Math.max(8, e.clientY - h - 10);
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    };
    const onMove = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const info = t.closest(".info");
      if (info && info.dataset.tip) { show(e, info.dataset.tip); return; }
      const cell = t.closest("[data-t]");
      if (cell) { show(e, cell.dataset.t); return; }
      tip.hidden = true;
    };
    // touch screens: a tap on an "i" button shows its text under the button; a tap anywhere else hides it
    const onTap = (e) => {
      const info = e.target && e.target.closest && e.target.closest(".info");
      if (info && info.dataset.tip) {
        e.preventDefault(); e.stopPropagation();
        const r = info.getBoundingClientRect();
        show({ clientX: r.left, clientY: r.bottom }, info.dataset.tip);
        return;
      }
      tip.hidden = true;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("click", onTap, true);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("click", onTap, true); };
  }, []);
  return <div className="tip" ref={ref} hidden />;
}

// a small "i" button: hover (or tap on a phone) shows what the number or chart means
// Quarter or Year, for the charts of a long period (All data); every such chart follows the same choice
export const AggSeg = ({ S, set }) => (
  <div className="seg noprint aggseg" role="group" aria-label="Columns per">
    {[["quarter", "Quarter"], ["year", "Year"]].map(([v, l]) => <button key={v} aria-pressed={(S.agg || "year") === v} onClick={() => set({ agg: v })}>{l}</button>)}
  </div>
);
export const Info = ({ t }) => (t ? <span className="info" role="button" tabIndex={0} aria-label={"What this means: " + t} data-tip={t}>i</span> : null);

// a long explanation folded into one small line with an "i": hover or tap shows the text
export const NoteTip = ({ t, label = "How this is worked out" }) => (t ? <div className="note-tip"><span className="info" role="button" tabIndex={0} aria-label={t} data-tip={t}>i</span><span>{label}</span></div> : null);

// Change against an earlier period, as a short badge (arrow and percent). Green when it is good news, red when not.
// Hovering the KPI shows the earlier value next to the current one (data-cmp).
export function deltaEl(cur, prev, fmt, lowerBetter, unit = "") {
  if (prev === null || prev === undefined) return null;
  const d = cur - prev, cmp = `Earlier ${fmt(prev)} → now ${fmt(cur)}`;
  if (Math.abs(d) < 1e-9 || fmt(Math.abs(d)) === fmt(0)) return <span className="t-flat dlt" data-cmp={cmp}>▬ 0% vs before</span>;
  const up = d > 0, good = lowerBetter ? !up : up;
  const short = unit ? fmt(Math.abs(d)) + unit.replace(" points", " pts") : prev ? (Math.abs(d / prev) > 1 ? (cur / prev).toFixed(1).replace(/\.0$/, "") + "×" : Math.round(Math.abs(d / prev) * 100) + "%") : fmt(Math.abs(d));
  if (/^0(\.0+)?( |%)/.test(short)) return <span className="t-flat dlt" data-cmp={cmp}>▬ 0% vs before</span>;
  return <span className={(good ? "t-good" : "t-bad") + " dlt"} data-cmp={cmp} title={"Compared with the same number of days just before: " + cmp}>{up ? "▲" : "▼"} {short} vs before</span>;
}
// the badge element (with data-cmp) inside a KPI's delta, and the plain text of a delta
function findCmp(node) {
  if (!node || typeof node !== "object") return null;
  if (node.props && node.props["data-cmp"]) return node;
  const ch = node.props && node.props.children;
  if (!ch) return null;
  for (const c of Children.toArray(ch)) { const r = findCmp(c); if (r) return r; }
  return null;
}
function textOf(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return node.props ? textOf(node.props.children) : "";
}

// A KPI card: the name, the number, a short change badge and an optional trend line. Hover for the comparison with the earlier period.
export function Kpi({ label, value, delta, goto, onGo, spark, sparkColor, icon, info, act }) {
  const app = useApp();
  // the comparison with the period before is not drawn on the card (no arrow): it is said in words behind the i
  const badge = findCmp(delta), change = badge ? changeWords(badge) : "";
  const infoText = [info, change].filter(Boolean).join(" ");
  // act: { page, tab, patch, hint } opens that page (and sub-page), with any filter the card stands for
  const go = act ? () => {
    const p = { ...(act.patch || {}) };
    if (act.tab && SUBTABS[act.page]) p[SUBTABS[act.page].key] = act.tab;
    if (Object.keys(p).length) app.set(p);
    app.goto(act.page);
  } : goto && onGo ? () => onGo(goto) : null;
  const tip = act ? "Click: " + act.hint : "";
  // the words around the badge (what the number is against), shown under the number
  const words = textNoBadge(delta).replace(/^[\s·]+|[\s·]+$/g, "");
  return (
    <button className={"kpi hasico" + (go ? " act" : " noact")} data-t={tip || undefined} aria-label={act ? label + ": " + act.hint : undefined} onClick={(e) => { if (e.target.closest && e.target.closest(".info")) return; if (go) go(); }}>
      <span className="kico"><Icon name={icon || kpiIcon(label)} size={18} /></span>
      <span className="kbody">
        <div className="l">{label} <Info t={infoText} /></div>
        <div className="v">{value}</div>
        {words && words.length <= 34 ? <div className="ks">{words}</div> : null}
      </span>
      {act ? <span className="kgo" aria-hidden="true"><b>{act.hint}</b>›</span> : null}
    </button>
  );
}
// "▲ 36% vs before" with "Earlier ₱4,300 → now ₱5,837" becomes "Up 36% on the period before (earlier ₱4,300, now ₱5,837)."
function changeWords(badge) {
  const t = textOf(badge).trim(), cmp = String(badge.props["data-cmp"] || "");
  const m = cmp.match(/^Earlier (.*) → now (.*)$/), pc = / pts vs before$/.test(t) && m && !/%$/.test(m[2]) ? "%" : "";
  const was = m ? ` (earlier ${m[1]}${pc}, now ${m[2]}${pc})` : "";
  if (t.startsWith("▬")) return `No change on the period before${was}.`;
  const amt = t.replace(/^[▲▼]\s*/, "").replace(/\s*vs before$/, "").replace(/ pts$/, " percentage points");
  return `${t.startsWith("▲") ? "Up" : "Down"} ${amt} on the period before${was}.`;
}
function textNoBadge(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textNoBadge).join("");
  if (node.props && node.props["data-cmp"]) return "";
  return node.props ? textNoBadge(node.props.children) : "";
}

// A measure against a target, drawn as a bullet graph with its numbers above it
export function BulletBar({ value, target, pace, big, sub, fmt }) {
  return (
    <div className="mbar bulletbar">
      <div className="mtop"><b>{big}</b><span>{sub}</span></div>
      <BulletChart value={value} target={target} pace={pace} fmt={fmt} />
    </div>
  );
}
export function Kpis({ children }) { return <div className="kpis">{children}</div>; }

export const Chip = ({ cls = "", children }) => <span className={`chip ${cls}`}>{children}</span>;

// one-line commentary under the page title, computed from the data (like a "Key takeaways" text box)
export const Takeaway = ({ children }) => <div className="takeaway" title={typeof children === "string" ? children : undefined}>{children}</div>;

// Key findings scorecard (like the "Key findings" box on the reference reports): one row per finding, a label and its text
// On wide screens it is one row with a column per finding; hovering a finding shows its full text.
export function KeyFindings({ items }) {
  if (items) return null;   // the text boxes were removed for a lighter, report-style layout
  return (
    <div className="panel c12 kf">
      <div className="ph"><h2>Key findings</h2></div>
      <div className="kf-t">Key findings</div>
      <ul className="kf-list" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(([label, text], i) => <li key={i}><b>{label}</b><span data-t={typeof text === "string" ? text : undefined}>{text}</span></li>)}
      </ul>
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map(([label, color], k) => <span key={k}><i style={{ background: color }} />{label}</span>)}
    </div>
  );
}

// Pill tabs (Orders / Stock plan / ...). list: [value, label]
export function TabBar() {
  return null;   // the sub-pages are in the side navigation
}
function OldTabBar({ id, list, value, onChange }) {
  return (
    <div className="seg tabs" id={id}>
      {list.map(([v, l]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

// A single amount against a cap, coloured by how full it is
export function MeterBar({ value, cap, big, sub, warn, bad }) {
  const f = cap ? value / cap : 0;
  const w = warn === undefined ? 0.6 : warn, b = bad === undefined ? 0.9 : bad;
  const col = f < w ? "var(--good)" : f < b ? "var(--warn)" : "var(--bad)";
  return (
    <div className="mbar">
      <div className="mtop"><b>{big}</b><span>{sub}</span></div>
      <MeterChart fraction={f} color={col} />
    </div>
  );
}

// Horizontal bars (Recharts): items [label, value, id, colour?]
export function BarRows({ items, fmt, click, color, w, onRow }) {
  return <HBars items={items} fmt={fmt} click={click} onRow={onRow} color={color} labelWidth={w ? Math.min(w, 170) : 150} />;
}

// A row or grid of stat tiles: a big number with a small label (and a colour for good, warning or bad)
export function Tiles({ items }) {
  return (
    <div className="tiles">
      {items.map((t, k) => (
        <div key={k} className={"tile" + (t.tone ? " " + t.tone : "")} data-t={t.tip || undefined}>
          <b>{t.value}</b>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}
