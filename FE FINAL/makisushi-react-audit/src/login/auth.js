// Sign-in for the dashboard. The username and password are checked by the server (server/auth.js), which answers with a
// session cookie that the page cannot read; the data and the saving of records are served only to a signed-in session.

const KEY = "makisushi.signedin.v1";

// sends the username and password to the server; resolves to { ok, error }
export async function checkLogin(username, password) {
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, error: j.error || "Incorrect username or password." };
  } catch (e) {
    return { ok: false, error: "The server could not be reached. Check the connection and try again." };
  }
}

// The sign-in is remembered for this browser tab only (sessionStorage), so a reload keeps you signed in while the
// server session lasts; when the server says the session has ended, the sign-in page is shown again.
export function wasSignedIn() {
  try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; }
}

export function rememberSignIn() {
  try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* storage blocked: the sign-in lasts until a reload */ }
}

export function forgetSignIn() {
  try { sessionStorage.removeItem(KEY); } catch (e) { /* nothing stored to clear */ }
  fetch("/api/logout", { method: "POST" }).catch(() => { /* offline: the session ends on its own */ });
}
