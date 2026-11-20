# Makisushi Decision Support (React)

React version of `makisushi_dss_dashboard (2).html`. Charts use Recharts. All figures come from the
Supabase `dw` schema through a small Node server, so the database password never reaches the browser.

## Run it

1. `npm install`
2. Copy `.env.example` to `.env` (already done locally) and check `DATABASE_URL`.
3. `npm run build` to build the app into `dist/`
4. `npm start` and open http://localhost:8787

For development with hot reload: run `npm run server` in one terminal and `npm run dev` in another,
then open http://localhost:5173.

## What comes from where

- Supabase (`dw` schema): inventory, batches, waste, stock-outs, sales, menu, recipes, suppliers,
  forecasts and accuracy, the replenishment plan and the optimisation run.
- Not in the database, so configured or fetched separately:
  - `BUDGET_LOW` / `BUDGET_HIGH` in `.env` (only the Base budget is stored in the database).
  - Heat index: Open-Meteo archive (Quezon City, 2 pm each day). No key needed.
- Loyverse CSV uploads are read in the browser and stored only in that browser's local storage.

## Notes

- `.env` holds the database connection string. It is git-ignored; do not commit it.
- The server caches the dashboard data for 10 minutes. Restart it to reload sooner.

## The seven views (simplified DSS)

This copy follows the seven views of manuscript Section 4.3, each with a few visuals tied to a decision:
Today (overview) · Purchasing · Tracking · Expiry & waste · Stock risk · Forecast · Sales & use.
Analyst content (model comparison, accuracy tables, weather and calendar tests, replay and frontier charts,
solver status) is left to Chapter 4 and is no longer in the dashboard.

- **Backtest figures.** The "Is the plan working?" strip (Today) and the owner-priority cards (Purchasing) show the
  study's test-year results from Chapter 4 (`BACKTEST` and `PRIORITIES` in `src/lib/constants.js`). They are not read
  from the database. The orders on the Purchasing page come from the plan that is loaded in Supabase, and a banner
  says when that plan is not the Balanced 80% plan of Chapter 4.
- **Tracking.** `GET/POST /api/tracking` (`server/tracking.js`) read and write `dw.fact_recommendation_outcome`
  (followed or not, quantity really ordered; waste and stockout days are read from the records once the week is over).
  The table's foreign key to the dish-level plan was dropped (migration `drop_fk_recommendation_outcome_to_dish_plan`,
  approved) so rows can be keyed to the ingredient plan; the server checks each row against the loaded plan instead.
  The sign-in is still client-side, so the endpoint is not protected: run it on a trusted network only.

## Update 2026-11-19 (second round)

- **Balanced plan loaded.** `dw.ingredient_optimization_run` run 11 (80% service level, Balanced priority, Base budget ₱87,000/month) with its 40 plan lines was added from `model_rerun_v18_5/outputs/v4_recommended/final_balanced` (281 packs, ₱20,334, as in Chapter 4). The 98% run (run 10) is kept; the dashboard reads the latest run.
- **Purchasing is a 14-day plan.** The default view shows both weeks in one table (packs for week 1 and week 2, quantity, cost). "This week" and "Next week" keep the order sheet, tick boxes and copy-message.
- **Forecast has three tabs.** "Next 2 weeks" (daily, used by the plan), "Up to 1 year" (monthly Holt-Winters, 1/3/6/12 months, for budgeting; not used for the weekly order) and "Weather and calendar" (restored). The monthly forecast is read from `server/data/long_range.json`, built by `scripts/build_long_range.py` from the modelling outputs, because the warehouse tables only allow 'backtest' and 'plan' runs. Amounts are converted from recipe demand to amounts taken from stock (divided by yield), the same basis as the plan.
- **Export for the report.** Every card has PNG (and CSV when it has a table) buttons in its header on hover; the Filters pane has "Page as image (PNG)" and "Page as PDF (print)". Images come from `src/lib/exporter.js` (html-to-image).

## Update 2026-11-19 (third round)

- **Service levels 80% to 99%.** The 14-day plan at each level is stored in the warehouse (`dw.ingredient_optimization_run` plus its plan lines, one run per level), produced by `modelling/.../model_rerun_v18_5/63_plans_by_service_level.py` and loaded by `64_write_plans_by_level.py` (same forecast, Balanced waste penalty, Base budget). The dashboard **opens on 80% (Balanced, the recommended default)**; the admin can choose any level up to 99% on the Purchasing page, and the whole app (orders, deliveries, stock levels, tracking) follows it. The backtest of each level (stockouts, expiry, net cost) is in `server/data/service_levels.json` (`scripts/build_service_levels.py`).
- **Recommended actions** (Purchasing): promote or use first what is close to expiry (with the dishes to push), top up before a run-out, hold back overstock, smaller orders for high-waste items, limit slow movers, weather and season advice, and raise or relax buffers for the coming month. Logic in `src/pages/recommend.js`.
- **Live weather** (`/api/weather`, Open-Meteo forecast API, cached 30 minutes): feels-like temperature at 14:00 for the last days, today and the next 16 days, with PAGASA heat classes and the Philippine season (hot dry/summer March to May, rainy June to November, cool dry December to February).
- **Summer and hot-day effect on sales** (`src/lib/seasons.js`), measured on the real POS period (since 1 Dec 2025): mango shakes and juice and Drinks & Shakes sell clearly more in summer and on hot days; overall sales do not move; desserts sell almost nothing in 2026, so no effect can be measured. Only one summer of real data exists.

