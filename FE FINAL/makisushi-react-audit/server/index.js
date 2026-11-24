// Local server: the API and the built app on one port (npm start). On Vercel, api/index.js serves the same app as a function.
import app, { getPayload } from "./app.js";

const port = Number(process.env.PORT || 8788);
app.listen(port, () => {
  console.log(`Dashboard API on http://localhost:${port}`);
  // load the data once at start-up so the first page view is quick
  getPayload()
    .then(() => console.log("Dashboard data loaded from Supabase."))
    .catch((e) => console.error("Could not load the dashboard data yet:", e.message));
});
