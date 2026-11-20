"""Build server/data/service_levels.json: what each service level from 80 % to 99 % did in the test-year backtest (Chapter 4, Figure 4.2.3.3.6).

The numbers come from the study's day-by-day replay of the ordering rule over the test year (7 Sep 2025 to 8 Sep 2026), not from the warehouse:
stockout episodes, expiry (the replay's waste, stock kept past its shelf life), net cost, fill rate and average stock. The 14-day plans at these
levels are stored in the warehouse (dw.ingredient_optimization_run, loaded by modelling 64_write_plans_by_level.py).

    py -I scripts/build_service_levels.py "<path to Chapter4_5_Output/data/service_level_replay.csv>"
"""
import json
import pathlib
import sys

import pandas as pd

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parent.parent / "server" / "data" / "service_levels.json"
d = pd.read_csv(src)
d = d[(d.target_level >= 0.8 - 1e-9) & (d.target_level <= 0.99 + 1e-9)]   # 80 % (default) to 99 % (the highest level the admin can choose)
rows = [{"level": round(float(r.target_level), 4), "episodes": int(r.stockout_episodes), "days": int(r.stockout_days),
         "expiry": round(float(r.waste_php), 2), "net_cost": round(float(r.net_cost_php), 2), "fill": round(float(r.fill_rate), 4),
         "avg_stock": round(float(r.avg_inventory_php), 2), "purchases": round(float(r.purchases_php), 2),
         "orders_cut": int(r.orders_cut)} for r in d.itertuples()]
# historical ordering over the same test year (Chapter 4, Table 4.2.3.3.1)
hist = {"episodes": 296, "days": 407, "expiry": 11905, "net_cost": 990329, "fill": 0.973, "avg_stock": 27447, "purchases": 893463}
json.dump({"period": "7 Sep 2025 to 8 Sep 2026", "historical": hist, "levels": rows,
           "note": "Backtest of the ordering rule on the test year at each service level, Balanced waste penalty, Base budget PHP 87,000 a month (Chapter 4, Section 4.2.3.3)."},
          open(out, "w"), indent=0)
print(f"wrote {out}: {len(rows)} levels from {rows[0]['level']} to {rows[-1]['level']}")
