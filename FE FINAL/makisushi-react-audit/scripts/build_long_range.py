"""Build server/data/long_range.json: the 12-month demand forecast of the 20 perishables (monthly Holt-Winters, Chapter 4 Section 4.2.2.6).

The monthly model is fitted by the modelling pipeline (model_rerun_v18_5/60_long_range_forecast.py), not by the dashboard, and its
outputs are not stored in the Supabase tables (the run-type check allows only 'backtest' and 'plan'). This script copies the twelve
supported months and the accuracy by horizon into one small file that the Node server reads. Re-run it after the pipeline is re-run:

    py -I scripts/build_long_range.py "<path to model_rerun_v18_5/outputs/v2_5yr/long_range>"

Quantities are in the amounts taken from stock (the same basis as the 14-day forecast); the dashboard values them at standard cost.
Forecasts beyond 12 months are not supported (Chapter 4, Table 4.2.2.6.2) and are not copied.
"""
import json
import pathlib
import sys

import pandas as pd

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parent.parent / "server" / "data" / "long_range.json"
m = pd.read_csv(src / "forecast_monthly.csv")
m = m[(m.perishable) & (m.months_ahead <= 12)]
months = sorted(m.month.unique())
assert len(months) == 12, months
by = {}
for i, g in m.groupby("ingredient_id"):
    g = g.set_index("month").reindex(months)
    by[int(i)] = [round(float(v), 1) for v in g.forecast_qty]
d = pd.read_csv(src / "forecast_daily.csv", parse_dates=["date"])
origin = d.date.min().date().isoformat()
a = pd.read_csv(src / "accuracy_by_horizon.csv")
a = a[(a.model == "HW_MONTHLY") & (a.window == "test year")]
err = {str(r.months): round(float(r.total_wmape_by_ingredient), 4) for r in a.itertuples()}
json.dump({"model": "HW_MONTHLY", "origin": origin, "months": months, "qty": by, "error_by_horizon_months": err,
           "note": "Monthly Holt-Winters, damped trend and yearly season, spread to days with weekday, payday and holiday factors. "
                   "Error = typical error of each ingredient's total over the next N months on the test year (Chapter 4, Table 4.2.2.6.2)."},
          open(out, "w"), indent=0)
print(f"wrote {out}: {len(by)} ingredients x {len(months)} months from {origin}; error by horizon {err}")
