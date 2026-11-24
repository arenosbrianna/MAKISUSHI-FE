import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardPayload } from "./payload.js";
import { readTracking, saveTracking, deleteTracking, batchTracking } from "./tracking.js";
import { liveWeather, weatherAt } from "./weather.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const app = express();
const TTL = 10 * 60 * 1000;
let cache = null, cacheAt = 0, pending = null;

function refresh() {
  if (!pending) {
    pending = buildDashboardPayload()
      .then((p) => { cache = p; cacheAt = Date.now(); return p; })
      .finally(() => { pending = null; });
  }
  return pending;
}
// the last data is served at once; when it is older than 10 minutes it is refreshed in the background,
// so only the very first load after the server starts waits for Supabase
async function getPayload() {
  if (cache) { if (Date.now() - cacheAt >= TTL) refresh().catch((e) => console.error("Refresh failed:", e.message)); return cache; }
  return refresh();
}

app.get("/api/dashboard", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await getPayload());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load the dashboard data from Supabase.", detail: e.message });
  }
});

// Live weather and the Philippine season (Open-Meteo; cached for 30 minutes, separate from the dashboard data)
app.get("/api/weather", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await (req.query.asof ? weatherAt(String(req.query.asof)) : liveWeather()));
  } catch (e) {
    res.status(502).json({ error: "The weather service could not be reached.", detail: e.message });
  }
});

// Recommendation tracking (not cached: it changes when a line is saved)
app.get("/api/tracking", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await readTracking());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not read the tracking records.", detail: e.message });
  }
});
app.post("/api/tracking", express.json({ limit: "20kb" }), async (req, res) => {
  try {
    res.json(await saveTracking(req.body || {}));
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : "Could not save the record.", detail: e.message });
  }
});

app.post("/api/tracking/batch", express.json({ limit: "100kb" }), async (req, res) => {
  try {
    res.json(await batchTracking(req.body || {}));
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : "Nothing was saved.", detail: e.message });
  }
});
app.delete("/api/tracking", express.json({ limit: "5kb" }), async (req, res) => {
  try {
    res.json(await deleteTracking(req.body || {}));
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : "Could not undo the record.", detail: e.message });
  }
});

// Serve the built React app when it exists (npm run build first).
const dist = path.join(root, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT || 8788);
app.listen(port, () => {
  console.log(`Dashboard API on http://localhost:${port}`);
  // load the data once at start-up so the first page view is quick
  getPayload()
    .then(() => console.log("Dashboard data loaded from Supabase."))
    .catch((e) => console.error("Could not load the dashboard data yet:", e.message));
});
