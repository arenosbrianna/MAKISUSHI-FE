// Vercel function: every /api request is routed here (vercel.json) and handled by the same Express app as the local server.
import app from "../server/app.js";

export default app;
