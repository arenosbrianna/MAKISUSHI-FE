// Store the 14-day plan at every service level from 80% to 99% in the warehouse (rows only; no schema change).
//
//   node scripts/load_plan_levels.mjs            dry run: write in one transaction, run the checks, ROLL BACK
//   node scripts/load_plan_levels.mjs --commit   keep it
//
// Input: the files of modelling .../model_rerun_v18_5/63_plans_by_service_level.py (outputs/v4_recommended/plans_by_level/plan_lines_all_levels.csv
// and plans_summary.csv). Each level becomes one dw.ingredient_optimization_run (scenario 'balanced', solve_method 'MILP', attached to the selected
// forecast run) with its 40 dw.fact_ingredient_replenishment_plan lines (20 perishables x 2 weeks). A level that is already stored is skipped, so
// running it twice never duplicates rows. The 80% run (the Balanced priority) and the 98% run were loaded earlier and stay as they are.
// The dashboard opens on 80% and the admin can choose any stored level up to 99%; the 99.99% run of the Chapter 4 sweep is not stored.
// It uses the dashboard server's own connection (DATABASE_URL in .env), which connects in seconds; the Python writer (64_write_plans_by_level.py)
// does the same work for a machine with a direct connection.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../server/db.js";

const COMMIT = process.argv.includes("--commit");
const DIR = process.argv.find((a) => a.endsWith("plans_by_level")) ||
  path.resolve("..", "..", "modelling", "staging", "rebuild_new_fish_produce_20261026", "model_rerun_v18_5", "outputs", "v4_recommended", "plans_by_level");
const MAXLEVEL = 0.99;

const csv = (file) => {
  const [head, ...rows] = fs.readFileSync(path.join(DIR, file), "utf8").trim().split(/\r?\n/);
  const cols = head.split(",");
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, k) => [cols[k], v])));
};
const num = (v) => (v === "" || v === undefined ? null : Number(v));
const label = (l) => `${Math.round(l * 100)}%`;

const lines = csv("plan_lines_all_levels.csv");
const summary = Object.fromEntries(csv("plans_summary.csv").map((r) => [Number(r.level).toFixed(4), r]));
const levels = [...new Set(lines.map((r) => Number(r.level)))].sort((a, b) => a - b).filter((l) => l <= MAXLEVEL + 1e-9);

const client = await pool.connect();
try {
  await client.query("begin");
  const fr = (await client.query("select run_id from dw.ingredient_forecast_run where run_type = 'plan' and is_selected")).rows[0].run_id;
  const code = (await client.query("select code_version from dw.ingredient_optimization_run where forecast_run_id = $1 order by opt_run_id desc limit 1", [fr])).rows[0].code_version;
  const have = new Set((await client.query(
    `select distinct round(p.service_level::numeric, 4) as l from dw.fact_ingredient_replenishment_plan p
     join dw.ingredient_optimization_run o using (opt_run_id) where o.forecast_run_id = $1 and p.service_level is not null`, [fr])).rows.map((r) => Number(r.l).toFixed(4)));
  console.log(`selected forecast run ${fr}; levels already stored: ${[...have].join(", ")}`);
  const info = JSON.parse(fs.readFileSync(path.join(DIR, "..", "final", "run_info.json"), "utf8"));
  const budget = info.monthly_budget_php;
  for (const level of levels) {
    if (have.has(level.toFixed(4))) continue;
    const L = lines.filter((r) => Number(r.level) === level), s = summary[level.toFixed(4)];
    const total = L.reduce((t, r) => t + Number(r.order_cost_php), 0);
    const over = total > (budget * 7 * info.horizon_weeks) / (365 / 12) + 0.5;
    const policy = `Weekly MILP, every perishable, one ${label(level)} safety level, monthly Base budget PHP ${budget.toLocaleString("en-US")} (service-level sweep, Balanced waste penalty)`;
    const run = await client.query(
      `insert into dw.ingredient_optimization_run (forecast_run_id, plan_start, horizon_weeks, scenario, budget_php, solve_method, solver_status, objective_php, purchase_php, over_budget, code_version, policy)
       values ($1, $2, $3, 'balanced', $4, 'MILP', $5, $6, $7, $8, $9, $10) returning opt_run_id`,
      [fr, info.plan_start, info.horizon_weeks, budget, s.milp_status, Number(s.milp_objective_php), total, over, code, policy]);
    const id = run.rows[0].opt_run_id;
    for (const r of L) {
      await client.query(
        `insert into dw.fact_ingredient_replenishment_plan (opt_run_id, ingredient_id, week_no, supplier_id, demand_qty, packs, order_qty, order_cost_php, end_stock_qty, shortage_qty, waste_qty, safety_deficit, ordering_rule, service_level)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [id, num(r.ingredient_id), num(r.week_no), num(r.supplier_id), num(r.demand_qty), Math.round(num(r.packs)), num(r.order_qty), num(r.order_cost_php), num(r.end_stock_qty),
          num(r.shortage_qty), num(r.waste_qty), num(r.safety_deficit), r.rule, num(r.service_level)]);
    }
    console.log(`  level ${label(level).padStart(4)}: opt_run_id ${id}, ${L.length} lines, purchases PHP ${total.toFixed(2)}`);
  }
  const now = (await client.query(
    `select o.opt_run_id, round(max(p.service_level)::numeric, 4) as lvl, count(*)::int as n, round(sum(p.order_cost_php)::numeric, 2) as cost
     from dw.ingredient_optimization_run o join dw.fact_ingredient_replenishment_plan p using (opt_run_id)
     where o.forecast_run_id = $1 group by 1 order by 2, 1`, [fr])).rows;
  console.log(`runs of forecast run ${fr} now: ${now.length}`);
  if (!now.every((r) => r.n === 40)) throw new Error("a run does not have 40 plan lines");
  if (new Set(now.map((r) => r.lvl)).size !== now.length) throw new Error("two runs share a service level");
  if (COMMIT) { await client.query("commit"); console.log("COMMITTED"); } else { await client.query("rollback"); console.log("DRY RUN: rolled back (use --commit to keep)"); }
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("FAILED, rolled back:", e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
