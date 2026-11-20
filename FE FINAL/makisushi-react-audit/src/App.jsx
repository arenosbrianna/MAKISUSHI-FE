// App shell: loads the data from /api/dashboard, holds the page state, and lays out the screen like a
// Power BI report: a top bar, a row of slicers across the top of the page, and the pages in a navigation sidebar on the left.
import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AppCtx } from "./AppContext.js";
import { initModel, selectPlan, LAST, D0, fd, filtered, win, MONTHS, D } from "./lib/model.js";
import { NAVN, PAGES, NAV_GROUPS, HEADS, SHORT_RANGE, SUBTABS, tabOf } from "./lib/constants.js";

// the period the page's numbers cover, printed beside the page title
const PERIOD_PAGES = new Set(["today", "inv", "waste", "sales", "reports"]);
function periodText(S) {
  const w = win(S);
  const name = S.year ? (S.month === "" ? String(S.year) : `${MONTHS[+S.month]} ${S.year}`) : SHORT_RANGE[S.range] ? `Last ${SHORT_RANGE[S.range]}` : "All data";
  return `${name} · ${fd(w.a, true)} to ${fd(w.b, true)}`;
}
import { downloadCsv } from "./lib/actions.js";
import { TipLayer } from "./components/ui.jsx";
import { Controls, filtersFor } from "./components/Controls.jsx";
import { SalesPage } from "./pages/SalesPage.jsx";
import { WastePage } from "./pages/WastePage.jsx";
import { InvPage } from "./pages/InvPage.jsx";
import { PredPage } from "./pages/PredPage.jsx";
import { BuyPage } from "./pages/BuyPage.jsx";
import { TrackPage } from "./pages/TrackPage.jsx";
import { TodayPage } from "./pages/TodayPage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { Icon } from "./components/Icons.jsx";
import { LoginPage } from "./login/LoginPage.jsx";
import { AccountMenu } from "./login/AccountMenu.jsx";
import { wasSignedIn, rememberSignIn, forgetSignIn } from "./login/auth.js";

const initialPage = () => {
  try {
    const h = window.location.hash.slice(1);
    if (PAGES.some((p) => p[0] === h)) return h;
  } catch (e) { /* no hash */ }
  return "today";
};

const initialState = () => ({
  topcat: "", topby: "n", year: null, month: "", yoyBy: "total", report: "orders", wyear: "",
  showHelp: false, allrows: false, invAll: false, heat: "all", ptab: "forecast", lr: 12, planRun: null,
  wi: 1, week: 0, grain: "", range: 90, cat: "", ing: 0, sup: 0,
  store: "", scen: "Base", sel: 0,
  stab: "overview", ttab: "w1", itab: "status", wtab: "now", btab: "orders",
  page: initialPage(),
});

// used while the data loads or if it fails
const Screen = ({ children }) => (
  <div className="pbi-app">
    <main className="pbi-page">{children}</main>
  </div>
);

