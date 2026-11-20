// Builds the dashboard data from the Supabase "dw" schema.
// The shape matches what the page reads (see src/lib/model.js). Every number comes from the database,
// except the Low/High budgets (env) and the heat index (weather service).
import { pool } from "./db.js";
import { heatIndexByDate, rainByDate } from "./weather.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DAY = 864e5;
// the 12-month forecast of the monthly model (built by scripts/build_long_range.py from the modelling outputs); null when absent
function readJson(name) {
  try { return JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "data", name), "utf8")); }
  catch (e) { console.warn(name + " not found (server/data):", e.message); return null; }
}
function readLongRange() { return readJson("long_range.json"); }
const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
const toUTC = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const monthYear = (s) => new Date(toUTC(s)).toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const normName = (s) => String(s || "").toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[^a-z0-9]/g, "");

async function q(text, params = []) {
  return (await pool.query(text, params)).rows;
}

export async function buildDashboardPayload() {
  // ---- calendar: day 0 is the first snapshot date; the last day is the latest snapshot ----
  const [span] = await q(`select min(snapshot_date) as d0, max(snapshot_date) as asof from dw.fact_inventory_snapshot`);
  const d0 = span.d0, asof = span.asof;
  const N = (toUTC(asof) - toUTC(d0)) / DAY + 1;
  const dayIdx = (s) => Math.round((toUTC(String(s).slice(0, 10)) - toUTC(d0)) / DAY);
  const dateOf = (i) => new Date(toUTC(d0) + i * DAY).toISOString().slice(0, 10);

  // ---- perishable ingredients (the inventory scope) ----
  const ing = (await q(`
    select i.ingredient_id as id, i.ingredient_name as name, i.category as cat, i.storage_type as store,
           i.base_uom as uom, i.shelf_life_days as shelf, i.standard_unit_cost as cost,
           s.supplier_id as sup, s.supplier_name as supname, s.lead_time_days as lead,
           s.contact_info as contact, s.delivery_interval_days as "interval",
           t.pack_size_base as pack, t.min_order_packs as minpacks
    from dw.dim_ingredient i
    join dw.supplier_item_terms t on t.ingredient_id = i.ingredient_id
    join dw.dim_supplier s on s.supplier_id = t.supplier_id
    where i.is_perishable
    order by i.ingredient_id`)).map((r) => ({
    ...r, cost: +r.cost, lead: +r.lead, pack: +r.pack, minpacks: +r.minpacks, interval: +r.interval, shelf: +r.shelf,
  }));
  const ids = ing.map((i) => i.id);

  // ---- daily inventory series: use (consumed), close (closing stock), rec (received, incl. emergency buys),
  //      off (use outside the menu: staff meals and other off-POS use, part of use) ----
  const series = {};
  for (const id of ids) series[id] = { use: new Array(N).fill(0), close: new Array(N).fill(0), rec: new Array(N).fill(0), off: new Array(N).fill(0) };
  for (const r of await q(`select ingredient_id, snapshot_date, qty_consumed, closing_qty, qty_received, qty_emergency, qty_off_pos_use
                           from dw.fact_inventory_snapshot where ingredient_id = any($1::int[])`, [ids])) {
    const s = series[r.ingredient_id], i = dayIdx(r.snapshot_date);
    s.use[i] = round(+r.qty_consumed); s.close[i] = round(+r.closing_qty); s.rec[i] = round(+r.qty_received + +r.qty_emergency);
    s.off[i] = round(+r.qty_off_pos_use || 0);
  }

  // ---- batches on hand in the last 30 days: [day, ingredient, qty, received day, expiry day] ----
  const batches = (await q(`select snapshot_date, ingredient_id, qty_on_hand, received_date, expiry_date
                            from dw.fact_inventory_batch_snapshot
                            where ingredient_id = any($1::int[]) and snapshot_date >= $2
                            order by snapshot_date, batch_id`, [ids, dateOf(N - 30)]))
    .map((r) => [dayIdx(r.snapshot_date), r.ingredient_id, round(+r.qty_on_hand), dayIdx(r.received_date), dayIdx(r.expiry_date)]);

  // ---- waste: [day, ingredient, value PHP, qty, reason index] ----
  const reasons = (await q(`select distinct waste_reason as r from dw.fact_waste order by 1`)).map((r) => r.r);
  const waste = (await q(`select waste_date, ingredient_id, waste_value_php, waste_qty, waste_reason
                          from dw.fact_waste where ingredient_id = any($1::int[])`, [ids]))
    .map((r) => [dayIdx(r.waste_date), r.ingredient_id, round(+r.waste_value_php, 2), round(+r.waste_qty, 2), reasons.indexOf(r.waste_reason)]);

  // ---- stock-outs: [day, ingredient, outcome index, unmet qty, shortage cost PHP, emergency-buy cost PHP] ----
  const outcomes = (await q(`select distinct outcome as o from dw.fact_stockout_event order by 1`)).map((r) => r.o);
  const so = (await q(`select event_date, ingredient_id, outcome, unmet_qty, shortage_cost_php, emergency_cost_php, need_qty, available_qty
                       from dw.fact_stockout_event where ingredient_id = any($1::int[])`, [ids]))
    .map((r) => [dayIdx(r.event_date), r.ingredient_id, outcomes.indexOf(r.outcome), round(+r.unmet_qty, 2), round(+r.shortage_cost_php, 2), round(+r.emergency_cost_php || 0, 2), round(+r.need_qty || 0, 1), round(+r.available_qty || 0, 1)]);

  // ---- menu: categories, channels, sales by day ----
  const cats = (await q(`select distinct c.category_name as n from dw.fact_sales s
                         join dw.dim_menu_item i on i.item_id = s.item_id
                         join dw.dim_menu_category c on c.category_id = i.category_id
                         where s.is_revenue order by 1`)).map((r) => r.n);
  const catIdx = Object.fromEntries(cats.map((c, k) => [c, k]));
  const chans = (await q(`select distinct channel as c from dw.fact_sales order by 1`)).map((r) => r.c);
  const chanIdx = Object.fromEntries(chans.map((c, k) => [c, k]));
  const sales = (await q(`select s.sale_date, c.category_name as cat, s.channel, sum(s.net_sales) as net,
                                 sum(s.quantity_sold) as qty, count(*) as lines
                          from dw.fact_sales s
                          join dw.dim_menu_item i on i.item_id = s.item_id
                          join dw.dim_menu_category c on c.category_id = i.category_id
                          where s.is_revenue group by 1, 2, 3 order by 1, 2, 3`))
    .map((r) => [dayIdx(r.sale_date), catIdx[r.cat], chanIdx[r.channel], round(+r.net, 2), +r.qty, +r.lines]);
  const isales = (await q(`select sale_date, item_id, sum(quantity_sold) as q, sum(net_sales) as n
                           from dw.fact_sales where is_revenue group by 1, 2`))
    .map((r) => [dayIdx(r.sale_date), r.item_id, +r.q, round(+r.n, 2)]);
  const items = {};
  for (const r of await q(`select i.item_id, i.item_name, c.category_name as cat, i.is_active
                           from dw.dim_menu_item i left join dw.dim_menu_category c on c.category_id = i.category_id
                           order by i.item_id`)) {
    items[r.item_id] = [r.item_name, catIdx[r.cat] ?? -1, r.is_active ? 1 : 0];
  }
  const dishes = {};
  // dishes that use each ingredient, with the amount one plate uses (to say how many plates clear a batch)
  for (const r of await q(`select b.ingredient_id, i.item_id, i.item_name, i.list_price, b.qty_base
                           from dw.bridge_recipe_bom b join dw.dim_menu_item i on i.item_id = b.item_id
                           where i.is_active and not i.is_complimentary and i.list_price > 0
                             and b.qty_base > 0 and b.ingredient_id = any($1::int[])
                           order by b.ingredient_id, i.item_name`, [ids])) {
    const list = (dishes[r.ingredient_id] ||= []);
    if (!list.some((d) => d.name === r.item_name)) list.push({ id: r.item_id, name: r.item_name, price: +r.list_price, q: round(+r.qty_base, 3) });
  }

  // ---- forecast runs: the latest backtest (accuracy, test window) and the latest plan (next 16 days) ----
  const runs = await q(`select run_id, run_type, train_end_date, holdout_start, holdout_end, weekly_wmape_peso,
                               bias_peso, model_version, is_selected
                        from dw.ingredient_forecast_run order by run_id`);
  const btRun = runs.filter((r) => r.run_type === "backtest").pop();
  const planRun = runs.filter((r) => r.run_type === "plan").pop();
  if (!btRun || !planRun) throw new Error("No backtest or plan run found in dw.ingredient_forecast_run");

  const fcRows = await q(`select f.ingredient_id, f.target_date, f.forecast_qty, f.lower80, f.upper80, f.model_name
                          from dw.fact_ingredient_forecast f
                          where f.run_id = $1 and f.is_selected and f.ingredient_id = any($2::int[])
                          order by f.target_date`, [planRun.run_id, ids]);
  const fdates = [...new Set(fcRows.map((r) => r.target_date))].sort();
  const fdIdx = Object.fromEntries(fdates.map((d, k) => [d, k]));
  const selectedModel = fcRows[0]?.model_name ?? "";
  const fc = {};
  for (const id of ids) fc[id] = { y: new Array(fdates.length).fill(0), lo: new Array(fdates.length).fill(0), hi: new Array(fdates.length).fill(0) };
  for (const r of fcRows) {
    const f = fc[r.ingredient_id], k = fdIdx[r.target_date];
    f.y[k] = round(+r.forecast_qty); f.lo[k] = round(+r.lower80); f.hi[k] = round(+r.upper80);
  }

  const bts = dayIdx(btRun.holdout_start);
  const btRows = await q(`select f.ingredient_id, f.target_date, f.forecast_qty
                          from dw.fact_ingredient_forecast f
                          where f.run_id = $1 and f.is_selected and f.ingredient_id = any($2::int[])`, [btRun.run_id, ids]);
  const btd = {};
  for (const id of ids) btd[id] = { a: series[id].use.slice(bts), f: new Array(N - bts).fill(null) };
  for (const r of btRows) btd[r.ingredient_id].f[dayIdx(r.target_date) - bts] = round(+r.forecast_qty);

  // accuracy of every model on the backtest, per ingredient
  const acc = await q(`select ingredient_id, model_name, weekly_wmape, bias, mase, is_selected
                       from dw.fact_ingredient_forecast_accuracy
                       where run_id = $1 and ingredient_id = any($2::int[])`, [btRun.run_id, ids]);
  // pering: weekly WMAPE per ingredient and model; perm: [WMAPE, bias, MASE] per ingredient and model
  const pering = {}, wmape = {}, perm = {};
  for (const r of acc) {
    (pering[r.ingredient_id] ||= {})[r.model_name] = round(+r.weekly_wmape, 4);
    (perm[r.ingredient_id] ||= {})[r.model_name] = [round(+r.weekly_wmape, 4), round(+r.bias, 4), round(+r.mase, 3)];
    if (r.is_selected) wmape[r.ingredient_id] = round(+r.weekly_wmape, 4);
  }
  const win = `${monthYear(btRun.holdout_start)} to ${monthYear(btRun.holdout_end)}`;
  const modelNames = [...new Set(acc.map((r) => r.model_name))];
  const mcmp = modelNames.map((m) => {
    const rows = acc.filter((r) => r.model_name === m);
    const avg = (k) => rows.reduce((s, r) => s + (+r[k] || 0), 0) / (rows.length || 1);
    return { win: `Full test, ${win}`, scope: "20 perishables", model: m, wmape: round(avg("weekly_wmape"), 4), bias: round(avg("bias"), 4), mase: round(avg("mase"), 3) };
  });
  const selAcc = acc.filter((r) => r.is_selected);
  const engine = {
    model: selectedModel,
    model_version: planRun.model_version,
    train_end: planRun.train_end_date,
    tune: `${d0} to ${btRun.train_end_date}`,
    test: `${btRun.holdout_start} to ${btRun.holdout_end}`,
    wmape: round(selAcc.reduce((s, r) => s + +r.weekly_wmape, 0) / (selAcc.length || 1), 4),
    bias: round(selAcc.reduce((s, r) => s + +r.bias, 0) / (selAcc.length || 1), 4),
  };

  // ---- calendar flags: 1 holiday, 2 payday, 4 weekend, 8 closed ----
  const lastF = fdates[fdates.length - 1];
  const flagRows = await q(`select date, is_holiday, is_payday, is_weekend, is_open from dw.dim_date where date between $1 and $2`, [d0, lastF]);
  const flagOf = new Map(flagRows.map((r) => [r.date, (r.is_holiday ? 1 : 0) | (r.is_payday ? 2 : 0) | (r.is_weekend ? 4 : 0) | (r.is_open ? 0 : 8)]));
  const f = Array.from({ length: N }, (_, i) => flagOf.get(dateOf(i)) ?? 0);
  const ff = fdates.map((d) => flagOf.get(d) ?? 0);

  // heat index (Open-Meteo), null where unavailable
  let hi = new Array(N).fill(null);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const byDate = await heatIndexByDate(d0, asof);
      hi = Array.from({ length: N }, (_, i) => byDate.get(dateOf(i)) ?? null);
      break;
    } catch (e) {
      console.warn("Heat index unavailable (try " + attempt + "):", e.message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }

  // rain in each day (mm), null where unavailable
  let rain = new Array(N).fill(null);
  try {
    const byDay = await rainByDate(d0, asof);
    rain = Array.from({ length: N }, (_, i) => byDay.get(dateOf(i)) ?? null);
  } catch (e) {
    console.warn("Rain history unavailable:", e.message);
  }

  // ---- ingredient plans: every stored run of the selected forecast, one per service level from 80% to 100% ----
  // The default is the Balanced priority (80%, Chapter 4); the page can switch to any other stored level.
  const byId = Object.fromEntries(ing.map((i) => [i.id, i]));
  const optRuns = await q(`select * from dw.ingredient_optimization_run where forecast_run_id = $1 order by opt_run_id`, [planRun.run_id]);
  if (!optRuns.length) throw new Error("No row in dw.ingredient_optimization_run for the selected forecast run");
  const allLines = await q(`select p.opt_run_id, p.ingredient_id, p.week_no, p.supplier_id, p.demand_qty, p.packs, p.order_qty,
                                   p.order_cost_php, p.end_stock_qty, p.shortage_qty, p.waste_qty, p.ordering_rule, p.service_level
                            from dw.fact_ingredient_replenishment_plan p
                            where p.opt_run_id = any($1::int[]) and p.ingredient_id = any($2::int[])
                            order by p.opt_run_id, p.ingredient_id, p.week_no`, [optRuns.map((r) => r.opt_run_id), ids]);
  const monthStart = optRuns[0].plan_start.slice(0, 8) + "01";
  const [mtdRow] = await q(`select coalesce(sum(extended_cost), 0) as v from dw.fact_inventory_transaction
                            where txn_type = 'RECEIPT' and txn_date >= $1 and txn_date <= $2 and ingredient_id = any($3::int[])`,
    [monthStart, asof, ids]);
  const mtd = round(+mtdRow.v, 2);
  function buildRun(opt) {
    const rows = allLines.filter((r) => r.opt_run_id === opt.opt_run_id);
    const service = rows.length ? +rows.find((r) => r.service_level !== null)?.service_level || 0 : 0;
    const plan = rows.map((r) => ({
      ing: r.ingredient_id, week: r.week_no, rule: r.ordering_rule, packs: +r.packs, qty: round(+r.order_qty, 2),
      cost: round(+r.order_cost_php, 2), end: round(+r.end_stock_qty, 2), sup: r.supplier_id, demand: round(+r.demand_qty, 2),
      waste: round(+r.waste_qty, 2), short: round(+r.shortage_qty, 2),
    }));
    // Deliveries: each pack arrives on the supplier's cycle: the first on plan start + week offset + lead time,
    // then every delivery interval. Market buys are not deliveries.
    const deliveries = [];
    for (const q_ of plan) {
      const I = byId[q_.ing];
      if (!I || !q_.packs || q_.rule === "daily market buy") continue;
      const start = toUTC(opt.plan_start) + (q_.week - 1) * 7 * DAY + I.lead * DAY;
      for (let k = 0; k < q_.packs; k++) deliveries.push([q_.ing, q_.week, opt.solve_method, new Date(start + k * I.interval * DAY).toISOString().slice(0, 10), I.pack]);
    }
    // Budget check for the month of the plan start
    const wk1 = plan.filter((x) => x.week === 1);
    const market = round(wk1.filter((x) => x.rule === "daily market buy").reduce((t, x) => t + x.cost, 0), 2);
    const planned = round(wk1.filter((x) => x.rule !== "daily market buy").reduce((t, x) => t + x.cost, 0), 2);
    const budgetBase = +opt.budget_php;
    const budget_check = {
      month: opt.plan_start.slice(0, 7), monthly_budget_php: budgetBase, month_to_date_php: mtd, market_buy_php: market, planned_orders_php: planned,
      month_total_php: round(mtd + planned + market, 2), headroom_php: round(budgetBase - (mtd + planned + market), 2),
      cap_for_orders_php: round(budgetBase - mtd - market, 2), cap_binding: planned > budgetBase - mtd - market,
    };
    return { id: opt.opt_run_id, level: service, policy: opt.policy, purchase_php: round(+opt.purchase_php, 2), status: opt.solver_status,
      objective: round(+opt.objective_php, 0), plan_start: opt.plan_start, horizon: opt.horizon_weeks, method: `Weekly ${opt.solve_method} planner`,
      budget: budgetBase, plan, deliveries, budget_check };
  }
  const planRuns = optRuns.map(buildRun).sort((x, y) => x.level - y.level);
  // The other two owner priorities (Minimize spoilage, Maximize availability) are plans of the v18.5 model outputs, not rows of the warehouse
  // (Balanced is the warehouse's 80% run). They are read from server/data/priority_plans.json, copied from model_rerun_v18_5/outputs.
  const prioFile = readJson("priority_plans.json"), prioRuns = [];
  for (const key of ["min_spoilage", "max_availability"]) {
    const pp = prioFile && prioFile[key];
    if (!pp) continue;
    const plan = pp.lines.filter((r) => byId[r.ing]).map((r) => ({ ing: r.ing, week: r.week, rule: r.rule, packs: r.packs, qty: r.qty, cost: r.cost, end: r.end, sup: r.sup, demand: r.demand, waste: r.waste, short: r.short }));
    const deliveries = [];
    for (const q_ of plan) {
      const I = byId[q_.ing];
      if (!q_.packs || q_.rule === "daily market buy") continue;
      const start = toUTC(pp.plan_start) + (q_.week - 1) * 7 * DAY + I.lead * DAY;
      for (let k = 0; k < q_.packs; k++) deliveries.push([q_.ing, q_.week, "MILP", new Date(start + k * I.interval * DAY).toISOString().slice(0, 10), I.pack]);
    }
    prioRuns.push({ id: key, owner: key, level: pp.level, policy: pp.policy, purchase_php: round(plan.reduce((t, x) => t + x.cost, 0), 2), status: pp.status, objective: pp.objective,
      plan_start: pp.plan_start, horizon: 2, method: "Weekly MILP planner", budget: pp.budget_check.monthly_budget_php, plan, deliveries, budget_check: pp.budget_check, bt: pp.backtest });
  }
  const defRun = planRuns.find((r) => /owner priority 'Balanced'/i.test(r.policy)) || planRuns[planRuns.length - 1];
  const { plan, deliveries, budget_check, level: service } = defRun;
  const budgetBase = defRun.budget;

  // the test window of the latest backtest (used by the plan summary and the supplier record)
  const w0 = btRun.holdout_start, w1 = btRun.holdout_end;

  const meta = {
    asof, d0, nd: N, plan_start: defRun.plan_start, horizon_weeks: defRun.horizon,
    budget: { Low: Number(process.env.BUDGET_LOW || 71100), Base: budgetBase, High: Number(process.env.BUDGET_HIGH || 91100) },
    service,
  };
  const optOut = {
    run_id: defRun.id,
    budget_check,
    method: defRun.method,
    status: defRun.status,
    objective: defRun.objective,
    horizon: defRun.horizon,
    plan_start: defRun.plan_start,
    service,
    window: `${w0} to ${w1}`,
  };

  // ---- upload matching (Loyverse CSV): SKU and name lookups, recipes, forecast profile ----
  const menu = await q(`select item_id, pos_sku, item_name from dw.dim_menu_item order by item_id`);
  const sku = {}, names = {};
  for (const m of menu) {
    if (m.pos_sku != null && !(String(m.pos_sku) in sku)) sku[String(m.pos_sku)] = [m.item_id, 0];
    const nk = normName(m.item_name);
    if (!(nk in names)) names[nk] = m.item_id;
  }
  const bom = {};
  for (const r of await q(`select item_id, ingredient_id, qty_base from dw.bridge_recipe_bom`)) {
    (bom[r.item_id] ||= []).push([r.ingredient_id, +r.qty_base]);
  }
  const prof = {};
  for (const r of await q(`select ingredient_id, target, yield_pct, demand_class, adi, cv2, off_pos_share from dw.ingredient_forecast_profile
                           where run_id = $1 and ingredient_id = any($2::int[])`, [planRun.run_id, ids])) {
    // a missing or zero yield would divide by zero later, so treat it as 1 (no adjustment)
    // c: demand class (smooth, erratic, intermittent, lumpy) from how often and how evenly the ingredient is used
    prof[r.ingredient_id] = {
      t: r.target === "bom_demand" ? "menu" : "other", y: +r.yield_pct > 0 ? round(+r.yield_pct, 4) : 1,
      c: r.demand_class, adi: round(+r.adi, 2), cv2: round(+r.cv2, 2), off: round(+r.off_pos_share || 0, 3),
    };
  }

  // full recipe cost of each menu item (every ingredient in the recipe, at standard cost)
  const icost = {};
  for (const r of await q(`select b.item_id, sum(b.qty_base * i.standard_unit_cost) as c
                           from dw.bridge_recipe_bom b join dw.dim_ingredient i on i.ingredient_id = b.ingredient_id
                           group by b.item_id`)) {
    icost[r.item_id] = round(+r.c, 2);
  }

  // ---- supplier delivery record over the test year: each purchase order against the first receipt after it ----
  const suppliers = (await q(`
    with po as (select txn_date, ingredient_id, supplier_id, quantity from dw.fact_inventory_transaction
                where txn_type = 'PURCHASE_ORDER' and txn_date between $2 and $3 and ingredient_id = any($1::int[])),
    m as (select po.*, r.txn_date as rdate, r.quantity as rqty from po
          join lateral (select txn_date, quantity from dw.fact_inventory_transaction r
                        where r.txn_type = 'RECEIPT' and r.ingredient_id = po.ingredient_id and r.txn_date >= po.txn_date
                        order by r.txn_date limit 1) r on true)
    select m.supplier_id, s.supplier_name, s.lead_time_days, count(*) as orders, avg(m.rdate - m.txn_date) as avg_days,
           sum(case when m.rdate - m.txn_date <= s.lead_time_days then 1 else 0 end) as on_time,
           max(m.rdate - m.txn_date) as max_days, sum(m.rqty) as received, sum(m.quantity) as ordered
    from m join dw.dim_supplier s on s.supplier_id = m.supplier_id
    group by 1, 2, 3 order by 2`, [ids, w0, w1])).map((r) => ({
    sup: r.supplier_id, name: r.supplier_name, lead: +r.lead_time_days, orders: +r.orders, avgDays: round(+r.avg_days, 2),
    onTime: round(+r.on_time / +r.orders, 4), maxDays: +r.max_days, qtyRatio: round(+r.received / (+r.ordered || 1), 4),
  }));
  const [priceRow] = await q(`select count(distinct (ingredient_id, unit_cost))::int as prices, count(distinct ingredient_id)::int as ings
                              from dw.fact_inventory_transaction where txn_type = 'RECEIPT' and ingredient_id = any($1::int[])`, [ids]);

  return {
    meta, ing, series, waste, reasons, so, outcomes, cats, chans, sales, batches, fdates, fc, wmape,
    plan, deliveries, dishes, mcmp, pering, perm, btd, icost,
    suppliers, pricesChanged: priceRow.prices > priceRow.ings,
    ext: { f, hi, rain, bts, ff }, engine, opt: optOut,
    upload: { sku, names, bom, prof }, isales, items,
    longRange: readLongRange(),
    serviceLevels: readJson("service_levels.json"),
    planRuns: [...planRuns, ...prioRuns].map((r) => ({ id: r.id, owner: r.owner || null, bt: r.bt || null, level: r.level, policy: r.policy, purchase_php: r.purchase_php, status: r.status, objective: r.objective, budget_check: r.budget_check, plan: r.plan, deliveries: r.deliveries })),
    defaultRun: defRun.id,
    loaded_at: new Date().toISOString(),
  };
}
