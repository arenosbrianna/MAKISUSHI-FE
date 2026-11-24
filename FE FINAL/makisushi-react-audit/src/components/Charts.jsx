// Charts, drawn with Recharts. Each component keeps the layout, colours, labels and tooltips of the original page.
import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, ScatterChart, PieChart, Pie, Bar, Line, Area, Cell, LabelList,
  XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, Customized, Treemap, Scatter,
} from "recharts";
import { num, kpeso } from "../lib/format.js";
import { niceMax, PAL, ramp } from "../lib/model.js";

const TICK = { fontSize: 11, fill: "#64748B" };
// Recharts calls formatters with (value, index); pass only the value, so a formatter such as num() never reads the index as its precision
const tf = (f) => (v) => f(v);

// Phones only (600 px wide or less): the horizontal bar charts use a narrower label column and just the first and last axis
// values, so the bars keep room and the axis numbers do not run into each other. Wider screens are unchanged.
const PHONE_Q = "(max-width: 600px)";
export function usePhone() {
  const [p, setP] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(PHONE_Q).matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(PHONE_Q), on = () => setP(m.matches);
    m.addEventListener ? m.addEventListener("change", on) : m.addListener(on);
    return () => (m.removeEventListener ? m.removeEventListener("change", on) : m.removeListener(on));
  }, []);
  return p;
}

// Even axis steps on a round number (1, 2 or 5 times a power of ten), so every tick label shows and the gaps match
export function niceTicks(top, steps = 4) {
  if (!(top > 0)) return { max: 1, ticks: [0, 0.5, 1] };
  const raw = top / steps, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  const n = Math.max(1, Math.ceil(top / step - 1e-9));
  return { max: step * n, ticks: Array.from({ length: n + 1 }, (_, k) => +(step * k).toPrecision(12)) };
}

// A ranked list, largest first, in one colour (no running share: it was hard to read and did not help a decision). Use with HBars (items).
export function rankWithShare(list, total, dark = "var(--accent)") {
  return { items: list.map(([name, v, id]) => [name, v, id, dark]), notes: undefined };
}

// Tooltip box in the same dark style as the original hover tip
function TipBox({ active, payload, label, metas }) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter((p) => metas[p.dataKey] && !metas[p.dataKey].notip && p.value !== null && p.value !== undefined);
  return (
    <div className="rc-tip">
      <b>{label}</b>
      {rows.map((p) => (
        <div key={p.dataKey}>{metas[p.dataKey].name}: {metas[p.dataKey].fmt(p.value)}</div>
      ))}
    </div>
  );
}

