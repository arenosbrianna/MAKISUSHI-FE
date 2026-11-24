// Live weather from the server (/api/weather, Open-Meteo), loaded once and refreshed every 30 minutes.
import { useEffect, useState } from "react";
import { LAST, dateOf } from "./model.js";

let cached = null, at = 0, pending = null;
function load() {
  if (cached && Date.now() - at < 30 * 60 * 1000) return Promise.resolve(cached);
  if (!pending) {
    // the weather of the data's dates: the latest upload and the 14 days of the plan
    const asof = dateOf(LAST).toISOString().slice(0, 10);
    pending = fetch("/api/weather?asof=" + asof).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || r.statusText);
      cached = j; at = Date.now();
      return j;
    }).finally(() => { pending = null; });
  }
  return pending;
}

// { wx, error, loading }: wx is null until the weather has loaded (or when the service cannot be reached)
export function useWeather() {
  const [s, setS] = useState({ wx: cached, error: null, loading: !cached });
  useEffect(() => {
    let live = true;
    load().then((wx) => { if (live) setS({ wx, error: null, loading: false }); }).catch((e) => { if (live) setS({ wx: cached, error: e.message, loading: false }); });
    return () => { live = false; };
  }, []);
  return s;
}
