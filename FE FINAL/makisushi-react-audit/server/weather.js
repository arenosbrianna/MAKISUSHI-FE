// Heat index at 14:00 each day, from Open-Meteo's historical archive (no API key).
// Supabase does not store weather, so this is the only non-database input.

function heatIndexC(tC, rh) {
  const T = tC * 9 / 5 + 32, R = rh;
  let HI = 0.5 * (T + 61 + (T - 68) * 1.2 + R * 0.094);
  if (HI >= 80) {
    HI = -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R - 6.83783e-3 * T * T
      - 5.481717e-2 * R * R + 1.22874e-3 * T * T * R + 8.5282e-4 * T * R * R - 1.99e-6 * T * T * R * R;
    if (R < 13 && T >= 80 && T <= 112) HI -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (R > 85 && T >= 80 && T <= 87) HI += ((R - 85) / 10) * ((87 - T) / 5);
  }
  return (HI - 32) * 5 / 9;
}

export async function heatIndexByDate(startDate, endDate) {
  const lat = process.env.WEATHER_LAT || "14.676";
  const lon = process.env.WEATHER_LON || "121.0437";
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}`
    + `&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m&timezone=Asia%2FManila`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
  const j = await res.json();
  const out = new Map();
  j.hourly.time.forEach((t, k) => {
    if (!t.endsWith("T14:00")) return;
    const tc = j.hourly.temperature_2m[k], rh = j.hourly.relative_humidity_2m[k];
    if (tc == null || rh == null) return;
    out.set(t.slice(0, 10), Math.round(heatIndexC(tc, rh) * 10) / 10);
  });
  return out;
}

// Rain in each day (mm), from the same archive, so the dashboard can say whether rainy days sell differently
export async function rainByDate(startDate, endDate) {
  const lat = process.env.WEATHER_LAT || "14.676";
  const lon = process.env.WEATHER_LON || "121.0437";
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=Asia%2FManila`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
  const j = await res.json();
  const out = new Map();
  (j.daily.time || []).forEach((t, k) => { if (j.daily.precipitation_sum[k] != null) out.set(t, j.daily.precipitation_sum[k]); });
  return out;
}

// ---- live weather: recent days, today and the next days, from Open-Meteo's forecast API (no API key) ----
// The same heat index as the history above (feels-like at 14:00, from temperature and humidity), so the live days compare with the sales history.
// PAGASA heat-index classes: caution below 33 °C, extreme caution 33 to 41 °C, danger 42 °C and above.
// Philippine seasons (PAGASA climate types for Metro Manila): the hot dry season ("summer", tag-init) from March to May, the rainy season
// (tag-ulan) from June to November and the cool dry season (tag-lamig) from December to February.
export function phSeason(isoDate) {
  const m = +isoDate.slice(5, 7);
  if (m >= 3 && m <= 5) return { key: "summer", label: "Hot dry season (summer)", local: "tag-init", months: "March to May" };
  if (m >= 6 && m <= 11) return { key: "rainy", label: "Rainy season", local: "tag-ulan", months: "June to November" };
  return { key: "cool", label: "Cool dry season", local: "tag-lamig", months: "December to February" };
}
export const heatClass = (hi) => (hi == null ? null : hi >= 42 ? "danger" : hi >= 33 ? "extreme caution" : "caution");

let liveCache = null, liveAt = 0;
export async function liveWeather() {
  if (liveCache && Date.now() - liveAt < 30 * 60 * 1000) return liveCache;
  const lat = process.env.WEATHER_LAT || "14.676";
  const lon = process.env.WEATHER_LON || "121.0437";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,relative_humidity_2m,apparent_temperature`
    + `&hourly=temperature_2m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`
    + `&timezone=Asia%2FManila&past_days=7&forecast_days=16`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
  const j = await res.json();
  const hi = new Map();
  j.hourly.time.forEach((t, k) => {
    if (!t.endsWith("T14:00")) return;
    const tc = j.hourly.temperature_2m[k], rh = j.hourly.relative_humidity_2m[k];
    if (tc != null && rh != null) hi.set(t.slice(0, 10), Math.round(heatIndexC(tc, rh) * 10) / 10);
  });
  const today = String(j.current.time).slice(0, 10);
  const days = j.daily.time.map((d, k) => ({
    date: d, tmax: j.daily.temperature_2m_max[k], tmin: j.daily.temperature_2m_min[k], rain: j.daily.precipitation_sum[k],
    hi: hi.get(d) ?? null, class: heatClass(hi.get(d) ?? null), past: d < today, today: d === today,
  }));
  liveCache = {
    source: "Open-Meteo", location: "Quezon City", fetched_at: new Date().toISOString(), today, season: phSeason(today),
    now: { temp: j.current.temperature_2m, humidity: j.current.relative_humidity_2m, feels: j.current.apparent_temperature },
    days,
  };
  liveAt = Date.now();
  return liveCache;
}
