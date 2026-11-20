// Page names, help text and fixed colours, copied from the original page.
import { N } from "./model.js";

// The seven views of the DSS (manuscript Section 4.3): Overview, Purchasing, Tracking, Expiry and waste,
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

// Test-year backtest of the recommended Balanced plan against historical ordering (Chapter 4, Sections 4.2.3.3 and 4.2.3.5;
// 7 Sep 2025 to 8 Sep 2026, 367 days). These are results of the study's model runs, not of the live database.
export const BACKTEST = {
  period: "7 Sep 2025 to 8 Sep 2026",
  hist: { episodes: 296, expiry: 11905, avgStock: 27447, fill: 0.973, problems: 119625 },
  plan: { episodes: 180, expiry: 9077, avgStock: 22104, fill: 0.975, problems: 105898 },
  spoilage: 10232,   // estimated outside the backtest; the same for both ordering rules, never added to expiry
};
// The three owner priorities (Chapter 4, Figure 4.2.3.5.1), each at the Base budget of ₱87,000 a month.
export const PRIORITIES = [
  { key: "min", label: "Minimize spoilage", setting: "50% service level, waste penalised at 2× cost", episodes: 381, expiry: 5232, problems: 207065,
    fit: "For an owner whose only concern is waste. Runs out more often than today." },
  { key: "bal", label: "Balanced", setting: "80% service level, waste penalised at 0.5× cost", episodes: 180, expiry: 9077, problems: 105898, recommended: true,
    fit: "Recommended default: fewer stockouts and less expiry than today." },
  { key: "max", label: "Maximize availability", setting: "95% service level, waste penalised at 0.25× cost", episodes: 94, expiry: 18250, problems: 62160,
    fit: "For an owner who values never running out most. Expires more than today." },
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

export const HOW = {
  today: ["The numbers at the top follow the Period in the filters row; the small line is the trend over the last 12 weeks.", "\"Needs attention\" lists what to act on now. Open Purchasing for the orders and the daily prep list.", "\"Is the plan working?\" compares the recommended plan with the way the restaurant ordered before, on the study's test year (a backtest)."],
  buy: ["Place each order with the supplier, or buy it at the grocery, then tick it. \"Copy message\" and \"Copy shopping list\" give you text to paste into a chat or notes.", "\"Why?\" on each line explains the order.", "\"Owner priority\" shows what each setting trades off; the orders below follow the plan that is loaded.", "Record what you actually ordered on the Tracking page."],
  track: ["Each line is one recommended order for the week. Say whether you followed it and how much you really ordered, then save.", "Waste and stockout days are filled in from the records once the week is over.", "The summary compares weeks where the plan was followed with weeks where it was not."],
  pred: ["\"Next 2 weeks\" is the forecast the purchase plan uses: the last 4 weeks of use and the next 14 days, with the range that is right 4 times out of 5.", "\"Up to 1 year\" gives the monthly forecast for budgeting and supplier planning. Choose 1 month, 3 months, 6 months or 1 year. The weekly order does not use it.", "\"Weather and calendar\" shows whether heat, paydays or holidays change sales."],
  inv: ["\"Status\" lists the ingredients that may run short or are overstocked first, with what to do.", "\"Running out\" shows one ingredient's stock day by day, with and without the planned orders.", "\"Extra stock\" shows how much money sits in stock the forecast will not use; \"Stockouts\" shows which ingredients ran out most."],
  waste: ["The charts show where waste comes from: the few ingredients that make up most of it, and spoilage (went bad early) against expiry (kept too long), which are never added together.", "\"Stock by days left\" shows how much stock value expires soon. Alerts for batches close to expiry, with the dishes to push, are sent through Telegram.", "Waste as a share of purchases shows the short-life ingredients lose the most."],
  reports: ["Pick a report, check the preview, then download it as a spreadsheet (CSV) or print it as a PDF.", "Reports use the Period in the filters row where they cover a period."],
  sales: ["Choose Day, Week or Month to change the sales chart; grey bars cover only part of a period.", "\"Top dishes\" shows what sells most, which tells you which ingredients to protect.", "\"Ingredient use\" shows the busy weekdays and months; \"Most used\" shows which few ingredients carry most of the value."],
};

// one fixed colour per year, never shared
export const YCOL = { 2021: "#94A3B8", 2022: "#10B981", 2023: "#A78BFA", 2024: "#3B82F6", 2025: "#F59E0B", 2026: "#1E3A8A" };

export const MODEL_NAMES = {
  HW: "Holt-Winters (7-day season)",
  SES: "Simple exponential smoothing (SES)",
  SARIMA: "SARIMA",
  ML: "Gradient boosting (ML)",
  SNAIVE: "Seasonal naive (baseline)",
};