export default function App() {
  const [status, setStatus] = useState({ loading: true, error: null });
  const [signedIn, setSignedIn] = useState(wasSignedIn);
  const [S, setS] = useState(initialState);
  const up = null;   // data comes from the daily upload form (n8n), not from this page
  const [toastMsg, setToastMsg] = useState(null);
  const exp = useRef({});
  const msgs = useRef({});
  const toastTimer = useRef(null);

  // load the dashboard data from the server (which reads Supabase), once the user has signed in
  useEffect(() => {
    if (!signedIn) return undefined;
    let cancelled = false;
    fetch("/api/dashboard")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || j.error || r.statusText);
        return j;
      })
      .then((j) => {
        if (cancelled) return;
        initModel(j);
        setStatus({ loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setStatus({ loading: false, error: e.message });
      });
    return () => { cancelled = true; };
  }, [signedIn]);

  const set = useCallback((patch) => setS((s) => ({ ...s, ...patch })), []);
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2400);
  }, []);
  const goto = useCallback((page) => {
    set({ page, cat: "" });
    try { history.replaceState(null, "", "#" + page); } catch (e) { /* ignore */ }
    window.scrollTo(0, 0);
  }, [set]);

  const openTab = useCallback((page, key, value) => {
    set({ page, [key]: value, cat: "" });
    try { history.replaceState(null, "", "#" + page); } catch (e) { /* ignore */ }
  }, [set]);

  // sign out: forget the sign-in and show the login page; the next sign-in loads the data again
  const signOut = useCallback(() => {
    forgetSignIn();
    setStatus({ loading: true, error: null });
    setSignedIn(false);
  }, []);

  // export helper used by the pages
  exp.current.onExport = (name) => {
    const rows = exp.current[name];
    if (rows) downloadCsv("makisushi_" + name + ".csv", rows, toast);
  };

  const ctx = useMemo(() => ({ S, set, exp, msgs, goto, toast, up, openUpload: () => {}, removeUpload: () => {} }), [S, set, goto, toast, up]);

  if (!signedIn) {
    return <LoginPage onSignIn={() => { rememberSignIn(); setSignedIn(true); }} />;
  }
  if (status.loading) {
    return <Screen><div className="panel empty">Loading the dashboard data from Supabase…</div></Screen>;
  }
  if (status.error) {
    return (
      <Screen>
        <div className="panel"><h2>The data could not be loaded</h2>
          <p className="note">{status.error}</p>
          <p className="note">Check that the server is running (npm start) and that DATABASE_URL in .env is correct.</p>
        </div>
      </Screen>
    );
  }

  selectPlan(S.planRun || D.defaultRun);
  const F = filtered(S);
  // how old the data is: the pill turns amber after 2 days
  const ageDays = Math.floor((Date.now() - (D0 + LAST * 864e5)) / 864e5);
  const stale = ageDays > 2;
  const dataPill = `Data as of ${fd(LAST, true)}`;
  const h = HEADS[S.page];

  let body;
  if (S.page === "sales") body = <SalesPage F={F} />;
  else if (S.page === "reports") body = <ReportsPage F={F} />;
  else if (S.page === "track") body = <TrackPage />;
  else if (!F.length) body = <div className="panel empty">No ingredients match these filters. Press Reset.</div>;
  else if (S.page === "today") body = <TodayPage F={F} />;
  else if (S.page === "buy") body = <BuyPage F={F} />;
  else if (S.page === "pred") body = <PredPage F={F} />;
  else if (S.page === "inv") body = <InvPage F={F} />;
  else body = <WastePage F={F} />;

  return (
    <AppCtx.Provider value={ctx}>
      <div className="pbi-app">
        <header className="pbi-top top">
          <a className="logo" href="#today" aria-label="Makisushi Japanese Restaurant"><img src="/logo.png" alt="Makisushi Japanese Restaurant" /></a>
          <div className="topr">
            <span className={`pill${stale ? " stale" : ""}`} title={stale ? "The data has not been updated for more than 2 days. Send the latest daily upload." : undefined}>
              <span className="dot" /><span id="datapill">{dataPill}</span>
            </span>
          </div>
        </header>

        <div className="pbi-body">
          <nav className="pbi-nav noprint" aria-label="Pages">
            <div className="nav-top">
              {NAV_GROUPS.map((g) => (
                <div className="nav-group" key={g}>
                  {g === "Reports" ? <div className="nav-sep" /> : <div className="nav-h">{g}</div>}
                  {PAGES.filter((p) => p[2] === g).map((p) => {
                    const sub = SUBTABS[p[0]], cur = p[0] === S.page, curTab = tabOf(p[0], S);
                    return (
                      <div key={p[0]} className={"nav-entry" + (cur ? " cur" : "")}>
                        <button className="nav-item" title={p[1]} aria-current={cur ? "page" : undefined} onClick={() => goto(p[0])}>
                          <Icon name={p[0]} /><span>{NAVN[p[0]]}</span>{sub ? <i className="nav-caret" aria-hidden="true" /> : null}
                        </button>
                        {sub && (
                          <div className="nav-sub">
                            {sub.list.map(([v, l]) => (
                              <button key={v} className="nav-subitem" aria-current={cur && curTab === v ? "true" : undefined} onClick={() => openTab(p[0], sub.key, v)}>{l}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="nav-acct"><AccountMenu user="Admin" onSignOut={signOut} /></div>
          </nav>
          <div className="pbi-main">
          {Object.values(filtersFor(S)).some(Boolean) && <div className="pbi-slicers noprint" id="filters" aria-label="Filters"><Controls F={F} /></div>}
          <main className="pbi-page" id="main">
            <div className="pagehead">
              <h1>{h[0]}</h1>
              {SUBTABS[S.page] && <span className="subname">{(SUBTABS[S.page].list.find((t) => t[0] === tabOf(S.page, S)) || [])[1]}</span>}
              {PERIOD_PAGES.has(S.page) && <span className="pagewin">{periodText(S)}</span>}
            </div>
            <div className="print-title">Makisushi Japanese Restaurant · {h[0]} · {dataPill}</div>
            {body}
          </main>
          </div>
        </div>
      </div>
      <TipLayer />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      <div id="printarea" />
    </AppCtx.Provider>
  );
}
