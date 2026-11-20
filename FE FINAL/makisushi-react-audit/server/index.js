import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardPayload } from "./payload.js";
import { readTracking, saveTracking } from "./tracking.js";
import { liveWeather } from "./weather.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const app = express();
const TTL = 10 * 60 * 1000;
let cache = null, cacheAt = 0, pending = null;

async function getPayload() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  if (!pending) {
    pending = buildDashboardPayload()
      .then((p) => { cache = p; cacheAt = Date.now(); return p; })
      .finally(() => { pending = null; });
  }
  return pending;
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
    res.json(await liveWeather());
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