// A small forecast chart for one ingredient: what was used (blue), the forecast (orange) and the range it should fall in (shaded)
export function MiniForecast({ x, act, fc, lo, hi, todayIdx, fmt }) {
  const f = fmt || num;
  const data = x.map((d, i) => ({ d, act: act[i], fc: fc[i], band: lo[i] === null ? null : [lo[i], hi[i]] }));
  const metas = { act: { name: "Used", fmt: f }, fc: { name: "Forecast", fmt: f } };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <XAxis dataKey="d" hide />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip content={<TipBox metas={metas} />} isAnimationActive={false} />
        <Area dataKey="band" stroke="#B45309" strokeWidth={0.8} strokeDasharray="2 2" fill="#E8B88A" fillOpacity={0.4} isAnimationActive={false} />
        <ReferenceLine x={x[todayIdx]} stroke="#94A3B8" strokeDasharray="3 3" />
        <Line dataKey="act" stroke="#1E3A8A" strokeWidth={1.6} dot={false} isAnimationActive={false} />
        <Line dataKey="fc" stroke="#B45309" strokeWidth={1.8} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Bar + line combination (the original "chart" function). Lines can have a low-high band and be areas.
export function ComboChart({ x, h = 240, bars = [], lines = [], marks = [], shade, right = false, yfmt, y2fmt, refs = [], yband }) {
  const n = x.length;
  const data = x.map((label, i) => {
    const row = { x: label };
    bars.forEach((b, k) => { row[`b${k}`] = b.vals[i]; });
    lines.forEach((l, k) => {
      row[`l${k}`] = l.vals[i];
      if (l.hi) { const ok = l.hi[i] !== null && l.hi[i] !== undefined && l.lo[i] !== null && l.lo[i] !== undefined; row[`lo${k}`] = ok ? l.lo[i] : null; row[`band${k}`] = ok ? l.hi[i] - l.lo[i] : null; }
    });
    return row;
  });
  const metas = {};
  bars.forEach((b, k) => { metas[`b${k}`] = { name: b.name, fmt: b.fmt || yfmt || num, notip: b.notip }; });
  lines.forEach((l, k) => { metas[`l${k}`] = { name: l.name, fmt: l.fmt || yfmt || num, notip: l.notip }; });
  const usesRight = right || bars.some((b) => b.axis === "r") || lines.some((l) => l.axis === "r");
  const axisOf = (s) => (s.axis === "r" ? "r" : "l");
  const every = n <= 12 ? 0 : "preserveStartEnd";
  // even steps on the left axis (1, 2 or 5 times a power of ten) when everything on it is zero or more
  const leftVals = [...bars.filter((b) => axisOf(b) === "l").flatMap((b) => b.vals),
    ...lines.filter((l) => axisOf(l) === "l").flatMap((l) => [...l.vals, ...(l.hi || [])]),
    ...refs.map((r) => r.y), ...(yband ? [yband[0], yband[1]] : [])].filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  const nt = leftVals.length && Math.min(...leftVals) >= 0 && Math.max(...leftVals) > 0 ? niceTicks(Math.max(...leftVals), 5) : null;

  return (
    <div className="rc" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: usesRight ? 46 : 10, left: 0, bottom: 6 }}>
          <XAxis dataKey="x" tick={TICK} interval={every} minTickGap={6} tickLine={false} axisLine={{ stroke: "var(--line)" }} height={26} />
          <YAxis yAxisId="l" width={46} tick={TICK} tickLine={false} axisLine={false} domain={nt ? [0, nt.max] : [0, "auto"]} ticks={nt ? nt.ticks : undefined} interval={nt ? 0 : undefined} tickFormatter={tf(yfmt || num)} />
          {usesRight && <YAxis yAxisId="r" orientation="right" width={46} tick={TICK} tickLine={false} axisLine={false} domain={[0, "auto"]} tickFormatter={tf(y2fmt || num)} />}
          <Tooltip content={<TipBox metas={metas} />} cursor={{ fill: "transparent" }} isAnimationActive={false} />
          {shade && <ReferenceArea yAxisId="l" x1={x[shade[0]]} x2={x[Math.max(shade[0], shade[1] - 1)]} fill="var(--warn-soft)" fillOpacity={0.75} ifOverflow="extendDomain"
            label={{ value: shade[2], position: "insideTopLeft", fill: "var(--warn)", fontWeight: 600, fontSize: 11 }} />}
          {yband && <ReferenceArea yAxisId="l" y1={yband[0]} y2={yband[1]} fill="var(--good)" fillOpacity={0.09} stroke="none" ifOverflow="extendDomain"
            label={{ value: yband[2], position: "insideTopRight", fill: "var(--good)", fontWeight: 600, fontSize: 11 }} />}
          {refs.map((r, k) => (
            <ReferenceLine key={"r" + k} yAxisId="l" y={r.y} stroke={r.color || "var(--bad)"} strokeDasharray="5 4" strokeWidth={1.4} ifOverflow="extendDomain"
              label={r.label ? { value: r.label, position: r.labelPos || "insideTopRight", fill: r.color || "var(--bad)", fontWeight: 600, fontSize: 11 } : undefined} />
          ))}
          {marks.map(([i, lab, col], k) => (
            <ReferenceLine key={"m" + k} yAxisId="l" x={x[i]} stroke={col || "var(--accent)"} strokeDasharray={col ? undefined : "2 4"} strokeWidth={col ? 2 : 1} strokeOpacity={0.85}
              label={{ value: lab, position: "insideTop", fill: col || "var(--accent)", fontWeight: 700, fontSize: 11 }} />
          ))}
          {bars.map((b, k) => (
            <Bar key={"b" + k} yAxisId={axisOf(b)} dataKey={`b${k}`} fill={b.color || "var(--accent)"} fillOpacity={b.op || 1} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {b.colors && b.colors.map((c, i) => <Cell key={i} fill={c} />)}
              {b.texts && <LabelList dataKey={`b${k}`} content={(p) => { const t = b.texts[p.index]; return t && t[0] ? <text x={p.x + p.width / 2} y={p.y - 6} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: t[1] || "#334155" }}>{t[0]}</text> : null; }} />}
              {b.labels && (n <= 12 || b.labelsAlways) && (
                <LabelList dataKey={`b${k}`} position="top" formatter={tf(b.lfmt || yfmt || num)}
                  style={{ fontSize: 10.5, fontWeight: 600, fill: "#334155" }} />
              )}
            </Bar>
          ))}
          {lines.flatMap((l, k) => {
            // Recharts only sees its own components as direct children, so return a flat list (no wrapper elements)
            const yid = axisOf(l), out = [];
            if (l.hi) {
              out.push(<Area key={`lo${k}`} yAxisId={yid} dataKey={`lo${k}`} stackId={`band${k}`} stroke={l.color} strokeWidth={0.8} strokeDasharray="3 3" fill="transparent" isAnimationActive={false} legendType="none" />);
              out.push(<Area key={`band${k}`} yAxisId={yid} dataKey={`band${k}`} stackId={`band${k}`} stroke={l.color} strokeWidth={0.8} strokeDasharray="3 3" fill={l.color} fillOpacity={0.16} isAnimationActive={false} legendType="none" />);
            }
            if (l.area) out.push(<Area key={`area${k}`} yAxisId={yid} dataKey={`l${k}`} stroke={l.color} strokeWidth={0} fill={l.color} fillOpacity={0.14} connectNulls={false} dot={false} isAnimationActive={false} legendType="none" />);
            out.push(<Line key={`line${k}`} yAxisId={yid} dataKey={`l${k}`} stroke={l.color} strokeWidth={l.w === undefined ? 2.2 : l.w} strokeOpacity={l.op === undefined ? 1 : l.op}
              strokeDasharray={l.dash ? "6 4" : undefined} connectNulls={false} isAnimationActive={false}
              dot={!l.nodots && n <= 40 ? { r: 2.6, fill: l.color, strokeWidth: 0 } : false} activeDot={{ r: 4 }} />);
            return out;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Wrapped category tick (two lines at most, like the original labels)
// anchor "end" for the labels beside a vertical axis, "middle" for labels under a horizontal axis
function WrapTick({ x, y, payload, width = 26, anchor = "end", fontSize = 11, fill = "#334155", lineH = 12 }) {
  const words = String(payload.value).split(" ");
  const lines = [""];
  words.forEach((w) => {
    const c = lines[lines.length - 1];
    if ((c + " " + w).trim().length > width && c) lines.push(w);
    else lines[lines.length - 1] = (c + " " + w).trim();
  });
  let out = lines;
  if (lines.length > 2) {
    const rest = lines.slice(1).join(" ");
    out = [lines[0], rest.length > width + 1 ? rest.slice(0, width) + "…" : rest];
  }
  const firstDy = anchor === "middle" ? fontSize + 4 : 4 - ((out.length - 1) * lineH) / 2;
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={fontSize} fill={fill}>
      {out.map((t, j) => (
        <tspan key={j} x={x} dy={j === 0 ? firstDy : lineH}>{t}</tspan>
      ))}
    </text>
  );
}

// Marks drawn on top of horizontal bars (targets, order levels)
// labels: when given, each row's value label is drawn after the bar or its farthest mark, whichever ends later
function BarMarks({ xAxisMap, yAxisMap, rows, marks, labels }) {
  const xa = xAxisMap && Object.values(xAxisMap)[0];
  const ya = yAxisMap && Object.values(yAxisMap)[0];
  if (!xa || !ya) return null;
  const band = ya.bandSize || 0;
  return (
    <g>
      {marks.map((mk, mi) => rows.map((r, ri) => {
        const v = mk.vals[ri];
        if (v === undefined || v === null) return null;
        const cx = xa.scale(v), cy = ya.scale(r.name) + band / 2;
        return <rect key={mi + "-" + ri} x={cx - 1.5} y={cy - 7} width={3} height={14} fill={mk.color} />;
      }))}
      {labels && rows.map((r, ri) => {
        const end = Math.max(r.v || 0, ...marks.map((mk) => (mk.vals[ri] === null || mk.vals[ri] === undefined ? 0 : mk.vals[ri])));
        return (
          <text key={"l" + ri} x={xa.scale(end) + 7} y={ya.scale(r.name) + band / 2} dominantBaseline="central" style={{ fontSize: 10.5, fontWeight: 600, fill: "#334155" }}>
            {labels[ri]}
          </text>
        );
      })}
    </g>
  );
}

// Horizontal bars with labels on the left (the original "hbar")
// notes: optional text per row, shown after the value (for example a growth figure or a class)
// fill: stretch the rows to the height of the card (never thinner than 13px a row) instead of a fixed 26px a row
export function HBars({ items, w, marks, axis, fmt, shade, color, click, onRow, label, max, labelWidth: lw0 = 170, notes, values = true, fill = false }) {
  const phone = usePhone(), labelWidth = phone ? Math.min(lw0, 92) : lw0;
  const n = items.length;
  const rowH = 26, H = 6 + n * rowH + 30;
  const f = fmt || num;
  const data = items.map((i, k) => ({ name: i[0], v: i[1], id: i[2], color: i[3], lab: f(i[1]) + (notes && notes[k] ? " · " + notes[k] : "") }));
  const topVal = Math.max(0, ...items.map((i) => i[1]), ...(marks || []).flatMap((m) => m.vals));
  const nt = max ? null : niceTicks(topVal * 1.12, 4);
  const mx = max || nt.max;
  const maxRow = Math.max(...items.map((i) => i[1]), 1);
  const metas = { v: { name: label || "", fmt: f } };
  const rowColor = (d) => d.color || (shade === "cat" ? PAL[data.indexOf(d) % PAL.length] : shade ? ramp(d.v / maxRow, shade) : color || "var(--accent)");
  // room on the right for the longest value label (drawn as plain text, so short bars do not wrap it)
  const rightPad = Math.max(marks ? 56 : 36, values ? Math.round(Math.max(0, ...data.map((d) => d.lab.length)) * (phone ? 5.6 : 6.2)) + 14 : 16);
  return (
    <div className={fill ? "cwrap" : "hbars"}>
      <div className="rc" style={{ height: H, minHeight: fill ? 6 + n * 13 + 30 : undefined }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 6, right: rightPad, left: 0, bottom: 24 }} barCategoryGap="30%">
            <XAxis type="number" domain={[0, mx]} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(axis || num)}
              ticks={phone ? [0, mx] : nt ? nt.ticks : undefined} interval={nt || phone ? 0 : undefined} tickCount={nt || phone ? undefined : 5} />
            <YAxis type="category" dataKey="name" width={labelWidth} interval={0} tickLine={false} axisLine={false} tick={<WrapTick width={Math.round(labelWidth / (fill ? 6.4 : 7))} fontSize={fill || phone ? 10.5 : 11} />} />
            <Tooltip content={<TipBox metas={metas} />} cursor={{ fill: "transparent" }} isAnimationActive={false} />
            <Bar dataKey="v" isAnimationActive={false} radius={[2, 2, 2, 2]} cursor={click ? "pointer" : undefined}
              onClick={(e) => click && onRow && e && e.payload && onRow(e.payload.id)}>
              {data.map((d, i) => <Cell key={i} fill={rowColor(d)} />)}
              {values && !marks && <LabelList dataKey="lab" content={(p) => (
                <text x={p.x + p.width + 6} y={p.y + p.height / 2} dominantBaseline="central" style={{ fontSize: 10.5, fontWeight: 600, fill: "#334155" }}>
                  {data[p.index] ? data[p.index].lab : ""}
                </text>
              )} />}
            </Bar>
            {marks && <Customized component={<BarMarks rows={data} marks={marks} labels={values ? data.map((d) => d.lab) : null} />} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Stacked horizontal bars, one row per item (a ranking split into parts): items [name, id], series [{name, color, vals}]
export function StackH({ items, series, fmt, axis, label, labelWidth: lw0 = 150, onRow }) {
  const phone = usePhone(), labelWidth = phone ? Math.min(lw0, 92) : lw0;
  const n = items.length, f = fmt || num;
  const data = items.map((it, i) => {
    const row = { name: it[0], id: it[1] };
    let t = 0;
    series.forEach((s, j) => { row["s" + j] = s.vals[i]; t += s.vals[i]; });
    row.tot = t;
    return row;
  });
  const metas = {};
  series.forEach((s, j) => { metas["s" + j] = { name: s.name, fmt: f }; });
  const nt = niceTicks(Math.max(0, ...data.map((d) => d.tot)) * 1.12, 4);
  return (
    <div className="cwrap">
      <div className="rc" style={{ height: 6 + n * 26 + 30, minHeight: 6 + n * 13 + 30 }} aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 6, right: 64, left: 0, bottom: 24 }} barCategoryGap="30%">
            <XAxis type="number" domain={[0, nt.max]} ticks={phone ? [0, nt.max] : nt.ticks} interval={0} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(axis || num)} />
            <YAxis type="category" dataKey="name" width={labelWidth} interval={0} tickLine={false} axisLine={false} tick={<WrapTick width={Math.round(labelWidth / 6.4)} fontSize={10.5} />} />
            <Tooltip content={<TipBox metas={metas} />} cursor={{ fill: "transparent" }} isAnimationActive={false} />
            {series.map((s, j) => (
              <Bar key={j} dataKey={"s" + j} stackId="a" fill={s.color} isAnimationActive={false} cursor={onRow ? "pointer" : undefined}
                onClick={(e) => onRow && e && e.payload && onRow(e.payload.id)}>
                {j === series.length - 1 && <LabelList dataKey="tot" content={(p) => (
                  <text x={p.x + p.width + 6} y={p.y + p.height / 2} dominantBaseline="central" style={{ fontSize: 10.5, fontWeight: 600, fill: "#334155" }}>{data[p.index] ? f(data[p.index].tot) : ""}</text>
                )} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">{series.map((s, j) => <span key={j}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}

// Diverging horizontal bars: up (good) and down (warn) from a zero line (the original "divbars")
export function DivBars({ items, label, up = "Up", down = "Down", labelWidth = 190, upColor = "var(--good)", downColor = "var(--warn)", unitFmt, floor = 0.1 }) {
  const n = items.length;
  const rowH = n > 8 ? 22 : n > 6 ? 26 : 30, H = 6 + n * rowH + 28;
  const M = niceMax(Math.max(floor, ...items.map((i) => (i[1] === null ? 0 : Math.abs(i[1])))) * 1.35);
  const lab = unitFmt || ((v) => (Math.round(v * 100) > 0 ? "+" : Math.round(v * 100) < 0 ? "−" : "") + Math.abs(Math.round(v * 100)) + "%");
  const data = items.map((i) => ({ name: i[0], v: i[1] === null ? null : i[1] }));
  return (
    <div className="hbars">
      <div className="rc" style={{ height: H }} aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 6, right: 34, left: 0, bottom: 22 }} barCategoryGap="30%">
            <XAxis type="number" domain={[-M, M]} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(lab)} ticks={[-M, 0, M]} interval={0} />
            <YAxis type="category" dataKey="name" width={labelWidth} interval={0} tickLine={false} axisLine={false} tick={<WrapTick width={Math.round(labelWidth / 6.5)} />} />
            <ReferenceLine x={0} stroke="#94A3B8" />
            <Tooltip cursor={{ fill: "transparent" }} isAnimationActive={false}
              content={({ active, payload }) => (active && payload && payload[0] && payload[0].value !== null ? (
                <div className="rc-tip"><b>{payload[0].payload.name}</b>{lab(payload[0].value)}</div>) : null)} />
            <Bar dataKey="v" isAnimationActive={false} radius={[2, 2, 2, 2]}>
              {data.map((d, i) => <Cell key={i} fill={d.v !== null && d.v < 0 ? downColor : upColor} />)}
              <LabelList dataKey="v" position="right" formatter={tf((v) => (v === null || v === undefined ? "" : lab(v)))}
                style={{ fontSize: 10.5, fontWeight: 600, fill: "#334155" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend"><span><i style={{ background: upColor }} />{up}</span><span><i style={{ background: downColor }} />{down}</span></div>
    </div>
  );
}

// Diverging columns for months (the original "divcols")
// yaxis={false} drops the axis when every column carries its value
export function DivCols({ items, label, up = "Up", down = "Down", short = true, h = 270, upColor = "var(--good)", downColor = "var(--warn)", yaxis = true }) {
  const M = niceMax(Math.max(0.1, ...items.map((i) => (i[1] === null ? 0 : Math.abs(i[1])))) * 1.35);
  const lab = (v) => (v === null || v === undefined ? "" : (Math.round(v * 100) > 0 ? "+" : Math.round(v * 100) < 0 ? "−" : "") + Math.abs(Math.round(v * 100)) + "%");
  const data = items.map((i) => ({ name: short ? i[0].slice(0, 3) : i[0], full: i[0], v: i[1] }));
  return (
    <div className="cwrap">
      <div className="rc" style={{ height: h }} aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 4 }} barCategoryGap="30%">
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} height={30} />
            <YAxis domain={[-M, M]} width={yaxis ? 46 : 0} hide={!yaxis} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(lab)} />
            <ReferenceLine y={0} stroke="#94A3B8" />
            <Tooltip cursor={{ fill: "transparent" }} isAnimationActive={false}
              content={({ active, payload }) => (active && payload && payload[0] ? (
                <div className="rc-tip"><b>{payload[0].payload.full}</b>{lab(payload[0].value)}</div>) : null)} />
            <Bar dataKey="v" isAnimationActive={false} radius={[2, 2, 2, 2]}>
              {data.map((d, i) => <Cell key={i} fill={d.v >= 0 ? upColor : downColor} />)}
              <LabelList dataKey="v" position="top" formatter={tf(lab)} style={{ fontSize: 10.5, fontWeight: 600, fill: "#334155" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend"><span><i style={{ background: upColor }} />{up}</span><span><i style={{ background: downColor }} />{down}</span></div>
    </div>
  );
}

// Stock walk: balances from zero and moves that float (the original "waterfall")
export function Waterfall({ steps, fmt, axis, label, w }) {
  let run = 0;
  const bars = steps.map((s) => {
    if (s[2] === "total") { run = s[1]; return { s, lo: 0, hi: s[1], end: s[1] }; }
    const a = run, b = run + s[1];
    run = b;
    return { s, lo: Math.min(a, b), hi: Math.max(a, b), end: b };
  });
  const f = fmt || num;
  const data = bars.map((b) => {
    const tot = b.s[2] === "total";
    return {
      name: b.s[0],
      base: b.lo,
      seg: Math.max(1.5, b.hi - b.lo),
      color: tot ? "var(--accent)" : b.s[1] >= 0 ? "var(--good)" : "var(--warn)",
      txt: (tot || /^0(\.0+)?%?$/.test(f(Math.abs(b.s[1]))) ? "" : b.s[1] >= 0 ? "+" : "−") + f(Math.abs(b.s[1])),
      full: `${b.s[0]}: ${f(Math.abs(b.s[1]))}`,
    };
  });
  return (
    <div className="cwrap">
      <div className="rc" style={{ height: 250, maxWidth: w || 640, margin: "0 auto" }} aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 10, left: 0, bottom: 30 }} barCategoryGap="30%">
            <XAxis dataKey="name" tick={<WrapTick width={7} anchor="middle" fontSize={12} fill="#1E293B" lineH={14} />} tickLine={false} axisLine={false} interval={0} height={56} />
            <YAxis width={52} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(axis || num)} domain={[0, "auto"]} />
            <Tooltip cursor={{ fill: "transparent" }} isAnimationActive={false}
              content={({ active, payload }) => (active && payload && payload[0] ? (
                <div className="rc-tip"><b>{payload[0].payload.full}</b></div>) : null)} />
            <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} legendType="none" />
            <Bar dataKey="seg" stackId="w" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              <LabelList dataKey="txt" content={(p) => (
                <text x={p.x + p.width / 2} y={p.y - 6} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 600, fill: "#334155" }}>{data[p.index] ? data[p.index].txt : ""}</text>
              )} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend"><span><i style={{ background: "var(--accent)" }} />Stock on hand</span><span><i style={{ background: "var(--good)" }} />Added</span><span><i style={{ background: "var(--warn)" }} />Taken away</span></div>
    </div>
  );
}

