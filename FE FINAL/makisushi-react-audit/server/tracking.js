// Recommendation tracking: what was recommended, whether it was followed, and what was really ordered.
// Rows live in dw.fact_recommendation_outcome (opt_run_id, ingredient_id, week_start, implemented, actual_order_qty,
// actual_waste_qty, actual_stockout_days, recorded_at). The server only writes rows; it never changes the schema.
// The table's foreign key to the dish-level plan was dropped (approved), so this module checks that each row matches
// a line of a stored ingredient plan (dw.fact_ingredient_replenishment_plan, one run per service level) before it writes.
import { pool } from "./db.js";

const DAY = 864e5;
const toUTC = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const weekStartOf = (planStart, weekNo) => new Date(toUTC(planStart) + (weekNo - 1) * 7 * DAY).toISOString().slice(0, 10);

async function runById(id) {
  if (!Number.isInteger(id)) return null;
  const { rows } = await pool.query(`select opt_run_id, plan_start, horizon_weeks from dw.ingredient_optimization_run where opt_run_id = $1`, [id]);
  return rows[0] || null;
}

// the saved rows of every run, with the week number each belongs to
export async function readTracking() {
  const { rows } = await pool.query(
    `select o.opt_run_id, o.ingredient_id, o.week_start, o.implemented, o.actual_order_qty, o.actual_waste_qty, o.actual_stockout_days, o.recorded_at
     from dw.fact_recommendation_outcome o order by o.week_start desc, o.ingredient_id`);
  return {
    rows: rows.map((r) => ({
      opt_run_id: Number(r.opt_run_id), ingredient_id: r.ingredient_id, week_start: r.week_start, implemented: r.implemented,
      actual_order_qty: r.actual_order_qty === null ? null : +r.actual_order_qty,
      actual_waste_qty: r.actual_waste_qty === null ? null : +r.actual_waste_qty,
      actual_stockout_days: r.actual_stockout_days === null ? null : +r.actual_stockout_days,
      recorded_at: r.recorded_at,
    })),
  };
}

const num0 = (v) => v === null || v === undefined || v === "" ? null : Number(v);

// save one line (insert, or update the existing row for the same run, ingredient and week)
export async function saveTracking(b) {
  const run = await runById(Number(b.opt_run_id));
  if (!run) throw Object.assign(new Error("That plan is not stored. Reload the page."), { status: 400 });
  const ingredient = Number(b.ingredient_id), week = Number(b.week_no);
  if (!Number.isInteger(ingredient) || !Number.isInteger(week) || week < 1 || week > Number(run.horizon_weeks)) throw Object.assign(new Error("Unknown plan line."), { status: 400 });
  if (typeof b.implemented !== "boolean") throw Object.assign(new Error("Say whether the recommendation was followed."), { status: 400 });
  const qty = num0(b.actual_order_qty), waste = num0(b.actual_waste_qty), days = num0(b.actual_stockout_days);
  if (qty !== null && !(qty >= 0)) throw Object.assign(new Error("The quantity ordered cannot be negative."), { status: 400 });
  if (waste !== null && !(waste >= 0)) throw Object.assign(new Error("Waste cannot be negative."), { status: 400 });
  if (days !== null && !(Number.isInteger(days) && days >= 0 && days <= 7)) throw Object.assign(new Error("Stockout days must be a whole number from 0 to 7."), { status: 400 });
  const line = await pool.query(
    `select 1 from dw.fact_ingredient_replenishment_plan where opt_run_id = $1 and ingredient_id = $2 and week_no = $3`,
    [run.opt_run_id, ingredient, week]);
  if (!line.rowCount) throw Object.assign(new Error("That ingredient and week are not in that plan."), { status: 400 });
  const ws = weekStartOf(run.plan_start, week);
  await pool.query(
    `insert into dw.fact_recommendation_outcome (opt_run_id, ingredient_id, week_start, implemented, actual_order_qty, actual_waste_qty, actual_stockout_days)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (opt_run_id, ingredient_id, week_start)
     do update set implemented = excluded.implemented, actual_order_qty = excluded.actual_order_qty,
       actual_waste_qty = excluded.actual_waste_qty, actual_stockout_days = excluded.actual_stockout_days, recorded_at = now()`,
    [run.opt_run_id, ingredient, ws, b.implemented, qty, waste, days]);
  return { ok: true, week_start: ws };
}
