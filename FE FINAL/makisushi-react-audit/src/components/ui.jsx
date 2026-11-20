// Shared page pieces: tooltip, KPI cards, chips, tabs, meters, bar rows and legends.
import { Children, useEffect, useRef } from "react";
import { HBars, MeterChart, BulletChart, Sparkline } from "./Charts.jsx";
import { Icon, kpiIcon } from "./Icons.jsx";

// Hover tooltip: any element with data-tip (info icons) or data-t (cells) shows its text, as before.
export function TipLayer() {
  const ref = useRef(null);
  useEffect(() => {
    const tip = ref.current;
    if (!tip) return undefined;
    const show = (e, text) => {
      tip.textContent = text;
      tip.hidden = false;
      const w = tip.offsetWidth;
      let x = e.clientX + 12;
      const y = e.clientY + 14;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 12;
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
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);
  return <div className="tip" ref={ref} hidden />;
}

// the information buttons are gone: the pages show numbers and charts, not descriptions
export const Info = () => null;

// Change against an earlier period, as a short badge (arrow and percent). Green when it is good news, red when not.
// Hovering the KPI shows the earlier value next to the current one (data-cmp).
export function deltaEl(cur, prev, fmt, lowerBetter, unit = "") {
  if (prev === null || prev === undefined) return null;
  const d = cur - prev, cmp = `Earlier ${fmt(prev)} → now ${fmt(cur)}`;
  if (Math.abs(d) < 1e-9 || fmt(Math.abs(d)) === fmt(0)) return <span className="t-flat dlt" data-cmp={cmp}>▬ 0%</span>;
  const up = d > 0, good = lowerBetter ? !up : up;
  const short = unit ? fmt(Math.abs(d)) + unit.replace(" points", " pts") : prev ? Math.min(100, Math.round(Math.abs(d / prev) * 100)) + (Math.abs(d / prev) > 1 ? "%+" : "%") : fmt(Math.abs(d));
  return <span className={(good ? "t-good" : "t-bad") + " dlt"} data-cmp={cmp}>{up ? "▲" : "▼"} {short}</span>;
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
export function Kpi({ label, value, delta, goto, onGo, spark, sparkColor, icon }) {
  const badge = findCmp(delta), tip = badge ? badge.props["data-cmp"] : textOf(delta).trim();
  return (
    <button className="kpi hasico" data-t={tip || undefined} onClick={() => goto && onGo && onGo(goto)}>
      <span className="kico"><Icon name={icon || kpiIcon(label)} size={18} /></span>
      <span className="kbody">
        <div className="l">{label}</div>
        <div className="v">{value}{badge ? <span className="vb">{badge}</span> : null}</div>
      </span>
    </button>
  );
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
