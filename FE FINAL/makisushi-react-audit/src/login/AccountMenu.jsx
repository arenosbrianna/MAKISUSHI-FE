// Account menu for the top-right corner: the avatar, the signed-in name and a Sign out option.
// Taken from the React branch of MAKISUSHI-FE (its Shell header).
import { useEffect, useRef, useState } from "react";
import "./account.css";

const SushiAvatar = () => <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", background: "#EEF2FF", border: "1px solid #DBE2F7", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><svg viewBox="0 0 64 40" width="35" height="22" focusable="false" style={{ display: "block" }}><path d="M8 22c0-5 8-8 24-8s24 3 24 8v8c0 5-8 8-24 8S8 35 8 30z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.6" /><path d="M12 33c5 3 12 4 20 4s15-1 20-4" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M3 21C6 8 20 3 32 3s26 5 29 18c-9 4-19 5-29 5S12 25 3 21z" fill="#F97316" /><path d="M3 21c9 4 19 5 29 5s20-1 29-5c-1 3-3 5-6 6-7 2-15 3-23 3s-16-1-23-3c-3-1-5-3-6-6z" fill="#DC5A12" /><path d="M12 15c6-4 14-5 21-4M24 21c8-3 17-3 26 0" stroke="#FFE0C2" strokeWidth="2.6" strokeLinecap="round" fill="none" /><rect x="27" y="1" width="10" height="38" rx="2.5" fill="#1B2540" /><path d="M30 5v30" stroke="#4B5D8A" strokeWidth="1.4" strokeLinecap="round" /></svg></span>;

export function AccountMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // close the menu on a click outside it or on Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="acct" ref={ref}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Account menu, signed in as ${user}`} onClick={() => setOpen((v) => !v)}>
        <SushiAvatar />
        <span className="acct-name">{user}</span>
        <span className="acct-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div role="menu" className="acct-menu">
          <div className="acct-who">Signed in as <strong>{user}</strong></div>
          <button type="button" role="menuitem" className="acct-out"
            onClick={() => { setOpen(false); onSignOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
