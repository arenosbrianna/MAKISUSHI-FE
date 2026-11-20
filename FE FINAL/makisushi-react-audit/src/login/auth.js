// Sign-in for the dashboard. The username and password are checked in the browser, so this only stops the
// dashboard from opening by accident: the password is visible in the built JavaScript. A real check needs the server.

export const LOGIN_USER = "admin";
const LOGIN_PASSWORD = "admin123";
const KEY = "makisushi.signedin.v1";

export function checkLogin(username, password) {
  return username.trim() === LOGIN_USER && password === LOGIN_PASSWORD;
}

// The sign-in is remembered for this browser tab only (sessionStorage), so a reload keeps you signed in.
export function wasSignedIn() {
  try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; }
}

export function rememberSignIn() {
  try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* storage blocked: the sign-in lasts until a reload */ }
}

export function forgetSignIn() {
  try { sessionStorage.removeItem(KEY); } catch (e) { /* nothing stored to clear */ }
}