// Pareto: bars by value, a line for the running share of the total, and an 80% mark
export function Pareto({ items, total, fmt, axis, name, label, mark = "80% of the loss", maxW = 640 }) {
  const tot = total || items.reduce((s, i) => s + i[1], 0) || 1;
  let acc = 0;
  const cum = items.map((i) => (acc += i[1]) / tot);
  const k80 = cum.findIndex((c) => c >= 0.8);
  const f = fmt || num;
  const data = items.map((i, k) => ({
    name: i[0].length > 16 ? i[0].slice(0, 15) + "…" : i[0],
    full: i[0],
    v: i[1],
    cum: cum[k],
    color: k80 >= 0 && k <= k80 ? "var(--accent)" : "#93A4D6",
  }));
  return (
    <div className="cwrap">
      <div className="rc" style={{ height: 300, maxWidth: maxW, margin: "0 auto" }} aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 14, right: 44, left: 0, bottom: 56 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: "#334155" }} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={0} angle={-40} textAnchor="end" height={66} />
            <YAxis yAxisId="l" width={52} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(axis || num)} domain={[0, "auto"]} />
            <YAxis yAxisId="r" orientation="right" width={44} tick={TICK} tickLine={false} axisLine={false} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={tf((v) => Math.round(v * 100) + "%")} />
            <ReferenceLine yAxisId="r" y={0.8} stroke="var(--bad)" strokeDasharray="5 4"
              label={{ value: mark, position: "insideBottomRight", fill: "var(--bad)", fontSize: 10.5, dy: 14 }} />
            <Tooltip cursor={{ fill: "transparent" }} isAnimationActive={false}
              content={({ active, payload }) => (active && payload && payload[0] ? (
                <div className="rc-tip"><b>{payload[0].payload.full}</b>{f(payload[0].payload.v)} · running total {Math.round(payload[0].payload.cum * 100)}%</div>) : null)} />
            <Bar yAxisId="l" dataKey="v" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
            <Line yAxisId="r" dataKey="cum" stroke="#D97706" strokeWidth={2} dot={{ r: 2.6, fill: "#D97706", strokeWidth: 0 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--accent)" }} />{name || "Amount"} (the few that make up 80%)</span>
        <span><i style={{ background: "#93A4D6" }} />The rest</span>
        <span><i style={{ background: "#D97706" }} />Running share of the total</span>
      </div>
    </div>
  );
}

