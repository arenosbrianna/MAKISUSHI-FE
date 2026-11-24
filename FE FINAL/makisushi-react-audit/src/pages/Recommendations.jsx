// Recommended actions: the prescriptive part in words. Hold back overstock, top up before a
// run-out, smaller orders for the ingredients that lose the most, and weather and season advice for mango shakes, juice and drinks.
import { useState } from "react";
import { Chip, Info, Legend, NoteTip } from "../components/ui.jsx";
import { Donut, HBars } from "../components/Charts.jsx";
import { stockStatus } from "./InvPage.jsx";
import { daysTxt } from "../lib/format.js";
import { useApp } from "../AppContext.js";
import { useWeather } from "../lib/weather.js";
import { buildRecommendations, KIND_CLS } from "./recommend.js";

// the Actions tab: the list, and two cards that show what kind of actions there are and which ingredients are closest to running out
export function ActionsView({ F }) {
  const { wx } = useWeather();
  const recs = buildRecommendations(F, wx);
  const kinds = {};
  recs.forEach((r) => { kinds[r.kind] = (kinds[r.kind] || 0) + 1; });
  const KCOL = { "Order now": "#DC2626", "Top up": "#F59E0B", "Hold back": "#94A3B8", "Smaller orders": "#3B82F6", "Limit orders": "#A78BFA", Weather: "#10B981", Season: "#14B8A6" };
  const items = Object.entries(kinds);
  const cover = F.map((i) => ({ i, d: stockStatus(i).d })).sort((a, b) => a.d - b.d).slice(0, 8);
  return (
    <div className="grid canvas">
      <RecommendationsPanel F={F} limit={50} cls="c12" />
    </div>
  );
}

export function RecommendationsPanel({ F, limit = 8, title = "Recommended actions", cls = "c12" }) {
  const { set, goto } = useApp();
  const { wx } = useWeather();
  const [all, setAll] = useState(false);
  const recs = buildRecommendations(F, wx);
  const shown = all ? recs : recs.slice(0, limit);
  return (
    <div className={"panel " + cls} id="p-recs">
      <div className="ph">
        <h2>{title}</h2>
        <Chip cls={recs.some((r) => r.lvl === "bad") ? "bad" : recs.length ? "warn" : "good"}>{recs.length ? `${recs.length} actions` : "Nothing to act on"}</Chip>
        <Info t="What to do now, from the stock, forecast, plan, waste and weather. Click an action to open the page behind it." />
        {recs.length > limit && <button className="linkbtn noprint" style={{ margin: 0 }} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${recs.length}`}</button>}
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Action</th><th>Ingredient or dish</th><th>Detail</th></tr></thead>
          <tbody>
            {shown.length ? shown.map((r, k) => (
              <tr key={k} className={r.page ? "click" : ""} onClick={() => { if (r.page) { if (r.patch) set(r.patch); goto(r.page); } }}>
                <td><Chip cls={r.lvl === "bad" ? "bad" : KIND_CLS[r.kind] || "flat"}>{r.kind}</Chip></td>
                <td><b>{r.what}</b></td>
                <td style={{ whiteSpace: "normal" }}>{r.kind === "Weather" || r.kind === "Season" ? r.action : r.why}</td>
              </tr>
            )) : <tr><td colSpan={3} className="empty">Nothing needs action.</td></tr>}
          </tbody>
        </table>
      </div>
      <NoteTip t={wx ? `Weather advice uses the live forecast (${wx.source}, ${wx.location}) and the season (${wx.season.label}).` : "Weather advice appears when the weather service answers."} />
    </div>
  );
}
