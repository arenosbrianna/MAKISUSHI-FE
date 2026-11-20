// Small line icons for the side navigation and the KPI cards (24 x 24, drawn with strokes, so they take the text colour).
const PATHS = {
  today: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  buy: "M3 4h2.5l2.2 10.5h10.3l2-7.5H6.6 M9.5 19.5h.01 M17 19.5h.01",
  track: "M9 4h6v3H9z M7 5.5H5.5V20h13V5.5H17 M9 13.5l2 2 4-4.5",
  waste: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
  inv: "M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5z M3 7.5l9 4.5 9-4.5 M12 12v9",
  pred: "M3 17l6-6 4 4 8-8 M15 7h6v6",
  sales: "M5 20V11 M11 20V4 M17 20v-7 M3 20h18",
  reports: "M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6",
  chart: "M5 20V11 M11 20V4 M17 20v-7 M3 20h18",
  tag: "M3 12V4h8l10 10-8 8z M7.5 8.5h.01",
  alert: "M12 4l9 16H3z M12 10v4 M12 17h.01",
  clock: "M12 3a9 9 0 1 0 .01 0 M12 7v5l3 2",
  check: "M5 12.5l4.5 4.5L19 7",
  cart: "M3 4h2.5l2.2 10.5h10.3l2-7.5H6.6 M9.5 19.5h.01 M17 19.5h.01",
  user: "M12 12a4 4 0 1 0 .01 0 M4 21c0-4 3.6-6 8-6s8 2 8 6",
};

export function Icon({ name, size = 20 }) {
  const d = PATHS[name] || PATHS.chart;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {d.split(" M").map((seg, k) => <path key={k} d={(k ? "M" : "") + seg} />)}
    </svg>
  );
}

// the icon of a KPI card, from the words of its label
export function kpiIcon(label) {
  const l = String(label || "").toLowerCase();
  if (/waste|spoil|expir|lost|loss/.test(l)) return "waste";
  if (/ran out|stock|days on hand|turn|running out/.test(l)) return "inv";
  if (/forecast|next|miss|expected|use/.test(l)) return "pred";
  if (/cost|spend|budget|spent|price|purchase|net|₱/.test(l)) return "tag";
  if (/served|follow|recorded|fill|met/.test(l)) return "check";
  if (/order|lines|items|dish/.test(l)) return "cart";
  if (/growth|sales|average/.test(l)) return "chart";
  return "chart";
}
