// Sign-in page, taken from the React branch of MAKISUSHI-FE. The server checks the sign-in (auth.js, server/auth.js).
import { useEffect, useState } from "react";
import { LoginArt } from "./LoginArt.jsx";
import { checkLogin } from "./auth.js";
import "./login.css";

const Icon = ({ d, extra }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} />{extra && <path d={extra} />}</svg>
);

export function LoginPage({ onSignIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const before = document.title;
    document.title = "Sign in · Makisushi Decision Support System";
    return () => { document.title = before; };
  }, []);

  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await checkLogin(username, password);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      setPassword("");
      return;
    }
    setError(null);
    onSignIn();
  };

  return (
    <div className="login-root">
      <main className="login-main">
        <LoginArt />
        <div className="login-wrap">
          <img className="login-logo" src="/logo.png" alt="Makisushi Japanese Restaurant" draggable={false} />
          <p className="login-product">Decision Support System</p>

          <form className="login-card" onSubmit={submit} noValidate>
            <div className="login-head">
              <h1>Sign in</h1>
            </div>

            {error && <div role="alert" className="login-error">● {error}</div>}

            <label className="login-field">
              <span className="lbl">Username</span>
              <span className="login-input-wrap">
                <span className="login-icon"><Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></span>
                <input className="login-input" type="text" name="username" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
              </span>
            </label>

            <label className="login-field">
              <span className="lbl">Password</span>
              <span className="login-input-wrap">
                <span className="login-icon"><Icon d="M5 11h14v10H5z" extra="M8 11V8a4 4 0 0 1 8 0v3" /></span>
                <input className="login-input" type={show ? "text" : "password"} name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 48 }} />
                <button type="button" className="login-eye" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}>
                  {show
                    ? <Icon d="M17.9 17.9A10.4 10.4 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.7 9.7 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22" />
                    : <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" extra="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />}
                </button>
              </span>
            </label>

            <button className="login-submit" type="submit" disabled={busy || !username.trim() || !password}>
              Sign in <Icon d="M5 12h14M13 6l6 6-6 6" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
