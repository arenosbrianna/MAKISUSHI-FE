// Page names, help text and fixed colours, copied from the original page.
import { N } from "./model.js";

// The seven views of the DSS: Overview, Purchasing, Tracking, Expiry and waste,
// Stock risk, Forecast, and Sales and ingredient use.
export const NAVN = { today: "Overview", buy: "Purchasing", track: "Tracking", waste: "Waste", inv: "Stock risk", pred: "Forecast", sales: "Sales & use", reports: "Reports" };
// ordered by the decision flow: act first, then what to watch, then what happened
export const PAGES = [
  ["today", "Overview", "What to do"],
  ["buy", "Purchasing plan", "What to do"],
  ["track", "Recommendation tracking", "What to do"],
  ["waste", "Waste", "What to watch"],
  ["inv", "Stock risk", "What to watch"],
  ["pred", "Forecast", "What to watch"],
  ["sales", "Sales & ingredient use", "What happened"],
  ["reports", "Reports", "Reports"],
];
// the sub-pages of a page, shown under it in the side navigation: [state key, default, [value, label] ...]
export const SUBTABS = {
  buy: { key: "btab", def: "plan", list: [["plan", "Plan"], ["prep", "Daily prep"], ["level", "What-if"]] },
  pred: { key: "ptab", def: "forecast", list: [["forecast", "Next 2 weeks"], ["byIng", "By ingredient"], ["year", "Up to 1 year"], ["weather", "Weather and calendar"]] },
  waste: { key: "wtab", def: "where", list: [["where", "Where it comes from"], ["when", "When it was wasted"]] },
  inv: { key: "itab", def: "status", list: [["status", "Status"], ["risk", "Running out"], ["outs", "Stockouts"]] },
  sales: { key: "stab", def: "overview", list: [["overview", "Sales"], ["products", "Top dishes"], ["time", "Ingredient use"], ["what", "Most used"]] },
  track: { key: "ttab", def: "w1", list: [["w1", "This week"], ["w2", "Next week"], ["hist", "History"]] },
};
// the sub-page that is open on a page (an unknown or old value means the first one)
export function tabOf(page, S) {
  const sub = SUBTABS[page];
  if (!sub) return null;
  const v = page === "buy" && S.btab === "orders" ? "plan" : S[sub.key];
  return sub.list.some((t) => t[0] === v) ? v : sub.def;
}
export const NAV_GROUPS = ["What to do", "What to watch", "What happened", "Reports"];

// The three owner priorities, each at the Base budget of ₱87,000 a month, replayed on the past year.
export const PRIORITIES = [
  { key: "min", label: "Minimize waste", setting: "76% service level, waste penalised at 0.5× cost", episodes: 214, expiry: 7816, problems: 117614,
    fit: "For an owner whose main concern is waste: the least waste, and fewer stockouts than today but more than Balanced." },
  { key: "bal", label: "Balanced", setting: "80% service level, waste penalised at 0.5× cost", episodes: 180, expiry: 9077, problems: 105898, recommended: true,
    fit: "Recommended default: fewer stockouts and less waste than today." },
  { key: "max", label: "Maximize availability", setting: "95% service level, waste penalised at 0.25× cost", episodes: 94, expiry: 18250, problems: 62160,
    fit: "For an owner who values never running out most. More waste than today." },
];

// period choices; "All data" uses the whole data range
export function rangeChoices() {
  return [[28, "Last 28 days"], [90, "Last 3 months"], [180, "Last 6 months"], [365, "Last 12 months"], [N, "All data"]];
}
export const SHORT_RANGE = { 28: "4 weeks", 90: "3 months", 180: "6 months", 365: "12 months" };

export const HEADS = {
  today: ["Overview", "What to do", "How the kitchen is doing: sales, spend, waste and what needs attention.", "Overview"],
  buy: ["Purchasing plan", "What to do", "What to order, from whom, how much and when.", "Purchasing recommendations"],
  track: ["Recommendation tracking", "What to do", "Did we follow the plan, and what happened?", "Recommendation tracking and decision history"],
  pred: ["Forecast", "What to watch", "How much of each ingredient will be used: the next two weeks, and up to one year ahead.", "Demand forecast"],
  inv: ["Stock risk", "What to watch", "Which ingredients may run out, and which are overstocked.", "Stockout and overstock risk"],
  waste: ["Waste", "What to watch", "Where waste comes from (near-expiry alerts go to Telegram).", "Spoilage and expiry alerts"],
  sales: ["Sales & ingredient use", "What happened", "How busy the restaurant is and what the kitchen uses.", "Sales and ingredient-consumption monitoring"],
  reports: ["Reports", "Reports", "Ready-made reports to download or print for the owner, the kitchen and the suppliers.", "Reports"],
};

// one fixed colour per year, never shared
// sales channels as the point of sale records them, with the name shown and a colour
export const CHAN = { "Dine-In": ["Dine-in", "var(--accent)"], GrabFood: ["GrabFood delivery", "#10B981"] };
export const chanName = (c) => (CHAN[c] ? CHAN[c][0] : c);
export const chanColor = (c, k) => (CHAN[c] ? CHAN[c][1] : ["#7C3AED", "#D97706"][k % 2]);
export const YCOL = { 2021: "#64748B", 2022: "#059669", 2023: "#7C3AED", 2024: "#2563EB", 2025: "#D97706", 2026: "#1E3A8A" };

// The likely range of the monthly forecast (Forecast > Up to 1 year). Measured, not assumed: for the forecasts made on
// 8 Sep 2024 and 7 Sep 2025, 1 to 12 months ahead, the actual monthly use of the 20 perishables together, at standard cost, was within
// 9% of the forecast in 20 of the 24 months. The error did not grow steadily with the months ahead (9.2% one month ahead,
// 12.7% twelve months ahead, 1% to 5% in most months between), so the range has one width. It was measured for the
// 20 ingredients together only, so it is not drawn for one ingredient or a smaller group.
export const LR_BAND = { lo: 0.91, hi: 1.09, inside: 20, of: 24, n: 20 };

export const MODEL_NAMES = {
  HW: "Holt-Winters (7-day season)",
  SES: "Simple exponential smoothing (SES)",
  SARIMA: "SARIMA",
  ML: "Gradient boosting (ML)",
  SNAIVE: "Seasonal naive (baseline)",
};