// Stacked columns, one colour per series (the original "stackcols")
export function StackCols({ keys, series, fmt, axis, label, w }) {
  const data = keys.map((k, i) => {
    const row = { x: k };
    series.forEach((s, j) => { row[`s${j}`] = s.vals[i]; });
    return row;
  });
  const metas = {};
  series.forEach((s, j) => { metas[`s${j}`] = { name: s.name, fmt: fmt || num }; });
  const many = keys.length > 12;
  // small whole-number counts get whole-number ticks (0, 1, 2), not 0, 0.25, 0.5
  const top = Math.max(0, ...data.map((r) => series.reduce((t, _, j) => t + (r[`s${j}`] || 0), 0)));
  const whole = top <= 6 && series.every((s) => s.vals.every((v) => Number.isInteger(v || 0)));
  return (
    <div className="cwrap">
      <div className="rc" style={{ height: 260, maxWidth: w || 640, margin: "0 auto" }} aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 10, left: 0, bottom: 6 }} barCategoryGap="25%">
            <XAxis dataKey="x" tick={TICK} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={many ? "preserveStartEnd" : 0} height={28} />
            <YAxis width={52} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(axis || num)} domain={whole ? [0, Math.max(1, top)] : [0, "auto"]}
              allowDecimals={!whole} ticks={whole ? Array.from({ length: Math.max(1, top) + 1 }, (_, k) => k) : undefined} />
            <Tooltip content={<TipBox metas={metas} />} cursor={{ fill: "transparent" }} isAnimationActive={false} />
            {series.map((s, j) => <Bar key={j} dataKey={`s${j}`} stackId="c" fill={s.color} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">{series.map((s, j) => <span key={j}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}

// Treemap of stock value: a box per ingredient, coloured by group
// only boxes big enough get a label; the label is plain white text
function TreeCell({ x, y, width, height, index, leaves }) {
  const leaf = leaves[index];
  if (!leaf || width <= 0 || height <= 0) return null;
  const big = width > 84 && height > 44;
  const maxChars = Math.max(4, Math.floor((width - 14) / 6.8));
  const nm = leaf.name.length > maxChars ? leaf.name.slice(0, maxChars - 1) + "…" : leaf.name;
  const ink = "#FFFFFF";
  return (
    <g>
      <rect x={x} y={y} width={Math.max(0, width - 2)} height={Math.max(0, height - 2)} rx={3} fill={leaf.color} stroke="#fff" />
      {big && (
        <>
          <text x={x + 8} y={y + 17} fontSize={12} fontWeight={400} style={{ fill: ink }}>{nm}</text>
          <text x={x + 8} y={y + 33} fontSize={11} fontWeight={400} style={{ fill: ink }}>{leaf.fmt(leaf.value)}</text>
        </>
      )}
    </g>
  );
}
export function TreemapChart({ groups, fmt, label, w = 760, h = 300 }) {
  const leaves = groups.flatMap((g) => g.items
    .filter((i) => i[1] > 0)
    .map((i) => ({ name: i[0], value: i[1], size: i[1], color: g.color, group: g.name, fmt })));
  const tot = leaves.reduce((s, l) => s + l.value, 0) || 1;
  const legend = groups.map((g) => ({ name: g.name, color: g.color, share: g.items.reduce((s, i) => s + i[1], 0) / tot }));
  return (
    <div className="cwrap">
      <div className="rc" style={{ height: h, maxWidth: w, margin: "0 auto" }} aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={leaves} dataKey="size" aspectRatio={4 / 3} isAnimationActive={false} stroke="#fff"
            content={<TreeCell leaves={leaves} />} />
        </ResponsiveContainer>
      </div>
      <div className="legend">{legend.map((g) => <span key={g.name}><i style={{ background: g.color }} />{g.name} · {Math.round(g.share * 100)}%</span>)}</div>
    </div>
  );
}

// Heatmap in Recharts: one stacked bar per row, one equal segment per column, each segment coloured by value.
// rows: [{ name, cells: [{ fill, ink, text, tip }] }]; cols: column headings shown above the chart.
export function HeatChart({ rows, cols, labelWidth = 120, rowH = 30 }) {
  const data = rows.map((r) => {
    const d = { name: r.name };
    cols.forEach((_, j) => { d["c" + j] = 1; });
    return d;
  });
  const tipOf = (label, key) => {
    const r = rows.find((x) => x.name === label);
    const j = Number(String(key).slice(1));
    return r && r.cells[j] ? r.cells[j].tip : "";
  };
  return (
    <div className="heatchart">
      <div className="heat-cols" style={{ marginLeft: labelWidth, gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
        {cols.map((c, j) => <span key={j}>{c}</span>)}
      </div>
      <div className="rc" style={{ height: rows.length * rowH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="6%">
            <defs>
              {/* hatching for cells that cover only part of a period */}
              <pattern id="hatchPart" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#E2E8F0" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#94A3B8" strokeWidth="2" />
              </pattern>
            </defs>
            <XAxis type="number" hide domain={[0, cols.length]} />
            <YAxis type="category" dataKey="name" width={labelWidth} interval={0} tickLine={false} axisLine={false} tick={<WrapTick width={Math.round(labelWidth / 6.5)} />} />
            <Tooltip cursor={{ fill: "transparent" }} isAnimationActive={false}
              content={({ active, payload, label }) => (active && payload && payload[0] ? <div className="rc-tip">{tipOf(label, payload[0].dataKey)}</div> : null)} />
            {cols.map((_, j) => (
              <Bar key={j} dataKey={"c" + j} stackId="h" stroke="#FFFFFF" strokeWidth={2} isAnimationActive={false}>
                {rows.map((r, i) => <Cell key={i} fill={r.cells[j].hatch ? "url(#hatchPart)" : r.cells[j].fill} />)}
                <LabelList dataKey={"c" + j} content={(p) => {
                  const cell = rows[p.index] && rows[p.index].cells[j];
                  if (!cell || !cell.text) return null;
                  return (
                    <text x={p.x + p.width / 2} y={p.y + p.height / 2} textAnchor="middle" dominantBaseline="central" style={{ fill: cell.ink, fontSize: 11 }}>
                      {cell.text}
                    </text>
                  );
                }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Progress meter in Recharts: a coloured part of the bar, with the rest of the track in pale grey
export function MeterChart({ fraction, color }) {
  const f = Math.max(0, Math.min(1, fraction));
  const data = [{ name: "m", v: f, rest: 1 - f }];
  return (
    <div className="rc meterrc" style={{ height: 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
          <XAxis type="number" hide domain={[0, 1]} />
          <YAxis type="category" dataKey="name" hide />
          <Bar dataKey="v" stackId="m" fill={color} radius={[8, 0, 0, 8]} barSize={12} isAnimationActive={false} />
          <Bar dataKey="rest" stackId="m" fill="#F1F5F9" radius={[0, 8, 8, 0]} barSize={12} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Correlation strength from -1 to +1 in Recharts: green to the right (sells more when hot), amber to the left
export function CorrelationBar({ r }) {
  const data = [{ name: "r", v: r }];
  return (
    <div className="rc corr" style={{ height: 22 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
          <XAxis type="number" hide domain={[-1, 1]} />
          <YAxis type="category" dataKey="name" hide />
          <ReferenceLine x={0} stroke="#94A3B8" />
          <Bar dataKey="v" fill={r >= 0 ? "var(--good)" : "var(--warn)"} barSize={12} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Ring or full pie of 2 to 5 parts (the original "donut")
// size="auto" fits the ring to the card it sits in (so the card has no empty space); a number is a fixed size in pixels
export function Donut({ items, pie, colors, fmt, center, sub, label, size = 140, counts }) {
  const auto = size === "auto";
  const box = useRef(null);
  const [dim, setDim] = useState(null);
  useEffect(() => {
    if (!auto || !box.current) return undefined;
    const el = box.current;
    const read = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [auto]);
  const stack = auto && !!dim && dim.w < 340;
  const px = auto ? (stack ? Math.max(90, Math.min(230, Math.floor(Math.min(dim.h - 8 - items.length * 24, dim.w - 12)))) : Math.max(100, Math.min(250, Math.floor(Math.min((dim ? dim.h : 150) - 6, (dim ? dim.w : 300) * 0.52))))) : size;
  size = px;
  const pal = colors || PAL;
  const tot = items.reduce((s, i) => s + i[1], 0) || 1;
  const data = items.map((i, k) => ({ name: i[0], v: i[1], color: pal[k % pal.length] }));
  return (
    <div className={"donut" + (auto ? " auto" : "") + (stack ? " stack" : "")} ref={box}>
      <div style={{ position: "relative", width: size, height: size, flex: "none" }} role="img" aria-label={label}>
        <PieChart width={size} height={size}>
          <Pie data={data} dataKey="v" cx={size / 2} cy={size / 2} innerRadius={pie ? 0 : size * 0.29} outerRadius={pie ? size * 0.486 : size * 0.443}
            startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
        {!pie && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{center || ""}</div>
            <div style={{ fontSize: 10, color: "#64748B" }}>{sub || ""}</div>
          </div>
        )}
      </div>
      <ul>
        {data.map((d) => (
          <li key={d.name}><i style={{ background: d.color }} /><span className="dn">{d.name}</span><b>{counts ? num(d.v) + " · " + (d.v / tot * 100).toFixed(0) + "%" : (d.v / tot * 100).toFixed(1) + "%"}</b></li>
        ))}
      </ul>
    </div>
  );
}

// Bullet graph (Stephen Few): the dark bar is the measure, the black tick is the target,
// the dashed amber line is where the measure should be by now (pace), and the pale bands mark up to and past the target.
export function BulletChart({ value, target, pace, fmt, h = 30 }) {
  const top = Math.max(value, target, pace || 0) * 1.08 || 1;
  const nt = niceTicks(top, 4);
  const data = [{ name: "b", band: target, over: Math.max(0, nt.max - target), v: value }];
  const over = value > target;
  return (
    <div className="rc bullet" style={{ height: h + 22 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 2, right: 16, bottom: 0, left: 0 }} barCategoryGap={0}>
          <XAxis type="number" domain={[0, nt.max]} ticks={nt.ticks} interval={0} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(fmt || num)} height={20} />
          <YAxis type="category" dataKey="name" yAxisId="bg" hide />
          <YAxis type="category" dataKey="name" yAxisId="fg" hide />
          <Bar yAxisId="bg" dataKey="band" stackId="r" fill="#E2E8F0" barSize={h - 6} isAnimationActive={false} />
          <Bar yAxisId="bg" dataKey="over" stackId="r" fill="#F8FAFC" barSize={h - 6} isAnimationActive={false} />
          <Bar yAxisId="fg" dataKey="v" fill={over ? "var(--bad)" : "var(--accent)"} barSize={Math.max(6, Math.round((h - 6) / 3))} isAnimationActive={false} />
          <ReferenceLine yAxisId="fg" x={target} stroke="#0F172A" strokeWidth={3} />
          {pace !== undefined && pace !== null && <ReferenceLine yAxisId="fg" x={pace} stroke="#D97706" strokeWidth={2} strokeDasharray="3 2" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Word-sized trend line for a KPI tile (no axes)
export function Sparkline({ vals, color = "var(--accent)", h = 26 }) {
  const data = vals.map((v, i) => ({ i, v }));
  if (data.length < 2) return null;
  return (
    <div className="rc spark" style={{ height: h }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line dataKey="v" stroke={color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Menu engineering matrix: each dish by how many sold (popularity) and what it earns per plate after ingredient cost (margin).
// The dashed lines are the menu averages; they split the dishes into Stars, Plowhorses, Puzzles and Dogs.
export const MENU_CLASS = {
  Star: { color: "var(--good)", hint: "Sells well and earns well: keep it visible and the recipe steady" },
  Plowhorse: { color: "var(--accent)", hint: "Sells well, earns little: raise the price a little or trim the recipe cost" },
  Puzzle: { color: "#D97706", hint: "Earns well, sells little: promote it, rename it or move it up the menu" },
  Dog: { color: "#94A3B8", hint: "Sells little and earns little: consider taking it off the menu" },
};
export function MenuMatrix({ pts, xMid, yMid, fx, fy, h = 340 }) {
  // round ticks that read well on a square-root scale
  const xmax = Math.max(1, ...pts.map((p) => p.x));
  const xt = [0, 5, 10, 25, 50, 100, 200, 300, 500, 1000, 2000].filter((t) => t <= xmax * 1.05);
  return (
    <div className="rc" style={{ height: h }} aria-label="Menu engineering matrix">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 14, right: 18, bottom: 22, left: 4 }}>
          <XAxis type="number" dataKey="x" name="Sold" scale="sqrt" domain={[0, "dataMax"]} ticks={xt} interval={0} tick={TICK} tickLine={false} axisLine={{ stroke: "var(--line)" }} tickFormatter={tf(fx || num)}
            label={{ value: "Plates sold (popularity, square-root scale) →", position: "insideBottomRight", offset: -14, fill: "#64748B", fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name="Margin" width={58} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(fy || num)}
            label={{ value: "Margin per plate →", angle: -90, position: "insideLeft", offset: 12, fill: "#64748B", fontSize: 11 }} />
          <ReferenceLine x={xMid} stroke="#94A3B8" strokeDasharray="5 4" />
          <ReferenceLine y={yMid} stroke="#94A3B8" strokeDasharray="5 4" />
          <Tooltip cursor={false} isAnimationActive={false}
            content={({ active, payload }) => (active && payload && payload[0] ? (
              <div className="rc-tip"><b>{payload[0].payload.name}</b>
                <div>{payload[0].payload.cls} · {num(payload[0].payload.x)} sold · {(fy || num)(payload[0].payload.y)} margin a plate</div></div>) : null)} />
          <Scatter data={pts} isAnimationActive={false}>
            {pts.map((p, i) => <Cell key={i} fill={MENU_CLASS[p.cls].color} fillOpacity={0.8} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// Trade-off between running out and waste: one point per setting, the settings of one rule joined by a line,
// and single points for comparison (for example what the restaurant did). Down and to the left is better.
export function TradeoffChart({ frontier, marks = [], h = 330 }) {
  const tipOf = (p) => (
    <div className="rc-tip"><b>{p.label}</b><div>{num(p.x)} stock-outs · ₱{num(p.y)} waste{p.extra ? ` · ${p.extra}` : ""}</div></div>
  );
  // plain one-line labels (Recharts' own labels wrap to the width of the dot); a frontier point can ask for
  // its label below and to the left (lpos: "below") when the point above it is close
  const lab = (dx, dy, anchor, style, rows) => ({ x, y, width = 0, height = 0, value, index }) => {
    if (!value) return null;
    const below = rows && rows[index] && rows[index].lpos === "below";
    return <text x={x + width / 2 + (below ? -8 : dx)} y={y + height / 2 + (below ? 16 : dy)} textAnchor={below ? "end" : anchor} style={style}>{value}</text>;
  };
  return (
    <div className="rc" style={{ height: h }} aria-label="Waste against stock-outs">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 18, right: 90, bottom: 22, left: 6 }}>
          <XAxis type="number" dataKey="x" tick={TICK} tickLine={false} axisLine={{ stroke: "var(--line)" }} domain={[0, "auto"]} tickFormatter={tf(num)}
            label={{ value: "Stock-outs in a year →", position: "insideBottomRight", offset: -14, fill: "#64748B", fontSize: 11 }} />
          <YAxis type="number" dataKey="y" width={60} tick={TICK} tickLine={false} axisLine={false} domain={[0, "auto"]} tickFormatter={tf(kpeso)}
            label={{ value: "Waste →", angle: -90, position: "insideLeft", offset: 14, fill: "#64748B", fontSize: 11 }} />
          <Tooltip cursor={false} isAnimationActive={false} content={({ active, payload }) => (active && payload && payload[0] ? tipOf(payload[0].payload) : null)} />
          <Scatter data={frontier} line={{ stroke: "var(--accent)", strokeWidth: 1.6 }} fill="var(--accent)" isAnimationActive={false}>
            <LabelList dataKey="short" content={lab(0, -10, "middle", { fontSize: 10.5, fill: "#334155" }, frontier)} />
          </Scatter>
          {marks.map((m, k) => (
            <Scatter key={k} data={[m]} fill={m.color} shape={m.shape || "diamond"} isAnimationActive={false}>
              {!m.nolabel && <LabelList dataKey="label" content={lab(-10, 4, "end", { fontSize: 11, fontWeight: 600, fill: m.color })} />}
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// Heat index against demand, one dot per day with the trend line (the original "scatter")
export function WeatherScatter({ pts, ymax, band, label, h = 250 }) {
  const xs = pts.map((q) => q[0]);
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
  const n = pts.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = pts.reduce((s, q) => s + q[1], 0) / n;
  let sxy = 0, sxx = 0;
  pts.forEach((q) => { sxy += (q[0] - mx) * (q[1] - my); sxx += (q[0] - mx) ** 2; });
  const slope = sxx ? sxy / sxx : 0;
  const yy = (v) => (my + slope * (v - mx)) * 100;
  const clampY = (v) => Math.max(-ymax, Math.min(ymax, v));
  const data = pts.map((q) => ({ x: q[0], y: clampY(q[1] * 100) }));
  const reg = [{ x: x0, y: clampY(yy(x0)) }, { x: x1, y: clampY(yy(x1)) }];
  const ticks = [-ymax, -ymax / 2, 0, ymax / 2, ymax];
  return (
    <div className="rc" style={{ height: h }} aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
          <XAxis type="number" dataKey="x" domain={[x0, x1]} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf((v) => v + "°")} tickCount={8} height={26} />
          <YAxis type="number" domain={[-ymax, ymax]} ticks={ticks} width={46} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf((v) => (v > 0 ? "+" : "") + v + "%")} />
          {band && band.map((bx) => <ReferenceLine key={bx} x={bx} stroke="var(--warn)" strokeDasharray="4 4" strokeOpacity={0.7} />)}
          <ReferenceLine y={0} stroke="var(--line)" />
          <Scatter data={data} fill="var(--accent)" fillOpacity={0.32} isAnimationActive={false} />
          <Line data={reg} dataKey="y" stroke="var(--bad)" strokeWidth={2.4} dot={false} isAnimationActive={false} legendType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Grouped columns: one group per key, one bar per series (e.g. each year beside the other for every category)
export function GroupCols({ keys, series, fmt, axis, label, labels = true }) {
  const data = keys.map((k, i) => { const row = { x: k.length > 13 ? k.slice(0, 12) + "…" : k }; series.forEach((s, j) => { row[`s${j}`] = s.vals[i]; }); return row; });
  const metas = {};
  series.forEach((s, j) => { metas[`s${j}`] = { name: s.name, fmt: fmt || num }; });
  return (
    <div className="cwrap">
      <div className="rc" style={{ height: 260 }} aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 10, left: 0, bottom: 6 }} barCategoryGap="18%" barGap={2}>
            <XAxis dataKey="x" tick={{ fontSize: 10.5, fill: "#334155" }} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={0} height={28} />
            <YAxis width={52} tick={TICK} tickLine={false} axisLine={false} tickFormatter={tf(axis || num)} domain={[0, "auto"]} />
            <Tooltip content={<TipBox metas={metas} />} cursor={{ fill: "transparent" }} isAnimationActive={false} />
            {series.map((s, j) => <Bar key={j} dataKey={`s${j}`} fill={s.color} radius={[2, 2, 0, 0]} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">{series.map((s, j) => <span key={j}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}
