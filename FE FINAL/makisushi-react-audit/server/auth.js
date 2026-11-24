// Sign-in checked by the server. The username and password are server settings (DSS_USER, DSS_PASSWORD in .env locally and
// in the Vercel environment), never part of the code that reaches the browser. A correct sign-in gets a signed session cookie
// that the page's scripts cannot read (HttpOnly); every /api route except sign-in and sign-out needs it.
import crypto from "node:crypto";

const COOKIE = "dss_session";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;   // a sign-in lasts at most 12 hours, and ends when the browser is closed

const user = () => process.env.DSS_USER || "admin";
const password = () => process.env.DSS_PASSWORD || "";
// the signing key follows the password (or SESSION_SECRET if set), so changing the password signs everyone out
const key = () => crypto.createHash("sha256").update("makisushi-dss-session:" + (process.env.SESSION_SECRET || password())).digest();
const sign = (v) => crypto.createHmac("sha256", key()).update(v).digest("base64url");
const same = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

function tokenOk(tok) {
  if (!tok || !password()) return false;
  const [t, mac] = String(tok).split(".");
  if (!t || !mac || !same(mac, sign(t))) return false;
  const age = Date.now() - Number(t);
  return age >= 0 && age < MAX_AGE_MS;
}

function readCookie(req) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Secure on https (Vercel), so the cookie is never sent over plain http; locally (http://localhost) it is left off
const flags = (req) => "; Path=/; HttpOnly; SameSite=Strict" + (req.headers["x-forwarded-proto"] === "https" || req.secure ? "; Secure" : "");

export async function login(req, res) {
  if (!password()) return res.status(503).json({ error: "Sign-in is not set up on the server (DSS_PASSWORD is missing)." });
  const { username = "", password: given = "" } = req.body || {};
  if (same(String(username).trim(), user()) && same(given, password())) {
    const t = String(Date.now());
    res.setHeader("Set-Cookie", COOKIE + "=" + t + "." + sign(t) + flags(req));
    return res.json({ ok: true });
  }
  await new Promise((r) => setTimeout(r, 600));   // slows down guessing
  res.status(401).json({ error: "Incorrect username or password." });
}

export function logout(req, res) {
  res.setHeader("Set-Cookie", COOKIE + "=" + flags(req) + "; Max-Age=0");
  res.json({ ok: true });
}

export function requireSession(req, res, next) {
  if (tokenOk(readCookie(req))) return next();
  res.status(401).json({ error: "Please sign in again." });
}
