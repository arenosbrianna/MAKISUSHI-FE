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

// Writes go through one transaction: every line is checked first and then written; if any line fails, nothing is written
// (Atomicity and Consistency). A row is keyed by run, ingredient and week (the table's unique key), so saving twice updates it.
async function inTransaction(work) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const out = await work(c);
    await c.query("commit");
    return out;
  } catch (e) {
    try { await c.query("rollback"); } catch (e2) { /* the connection is already gone */ }
    throw e;
  } finally {
    c.release();
  }
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

// check one line against the stored plan and return its run and week start; throws a 400 error that names the problem
async function checkLine(c, b) {
  const { rows } = await c.query(`select opt_run_id, plan_start, horizon_weeks from dw.ingredient_optimization_run where opt_run_id = $1`, [Number(b.opt_run_id)]);
  const run = rows[0];
  if (!run) throw bad("That plan is not stored. Reload the page.");
  const ingredient = Number(b.ingredient_id), week = Number(b.week_no);
  if (!Number.isInteger(ingredient) || !Number.isInteger(week) || week < 1 || week > Number(run.horizon_weeks)) throw bad("Unknown plan line.");
  const line = await c.query(`select 1 from dw.fact_ingredient_replenishment_plan where opt_run_id = $1 and ingredient_id = $2 and week_no = $3`, [run.opt_run_id, ingredient, week]);
  if (!line.rowCount) throw bad("That ingredient and week are not in that plan.");
  return { run, ingredient, ws: weekStartOf(run.plan_start, week) };
}

async function upsertLine(c, b) {
  const { run, ingredient, ws } = await checkLine(c, b);
  if (typeof b.implemented !== "boolean") throw bad("Say whether the recommendation was followed.");
  const qty = num0(b.actual_order_qty), waste = num0(b.actual_waste_qty), days = num0(b.actual_stockout_days);
  if (qty !== null && !(qty >= 0)) throw bad("The quantity ordered cannot be negative.");
  if (waste !== null && !(waste >= 0)) throw bad("Waste cannot be negative.");
  if (days !== null && !(Number.isInteger(days) && days >= 0 && days <= 7)) throw bad("Stockout days must be a whole number from 0 to 7.");
  await c.query(
    `insert into dw.fact_recommendation_outcome (opt_run_id, ingredient_id, week_start, implemented, actual_order_qty, actual_waste_qty, actual_stockout_days)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (opt_run_id, ingredient_id, week_start)
     do update set implemented = excluded.implemented, actual_order_qty = excluded.actual_order_qty,
       actual_waste_qty = excluded.actual_waste_qty, actual_stockout_days = excluded.actual_stockout_days, recorded_at = now()`,
    [run.opt_run_id, ingredient, ws, b.implemented, qty, waste, days]);
  return ws;
}

async function deleteLine(c, b) {
  const { run, ingredient, ws } = await checkLine(c, b);
  const r = await c.query(`delete from dw.fact_recommendation_outcome where opt_run_id = $1 and ingredient_id = $2 and week_start = $3`, [run.opt_run_id, ingredient, ws]);
  return r.rowCount;
}

// save one line (insert, or update the existing row for the same run, ingredient and week)
export async function saveTracking(b) {
  const ws = await inTransaction((c) => upsertLine(c, b));
  return { ok: true, week_start: ws };
}

// undo of a save that created a new row: remove that one row (rows only; the table itself is never changed)
export async function deleteTracking(b) {
  const n = await inTransaction((c) => deleteLine(c, b));
  return { ok: true, deleted: n };
}

// several lines at once (Save all, and Undo of Save all): all are written or none is
export async function batchTracking(body) {
  const save = Array.isArray(body.save) ? body.save : [], remove = Array.isArray(body.remove) ? body.remove : [];
  if (!save.length && !remove.length) throw bad("Nothing to save.");
  if (save.length + remove.length > 100) throw bad("Too many lines at once.");
  return inTransaction(async (c) => {
    for (const b of save) await upsertLine(c, b);
    let deleted = 0;
    for (const b of remove) deleted += await deleteLine(c, b);
    return { ok: true, saved: save.length, deleted };
  });
}
