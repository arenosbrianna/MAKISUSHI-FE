// Live weather from the server (/api/weather, Open-Meteo), loaded once and refreshed every 30 minutes.
import { useEffect, useState } from "react";

let cached = null, at = 0, pending = null;
function load() {
  if (cached && Date.now() - at < 30 * 60 * 1000) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch("/api/weather").then(async (r) => {
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