## Round 4: report-style layout, near-expiry alerts via Telegram

- Every page fits one screen at 1440×900 (Power BI style); explanatory text lives in the ⓘ tooltips.
- **Near-expiry alerts are sent through Telegram, not shown in the system.** The in-system "Use first" card, list, KPI, attention item and the "Use first"/"Promote" recommendations were removed. Today's third card is now the month's budget; Expiry & waste shows only the waste analysis (Pareto, spoilage vs expiry, stock by days left, waste share of purchases).
- The Telegram alert itself (n8n workflow) is not built here; it would read the same batch/expiry data.

## Round 5: dashboard layouts follow the Group 3 manuscript (CAP2_4ISA Group 3, Figures 3.11.1-3.11.5 and 4.2.3.x)
Styling (colours, nav, filters) is unchanged; only the graphs and the layout of each page follow Group 3's dashboards:
KPI row on top, one large primary chart with a side card, donuts with percentage legends, Pareto charts, stacked and grouped columns,
a "Recommendations" card with the prescriptive text, and a What-If page with a slider and a scenario table.
- Sales & use: monthly trend by year, sales by category (donut), by category per month (stacked), year over year (grouped), YoY growth KPI; Top dishes: most/least sold, items by category, Pareto.
- Forecast: forecast with band + Recommendations card, biggest expected use, chilled and frozen forecasts; By ingredient (table); Up to 1 year with Recommendations.
- Purchasing: What-if tab (service-level slider, scenario table, impact chart, recommendations); Owner priority tab; spend-by-supplier ring beside the budget.
- Expiry & waste: Pareto, spoilage vs expiry donut, stock by days left, spoilage and expiry by month, waste share.
- Stock risk: stock status donut, days of stock, stock turns, flagged table. Today: weekly spend and waste, orders by supplier, attention, prep, plan backtest. Tracking history: followed donut and orders by week.
- Login: the browser's own password-reveal icon (Edge) is hidden so only the page's eye button shows.

## Round 6: slicer row, filters that apply everywhere

- The left Filters pane is gone. The filters are one slim row of drop-down slicers under the top bar (Period, Month, Menu category, Ingredient type, Ingredient, Supplier, Storage, Budget), and each page shows only the ones that change something on it. Export (page as image or PDF) moved into an Export menu in the top bar.
- Every chart now follows the Period and the other filters. Sales: the trend, year over year and the stacked chart use the chosen period (year over year compares the same days of the two years before it; All data shows each year up to the same date); with a Menu category chosen, year over year switches to dishes. Today, Expiry & waste and Stock risk bucket their charts by day, week, month or quarter from the period (`bucketsFor` in `lib/model.js`).
- The data pill no longer says how many days old the data is; it still turns amber after 2 days.
- The server retries the Open-Meteo heat-index request (up to 3 tries) and the Weather tab shows "–" for months without heat data instead of failing.

## Round 7: side navigation, Overview, Daily prep, Reports, staff meals

- The pages are in a left navigation sidebar (no tabs at the bottom); the filters stay as the slim slicer row. KPI cards have icon tiles.
- "Today" is now **Overview**: KPIs, spend and waste, key takeaways, needs attention, best sellers, is the plan working. The supplier ring and the prep list left it, because Purchasing already has them.
- **Purchasing > Daily prep** (`pages/PrepPanel.jsx`): for tomorrow, each ingredient's need split into dishes and staff meals; buys in whole packs of at least the supplier's minimum order (`supplier_item_terms.min_order_packs`); the dishes that use it, how many plates the amount makes, whether they are selling (last 4 weeks against the 4 before) and which dish to push.
- **Staff meals** (off-menu use, `qty_off_pos_use`): KPI and charts on Sales & use, a column on Forecast > By ingredient saying whether the forecast already includes it, a line on the Overview, and in the daily prep. The forecast model itself is unchanged.
- **Reports** page: eight reports (purchase orders, daily prep, waste and expiry, stock status, sales summary, 14-day forecast, ingredient use and staff meals, supplier prices), each as CSV or print/PDF.
- Empty space: donuts size to their card (`size="auto"`), short lists and cards fill their card, and the Actions, Owner priority, Tracking history and Stock risk tabs have charts where there were blank areas.

## Round 8: owner priority, sidebar sub-pages, fewer filters, readable graphs

- **Owner priority** is chosen on Purchasing > Plan (Minimize spoilage 50%, Balanced 80% default, Maximize availability 95%). Balanced is the warehouse's 80% run; the other two are plans of the v18.5 model outputs, copied into `server/data/priority_plans.json` (`model_rerun_v18_5/outputs/v4_recommended/final_<priority>`, backtest from `priority_scenarios.csv`, Base budget) because the warehouse only holds the 80% to 100% service-level runs. The What-if tab still loads any 80% to 99% level. The separate Owner priority tab is gone.
- The sub-pages of a page are in the side navigation: they open when the page is hovered and stay open on the current page (`SUBTABS` in `lib/constants.js`). The account (Admin, Sign out) is at the bottom of the side navigation. The Upload Loyverse CSV and Export buttons, the per-card PNG/CSV buttons and the coloured left outlines are removed.
- **Filters**: Period (where a period is used), Storage, Supplier, Ingredient (its list follows Storage and Supplier) and, on the sales tabs, Menu category. A page shows only the ones that change it. Budget Low/Base/High is a switch inside the Budget card.
- **Year over year** shows every year from 2021 to 2026 that the data covers for the chosen days (All data shows the calendar years as recorded), as a Total or By category / By dish switch.
- Graphs: running-share (Pareto) charts became ranked horizontal bars with the running share; two-axis charts were split in two; "least sold dishes" (all 1 sale) became "dishes moving most"; whole-number ticks on small counts; diverging bars have three ticks; the weather bar chart became day tiles. Redundant cards removed (spoilage donut, supplier donut on Overview, best sellers, duplicate turnover chart).
- **Reports** page: pick a report, see its chart and table, download PDF (chart and whole table) or CSV.

## Round 9: less text, Power BI look

- The information (i) buttons are gone. A KPI shows its name, number and a short change badge (arrow and percent); hovering it shows the earlier value next to the current one (`deltaEl` sets `data-cmp`, `Kpi` shows it). Other detail lives in hovers (`data-t`) on table rows, not in sentences.
- Daily prep is a chart (lowest stock cover for tomorrow) and a short table (needed, on hand, action chip, top dish with trend arrow and a Promo chip); pack size, supplier, minimum order, dishes and staff meals are in the row hover.
- Overview: "At a glance" tiles instead of sentences, a weekly-budget line on the spend chart. Forecast: supplier ring and confidence ring instead of a recommendations box. What-if has no sentences. Actions has three short columns.
- Chapter 4 figures now used: waste by ingredient split into spoilage and expiry (Figure 4.2.1.5.1), stockouts by ingredient and outcome (4.2.1.5.3), stock value by days left (4.2.3.4.1), stockouts and expiry at each service level (4.2.3.3.6), by-year sales lines (4.2.1.3.2), top dishes (4.2.1.3.5), weekday and month use (4.2.1.3.7, 4.2.1.4.2), the 14-day and monthly forecasts (4.2.2.6.3, 4.2.2.6.6), turnover (4.2.1.6.1).

## Round 10: audit

- KPI cards have no trend lines. Purchasing > Plan has Copy message / Copy shopping list on every supplier in the 14-day view too (`lib/messages.js`). Reports has a Purchasing plan report (table, chart, the message for each supplier; PDF, CSV, Copy supplier messages).
- Audit: removed what repeated another card or did not help a decision (Overview tiles, Actions charts, forecast confidence ring, heat vs sales chart, repeated staff-meal chart, weekly stacked chart on Tracking). Added Least sold dishes (regular dishes only, Chapter 4 Figure 4.2.1.3.6 rule). Checked every page at 1440x900 and 1280x720 for text outside its card.

## Round 11

- Purchasing > Plan has no Print/Export buttons (printing and export are in Reports > Purchasing plan).
- Forecast > By ingredient is a grid of small Recharts forecast charts (`MiniForecast`), one per ingredient: last 3 weeks of use, next 14 days, and the likely range; click one to open it in Next 2 weeks.
- Every chart is a Recharts chart (ComposedChart, BarChart, PieChart, ScatterChart); the rest of the page is HTML (KPI cards, tables, day tiles).

## Round 12

- Daily prep: the arrow on the top dish compares its sales in the last 4 weeks with the 4 weeks before, only when it sold 10+ units before, and never above 100%. Dishes moving most shows the change in units. Change badges stop at 100%+.
- Forecast > Up to 1 year is a line chart (solid used, dashed forecast). Overview waste per week is bars with a 4-period average line.
- Weather: "Does the weather change sales?" compares hot days, cool days, rainy days (rain history from Open-Meteo, `ext.rain`) and summer with the usual weekday. No "real/generated" wording anywhere.
- The page is called Waste. The Suppliers and prices tab is removed (the plan shows each supplier; Reports has the price list).

## Round 13

- Forecast > Up to 1 year has two sliders (From and To) that choose the months the totals, the month table, the ingredient table and the peak and low are read over (for example November to December). The separate Nov to Dec tab was removed.
- Weather tab: a Year filter (All years by default) for the paydays and weather figures; each card says which dates it is based on.
- Year over year includes 2021 (marked * when the chosen days are only partly covered, since the records start on 1 September 2021); change chips never compare against a part year and stop at 100%.
