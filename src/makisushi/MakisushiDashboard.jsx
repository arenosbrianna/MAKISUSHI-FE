/* =====================================================================
   Makisushi Decision Support Dashboard (React)
   Port of makisushi_dss_dashboard.html to a single React component.

   - Data: ./makisushi-data.json (the dataset that was embedded in the HTML)
   - Logo: /makisushi-logo.png (public/)
   - Styles: the CSS string below, scoped under the .mkd root class so it
     does not leak into (or pick up rules from) the rest of the app.
   ===================================================================== */
import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import D from "./makisushi-data.json";

const LOGO_SRC = "/makisushi-logo.png";

/* Design system (navy #1E2856, crimson #D32F2F, slate canvas #F1F5F9 -> #EBF2F7, white cards). Every rule is scoped under .mkd. */
const CSS = String.raw`
.mkd{color-scheme:light;
  
  --brand:#1E2856; --brand-600:#2A3672; --brand-700:#161E42; --brand-50:#EEF0F8; --brand-100:#DCE0F0;
  --crimson:#D32F2F; --crimson-600:#C62828; --crimson-50:#FDECEC; --warm:#FF9F43; --amber:#FF9F43; --amber-soft:#FFF1E3; --emerald:#10B981; --emerald-soft:#D1FAE5; --indigo:#4F46E5; --indigo-soft:#E0E7FF; --sky:#3B82F6; --sky-soft:#DBEAFE;
  --glass:#FFFFFF; --glass-line:#E2E8F0; --canvas:linear-gradient(180deg,#F1F5F9 0%,#EBF2F7 100%);
  --sh-card:0 10px 30px -5px rgba(30,40,86,.08); --sh-card-hover:0 18px 36px -8px rgba(30,40,86,.16),0 2px 4px rgba(30,40,86,.05);
  
  --bg:#F8FAFC; --panel:#FFFFFF; --soft:#F1F5F9; --thbg:#F8FAFC;
  --ink:#0F172A; --ink-2:#334155; --muted:#64748B; --line:#E2E8F0; --line-2:#CBD5E1; --grid:#EEF2F6;
  
  --accent:var(--brand); --accent-ink:#FFFFFF; --accent-soft:var(--brand-50);
  
  --good:#047857; --good-soft:#DCFCE7; --warn:#B45309; --warn-soft:#FEF3C7; --bad:#B91C1C; --bad-soft:#FEE2E2;
  --info:#1D4ED8; --info-soft:#DBEAFE;
  --series2:#94A3B8; --heat0:#F1F5F9; --heat1:#1E2856;
  
  --font:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
  
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px; --s8:32px;
  
  --r-sm:8px; --r-md:12px; --r-lg:16px; --r-pill:999px;
  --sh-xs:0 1px 2px rgba(15,23,42,.05);
  --sh-sm:0 1px 3px rgba(15,23,42,.06),0 1px 2px rgba(15,23,42,.04);
  --sh-md:0 6px 16px -4px rgba(15,23,42,.10),0 2px 4px -2px rgba(15,23,42,.06);
  --sh-lg:0 18px 40px -12px rgba(15,23,42,.22);
  --ring:0 0 0 3px rgba(30,40,86,.18);
  --ease:cubic-bezier(.2,.7,.2,1); --t:.18s;}
html:has(.mkd){scrollbar-gutter:stable;overflow-y:scroll}
.mkd [hidden]{display:none!important}
.mkd *,.mkd *::before,.mkd *::after{box-sizing:border-box}
.mkd{background:var(--canvas);background-color:#EEF3F8;background-attachment:fixed;min-height:100vh;color:var(--ink);font-family:var(--font);font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased;padding:0}
.mkd b,.mkd strong{font-weight:700}
.mkd button{font-family:inherit}
.mkd :focus-visible{outline:none}
.mkd button:focus-visible,.mkd select:focus-visible,.mkd input:focus-visible,.mkd summary:focus-visible,.mkd a:focus-visible{outline:2px solid var(--brand);outline-offset:2px;box-shadow:var(--ring)}
.mkd .top{position:sticky;top:0;z-index:40;display:flex;justify-content:space-between;align-items:center;width:100%;gap:16px;
  height:72px;min-height:72px;max-height:72px;overflow:hidden;padding:0 var(--s6);
  background:#FFFFFF;
  border-bottom:1px solid var(--glass-line);box-shadow:0 4px 20px rgba(0,0,0,.05)}
.mkd .top::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,var(--brand) 0%,var(--brand) 30%,var(--crimson) 50%,transparent 85%);opacity:.85;pointer-events:none}
.mkd .topl{display:flex;align-items:center;gap:var(--s6);flex:1 1 auto;min-width:0;height:100%}
.mkd .topr{display:flex;align-items:center;justify-content:flex-end;gap:var(--s3);flex:0 0 auto;height:100%}
.mkd .top .logo{flex:none;display:block;border-radius:var(--r-sm)}
.mkd .top .logo img{height:46px;width:200px;max-width:100%;object-fit:contain;object-position:left;display:block}
.mkd .pill{display:inline-flex;align-items:center;gap:var(--s2);height:36px;font-size:12.5px;font-weight:600;color:var(--ink-2);background:rgba(255,255,255,.9);border:1px solid var(--glass-line);border-radius:var(--r-pill);padding:0 14px;white-space:nowrap;box-shadow:var(--sh-xs);max-width:360px}
.mkd .pill #datapill{overflow:hidden;text-overflow:ellipsis}
.mkd .pill .dot{flex:none;width:8px;height:8px;border-radius:50%;background:#16A34A;box-shadow:0 0 0 3px #DCFCE7;animation:mk-pulse 2.4s ease-in-out infinite}
@keyframes mk-pulse{50%{box-shadow:0 0 0 5px rgba(22,163,74,.12)}}
.mkd #uploadBtn{height:42px;min-height:42px}
.mkd .top.compact{gap:12px;padding-inline:var(--s4)}
.mkd .top.compact .topl{gap:var(--s3)}
.mkd .top.compact .logo img{width:150px}
.mkd .top.compact .navbar{gap:var(--s2)}
.mkd .top.compact .navbar .nav{padding-inline:11px}
.mkd .top.compact .pill{padding:0 11px}
.mkd .top.compact .pill .pl,.mkd .top.compact #uploadBtn .ul{display:none}
.mkd .top.compact #uploadBtn{padding-inline:14px}
.mkd .navbar{flex:1 1 auto;min-width:0;height:100%;display:flex;flex-wrap:nowrap;align-items:center;gap:var(--s4);padding:0;background:transparent;border:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.mkd .navbar::-webkit-scrollbar{display:none}
.mkd .navbar.more-r{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 48px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 48px),transparent)}
.mkd .navbar .grp{flex:none;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;height:62px;padding:0 4px;border-radius:14px;transition:background-color var(--t) var(--ease)}
.mkd .navbar .grp.cur{background-color:rgba(30,40,86,.04)}
.mkd .navbar .grp small{display:inline-flex;align-items:center;gap:6px;height:18px;box-sizing:border-box;font-size:9.5px;font-weight:800;line-height:1;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
  background-color:var(--soft);border:1px solid var(--line);border-radius:var(--r-pill);padding:0 9px 0 7px;margin-left:4px;white-space:nowrap;transition:color var(--t) var(--ease),background-color var(--t) var(--ease),border-color var(--t) var(--ease)}
.mkd .navbar .grp small::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--line-2);transition:background-color var(--t) var(--ease)}
.mkd .navbar .grp.cur small{color:var(--brand);background-color:var(--brand-50);border-color:var(--brand-100)}
.mkd .navbar .grp.cur small::before{background:var(--crimson)}
.mkd .navbar .btns{display:flex;flex-wrap:nowrap;gap:2px}
.mkd .navbar .nav{position:relative;display:inline-flex;align-items:center;box-sizing:border-box;height:34px;padding:0 15px;margin:0;font:inherit;font-size:14px;font-weight:600;line-height:1;color:var(--ink-2);
  background-color:transparent;border:1px solid transparent;border-radius:var(--r-pill);cursor:pointer;white-space:nowrap;
  transition:background-color .2s ease,color .2s ease,border-color .2s ease}
.mkd .navbar .nav:hover{background-color:var(--panel);border-color:var(--line);color:var(--brand)}
.mkd .navbar .nav.on{background-color:#1E2856;border-color:#1E2856;color:#FFFFFF}
.mkd .navbar .nav.on::after{content:"";position:absolute;left:50%;bottom:-5px;width:16px;height:3px;margin-left:-8px;border-radius:3px;background:#D32F2F}
.mkd .shell{display:block}
.mkd .content{min-width:0;max-width:1440px;margin:0 auto;padding:var(--s6) var(--s6) 64px;display:flex;flex-direction:column}
.mkd .grid{display:grid;gap:var(--s4);grid-template-columns:repeat(12,minmax(0,1fr))}
.mkd .c4{grid-column:span 4}
.mkd .c5{grid-column:span 5}
.mkd .c6{grid-column:span 6}
.mkd .c7{grid-column:span 7}
.mkd .c8{grid-column:span 8}
.mkd .c12{grid-column:span 12}
@media (max-width:1000px){.mkd .c4,.mkd .c5,.mkd .c6,.mkd .c7,.mkd .c8{grid-column:span 12}}
.mkd .stack{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--s4);align-content:start}
.mkd #main.enter>*{animation:mk-enter .32s var(--ease) both}
.mkd #main.enter>*:nth-child(2){animation-delay:.03s}
.mkd #main.enter>*:nth-child(3){animation-delay:.06s}
.mkd #main.enter>*:nth-child(n+4){animation-delay:.09s}
@keyframes mk-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.mkd .pagehead{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s1) var(--s3);margin:0 0 var(--s4)}
.mkd .pagehead h1{font-size:24px;line-height:1.2;margin:0;font-weight:800;letter-spacing:-.02em;color:var(--brand)}
.mkd .pagehead .tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--brand);background:var(--brand-50);border-radius:var(--r-pill);padding:3px 10px}
.mkd .pagehead p{margin:0;color:var(--muted);font-size:13.5px;flex-basis:100%}
.mkd .pagehead .info{width:22px;height:22px;background:var(--panel);font:inherit;font-size:12px;font-weight:700;padding:0;cursor:pointer;color:var(--muted)}
.mkd .pagehead .info:hover,.mkd .pagehead .info[aria-expanded="true"]{color:#fff;background:var(--brand);border-color:var(--brand)}
.mkd .pagehead .helpbtn{margin:0 0 0 auto;align-self:center;min-height:32px;padding:4px 12px;color:var(--muted)}
.mkd .how{position:relative;background:linear-gradient(0deg,var(--brand-50),var(--brand-50)),var(--panel);border:1px solid var(--brand-100);border-left:4px solid var(--brand);border-radius:var(--r-md);padding:var(--s3) var(--s4);margin-bottom:var(--s4);color:var(--ink-2)}
.mkd .how ol{margin:4px 0 10px 18px;padding:0}
.mkd .how li{margin:4px 0}
.mkd .how .linkbtn{margin:0}
.mkd .filters{position:relative;display:flex;flex-wrap:wrap;align-items:stretch;gap:var(--s2) var(--s3);background:transparent;border:0;padding:0;margin:0 0 var(--s5)}
.mkd .ftile{background:var(--glass);border:1px solid var(--glass-line);border-radius:var(--r-lg);padding:9px 14px 11px;display:flex;flex-direction:column;justify-content:center;min-width:0;box-shadow:var(--sh-card)}
.mkd .ft{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.mkd .prow{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s4);align-items:center}
.mkd .fg{display:flex;flex-direction:column;gap:3px;min-width:0}
.mkd .fl{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px}
.mkd .filters label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;font-weight:600;color:var(--muted);min-width:0}
.mkd .filters .rg{border:0;margin:0;padding:0;min-width:130px}
.mkd .filters .rg legend,.mkd .ftile .rg legend{font-size:11px;font-weight:700;color:var(--muted);padding:0 0 4px}
.mkd .rg.two{display:grid!important;grid-template-columns:repeat(2,auto);column-gap:14px;align-content:start}
.mkd .rg.two legend{grid-column:1/-1}
.mkd .rg.inline{display:flex!important;flex-wrap:wrap;gap:6px;align-items:center;padding:0!important}
.mkd .rg.inline legend{display:none}
.mkd .filters .rd{flex-direction:row;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--ink);padding:3px 0;cursor:pointer;white-space:nowrap}
.mkd .filters .rd input{accent-color:var(--brand);width:16px;height:16px;margin:0}
.mkd .rg.inline .rd{position:relative;padding:6px 14px;border-radius:var(--r-pill);font-size:12.5px;font-weight:600;color:var(--ink-2);background:var(--panel);border:1px solid var(--line-2);transition:all .2s ease}
.mkd .rg.inline .rd input{position:absolute;opacity:0;pointer-events:none}
.mkd .rg.inline .rd:hover{color:var(--brand);border-color:var(--brand);background:var(--brand-50);transform:translateY(-1px)}
.mkd .rg.inline .rd:has(input:checked){background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:0 4px 10px -4px rgba(30,40,86,.55);transform:none}
.mkd .rg.inline .rd:has(input:focus-visible){outline:2px solid var(--brand);outline-offset:1px}
.mkd .ftile .rd input[type=checkbox]{accent-color:var(--brand);width:16px;height:16px;margin:0}
.mkd select,.mkd input[type=search],.mkd input[type=text],.mkd input[type=number]{font-family:var(--font);font-size:13px;color:var(--ink);background-color:var(--panel);border:1px solid var(--line-2);border-radius:var(--r-sm);
  padding:7px 12px;min-height:36px;min-width:150px;max-width:240px;transition:border-color var(--t) var(--ease),box-shadow var(--t) var(--ease)}
.mkd select{appearance:none;-webkit-appearance:none;padding-right:34px;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center}
.mkd input[type=search]{padding-left:34px;background-repeat:no-repeat;background-position:12px center;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")}
.mkd select:hover,.mkd input[type=search]:hover{border-color:var(--brand-600)}
.mkd select:focus,.mkd input[type=search]:focus{border-color:var(--brand);box-shadow:var(--ring);outline:none}
.mkd .ftile select{min-width:160px}
.mkd .fbtn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:600;color:var(--brand);background:var(--panel);border:1px solid var(--line-2);border-radius:var(--r-pill);min-height:36px;padding:6px 16px;cursor:pointer;align-self:center;
  box-shadow:var(--sh-xs);transition:border-color var(--t) var(--ease),background var(--t) var(--ease),box-shadow var(--t) var(--ease)}
.mkd .fbtn:hover{border-color:var(--brand);background:var(--brand-50);transform:translateY(-2px);box-shadow:var(--sh-sm)}
.mkd .fbtn[aria-expanded="true"]{background:var(--brand);border-color:var(--brand);color:#fff}
.mkd .reset{font:inherit;font-weight:600;font-size:12.5px;color:var(--crimson);background:transparent;border:0;border-radius:var(--r-sm);padding:6px 8px;cursor:pointer;align-self:center;text-decoration:underline;text-underline-offset:3px;transition:background var(--t) var(--ease)}
.mkd .reset:hover{background:var(--crimson-50)}
.mkd .fpop{position:absolute;z-index:30;top:100%;left:0;margin-top:8px;display:flex;flex-wrap:wrap;gap:var(--s3) var(--s5);background:var(--panel);border:1px solid var(--line);border-radius:var(--r-md);padding:var(--s4);box-shadow:var(--sh-lg);max-width:min(680px,100%);animation:mk-pop .16s var(--ease)}
@keyframes mk-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.mkd .fchip{font-size:12.5px;font-weight:700;color:var(--brand);background:var(--brand-50);border-radius:var(--r-pill);padding:5px 11px;align-self:center}
.mkd .filters .pills{flex:none}
.mkd .filters .pills button{min-height:32px;font-size:12.5px;padding:4px 12px}
.mkd .rgcols{display:flex;gap:22px}
.mkd .btn{font:inherit;font-size:14px;font-weight:700;border-radius:var(--r-sm);padding:9px 16px;min-height:40px;cursor:pointer;border:1px solid var(--line-2);background:var(--panel);color:var(--brand);
  display:inline-flex;align-items:center;justify-content:center;gap:var(--s2);white-space:nowrap;
  transition:background var(--t) var(--ease),border-color var(--t) var(--ease),box-shadow var(--t) var(--ease),transform var(--t) var(--ease),color var(--t) var(--ease)}
.mkd .btn:hover{background:var(--brand-50);border-color:var(--brand);transform:translateY(-2px);box-shadow:var(--sh-md)}
.mkd .btn:active{transform:translateY(1px)}
.mkd .btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
.mkd .btn.pri{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:0 4px 12px -4px rgba(30,40,86,.5)}
.mkd .btn.pri:hover{background:var(--brand-600);border-color:var(--brand-600);box-shadow:0 10px 20px -8px rgba(30,40,86,.55)}
.mkd .btn.cta{background:var(--crimson);border-color:var(--crimson);color:#fff;box-shadow:0 6px 16px -6px rgba(211,47,47,.55);background-image:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,0))}
.mkd .btn.cta:hover{background:var(--crimson-600);border-color:var(--crimson-600);transform:translateY(-2px);box-shadow:0 12px 22px -8px rgba(211,47,47,.6)}
.mkd .btn.cta:active{transform:translateY(0)}
.mkd .btn.cta::before{content:"";width:16px;height:16px;background:currentColor;
  -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 16V4m0 0-5 5m5-5 5 5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2'/%3E%3C/svg%3E") center/contain no-repeat;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 16V4m0 0-5 5m5-5 5 5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2'/%3E%3C/svg%3E") center/contain no-repeat}
.mkd .btn.sm{min-height:34px;padding:6px 12px;font-size:13px}
.mkd .linkbtn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:600;font-size:12.5px;color:var(--brand);background:var(--panel);border:1px solid var(--line-2);border-radius:var(--r-sm);
  min-height:32px;padding:5px 12px;cursor:pointer;margin-top:var(--s3);white-space:nowrap;
  transition:all .2s ease}
.mkd .linkbtn:hover{background:var(--brand-50);border-color:var(--brand);box-shadow:var(--sh-sm);transform:translateY(-2px)}
.mkd .linkbtn:active{transform:translateY(1px)}
.mkd .linkbtn[data-copy]::before,.mkd .linkbtn[data-print]::before,.mkd .linkbtn[data-export]::before{content:"";width:14px;height:14px;flex:none;background:currentColor;-webkit-mask:var(--ico) center/contain no-repeat;mask:var(--ico) center/contain no-repeat}
.mkd .linkbtn[data-copy]{--ico:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='12' height='12' rx='2'/%3E%3Cpath d='M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'/%3E%3C/svg%3E")}
.mkd .linkbtn[data-print]{--ico:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2'/%3E%3Crect x='6' y='14' width='12' height='7' rx='1'/%3E%3C/svg%3E")}
.mkd .linkbtn[data-export]{--ico:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4v12m0 0-5-5m5 5 5-5M4 20h16'/%3E%3C/svg%3E")}
.mkd .linkbtn[data-copy]{background:var(--brand);border-color:var(--brand);color:#fff}
.mkd .linkbtn[data-copy]:hover{background:var(--brand-600);border-color:var(--brand-600)}
.mkd .seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:3px;background:var(--soft);border:1px solid var(--line);border-radius:var(--r-pill)}
.mkd .seg button{font:inherit;font-size:12.5px;font-weight:600;color:var(--muted);background:transparent;border:0;border-radius:var(--r-pill);min-height:30px;padding:5px 14px;cursor:pointer;white-space:nowrap;
  transition:background var(--t) var(--ease),color var(--t) var(--ease),box-shadow var(--t) var(--ease)}
.mkd .seg button:hover{color:var(--brand)}
.mkd .seg button[aria-pressed="true"]{background:var(--brand);color:#fff;box-shadow:0 2px 6px -2px rgba(30,40,86,.5)}
.mkd .fg .seg button{min-height:32px}
.mkd .seg.tabs{display:flex;width:100%;background:transparent;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:0;gap:var(--s1);margin:0 0 var(--s4)}
.mkd .seg.tabs button{position:relative;flex:0 0 auto;border-radius:var(--r-sm) var(--r-sm) 0 0;background:transparent;color:#475569;font-size:14px;font-weight:600;min-height:42px;padding:8px 18px;box-shadow:none}
.mkd .seg.tabs button::after{content:"";position:absolute;left:12px;right:12px;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:var(--crimson);transform:scaleX(0);transition:transform .22s var(--ease)}
.mkd .seg.tabs button:hover{color:var(--brand);background:var(--brand-50)}
.mkd .seg.tabs button[aria-pressed="true"]{background:transparent;color:var(--brand);font-weight:700;box-shadow:none}
.mkd .seg.tabs button[aria-pressed="true"]::after{transform:scaleX(1)}
.mkd .panel{background:var(--glass);border:1px solid var(--glass-line);border-radius:var(--r-lg);padding:var(--s4) var(--s5) var(--s5);min-width:0;box-shadow:var(--sh-card)}
.mkd .ph{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2);margin-bottom:var(--s3)}
.mkd .ph h2{font-size:15px;font-weight:700;margin:0;flex:1;min-width:0;color:#1E2856;letter-spacing:-.005em}
.mkd .ph label{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--muted)}
.mkd .sub{font-size:12px;font-weight:700;color:var(--muted);margin:8px 0 2px}
.mkd .note{font-size:12px;color:var(--muted);margin-top:var(--s3);line-height:1.5}
.mkd .empty{color:var(--muted);padding:var(--s6) var(--s1);text-align:center}
.mkd .info{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;border:1px solid var(--line-2);font-size:10px;font-weight:700;font-style:normal;color:var(--muted);cursor:help;text-transform:none;letter-spacing:0;flex:none;transition:all var(--t) var(--ease)}
.mkd .info:hover{border-color:var(--brand);color:var(--brand)}
.mkd .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--s4);margin-bottom:var(--s5)}
.mkd .kpi{position:relative;overflow:hidden;isolation:isolate;display:flex;flex-direction:column;background:var(--glass);border:1px solid var(--glass-line);border-radius:var(--r-lg);
  padding:16px 18px 14px;text-align:left;font:inherit;color:inherit;cursor:pointer;min-width:0;min-height:118px;box-shadow:var(--sh-card);transition:all .2s ease}
.mkd .kpi::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,#D32F2F,#FF6B5B);transform:scaleX(0);transform-origin:left;transition:transform .28s var(--ease)}
.mkd .kpi::after{content:"";position:absolute;z-index:-1;right:-36px;top:-36px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(30,40,86,.06),transparent 70%);transition:background .2s ease}
.mkd .kpi:hover{transform:translateY(-3px);box-shadow:var(--sh-card-hover);border-color:rgba(211,47,47,.25)}
.mkd .kpi:hover::before{transform:scaleX(1)}
.mkd .kpi:hover::after{background:radial-gradient(circle,rgba(211,47,47,.09),transparent 70%)}
.mkd .kpi .kico{position:absolute;top:14px;right:14px;display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:var(--brand);
  background:linear-gradient(135deg,var(--brand-50),#fff);border:1px solid var(--brand-100);box-shadow:0 4px 10px -6px rgba(30,40,86,.4);transition:all .2s ease}
.mkd .kpi .kico svg{width:18px;height:18px}
.mkd .kpi:hover .kico{color:#fff;background:linear-gradient(135deg,#D32F2F,#B71C1C);border-color:#D32F2F;transform:rotate(-6deg) scale(1.05)}
.mkd .kpi .l{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;padding-right:44px;min-height:20px}
.mkd .kpi .v{font-size:28px;font-weight:800;margin-top:8px;letter-spacing:-.025em;line-height:1.1;color:var(--brand);font-variant-numeric:tabular-nums;padding-right:6px}
.mkd .kpi .d{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;font-size:12px;margin-top:10px;color:var(--muted);font-variant-numeric:tabular-nums;position:relative;z-index:1}
.mkd .kpi .d .t-good,.mkd .kpi .d .t-bad{display:inline-flex;align-items:center;gap:4px;font-weight:700;padding:2px 9px;border-radius:var(--r-pill)}
.mkd .kpi .d .t-good{background:#E6F4EA;color:#137333}
.mkd .kpi .d .t-bad{background:#FCE8E6;color:#C5221F}
.mkd .kpi .d .up,.mkd .kpi .d .dn{font-size:9px}
.mkd .kpi .spark{display:block;width:calc(100% + 36px);height:34px;margin:12px -18px -14px;color:var(--brand);opacity:.5;pointer-events:none;transition:opacity .2s ease,color .2s ease}
.mkd .kpi:hover .spark{opacity:.85;color:#D32F2F}
.mkd .kpi.has-spark{padding-bottom:14px}
.mkd .kpi.has-spark .d{min-height:22px}
.mkd .d .up,.mkd .d .dn{font-weight:700}
.mkd .t-good{color:var(--good)}
.mkd .t-bad{color:var(--bad)}
.mkd .t-flat{color:var(--muted)}
.mkd .todo{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:var(--s4);margin-bottom:var(--s6)}
/* Today's actions: four white cards. A 3px top rule ranks them (Buy navy, Watch crimson, Use/Trim slate);
   crimson text appears only when a card is in alert (class .b, "could still run out"). */
.mkd .todo button{position:relative;display:flex;flex-direction:column;gap:6px;font:inherit;color:inherit;text-align:left;cursor:pointer;
  background:#FFFFFF;border:1px solid #E2E8F0;border-top:3px solid var(--rule,#CBD5E1);border-radius:16px;padding:16px 20px 16px;min-width:0;
  box-shadow:0 1px 2px rgba(15,23,42,.05);
  transition:box-shadow .2s ease,border-color .2s ease}
.mkd .todo button.k1{--rule:#1E2856}
.mkd .todo button.k2{--rule:#D32F2F}
.mkd .todo button.k3,.mkd .todo button.k4{--rule:#CBD5E1}
.mkd .todo button:hover{box-shadow:0 4px 6px -1px rgba(15,23,42,.08),0 2px 4px -2px rgba(15,23,42,.05);border-left-color:#CBD5E1;border-right-color:#CBD5E1;border-bottom-color:#CBD5E1}
.mkd .todo button:focus-visible{outline:2px solid #1E2856;outline-offset:2px}
.mkd .todo .h{display:flex;align-items:center;gap:var(--s2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748B}
.mkd .todo .h .num{display:inline-grid;place-items:center;flex:none;width:20px;height:20px;border-radius:999px;background:#1E2856;color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:0;line-height:1}
.mkd .todo .h .st{margin-left:auto;font-size:10.5px;font-weight:700;letter-spacing:.05em;line-height:1;padding:4px 10px;border-radius:999px;background:#F1F5F9;color:#1E2856}
.mkd .todo .h .st.alert{background:#FEF2F2;color:#D32F2F}
.mkd .todo .m{font-size:19px;font-weight:800;margin:4px 0 0;letter-spacing:-.01em;line-height:1.25;color:#1E2856;font-variant-numeric:tabular-nums}
.mkd .todo button.b .m{color:#D32F2F}
.mkd .todo .m .amt{color:inherit;font-weight:800}
.mkd .todo .s{font-size:12.5px;color:#64748B;line-height:1.45}
.mkd .todo .go{margin-top:auto;padding-top:8px;font-size:12.5px;font-weight:600;color:#1E2856;display:inline-flex;align-items:center;gap:4px;transition:gap .2s ease,font-weight .2s ease,color .2s ease}
.mkd .todo .go span{transition:transform .2s ease}
.mkd .todo button:hover .go{font-weight:800;gap:6px}
.mkd .todo button:hover .go span{transform:translateX(2px)}
.mkd .tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r-md)}
.mkd table{width:100%;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}
.mkd th{position:sticky;top:0;z-index:1;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;padding:11px 14px;background:var(--thbg);border-bottom:1px solid var(--line);white-space:nowrap}
.mkd td{padding:12px 14px;border-bottom:1px solid var(--grid);vertical-align:middle;transition:background var(--t) var(--ease)}
.mkd tbody tr:last-child td{border-bottom:0}
.mkd tbody tr:not(.sup):hover td{background:#F8FAFF}
.mkd td.n,.mkd th.n{text-align:right}
.mkd td small{display:block;color:var(--muted);font-size:11.5px;margin-top:1px}
.mkd td small + small{margin-top:2px}
.mkd td b{color:var(--ink)}
.mkd tr.mute td{color:var(--muted)}
.mkd tr.mute td b{color:var(--ink-2);font-weight:600}
.mkd tr.sup td{background:linear-gradient(90deg,var(--brand-50),#F8FAFC 70%);padding:12px 14px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);box-shadow:inset 3px 0 0 var(--brand)}
.mkd tbody tr.sup:first-child td{border-top:0}
.mkd .suphead{display:flex;justify-content:space-between;align-items:center;gap:var(--s3);flex-wrap:wrap}
.mkd .suphead>span{color:var(--ink-2)}
.mkd .suphead b{font-size:14.5px;color:var(--brand)}
.mkd .suphead small{display:block;margin-top:2px;font-weight:600;color:var(--muted)}
.mkd .suphead .linkbtn{margin:0}
.mkd tr.done td{opacity:.5}
.mkd tr.done td b{text-decoration:line-through;text-decoration-color:var(--muted)}
.mkd td.chk{width:40px;padding-right:0}
.mkd td.chk input{width:18px;height:18px;accent-color:var(--good);cursor:pointer;vertical-align:middle}
.mkd .mname{display:block;font-size:11px;font-weight:500;color:var(--muted)}
.mkd .gloss td,.mkd .gloss th{font-size:12.5px}
.mkd .chip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;border-radius:var(--r-pill);padding:3px 10px;white-space:nowrap;line-height:1.4}
.mkd .chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.85}
.mkd .chip.good{background:var(--good-soft);color:var(--good)}
.mkd .chip.warn{background:var(--warn-soft);color:var(--warn)}
.mkd .chip.bad{background:var(--bad-soft);color:var(--bad)}
.mkd .chip.flat{background:var(--soft);color:var(--muted)}
.mkd .banner{display:flex;gap:10px;align-items:flex-start;border-radius:var(--r-md);padding:12px 14px;margin-bottom:var(--s3);font-weight:600;border:1px solid transparent;border-left-width:4px}
.mkd .banner.good{background:var(--good-soft);color:var(--good);border-color:#86EFAC}
.mkd .banner.bad{background:var(--bad-soft);color:var(--bad);border-color:#FCA5A5}
.mkd .banner.warn{background:var(--warn-soft);color:var(--warn);border-color:#FCD34D}
.mkd .banner b{font-weight:800}
.mkd details.why summary{cursor:pointer;color:var(--brand);font-size:12.5px;font-weight:600;list-style:none;display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:var(--r-pill);transition:background var(--t) var(--ease)}
.mkd details.why summary::-webkit-details-marker{display:none}
.mkd details.why summary::after{content:"";width:6px;height:6px;border-right:1.8px solid currentColor;border-bottom:1.8px solid currentColor;transform:rotate(45deg) translate(-1px,-1px);transition:transform var(--t) var(--ease)}
.mkd details.why[open] summary::after{transform:rotate(-135deg) translate(-1px,-1px)}
.mkd details.why summary:hover{background:var(--brand-50)}
.mkd details.why div{font-size:12.5px;color:var(--ink-2);margin-top:6px;max-width:360px;line-height:1.5;background:var(--soft);border-radius:var(--r-sm);padding:8px 10px}
.mkd details.more{background:var(--glass);border:1px solid var(--glass-line);border-radius:var(--r-lg);margin-top:var(--s4);box-shadow:var(--sh-card)}
.mkd details.more>summary{cursor:pointer;font-weight:700;padding:14px 18px;list-style:none;display:flex;align-items:center;gap:10px;border-radius:var(--r-lg);transition:background var(--t) var(--ease)}
.mkd details.more>summary:hover{background:var(--soft)}
.mkd details.more>summary::before{content:"";width:7px;height:7px;border-right:2px solid var(--brand);border-bottom:2px solid var(--brand);transform:rotate(-45deg);transition:transform var(--t) var(--ease)}
.mkd details.more[open]>summary::before{transform:rotate(45deg)}
.mkd details.more>summary::-webkit-details-marker{display:none}
.mkd details.more>.inner{padding:0 18px 18px}
.mkd .mbar{margin:var(--s2) 0 var(--s5)}
.mkd .mbar:last-of-type{margin-bottom:var(--s2)}
.mkd .mtop{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.mkd .mtop b{font-size:24px;font-weight:800;letter-spacing:-.02em;color:var(--brand);font-variant-numeric:tabular-nums}
.mkd .mtop .mp{font-size:13px;font-weight:800;padding:2px 9px;border-radius:var(--r-pill);font-variant-numeric:tabular-nums}
.mkd .mtop .mp.good{background:var(--good-soft);color:var(--good)}
.mkd .mtop .mp.warn{background:var(--warn-soft);color:var(--warn)}
.mkd .mtop .mp.bad{background:var(--bad-soft);color:var(--bad)}
.mkd .mtop span{font-size:12px;color:var(--muted);text-align:right}
.mkd .msub{display:block;font-size:12px;color:var(--muted);margin-top:2px}
.mkd .mtrack{position:relative;height:12px;background:linear-gradient(180deg,#EEF2F7,#F5F7FA);border-radius:var(--r-pill);overflow:visible;margin-top:10px;box-shadow:inset 0 1px 2px rgba(15,23,42,.08)}
.mkd .mtrack i{position:relative;display:block;height:100%;min-width:12px;border-radius:var(--r-pill);background-image:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 60%)!important;box-shadow:0 0 14px -2px currentColor,0 2px 6px -2px currentColor}
.mkd .mtrack i{transition:width .5s var(--ease)}
.mkd .mscale{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-top:4px;font-variant-numeric:tabular-nums}
.mkd .meter{position:relative;height:10px;border-radius:var(--r-pill);background:linear-gradient(90deg,var(--warn-soft),var(--soft) 40%,var(--soft) 60%,var(--good-soft));margin:16px 0 4px}
.mkd .meter b{position:absolute;top:-5px;width:4px;height:20px;border-radius:2px;background:var(--brand);transform:translateX(-2px)}
.mkd .meterl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted)}
.mkd .big{font-size:20px;font-weight:800;line-height:1.25;margin:2px 0 10px;color:var(--brand)}
.mkd .chart{width:100%;position:relative}
.mkd .chart svg{display:block;width:100%;height:auto;overflow:visible}
.mkd .chart text{font-family:var(--font);fill:var(--muted);font-size:11px}
.mkd .chart .bar{transform-box:fill-box;transform-origin:50% 100%;animation:mk-barUp .55s cubic-bezier(.2,.7,.2,1) backwards;transition:opacity .2s ease,filter .2s ease,transform .2s ease}
@keyframes mk-barUp{from{transform:scaleY(0);opacity:0}}
.mkd .chart svg.hovering .bar:not(.hov){opacity:.42}
.mkd .chart .bar.hov{transform:scaleY(1.025);filter:brightness(1.08) drop-shadow(0 6px 8px rgba(30,40,86,.28))}
.mkd .chart .bar.warm{opacity:.94}
.mkd .chart .bar.warm.hov{opacity:1;filter:brightness(1.07) saturate(1.12) drop-shadow(0 0 6px rgba(255,159,67,.55)) drop-shadow(0 8px 12px rgba(230,81,0,.35))}
.mkd .chart .pt{transform-box:fill-box;transform-origin:center;transition:transform .2s ease}
.mkd .chart .pt.hov{transform:scale(1.6)}
.mkd .chart .avgline{animation:mk-dash 1.2s linear infinite}
@keyframes mk-dash{to{stroke-dashoffset:-14}}
.mkd .chart .ltag{font-size:11px;font-weight:800;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round;letter-spacing:.02em}
.mkd .seg.seg-sm button{min-height:28px;padding:4px 11px;font-size:12px}
.mkd #lg-sales .legend i{width:12px;height:12px;border-radius:4px}
.mkd .hit{cursor:pointer}
.mkd .legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted);margin-top:var(--s2)}
.mkd .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.mkd .tip{position:fixed;z-index:90;pointer-events:none;background:linear-gradient(135deg,rgba(30,40,86,.97),rgba(22,30,66,.97));color:#fff;font-size:12px;font-weight:500;line-height:1.5;padding:8px 12px 8px 14px;border-radius:10px;max-width:260px;border:1px solid rgba(255,255,255,.08);border-left:3px solid var(--crimson);box-shadow:0 14px 30px -10px rgba(30,40,86,.55);backdrop-filter:blur(6px);font-variant-numeric:tabular-nums}
.mkd .tip b{color:#FFD7A8}
.mkd .heat{display:grid;gap:2px;font-size:11px}
.mkd .heat .hl{color:var(--muted);align-self:center;padding-right:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mkd .heat .hc{height:24px;border-radius:4px;display:grid;place-items:center;font-size:10.5px;color:var(--ink);font-variant-numeric:tabular-nums}
.mkd .heat .hh{color:var(--muted);text-align:center;font-size:10.5px}
.mkd .rows{display:flex;flex-direction:column;gap:8px}
.mkd .row{display:grid;grid-template-columns:minmax(90px,150px) minmax(0,1fr) auto;gap:10px;align-items:center;font-size:13px;border-radius:var(--r-sm);padding:2px 4px;transition:background var(--t) var(--ease)}
.mkd .row .bar{height:10px;border-radius:var(--r-pill);background:var(--soft);overflow:hidden}
.mkd .row .bar span{display:block;height:100%;border-radius:var(--r-pill);background:var(--brand);transition:width .4s var(--ease)}
.mkd .row.click{cursor:pointer}
.mkd .row.click:hover{background:var(--brand-50)}
.mkd .row.click:hover .nm{color:var(--brand)}
.mkd g.row.click:hover{background:none}
.mkd .row .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mkd .row .val{font-variant-numeric:tabular-nums;font-weight:700}
.mkd .row .bar.bt{overflow:visible;position:relative;height:10px}
.mkd .row .bar.bt>span{display:block;height:100%;background:var(--brand)}
.mkd .bt b{position:absolute;top:-5px;bottom:-5px;width:2px}
.mkd .bt .m1{background:var(--bad)}
.mkd .bt .m2{background:var(--ink)}
.mkd .cmp{display:grid;grid-template-columns:1fr auto auto;gap:0 18px;align-items:center;font-variant-numeric:tabular-nums}
.mkd .cmp>span{padding:9px 0;border-bottom:1px solid var(--grid)}
.mkd .cmp .h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;text-align:right;padding-top:0}
.mkd .cmp .h:first-child{text-align:left}
.mkd .cmp .r{text-align:right;font-weight:700;font-size:15px}
.mkd .cmp .w{color:var(--good)}
.mkd .promo{display:flex;flex-direction:column;gap:var(--s2)}
.mkd .promo .it{border:1px solid var(--line);border-left:3px solid var(--crimson);border-radius:var(--r-md);padding:10px 12px;background:var(--panel);transition:box-shadow var(--t) var(--ease)}
.mkd .promo .it:hover{box-shadow:var(--sh-sm)}
.mkd .promo .it b{font-weight:700}
.mkd .facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:0 18px;margin:0}
.mkd .facts dt,.mkd .facts dd{padding:8px 0;border-bottom:1px solid var(--grid)}
.mkd .facts dt{color:var(--muted);font-size:12px;align-self:center}
.mkd .facts dd{margin:0;font-weight:600}
.mkd .pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.mkd .pills span{font-size:12px;font-weight:600;background:var(--soft);border:1px solid var(--line);border-radius:var(--r-pill);padding:3px 10px}
.mkd .dv{position:relative;height:12px;background:var(--soft);border-radius:var(--r-pill)}
.mkd .dv:after{content:"";position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;background:var(--line-2)}
.mkd .dv i{position:absolute;top:0;bottom:0;border-radius:var(--r-pill)}
.mkd .drow{display:grid;grid-template-columns:minmax(120px,210px) minmax(0,1fr) 104px;gap:10px;align-items:center;font-size:13px}
.mkd .drow .v{text-align:right}
.mkd .donut{display:flex;align-items:center;gap:var(--s4);flex-wrap:wrap}
.mkd .donut svg{flex:none}
.mkd .donut ul{list-style:none;margin:0;padding:0;flex:1;min-width:130px;font-size:12px}
.mkd .donut li{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--grid)}
.mkd .donut li:last-child{border-bottom:0}
.mkd .donut li i{width:10px;height:10px;border-radius:3px;flex:none}
.mkd .donut li span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkd .donut li b{font-variant-numeric:tabular-nums}
.mkd .cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.mkd .cal .ch{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:0 2px}
.mkd .cd{border:1px solid var(--line);border-radius:var(--r-md);min-height:92px;padding:8px 10px;font-size:12px;line-height:1.4;min-width:0;overflow-wrap:anywhere;background:var(--panel);transition:box-shadow var(--t) var(--ease),border-color var(--t) var(--ease)}
.mkd .cd:hover{box-shadow:var(--sh-sm);border-color:var(--brand-100)}
.mkd .cd b{font-size:13px;color:var(--brand)}
.mkd .cd .c1{color:var(--brand)}
.mkd .cd .c2{color:var(--bad)}
.mkd .cd .c3{color:var(--good);font-weight:700}
.mkd .cd.empty0{border-style:dashed;border-color:transparent;background:transparent}
.mkd .ydot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.mkd .asof{font-size:12px;color:var(--muted);text-align:right}
.mkd .asof b{display:block;color:var(--ink);font-size:13px}
.mkd .toast{position:fixed;right:16px;bottom:16px;z-index:95;display:flex;align-items:center;gap:10px;background:var(--brand-700);color:#fff;border-radius:var(--r-md);padding:12px 16px;font-size:14px;font-weight:600;
  max-width:min(420px,calc(100vw - 32px));box-shadow:var(--sh-lg);animation:mk-toastIn .22s var(--ease)}
.mkd .toast::before{content:"";width:8px;height:8px;border-radius:50%;background:#4ADE80;flex:none}
@keyframes mk-toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.mkd .dss-modal-back{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;z-index:80;animation:mk-fade .18s ease}
@keyframes mk-fade{from{opacity:0}to{opacity:1}}
.mkd .dss-modal{background:var(--panel);color:var(--ink);border-radius:var(--r-lg);padding:var(--s6);width:min(620px,100%);display:flex;flex-direction:column;gap:14px;max-height:90vh;overflow:auto;box-shadow:var(--sh-lg);border-top:4px solid var(--crimson);animation:mk-pop .22s var(--ease)}
.mkd .dss-modal h2{margin:0;font-size:20px;font-weight:800;color:var(--brand)}
.mkd .dss-modal p{margin:0;font-size:14px;line-height:1.55}
.mkd .dss-modal .small{font-size:13px;color:var(--muted)}
.mkd .dss-modal .actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.mkd .dss-modal .result{background:var(--soft);border-radius:var(--r-md);padding:12px 14px;font-size:14px;line-height:1.6}
.mkd .dss-modal .result .ok{color:var(--good);font-weight:700}
.mkd .dss-modal .result .no{color:var(--bad);font-weight:700}
.mkd .dss-modal .result ul{margin:6px 0 0 18px;padding:0}
.mkd .upfile{border:1.5px dashed var(--line-2);border-radius:var(--r-md);padding:var(--s4);background:var(--soft);transition:border-color var(--t) var(--ease),background var(--t) var(--ease)}
.mkd .upfile:hover{border-color:var(--brand);background:var(--brand-50)}
.mkd footer{margin-top:16px;font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:space-between}
@media (max-width:760px){.mkd .top{height:112px;min-height:112px;max-height:112px;flex-wrap:wrap;align-content:center;padding:0 16px;gap:4px 12px}
.mkd .top .topl{display:contents}
.mkd .top .logo{height:52px;display:flex;align-items:center}
.mkd .top .logo img{height:38px;width:150px}
.mkd .topr{height:52px}
.mkd .navbar{order:3;flex:1 1 100%;height:52px;gap:var(--s2)}
.mkd .navbar .grp{height:50px}
.mkd .pill{display:none}
.mkd #uploadBtn{height:38px;min-height:38px;padding:0 12px;font-size:13px}
.mkd .content{padding:var(--s4) var(--s4) 48px}
.mkd .pagehead h1{font-size:20px}
.mkd .panel{padding:var(--s3) var(--s4) var(--s4)}
.mkd .todo{gap:var(--s3)}
.mkd .cal{grid-template-columns:repeat(7,minmax(64px,1fr));overflow-x:auto}
.mkd select,.mkd input[type=search]{max-width:100%}
.mkd .filters{gap:var(--s2)}
.mkd .ftile{flex:1 1 100%}}
.mkd .dd{position:relative;display:inline-block;min-width:170px;max-width:260px;vertical-align:middle}
.mkd .ftile .dd{min-width:170px}
.mkd .ph .dd,.mkd .ph label .dd{min-width:150px}
.mkd .dd-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;height:38px;padding:0 10px 0 14px;font:inherit;font-size:13px;font-weight:600;color:#1E2856;text-align:left;
  background:linear-gradient(180deg,#FFFFFF,#FBFCFE);border:1px solid #E2E8F0;border-radius:10px;cursor:pointer;
  box-shadow:0 1px 2px rgba(30,40,86,.05),0 4px 12px -6px rgba(30,40,86,.14);transition:border-color .2s ease,box-shadow .2s ease,background-color .2s ease}
.mkd .dd-btn:hover{border-color:#CBD5E1;box-shadow:0 1px 2px rgba(30,40,86,.06),0 8px 18px -8px rgba(30,40,86,.22)}
.mkd .dd-btn:focus-visible{outline:none;border-color:#1E2856;box-shadow:0 0 0 3px rgba(30,40,86,.15)}
.mkd .dd.open .dd-btn{border-color:#1E2856;box-shadow:0 0 0 3px rgba(30,40,86,.12),0 8px 18px -8px rgba(30,40,86,.22)}
.mkd .dd-val{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkd .dd-val.is-ph{color:var(--muted);font-weight:500}
.mkd .dd-chev{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:7px;color:#1E2856;background:#F1F5F9;transition:transform .25s cubic-bezier(.2,.7,.2,1),background-color .2s ease,color .2s ease}
.mkd .dd-chev svg{width:12px;height:12px}
.mkd .dd-btn:hover .dd-chev{background:#E7EBF5}
.mkd .dd.open .dd-chev{transform:rotate(180deg);background:#1E2856;color:#fff}
.mkd .dd-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:60;min-width:100%;width:max-content;max-width:min(320px,calc(100vw - 32px));max-height:340px;overflow-y:auto;overscroll-behavior:contain;
  margin:0;padding:6px;list-style:none;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border:1px solid rgba(226,232,240,.9);border-radius:12px;box-shadow:0 10px 25px -5px rgba(30,40,86,.1),0 4px 10px -4px rgba(30,40,86,.08);
  opacity:0;visibility:hidden;transform:translateY(-6px) scale(.98);transform-origin:top left;transition:opacity .16s ease,transform .18s cubic-bezier(.2,.7,.2,1),visibility .16s}
.mkd .dd.right .dd-menu{left:auto;right:0;transform-origin:top right}
.mkd .dd.up .dd-menu{top:auto;bottom:calc(100% + 6px);transform-origin:bottom left}
.mkd .dd.open .dd-menu{opacity:1;visibility:visible;transform:none}
.mkd .dd-menu::-webkit-scrollbar{width:8px}
.mkd .dd-menu::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:8px;border:2px solid #fff}
.mkd .dd-head{padding:6px 10px 4px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.mkd .dd-opt{display:flex;align-items:center;gap:10px;min-height:36px;padding:7px 10px;border-radius:8px;font-size:13px;font-weight:500;color:var(--ink-2);cursor:pointer;white-space:nowrap;outline:none;
  transition:background-color .15s ease,color .15s ease}
.mkd .dd-opt + .dd-opt{margin-top:2px}
.mkd .dd-opt .tx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.mkd .dd-opt .ck{flex:none;width:16px;height:16px;opacity:0;transform:scale(.6);transition:opacity .15s ease,transform .15s ease}
.mkd .dd-opt .yd{flex:none;width:9px;height:9px;border-radius:50%;box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(15,23,42,.08)}
.mkd .dd-opt:hover,.mkd .dd-opt.hl{background:#F1F5F9;color:#1E2856}
.mkd .dd-opt.is-ph{color:var(--muted);font-style:normal}
.mkd .dd-opt.is-ph:hover,.mkd .dd-opt.is-ph.hl{background:#FFF1F2;color:#C62828}
.mkd .dd-opt[aria-selected="true"]{background:#1E2856;color:#fff;font-weight:700;box-shadow:0 4px 10px -4px rgba(30,40,86,.5)}
.mkd .dd-opt[aria-selected="true"]:hover,.mkd .dd-opt[aria-selected="true"].hl{background:#2A3672;color:#fff}
.mkd .dd-opt[aria-selected="true"] .ck{opacity:1;transform:none}
.mkd .dd-opt[aria-selected="true"] .yd{box-shadow:0 0 0 2px #1E2856,0 0 0 3px rgba(255,255,255,.5)}
.mkd .dd-sep{height:1px;margin:4px 6px;background:var(--line)}
@media (prefers-reduced-motion:reduce){.mkd .dd-menu,.mkd .dd-chev{transition:none}}
@media (prefers-reduced-motion:reduce){.mkd *,.mkd *::before,.mkd *::after,.mkd *::before,.mkd *::after{animation:none!important;transition:none!important}}
/* ---- React port additions ---- */
.mkd{position:relative;min-height:100vh;text-align:left}
.mkd,.mkd *,.mkd *::before,.mkd *::after{box-sizing:border-box}
.mkd .how ol{list-style:decimal}
.mkd .dss-modal .result ul{list-style:disc}
.mkd .ph .fld{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--muted)}
.mkd .fpop .fld{display:flex;flex-direction:column;align-items:flex-start;gap:4px;font-size:11.5px;font-weight:600;color:var(--muted)}
.mkd .fld .dd{min-width:150px}
.mkd .fld>span{white-space:nowrap}
.mkd .filters .rg.inline{min-width:0}
.mkd .chart svg .hit{outline:none}
.mkd .dd-menu:focus{outline:none}
.mkd .kpi .kico svg,.mkd .dd-chev svg{display:block}
#mkd-print{display:none}
@media print{
  body.mkd-printmode .mkd-app,body.mkd-printmode .mkd .toast,body.mkd-printmode .mkd .tip{display:none!important}
  body.mkd-printmode #mkd-print{display:block;color:#000;background:#fff;padding:12px}
  #mkd-print .noprint,#mkd-print details.why{display:none!important}
  #mkd-print table{font-size:12px}
  #mkd-print tr.sup td{background:#eee;box-shadow:none}
}
`;

/* =====================================================================
   Data helpers (pure functions over the dataset)
   ===================================================================== */
const M = D.meta, N = M.nd, LAST = N - 1;
const ING = D.ing, BYID = Object.fromEntries(ING.map((i) => [i.id, i]));
const D0 = Date.UTC(+M.d0.slice(0, 4), +M.d0.slice(5, 7) - 1, +M.d0.slice(8, 10));
const dateOf = (i) => new Date(D0 + i * 864e5);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fd = (i, y) => { const d = dateOf(i); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}${y ? " " + d.getUTCFullYear() : ""}`; };
const fiso = (s) => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}`;
const idxOf = (s) => Math.round((Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) - D0) / 864e5);
const peso = (v, d = 0) => "₱" + Number(v).toLocaleString("en-PH", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (v, d = 0) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d });
const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
const whole = (q) => (q > 0 && q < 0.5 ? "<1" : num(Math.round(q)));
const daysTxt = (d) => (d <= 0 ? "0" : d < 1 ? "<1" : num(Math.round(d)));
const qty = (q, uom) => uom === "g" ? (q >= 1000 ? num(q / 1000, 1) + " kg" : num(q) + " g") : whole(q) + (uom === "pc" ? (Math.round(q) === 1 ? " pc" : " pcs") : (Math.round(q) === 1 ? " serving" : " servings"));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

const NAVN = { buy: "Purchasing", pred: "Forecast", inv: "Inventory", waste: "Waste", use: "Usage", sales: "Sales" };
const PAGES = [["sales", "Sales", "What happened"], ["use", "Ingredient Usage", "What happened"], ["waste", "Waste & Spoilage", "What happened"], ["inv", "Inventory", "What happened"], ["pred", "Forecast", "What's coming"], ["buy", "Purchasing plan", "What to do"]];
const GROUPS = ["What happened", "What's coming", "What to do"];
const RANGES = [[28, "4 weeks"], [90, "3 months"], [180, "6 months"], [365, "12 months"], [N, "All time"]];

/* the budget is set per month; the dashboard shows the same amount per week (monthly x 12 / 52, to the nearest 100) */
const wk = (m) => Math.round(m * 12 / 52 / 100) * 100;

const series = (id) => D.series[id];
function consumedValue(ids, a, b) { let v = 0; for (const id of ids) { const s = series(id).use, c = BYID[id].cost; for (let i = a; i <= b; i++) v += s[i] * c; } return v; }
function unmetValue(ids, a, b) { const set = new Set(ids); return sum(D.so.filter((x) => x[0] >= a && x[0] <= b && set.has(x[1])).map((x) => x[3] * BYID[x[1]].cost)); }
function purchaseValue(ids, a, b) { let v = 0; for (const id of ids) { const s = series(id).rec, c = BYID[id].cost; for (let i = a; i <= b; i++) v += s[i] * c; } return v; }
const wasteIn = (set, a, b) => D.waste.filter((w) => w[0] >= a && w[0] <= b && set.has(w[1]));
const soIn = (set, a, b) => D.so.filter((w) => w[0] >= a && w[0] <= b && set.has(w[1]));
const stockValue = (ids, at) => sum(ids.map((id) => series(id).close[at] * BYID[id].cost));
/* expiry status of a batch. chilled items last 3-5 days, frozen 90-180 */
function riskOf(store, left) { if (store === "chilled") return left <= 1 ? "bad" : left <= 2 ? "warn" : "good"; return left <= 7 ? "bad" : left <= 21 ? "warn" : "good"; }
const batchesAt = (at) => D.batches.filter((b) => b[0] === at);
function riskIngredients(ids, at) {
  const set = new Set(ids), out = {};
  for (const b of batchesAt(at)) {
    if (!set.has(b[1]) || b[2] <= 0) continue;
    const ing = BYID[b[1]], left = b[4] - at, r = riskOf(ing.store, left);
    if (r === "good") continue;
    const o = out[b[1]] || (out[b[1]] = { qty: 0, left: 99, r: "warn" });
    o.qty += b[2]; o.left = Math.min(o.left, left); if (r === "bad") o.r = "bad";
  }
  return out;
}

/* period window: a chosen year (or one month of it), else the last N days. The earlier period is the same length just before. */
function winOf(p) {
  if (p.year) {
    const y = p.year, m = p.month === "" ? null : +p.month, day = (ms) => Math.round((ms - D0) / 864e5);
    const a = Math.max(0, day(Date.UTC(y, m === null ? 0 : m, 1))), b = Math.min(LAST, day(m === null ? Date.UTC(y, 11, 31) : Date.UTC(y, m + 1, 0))), n = Math.max(1, b - a + 1);
    return { a, b, n, pa: Math.max(0, a - n), pb: a - 1 };
  }
  const n = Math.min(p.range, N);
  return { a: N - n, b: LAST, n, pa: Math.max(0, N - 2 * n), pb: N - n - 1 };
}
const filterIng = (f) => ING.filter((i) => (!f.cat || i.cat === f.cat) && (!f.sup || i.sup === f.sup) && (!f.store || i.store === f.store) && (!f.ing || i.id === f.ing));

function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 1.2 ? 1.2 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10) * p; }
const PAL = ["#1E2856", "#FF9F43", "#10B981", "#6366F1", "#0EA5E9", "#A78BFA", "#94A3B8", "#14B8A6", "#D946EF", "#84CC16"]; // one hue per category; no red (red means a warning)
const RAMPS = { blue: ["#1E2856", "#C7D2FE"], amber: ["#B45309", "#FDE68A"], green: ["#047857", "#BBF7D0"] };
const ramp = (f, name = "blue") => { const [dark, light] = RAMPS[name] || RAMPS.blue; return `color-mix(in srgb, ${dark} ${Math.round(30 + 70 * Math.max(0, Math.min(1, f)))}%, ${light})`; };
const heatColor = (f) => `color-mix(in srgb, var(--heat1) ${Math.round(Math.min(1, f) * 85)}%, var(--heat0))`;
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], wdOf = (i) => (dateOf(i).getUTCDay() + 6) % 7;
function monthsFrom(a, b, fullOnly) {
  const out = []; let i = a;
  while (i <= b) {
    const d = dateOf(i), y = d.getUTCFullYear(), m = d.getUTCMonth(); let e = i;
    while (e + 1 <= b && dateOf(e + 1).getUTCMonth() === m) e++;
    const full = dateOf(i).getUTCDate() === 1 && dateOf(e + 1).getUTCDate() === 1;
    if (!fullOnly || full) out.push({ label: `${MON[m]} ${y}`, a: i, b: e });
    i = e + 1;
  }
  return out;
}
function weeksFrom(a, b) { const out = []; for (let i = a; i <= b; i += 7) out.push({ label: fd(i), a: i, b: Math.min(b, i + 6) }); return out; }

const WALKIN = new Set(["HI-TOP"]); // Hi-Top is a walk-in grocery: a shopping list instead of a supplier message
const isWalkin = (i) => WALKIN.has(i.supname);
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } } };
const orderKey = (p) => `makisushi.ordered.${M.plan_start}.${p.ing}.${p.week}`;
const dtxt = (i) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateOf(i).getUTCDay()]} ${fd(i)}`;
function nextDelivery(ids, week) { const ds = D.deliveries.filter((x) => ids.includes(x[0]) && x[1] === week).map((x) => idxOf(x[3])); return ds.length ? Math.min(...ds) : null; }

/* ---------- Loyverse upload (item-sales export) ---------- */
const UP_KEY = "makisushi.upload.v1";
const REQUIRED = ["Item name", "SKU", "Category", "Items sold", "Gross sales", "Discounts", "Net sales", "DATE"];
const MONS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const UPL = D.upload;
const normName = (s) => String(s || "").toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[^a-z0-9]/g, "");
const cleanName = (s) => String(s || "").replace(/\[[^\]]*\]\s*/g, "").trim();
function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((c) => c.trim() !== "")) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}
const cleanNum = (v) => { const s = String(v == null ? "" : v).replace(/[₱,\s]/g, ""); if (s === "" || s === "-") return 0; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
function loyDate(v) {
  const s = String(v || "").trim(); let y, m, d, k;
  if ((k = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(s))) { d = +k[1]; m = MONS[k[2].toLowerCase()]; y = +k[3]; if (y < 100) y += 2000; }
  else if ((k = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) { y = +k[1]; m = +k[2] - 1; d = +k[3]; }
  else if ((k = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { m = +k[1] - 1; d = +k[2]; y = +k[3]; }
  else return null;
  if (m === undefined || Number.isNaN(m)) return null;
  return Math.round((Date.UTC(y, m, d) - D0) / 864e5);
}
function analyzeUpload(text, name) {
  const rows = parseCsv(text);
  const res = { name, missing: [], lines: 0, bad: 0, unmatched: new Map(), unmatchedNet: 0, agg: new Map(), days: new Set(), net: 0, items: 0 };
  if (!rows.length) { res.missing = REQUIRED.slice(); return res; }
  const head = rows[0].map((h) => h.trim().toLowerCase()), idx = Object.fromEntries(head.map((h, k) => [h, k]));
  res.missing = REQUIRED.filter((c) => !(c.toLowerCase() in idx));
  if (res.missing.length) return res;
  const g = (r, c) => r[idx[c.toLowerCase()]];
  for (const r of rows.slice(1)) {
    const day = loyDate(g(r, "DATE")), items = cleanNum(g(r, "Items sold")), net = cleanNum(g(r, "Net sales")), gross = cleanNum(g(r, "Gross sales")), disc = cleanNum(g(r, "Discounts"));
    if (day === null || [items, net, gross, disc].some(Number.isNaN)) { res.bad++; continue; }
    const sku = String(g(r, "SKU") || "").trim().replace(/\.0+$/, ""), nm = String(g(r, "Item name") || "").trim(), cat = String(g(r, "Category") || "").trim();
    res.lines++; res.days.add(day); res.net += net; res.items += items;
    const hit = UPL.sku[sku]; const itemId = hit ? hit[0] : (UPL.names[normName(nm)] === undefined ? null : UPL.names[normName(nm)]);
    if (itemId === null) { const key = sku + "|" + nm; res.unmatched.set(key, (res.unmatched.get(key) || 0) + net); res.unmatchedNet += net; }
    const key = day + "|" + (sku || nm), a = res.agg.get(key) || { day, sku, name: nm, cat, itemId, items: 0, net: 0, gross: 0, disc: 0 };
    a.items += items; a.net += net; a.gross += gross; a.disc += disc; res.agg.set(key, a);
  }
  return res;
}
const isMgmt = (r) => String(r.cat).toUpperCase() === "MANAGEMENT";
let EX_NET = null;
function existingNetByDay() { if (!EX_NET) { EX_NET = {}; D.sales.forEach((r) => { EX_NET[r[0]] = (EX_NET[r[0]] || 0) + r[3]; }); } return EX_NET; }
function reconcile(rowsArr) {
  const ex = existingNetByDay(), up = {};
  rowsArr.forEach((r) => { if (!isMgmt(r)) up[r.day] = (up[r.day] || 0) + r.net; });
  let overlap = 0, match = 0, fresh = 0;
  Object.keys(up).forEach((k) => { const d = +k; if (d > LAST) { fresh++; return; } if (d < 0) return; overlap++; const e = ex[d] || 0; if (Math.abs(up[d] - e) <= Math.max(5, 0.01 * e)) match++; });
  return { overlap, match, fresh, up, ex };
}
function uploadFromRows(name, rows) {
  const days = [...new Set(rows.map((r) => r.day))].sort((a, b) => a - b);
  return { name, rows, from: days[0], to: days[days.length - 1], net: sum(rows.map((r) => r.net)), items: sum(rows.map((r) => r.items)), nDays: days.length, lines: rows.length };
}
function restoreUpload() {
  try {
    const s = ls.get(UP_KEY); if (!s) return null;
    const o = JSON.parse(s);
    return uploadFromRows(o.name, o.rows.map((a) => ({ day: a[0], sku: a[1], name: a[2], cat: a[3], itemId: a[4], items: a[5], net: a[6], gross: a[7], disc: a[8] })));
  } catch (e) { return null; }
}

/* ---------- item-level sales ---------- */
const IS = D.isales, IT = D.items;
function itemTotals(a, b, ci) {
  const m = new Map();
  for (let k = 0; k < IS.length; k++) {
    const r = IS[k]; if (r[0] < a || r[0] > b) continue;
    const it = IT[r[1]]; if (!it || (ci >= 0 && it[1] !== ci)) continue;
    const o = m.get(r[1]); if (o) { o.q += r[2]; o.n += r[3]; } else m.set(r[1], { q: r[2], n: r[3] });
  }
  return m;
}

/* ---------- external factors ---------- */
const XT = D.ext, TOPCATS = D.cats.map((c, k) => [c, k, sum(D.sales.filter((r) => r[1] === k).map((r) => r[3]))]).sort((a, b) => b[2] - a[2]).slice(0, 10);
function dailyDemand(key) {
  const a = new Array(N).fill(0);
  if (key === "all") D.sales.forEach((r) => { a[r[0]] += r[3]; });
  else if (key[0] === "c") { const k = +key.slice(2); D.sales.forEach((r) => { if (r[1] === k) a[r[0]] += r[3]; }); }
  else { const id = +key.slice(2), u = series(id).use; for (let i = 0; i < N; i++) a[i] = u[i]; }
  return a;
}
/* the usual level of a day: the median of the same weekday in the 4 weeks before and after, ignoring closed days and days with no sales */
function nbBase(a, i) {
  const v = [];
  for (let j = 1; j <= 4; j++) for (const k of [i - 7 * j, i + 7 * j]) if (k >= 0 && k < N && !(XT.f[k] & 8) && a[k] > 0) v.push(a[k]);
  if (v.length < 4) return 0;
  v.sort((x, y) => x - y); const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function devSeries(a, robust) {
  const y = new Array(N).fill(null), closed = (i) => XT.f[i] & 8;
  if (robust) { for (let i = 0; i < N; i++) { if (closed(i)) continue; const b = nbBase(a, i); if (b > 0) y[i] = a[i] / b - 1; } return y; }
  for (let i = 0; i < N; i++) {
    if (closed(i)) continue; let s = 0, c = 0;
    for (let j = 1; j <= 4; j++) for (const k of [i - 7 * j, i + 7 * j]) if (k >= 0 && k < N && !closed(k)) { s += a[k]; c++; }
    if (c >= 4 && s > 0) y[i] = a[i] / (s / c) - 1;
  }
  return y;
}
function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return 0;
  const mx = sum(xs) / n, my = sum(ys) / n; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

const MODELS = [["HW", "Holt-Winters (7-day season)"], ["SES", "Simple exponential smoothing (SES)"], ["SARIMA", "SARIMA"], ["ML", "Gradient boosting (ML)"], ["SNAIVE", "Seasonal naive (baseline)"]];
const MODEL_HELP = "Five ways of forecasting were tried on the same weeks. Holt-Winters looks at past weeks, including the weekly ups and downs (in use). SES is a recent average. SARIMA follows the pattern and trend. Gradient boosting is a learning program. Seasonal naive simply repeats last week and is the one to beat. WMAPE is how far off the forecast is, in %, per week; lower is better. A MASE below 1 means better than repeating last week.";
const MNAME = Object.fromEntries(MODELS), MWINS = [...new Set(D.mcmp.map((r) => r.win))];
const FV_MON = monthsFrom(D.ext.bts, LAST, false).map((m) => ({ ...m, part: m.b === LAST && dateOf(LAST + 1).getUTCDate() !== 1 }));

const YCOL = { 2021: "#94A3B8", 2022: "#10B981", 2023: "#A78BFA", 2024: "#3B82F6", 2025: "#F59E0B", 2026: "#1E2856" }; // one fixed colour per year
const CMP = {
  sales: { title: "Net sales per day", per: 1, fmt: peso, k: true, what: "Net sales" },
  use: { title: "Ingredient use per day (₱)", per: 1, fmt: peso, k: true, what: "Ingredient use" },
  waste: { title: "Waste per 30 days (₱)", per: 30, fmt: peso, k: true, what: "Waste" },
  inv: { title: "Times an ingredient ran out, per 30 days", per: 30, fmt: (v) => v.toFixed(1), k: false, what: "Times ran out" },
};
const YEARS = [...new Set(Array.from({ length: N }, (_, i) => dateOf(i).getUTCFullYear()))].sort((x, y) => y - x);

/* =====================================================================
   Shared UI context: state, setters, tooltip and toast
   ===================================================================== */
const UICtx = createContext(null);
const useUI = () => useContext(UICtx);

/* the tooltip lives in its own component so mouse moves only re-render the tooltip */
function TipLayer({ apiRef }) {
  const [t, setT] = useState(null);
  const node = useRef(null);
  useEffect(() => {
    apiRef.current = { show: (e, content) => setT({ x: e.clientX, y: e.clientY, content }), hide: () => setT(null) };
  }, [apiRef]);
  useLayoutEffect(() => {
    const el = node.current; if (!el || !t) return;
    const w = el.offsetWidth; let x = t.x + 12;
    if (x + w > window.innerWidth - 8) x = t.x - w - 12;
    el.style.left = x + "px"; el.style.top = t.y + 14 + "px";
  }, [t]);
  if (!t) return null;
  return <div className="tip" ref={node} role="tooltip">{t.content}</div>;
}
function ToastLayer({ apiRef }) {
  const [msg, setMsg] = useState("");
  const timer = useRef(0);
  useEffect(() => {
    apiRef.current = (m) => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(""), 2400); };
    return () => clearTimeout(timer.current);
  }, [apiRef]);
  if (!msg) return null;
  return <div className="toast" role="status">{msg}</div>;
}

function downloadCsv(name, rows, toast) {
  const q = (v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const text = "﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n");
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Saved " + name);
  } catch (e) { toast("The file could not be saved here."); }
}
function copyText(txt, walk, toast) {
  const ok = () => toast(walk ? "Shopping list copied. Paste it into your notes or chat." : "Message copied. Paste it into your chat with the supplier.");
  const fallback = () => {
    const ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); ok(); } catch (e) { toast("Could not copy. Please select the text and copy it yourself."); }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
}

/* =====================================================================
   Custom dropdown (replaces every native <select>)
   options: [{ value, label, menuLabel?, ph?, dot? } | { header }]
   ===================================================================== */
const ChevIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>);
const CheckIcon = () => (<svg className="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>);

function Dropdown({ value, options, onChange, label, head }) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(-1);
  const [place, setPlace] = useState("");
  const root = useRef(null), btn = useRef(null), menu = useRef(null);
  const id = useId();
  const picks = options.filter((o) => !o.header);
  const cur = picks.find((o) => String(o.value) === String(value)) || picks[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useLayoutEffect(() => {
    if (!open) { setPlace(""); return; }
    const r = menu.current.getBoundingClientRect(), b = btn.current.getBoundingClientRect();
    let p = "";
    if (r.right > window.innerWidth - 8) p += " right";
    if (r.bottom > window.innerHeight - 8 && b.top > r.height + 16) p += " up";
    setPlace(p);
    setHl(Math.max(0, picks.indexOf(cur)));
    menu.current.focus({ preventScroll: true });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || hl < 0 || !menu.current) return;
    const it = menu.current.querySelectorAll(".dd-opt")[hl];
    if (it) it.scrollIntoView({ block: "nearest" });
  }, [hl, open]);

  const close = (focus) => { setOpen(false); if (focus && btn.current) btn.current.focus(); };
  const pick = (o) => { close(true); if (String(o.value) !== String(value)) onChange(o.value); };
  const onMenuKey = (e) => {
    const last = picks.length - 1;
    if (e.key === "ArrowDown") { e.preventDefault(); setHl((i) => Math.min(last, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHl((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setHl(0); }
    else if (e.key === "End") { e.preventDefault(); setHl(last); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (picks[hl]) pick(picks[hl]); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") close(false);
    else if (e.key.length === 1) {
      const ch = e.key.toLowerCase(), from = hl + 1;
      const order = picks.slice(from).concat(picks.slice(0, from));
      const hit = order.find((o) => String(o.menuLabel ?? o.label).trim().toLowerCase().startsWith(ch));
      if (hit) setHl(picks.indexOf(hit));
    }
  };
  let k = -1;
  return (
    <div ref={root} className={`dd${open ? " open" : ""}${place}`}>
      <button ref={btn} type="button" className="dd-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={`${label}: ${cur ? cur.label : ""}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); } else if (e.key === "Escape") setOpen(false); }}>
        <span className={`dd-val${cur && cur.ph ? " is-ph" : ""}`}>{cur && cur.dot ? <span className="yd" style={{ background: cur.dot }} /> : null}{cur ? cur.label : ""}</span>
        <span className="dd-chev" aria-hidden="true"><ChevIcon /></span>
      </button>
      <ul ref={menu} className="dd-menu" id={id} role="listbox" tabIndex={-1} aria-label={label} onKeyDown={onMenuKey}>
        {head ? <li className="dd-head" role="presentation">{head}</li> : null}
        {options.map((o, j) => {
          if (o.header) return <li key={"h" + j} className="dd-head" role="presentation">{o.header}</li>;
          const idx = ++k;
          return (
            <li key={String(o.value) + "|" + j} role="option" tabIndex={-1} aria-selected={o === cur}
              className={`dd-opt${o.ph ? " is-ph" : ""}${idx === hl ? " hl" : ""}`}
              onClick={() => pick(o)} onMouseMove={() => { if (hl !== idx) setHl(idx); }}>
              {o.dot ? <span className="yd" style={{ background: o.dot }} /> : null}
              <span className="tx">{o.menuLabel ?? o.label}</span><CheckIcon />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* =====================================================================
   Small building blocks
   ===================================================================== */
const Info = ({ tip }) => <span className="info" data-tip={tip}>i</span>;
const Empty = ({ children = "No data for this selection." }) => <div className="empty">{children}</div>;
function Legend({ items }) {
  return <div className="legend">{items.map(([lab, col], k) => <span key={k}><i style={{ background: col }} />{lab}</span>)}</div>;
}
function Seg({ items, value, onChange, className = "", label }) {
  return (
    <div className={`seg ${className}`} role="group" aria-label={label}>
      {items.map(([v, lab]) => <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{lab}</button>)}
    </div>
  );
}
function TabBar({ items, value, onChange }) {
  return (
    <div className="seg tabs">
      {items.map(([v, lab]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{lab}</button>)}
    </div>
  );
}
function Chip({ tone = "flat", children, className = "" }) { return <span className={`chip ${tone} ${className}`}>{children}</span>; }
function Panel({ c = "c12", title, sub, right, children, id, style }) {
  return (
    <div className={`panel ${c}`} id={id} style={style}>
      {title !== undefined ? <div className="ph"><h2>{title}{sub ? <small className="mname">{sub}</small> : null}</h2>{right}</div> : null}
      {children}
    </div>
  );
}

const KICON = {
  coin: <><circle cx="12" cy="12" r="9" /><path d="M9.5 17V7h3.2a2.8 2.8 0 0 1 0 5.6H9.5M7.5 9.3h9M7.5 11.3h9" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 7.5h7M8.5 12h1M14.5 12h1M8.5 16h1M14.5 16h1" /></>,
  bowl: <><path d="M3 11h18a9 9 0 0 1-18 0z" /><path d="m13 3-3 8M19 4l-6 7" /></>,
  alert: <><path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" /><path d="M12 10v4M12 17.5h.01" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.4" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2.5" /><path d="M16 13.5h2M3 10h18M6 6l9-3 1.2 3" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  flame: <path d="M12 21a6 6 0 0 0 6-6c0-4-3-6.5-4.5-10-1.8 2-2.6 4-2.6 6-1-.8-1.8-1.8-2.1-3C7 10 6 12.3 6 15a6 6 0 0 0 6 6z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};
const KMAP = [[/ran out/i, "alert"], [/filled|same as/i, "check"], [/waste/i, "trash"], [/cost/i, "tag"], [/spend/i, "wallet"], [/new days/i, "cal"], [/wmape/i, "target"],
  [/beats/i, "trend"], [/ways/i, "layers"], [/next 7/i, "trend"], [/net sales/i, "coin"], [/^orders$/i, "receipt"], [/average per order/i, "calc"], [/items/i, "bowl"], [/used|per day|last 7/i, "flame"]];
function KIcon({ label }) {
  const m = KMAP.find(([re]) => re.test(label));
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{KICON[m ? m[1] : "chart"]}</svg>;
}
function Spark({ vals }) {
  const gid = "sp" + useId().replace(/:/g, "");
  const v = vals.filter((x) => Number.isFinite(x));
  if (v.length < 3) return null;
  const W = 120, H = 40, lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const line = v.map((x, k) => `${((k / (v.length - 1)) * W).toFixed(1)},${(H - 4 - ((x - lo) / r) * (H - 10)).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".28" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
function Kpi({ label, value, d, info, goto, spark }) {
  const { go } = useUI();
  const showSpark = spark && spark.filter((x) => Number.isFinite(x)).length >= 3;
  return (
    <button type="button" className={`kpi${showSpark ? " has-spark" : ""}`} onClick={() => goto && go(goto)}>
      <span className="kico" aria-hidden="true"><KIcon label={label} /></span>
      <div className="l">{label}<Info tip={info} /></div>
      <div className="v">{value}</div>
      <div className="d">{d}</div>
      {showSpark ? <Spark vals={spark} /> : null}
    </button>
  );
}
function Delta({ cur, prev, fmt, lower, unit = "" }) {
  if (prev === null || prev === undefined) return <span className="t-flat">no earlier period</span>;
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return <span className="t-flat">▬ same as before</span>;
  const up = d > 0, good = lower ? !up : up;
  return <><span className={good ? "t-good" : "t-bad"}><span className={up ? "up" : "dn"}>{up ? "▲" : "▼"}</span> {fmt(Math.abs(d))}{unit}</span> <span className="t-flat">vs earlier</span></>;
}
function MeterBar({ value, cap, big, sub, warn = 0.6, bad = 0.9 }) {
  const f = cap ? value / cap : 0, col = f < warn ? "var(--good)" : f < bad ? "var(--warn)" : "var(--bad)";
  const tone = f < warn ? "good" : f < bad ? "warn" : "bad", pc = Math.round(f * 100);
  return (
    <div className="mbar">
      <div className="mtop"><b>{big}</b>{cap ? <span className={`mp ${tone}`}>{pc}%</span> : null}</div>
      <span className="msub">{sub}</span>
      <div className="mtrack" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pc}><i style={{ width: `${Math.min(100, f * 100)}%`, backgroundColor: col, color: col }} /></div>
    </div>
  );
}
function BarRows({ items, fmt = num, color, click, w, onPick }) {
  const mx = Math.max(...items.map((i) => i[1]), 1);
  if (!items.length) return <div className="rows"><Empty /></div>;
  return (
    <div className="rows">
      {items.map((i, k) => (
        <div key={k} className={`row${click ? " click" : ""}`} style={w ? { gridTemplateColumns: `minmax(90px,${w}px) minmax(0,1fr) auto` } : undefined} onClick={click && onPick ? () => onPick(i[2]) : undefined}>
          <span className="nm" title={i[0]}>{i[0]}</span>
          <div className="bar"><span style={{ width: `${((i[1] / mx) * 100).toFixed(1)}%`, background: i[3] || color || undefined }} /></div>
          <span className="val">{fmt(i[1], i)}</span>
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   SVG charts
   ===================================================================== */
function useWidth(ref, fallback = 600) {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const upd = () => setW(el.clientWidth || fallback);
    upd();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return w;
}

/* bar + line chart with hover focus, gradients, rounded bars, bands, markers and a shaded window */
function Chart(o) {
  const host = useRef(null), width = useWidth(host), { tip } = useUI();
  const uid = "cg" + useId().replace(/:/g, "");
  const [hov, setHov] = useState(null);
  const W = Math.max(280, width), H = o.h || 240, L = 46, R = o.right ? 46 : 10, T = 10, B = 26;
  const gmap = new Map(), defs = [];
  const grad = (a, b, oa = 1, ob = 1) => {
    const key = [a, b, oa, ob].join("|");
    if (!gmap.has(key)) {
      const gid = `${uid}_${gmap.size}`; gmap.set(key, gid);
      defs.push(<linearGradient key={gid} id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} stopOpacity={oa} /><stop offset="1" stopColor={b} stopOpacity={ob} /></linearGradient>);
    }
    return `url(#${gmap.get(key)})`;
  };
  const bars = o.bars || [], lines = o.lines || [];
  const n = o.x.length, pw = W - L - R, ph = H - T - B;
  const left = [], right = [];
  bars.forEach((b) => (b.axis === "r" ? right : left).push(...b.vals));
  lines.forEach((l) => (l.axis === "r" ? right : left).push(...l.vals.filter((v) => v !== null), ...(l.hi || [])));
  const ymax = niceMax(Math.max(...left, 1)), y2max = niceMax(Math.max(...right, 1));
  const X = (i) => L + (n === 1 ? pw / 2 : ((i + 0.5) * pw) / n);
  const Y = (v, ax) => T + ph - (v / (ax === "r" ? y2max : ymax)) * ph;
  const yfmt = o.yfmt || num;
  const els = [];
  for (let g = 0; g <= 4; g++) {
    const v = (ymax * g) / 4, y = Y(v);
    els.push(<line key={"gl" + g} x1={L} x2={W - R} y1={y} y2={y} stroke="var(--grid)" />, <text key={"gt" + g} x={L - 6} y={y + 4} textAnchor="end">{yfmt(v)}</text>);
    if (o.right) els.push(<text key={"gr" + g} x={W - R + 6} y={y + 4}>{(o.y2fmt || num)((y2max * g) / 4)}</text>);
  }
  if (o.shade) {
    const x1 = L + (o.shade[0] * pw) / n, x2 = L + (o.shade[1] * pw) / n;
    els.push(<rect key="sh" x={x1} y={T} width={Math.max(0, x2 - x1)} height={ph} fill="var(--warn-soft)" opacity=".75" />, <text key="sht" x={x1 + 4} y={T + 11} style={{ fill: "var(--warn)", fontWeight: 600 }}>{o.shade[2]}</text>);
  }
  (o.marks || []).forEach(([i, lab], k) => {
    els.push(<line key={"mk" + k} x1={X(i)} x2={X(i)} y1={T} y2={T + ph} stroke="var(--accent)" strokeDasharray="2 4" opacity=".85" />, <text key={"mt" + k} x={X(i)} y={T + 10} textAnchor="middle" style={{ fill: "var(--accent)", fontWeight: 700 }}>{lab}</text>);
  });
  const bw = Math.max(1, Math.min(34, (pw / n) * 0.72));
  bars.forEach((b, bi) => b.vals.forEach((v, i) => {
    const y = Y(v, b.axis), h = Math.max(0, T + ph - y), x0 = X(i) - bw / 2;
    const fill = b.grads && b.grads[i] ? grad(b.grads[i][0], b.grads[i][1]) : (b.colors && b.colors[i]) || b.color || "var(--accent)";
    const op = b.ops && b.ops[i] !== undefined ? b.ops[i] : b.op || 1, rr = Math.min(b.radius || 3, bw / 2, h), dl = Math.min(i * 18, 420);
    const cls = `bar ${(b.cls && b.cls[i]) || ""}${hov === i ? " hov" : ""}`;
    els.push(b.radius
      ? <path key={`b${bi}_${i}`} className={cls} style={{ animationDelay: dl + "ms" }} d={`M${x0} ${y + h}V${y + rr}A${rr} ${rr} 0 0 1 ${x0 + rr} ${y}H${x0 + bw - rr}A${rr} ${rr} 0 0 1 ${x0 + bw} ${y + rr}V${y + h}Z`} fill={fill} opacity={op} />
      : <rect key={`b${bi}_${i}`} className={cls} style={{ animationDelay: dl + "ms" }} x={x0} y={y} width={bw} height={h} rx="3" fill={fill} opacity={op} />);
    if (b.labels && n <= 12) els.push(<text key={`bl${bi}_${i}`} x={X(i)} y={y - 4} textAnchor="middle" style={{ fontSize: "10.5px", fontWeight: 600, fill: "#334155", paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>{(b.lfmt || yfmt)(v)}</text>);
  }));
  lines.forEach((l, li) => {
    if (l.hi) {
      let p = ""; l.hi.forEach((v, i) => { p += (i ? "L" : "M") + X(i) + " " + Y(v, l.axis); });
      for (let i = n - 1; i >= 0; i--) p += "L" + X(i) + " " + Y(l.lo[i], l.axis);
      els.push(<path key={"band" + li} d={p + "Z"} fill={l.color} opacity=".16" />);
    }
    let p = "", pen = false;
    l.vals.forEach((v, i) => { if (v === null) { pen = false; return; } p += (pen ? "L" : "M") + X(i) + " " + Y(v, l.axis); pen = true; });
    if (l.area && p) {
      const f = l.vals.findIndex((v) => v !== null), la = l.vals.length - 1 - [...l.vals].reverse().findIndex((v) => v !== null);
      els.push(<path key={"area" + li} d={`${p}L${X(la)} ${T + ph}L${X(f)} ${T + ph}Z`} fill={l.areaGrad ? grad(l.color, l.color, 0.3, 0.02) : l.color} opacity={l.areaGrad ? 1 : 0.14} />);
    }
    if (l.halo) els.push(<path key={"halo" + li} d={p} fill="none" stroke="#fff" strokeWidth={(l.w || 2.2) + 3} opacity=".9" strokeLinejoin="round" />);
    els.push(<path key={"ln" + li} className={l.cls || undefined} d={p} fill="none" stroke={l.color} strokeWidth={l.w || 2.2} opacity={l.op || 1} strokeDasharray={l.dash ? (l.dash === true ? "6 4" : l.dash) : undefined} strokeLinecap="round" strokeLinejoin="round" />);
    if (l.pts) l.vals.forEach((v, i) => { if (v !== null && l.pts[i]) els.push(<circle key={`pt${li}_${i}`} className={`pt${hov === i ? " hov" : ""}`} cx={X(i)} cy={Y(v, l.axis)} r="3.4" fill={l.pts[i]} stroke="#fff" strokeWidth="1.5" />); });
    else if (n <= 40 && !l.nodots) l.vals.forEach((v, i) => { if (v !== null) els.push(<circle key={`d${li}_${i}`} cx={X(i)} cy={Y(v, l.axis)} r="2.6" fill={l.color} />); });
    if (l.tag) { const lv = l.vals[l.vals.length - 1]; if (lv !== null) els.push(<text key={"tag" + li} x={W - R - 2} y={Y(lv, l.axis) - 7} textAnchor="end" className="ltag" style={{ fill: l.color }}>{l.tag}</text>); }
  });
  const step = n <= 12 ? 1 : Math.ceil(n / Math.max(2, Math.floor(pw / 62)));
  o.x.forEach((t, i) => { if (i % step === 0) els.push(<text key={"x" + i} x={X(i)} y={H - 8} textAnchor="middle">{t}</text>); });
  els.push(<line key="axis" x1={L} x2={W - R} y1={T + ph} y2={T + ph} stroke="var(--line)" />);
  const tipFor = (i) => (
    <>
      <b>{o.x[i]}</b>
      {[...bars, ...lines].filter((z) => z.vals[i] !== null && z.vals[i] !== undefined && !z.notip).map((z, k) => <React.Fragment key={k}><br />{z.name}: {(z.fmt || yfmt)(z.vals[i])}</React.Fragment>)}
      {o.tipExtra ? <><br />{o.tipExtra(i)}</> : null}
    </>
  );
  for (let i = 0; i < n; i++) {
    els.push(<rect key={"hit" + i} className="hit" x={X(i) - pw / n / 2} y={T} width={pw / n} height={ph} fill="transparent"
      onMouseEnter={() => setHov(i)} onMouseMove={(e) => tip.show(e, tipFor(i))} onMouseLeave={() => { tip.hide(); setHov(null); }}
      onClick={o.onClick ? () => o.onClick(i) : undefined} />);
  }
  return (
    <div className="chart" ref={host}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={o.label || "chart"} className={hov !== null ? "hovering" : undefined}>
        {defs.length ? <defs>{defs}</defs> : null}
        {els}
      </svg>
    </div>
  );
}

const svgBox = (W) => ({ display: "block", maxWidth: W, margin: "0 auto" });
function wrapLabel(t, max, cut) {
  const w = String(t).split(" "), out = [""];
  w.forEach((x) => { const c = out[out.length - 1]; if ((c + " " + x).trim().length > max && c) out.push(x); else out[out.length - 1] = (c + " " + x).trim(); });
  if (out.length > 2) { const r = out.slice(1).join(" "); return [out[0], r.length > cut ? r.slice(0, cut - 1) + "…" : r]; }
  return out;
}

/* horizontal bars, labels left, value axis along the bottom. items: [label, value, id, colour?] */
function HBar({ items, w, click, onPick, max, marks, axis, fmt, short, shade, color, name, label }) {
  const W = w || 600, L = 170, R = marks ? 56 : 36, rowH = 26, T = 6, B = 30, n = items.length, H = T + n * rowH + B;
  if (!n) return <Empty />;
  const mx = max || niceMax((Math.max(...items.map((i) => i[1]), ...(marks || []).flatMap((m) => m.vals)) || 1) * 1.12);
  const pw = W - L - R, X = (v) => L + (v / mx) * pw, fm = axis || num, top = Math.max(...items.map((z) => z[1])) || 1;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || "Bar chart"} style={svgBox(W)}>
        {[0, 1, 2, 3, 4].map((k) => { const v = (mx * k) / 4, x = X(v); return <g key={k}><line x1={x} x2={x} y1={T} y2={T + n * rowH} stroke="#E2E8F0" /><text x={x} y={H - 14} textAnchor="middle" fontSize="11" fill="#64748B">{fm(v)}</text></g>; })}
        {items.map((i, k) => {
          const y = T + k * rowH, lines = wrapLabel(i[0], 26, 27), t = `${i[0]}: ${(fmt || num)(i[1])}`;
          const fill = i[3] || (shade === "cat" ? PAL[k % PAL.length] : shade ? ramp(i[1] / top, shade) : color || "var(--accent)");
          return (
            <g key={k} className={`hb${click ? " row click" : ""}`} onClick={click && onPick ? () => onPick(i[2]) : undefined}>
              <title>{t}</title>
              <rect x={L} y={y + 5} width={Math.max(1, X(i[1]) - L)} height={rowH - 10} rx="2" fill={fill} />
              <text x={marks ? L + pw + 8 : X(i[1]) + 5} y={y + rowH / 2 + 4} fontSize="10.5" fontWeight="600" fill="#334155">{(short || axis || num)(i[1])}</text>
              {lines.map((tx, j) => <text key={j} x={L - 8} y={y + rowH / 2 + 4 + (j - (lines.length - 1) / 2) * 12} textAnchor="end" fontSize="11" fill="#334155">{tx}</text>)}
            </g>
          );
        })}
        {(marks || []).map((m, mi) => items.map((it, k) => <rect key={mi + "_" + k} x={X(m.vals[k]) - 1.5} y={T + k * rowH + 2} width="3" height={rowH - 4} fill={m.color} />))}
      </svg>
      <div className="legend">
        {shade === "cat" ? null : <span><i style={{ background: shade ? ramp(1, shade) : color || "var(--accent)" }} />{name || ""}</span>}
        {(marks || []).map((m, k) => <span key={k}><i style={{ background: m.color, width: 3 }} />{m.name}</span>)}
      </div>
    </>
  );
}

/* ring (or pie) for 2 to 5 parts of one whole; anything else falls back to bar rows */
function Donut({ items, pie, colors, fmt = num, label, center, sub }) {
  if (items.length > 5 || items.length < 2) return <BarRows items={items.map((i) => [i[0], i[1]])} fmt={fmt} color="var(--accent)" />;
  const pal = colors || PAL, tot = sum(items.map((i) => i[1])) || 1, R = pie ? 35 : 52, SW = pie ? 70 : 22, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={label || "Share"}>
        {items.map((i, k) => {
          const f = i[1] / tot, d = f * C, seg = Math.max(0, d - 1.5), off = -acc; acc += d;
          return <circle key={k} cx="70" cy="70" r={R} fill="none" stroke={pal[k % pal.length]} strokeWidth={SW} strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={off} transform="rotate(-90 70 70)"><title>{`${i[0]}: ${fmt(i[1])} (${(f * 100).toFixed(0)}%)`}</title></circle>;
        })}
        {pie ? null : <><text x="70" y="68" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0F172A">{center || ""}</text><text x="70" y="83" textAnchor="middle" fontSize="10" fill="#64748B">{sub || ""}</text></>}
      </svg>
      <ul>{items.map((i, k) => <li key={k}><i style={{ background: pal[k % pal.length] }} /><span>{i[0]}</span><b>{((i[1] / tot) * 100).toFixed(0)}%</b></li>)}</ul>
    </div>
  );
}

const signPct = (v) => (v > 0 ? "+" : "") + Math.round(v * 100) + "%";
/* bars grow right (up) or left (down) from a zero line. items: [label, fraction or null] */
function DivBars({ items, label, up = "Up", down = "Down" }) {
  const W = 560, L = 190, R = 16, rowH = 30, T = 6, B = 28, n = items.length, H = T + n * rowH + B;
  const Mx = niceMax(Math.max(0.1, ...items.map((i) => (i[1] === null ? 0 : Math.abs(i[1])))) * 1.35), x0 = L + (W - L - R) / 2, half = (W - L - R) / 2, X = (v) => x0 + (v / Mx) * half;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || "Change"} style={svgBox(W)}>
        {[-1, -0.5, 0, 0.5, 1].map((t) => <g key={t}><line x1={X(t * Mx)} x2={X(t * Mx)} y1={T} y2={T + n * rowH} stroke={t === 0 ? "#94A3B8" : "#E2E8F0"} /><text x={X(t * Mx)} y={H - 10} textAnchor="middle" fontSize="11" fill="#64748B">{signPct(t * Mx)}</text></g>)}
        {items.map((i, k) => { const lsx = wrapLabel(i[0], 28, 28); return lsx.map((tx, j) => <text key={k + "_" + j} x={L - 10} y={T + k * rowH + rowH / 2 + 4 + (j - (lsx.length - 1) / 2) * 12} textAnchor="end" fontSize="11" fill="#334155">{tx}</text>); })}
        {items.map((i, k) => {
          const y = T + k * rowH, v = i[1]; if (v === null) return null;
          const isUp = v >= 0, x = isUp ? x0 : X(v);
          return <g key={"b" + k}><title>{`${i[0]}: ${signPct(v)}`}</title><rect x={x} y={y + 5} width={Math.max(1, Math.abs(X(v) - x0))} height={rowH - 10} rx="2" fill={isUp ? "var(--good)" : "var(--warn)"} /><text x={isUp ? X(v) + 5 : X(v) - 5} y={y + rowH / 2 + 4} textAnchor={isUp ? "start" : "end"} fontSize="10.5" fontWeight="600" fill="#334155">{signPct(v)}</text></g>;
        })}
      </svg>
      <Legend items={[[up, "var(--good)"], [down, "var(--warn)"]]} />
    </>
  );
}
/* columns up or down from a zero line. items: [label, fraction] */
function DivCols({ items, label, up = "Up", down = "Down" }) {
  const W = 600, H = 270, L = 46, R = 10, T = 20, B = 30, n = items.length, pw = W - L - R, ph = H - T - B;
  const Mx = niceMax(Math.max(0.1, ...items.map((i) => Math.abs(i[1]))) * 1.35), Y = (v) => T + ph / 2 - ((v / Mx) * ph) / 2, bw = (pw / n) * 0.6, X = (k) => L + ((k + 0.5) * pw) / n;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || "Change"} style={svgBox(W)}>
        {[-1, -0.5, 0, 0.5, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t * Mx)} y2={Y(t * Mx)} stroke={t === 0 ? "#94A3B8" : "#E2E8F0"} /><text x={L - 6} y={Y(t * Mx) + 4} textAnchor="end" fontSize="11" fill="#64748B">{signPct(t * Mx)}</text></g>)}
        {items.map((i, k) => {
          const v = i[1], isUp = v >= 0, y = isUp ? Y(v) : Y(0), h = Math.max(1, Math.abs(Y(v) - Y(0)));
          return <g key={k}><title>{`${i[0]}: ${signPct(v)}`}</title><rect x={X(k) - bw / 2} y={y} width={bw} height={h} rx="2" fill={isUp ? "var(--good)" : "var(--warn)"} /><text x={X(k)} y={isUp ? y - 4 : y + h + 12} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#334155">{signPct(v)}</text><text x={X(k)} y={H - 10} textAnchor="middle" fontSize="11" fill="#64748B">{i[0].slice(0, 3)}</text></g>;
        })}
      </svg>
      <Legend items={[[up, "var(--good)"], [down, "var(--warn)"]]} />
    </>
  );
}
/* stock walk. steps: [label, value, "total" | "move"] */
function Waterfall({ steps, w, fmt = num, axis = num, label }) {
  const W = w || 640, H = 250, L = 52, R = 10, T = 22, B = 44, n = steps.length, pw = W - L - R, ph = H - T - B;
  let run = 0;
  const bars = steps.map((s) => { if (s[2] === "total") { run = s[1]; return { s, lo: 0, hi: s[1], end: s[1] }; } const a = run, b = run + s[1]; run = b; return { s, lo: Math.min(a, b), hi: Math.max(a, b), end: b }; });
  const mx = niceMax(Math.max(...bars.map((b) => b.hi), 1) * 1.08), Y = (v) => T + ph - (v / mx) * ph, bw = (pw / n) * 0.62, X = (k) => L + ((k + 0.5) * pw) / n;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || "Stock walk"} style={svgBox(W)}>
        {[0, 1, 2, 3, 4].map((k) => { const v = (mx * k) / 4; return <g key={k}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#E2E8F0" /><text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#64748B">{axis(v)}</text></g>; })}
        {bars.map((b, k) => {
          const tot = b.s[2] === "total", col = tot ? "var(--accent)" : b.s[1] >= 0 ? "var(--good)" : "var(--warn)", h = Math.max(1.5, Y(b.lo) - Y(b.hi)), nxt = bars[k + 1];
          return (
            <g key={k}>
              <title>{`${b.s[0]}: ${fmt(Math.abs(b.s[1]))}`}</title>
              <rect x={X(k) - bw / 2} y={Y(b.hi)} width={bw} height={h} rx="2" fill={col} />
              <text x={X(k)} y={Y(b.hi) - 4} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#334155">{tot ? "" : b.s[1] >= 0 ? "+" : "−"}{fmt(Math.abs(b.s[1]))}</text>
              <text x={X(k)} y={H - 24} textAnchor="middle" fontSize="10.5" fill="#64748B">{b.s[0]}</text>
              {nxt ? <line x1={X(k) + bw / 2} x2={X(k + 1) - bw / 2} y1={Y(b.end)} y2={Y(b.end)} stroke="#94A3B8" strokeDasharray="2 2" /> : null}
            </g>
          );
        })}
      </svg>
      <Legend items={[["Stock on hand", "var(--accent)"], ["Added", "var(--good)"], ["Taken away", "var(--warn)"]]} />
    </>
  );
}
/* bars = value, line = running share of the total (0 to 100%). items sorted high to low */
function Pareto({ items, w, total, fmt = num, axis = num, name, label }) {
  const W = w || 640, H = 300, L = 52, R = 44, T = 14, B = 66, n = items.length, pw = W - L - R, ph = H - T - B, tot = total || sum(items.map((i) => i[1])) || 1;
  const mx = niceMax(Math.max(...items.map((i) => i[1]), 1) * 1.05), Y = (v) => T + ph - (v / mx) * ph, Yp = (p) => T + ph - p * ph, X = (k) => L + ((k + 0.5) * pw) / n, bw = (pw / n) * 0.64;
  let acc = 0; const cum = items.map((i) => (acc += i[1]) / tot), k80 = cum.findIndex((c) => c >= 0.8);
  const line = cum.map((c, k) => (k ? "L" : "M") + X(k) + " " + Yp(c)).join("");
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || "Pareto chart"} style={svgBox(W)}>
        {[0, 1, 2, 3, 4].map((k) => { const v = (mx * k) / 4; return <g key={k}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#E2E8F0" /><text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#64748B">{axis(v)}</text><text x={W - R + 6} y={Yp(k / 4) + 4} fontSize="11" fill="#64748B">{k * 25}%</text></g>; })}
        <line x1={L} x2={W - R} y1={Yp(0.8)} y2={Yp(0.8)} stroke="var(--bad)" strokeDasharray="5 4" />
        <text x={W - R - 4} y={Yp(0.8) + 14} textAnchor="end" fontSize="10.5" fill="var(--bad)">80% of the loss</text>
        {items.map((i, k) => (
          <g key={k}>
            <title>{`${i[0]}: ${fmt(i[1])} · running total ${(cum[k] * 100).toFixed(0)}%`}</title>
            <rect x={X(k) - bw / 2} y={Y(i[1])} width={bw} height={Math.max(1, Y(0) - Y(i[1]))} rx="2" fill={k80 >= 0 && k <= k80 ? "var(--accent)" : "#93A4D6"} />
            <text transform={`translate(${X(k) + 3} ${H - B + 10}) rotate(-40)`} textAnchor="end" fontSize="10.5" fill="#334155">{i[0].length > 16 ? i[0].slice(0, 15) + "…" : i[0]}</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="#D97706" strokeWidth="2" />
        {cum.map((c, k) => <circle key={k} cx={X(k)} cy={Yp(c)} r="2.6" fill="#D97706" />)}
      </svg>
      <Legend items={[[`${name || "Amount"} (the few that make up 80%)`, "var(--accent)"], ["The rest", "#93A4D6"], ["Running share of the total", "#D97706"]]} />
    </>
  );
}
/* stacked columns. keys: x labels; series: [{ name, vals, color }] */
function StackCols({ keys, series: ser, w, fmt = num, axis = num, label }) {
  const W = w || 640, H = 260, L = 52, R = 10, T = 14, B = 30, n = keys.length, pw = W - L - R, ph = H - T - B;
  const totals = keys.map((_, k) => sum(ser.map((s) => s.vals[k]))), mx = niceMax(Math.max(...totals, 1) * 1.05);
  const Y = (v) => T + ph - (v / mx) * ph, X = (k) => L + ((k + 0.5) * pw) / n, bw = Math.min(46, (pw / n) * 0.66), step = n <= 12 ? 1 : Math.ceil(n / 12);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || "Stacked columns"} style={svgBox(W)}>
        {[0, 1, 2, 3, 4].map((k) => { const v = (mx * k) / 4; return <g key={k}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#E2E8F0" /><text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#64748B">{axis(v)}</text></g>; })}
        {keys.map((key, k) => {
          let acc = 0;
          return (
            <g key={k}>
              {ser.map((s, si) => { const v = s.vals[k], y0 = Y(acc), y1 = Y(acc + v); acc += v; return v > 0 ? <rect key={si} x={X(k) - bw / 2} y={y1} width={bw} height={Math.max(0.5, y0 - y1)} fill={s.color}><title>{`${key} · ${s.name}: ${fmt(v)}`}</title></rect> : null; })}
              {k % step === 0 ? <text x={X(k)} y={H - 10} textAnchor="middle" fontSize="11" fill="#64748B">{key}</text> : null}
            </g>
          );
        })}
      </svg>
      <Legend items={ser.map((s) => [s.name, s.color])} />
    </>
  );
}
function squarify(vals, x, y, w, h) {
  const tot = sum(vals) || 1, area = vals.map((v) => (v / tot) * w * h), out = []; let i = 0;
  while (i < area.length) {
    const side = Math.min(w, h), row = []; let best = Infinity, rs = 0;
    while (i + row.length < area.length) {
      const a = area[i + row.length], ns = rs + a;
      const worst = (r, s) => Math.max(...r.map((v) => Math.max((side * side * v) / (s * s), (s * s) / (side * side * v))));
      const nw = worst([...row, a], ns);
      if (row.length && nw > best) break;
      row.push(a); rs = ns; best = nw;
    }
    const th = rs / side;
    if (w >= h) { let yy = y; row.forEach((a) => { const hh = a / th; out.push([x, yy, th, hh]); yy += hh; }); x += th; w -= th; }
    else { let xx = x; row.forEach((a) => { const ww = a / th; out.push([xx, y, ww, th]); xx += ww; }); y += th; h -= th; }
    i += row.length;
  }
  return out;
}
/* two-level treemap: category, then ingredient. groups: [{ name, color, items: [[label, value]] }] */
function Treemap({ groups, w, h, fmt = num, label }) {
  const W = w || 640, H = h || 330, gsum = (g) => sum(g.items.map((i) => i[1]));
  const gs = groups.filter((g) => gsum(g) > 0).sort((a, b) => gsum(b) - gsum(a)), tot = sum(gs.map(gsum)) || 1;
  const rects = squarify(gs.map(gsum), 0, 0, W, H);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || "Treemap"} style={svgBox(W)}>
        {gs.map((g, k) => {
          const [x, y, gw, gh] = rects[k], pad = 2, hd = gw > 70 && gh > 38 ? 15 : 0;
          const its = g.items.filter((i) => i[1] > 0).sort((a, b) => b[1] - a[1]);
          const inner = squarify(its.map((i) => i[1]), x + pad, y + pad + hd, Math.max(1, gw - pad * 2), Math.max(1, gh - pad * 2 - hd));
          return (
            <g key={k}>
              <rect x={x} y={y} width={gw} height={gh} fill={g.color} opacity=".16" />
              {hd ? <text x={x + 6} y={y + 12} fontSize="10.5" fontWeight="700" fill="#334155">{`${g.name} · ${((gsum(g) / tot) * 100).toFixed(0)}%`}</text> : null}
              {its.map((it, j) => {
                const [a, b, c, d] = inner[j], big = c > 62 && d > 30, maxCh = Math.floor(c / 6.3);
                return (
                  <g key={j}>
                    <title>{`${it[0]} (${g.name}): ${fmt(it[1])}`}</title>
                    <rect x={a} y={b} width={Math.max(0, c - 1.5)} height={Math.max(0, d - 1.5)} rx="2" fill={g.color} />
                    {big ? <><text x={a + 5} y={b + 13} fontSize="10.5" fontWeight="600" fill="#fff">{it[0].length > maxCh ? it[0].slice(0, Math.max(3, maxCh - 1)) + "…" : it[0]}</text><text x={a + 5} y={b + 26} fontSize="10" fill="#fff" opacity=".9">{fmt(it[1])}</text></> : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <Legend items={gs.map((g) => [g.name, g.color])} />
    </>
  );
}
/* generic heat grid: rows of cells, a header row and a label column */
function Heat({ labelCol, cols, rows }) {
  return (
    <div className="heat" style={{ gridTemplateColumns: `${labelCol} repeat(${cols.length},minmax(0,1fr))` }}>
      <span />
      {cols.map((c, k) => <span key={"h" + k} className="hh">{c}</span>)}
      {rows.map((r, k) => (
        <React.Fragment key={k}>
          <span className="hl" title={r.title || undefined}>{r.label}</span>
          {r.cells.map((c, j) => <span key={j} className="hc" style={c.style} data-t={c.t || undefined}>{c.text}</span>)}
        </React.Fragment>
      ))}
    </div>
  );
}

/* =====================================================================
   Shared KPI row (Inventory, Waste, Purchasing > Spend)
   ===================================================================== */
function OpsKpis({ F }) {
  const { w, s } = useUI();
  const ids = F.map((i) => i.id), set = new Set(ids), hasPrev = w.pb >= 0 && w.pa <= w.pb;
  const so = soIn(set, w.a, w.b).length, soP = hasPrev ? soIn(set, w.pa, w.pb).length : null;
  const served = consumedValue(ids, w.a, w.b), lost = unmetValue(ids, w.a, w.b), fill = served + lost > 0 ? served / (served + lost) : 1;
  const servedP = hasPrev ? consumedValue(ids, w.pa, w.pb) : 0, lostP = hasPrev ? unmetValue(ids, w.pa, w.pb) : 0;
  const fillP = hasPrev ? (servedP + lostP > 0 ? servedP / (servedP + lostP) : 1) : null;
  const wv = sum(wasteIn(set, w.a, w.b).map((x) => x[2])), pu = purchaseValue(ids, w.a, w.b), wvP = hasPrev ? sum(wasteIn(set, w.pa, w.pb).map((x) => x[2])) : null;
  const puP = hasPrev ? purchaseValue(ids, w.pa, w.pb) : 0;
  const per7 = (v, n) => (v / n) * 7, sp = per7(pu, w.n), spP = hasPrev ? per7(puP, w.pb - w.pa + 1) : null;
  const bud = wk(M.budget[s.scen]);
  const sn = sum(D.sales.filter((r) => r[0] >= w.a && r[0] <= w.b).map((r) => r[3])), snP = hasPrev ? sum(D.sales.filter((r) => r[0] >= w.pa && r[0] <= w.pb).map((r) => r[3])) : null;
  const fcost = sn ? pu / sn : 0, fcostP = snP ? puP / snP : null;
  return (
    <div className="kpis">
      <Kpi label="Ran out" value={num(so)} d={<Delta cur={so} prev={soP} fmt={num} lower />} info="Times an ingredient ran out of stock during the selected period." goto="inv" />
      <Kpi label="Orders filled" value={pct(fill)} d={<Delta cur={fill} prev={fillP} fmt={(v) => (v * 100).toFixed(2)} unit=" points" />} info="Share of ingredient demand (in pesos) that was served from stock." goto="inv" />
      <Kpi label="Waste" value={peso(wv)} d={<>{pct(pu ? wv / pu : 0)} of purchases · <Delta cur={wv} prev={wvP} fmt={(v) => peso(v)} lower /></>} info="Recorded waste in pesos, and as a share of what was bought in the period." goto="waste" />
      <Kpi label="Ingredient cost" value={pct(fcost)} d={<>of sales · <Delta cur={fcost} prev={fcostP} fmt={(v) => (v * 100).toFixed(1)} lower unit=" points" /></>} info="What was spent on these ingredients as a share of sales. Only ingredients that spoil are counted, so this is lower than the full food cost." goto="buy" />
      <Kpi label="Weekly spend" value={peso(sp)} d={<>{pct(sp / bud, 0)} of {peso(bud)} weekly budget · <Delta cur={sp} prev={spP} fmt={(v) => peso(v)} lower /></>} info="Average spend per week on the selected ingredients, valued at standard cost, against the weekly budget (the monthly budget divided across the weeks)." goto="buy" />
    </div>
  );
}

/* =====================================================================
   Page heading + "how to read this page"
   ===================================================================== */
const HEADS = { buy: "Purchasing plan", pred: "Forecast", inv: "Inventory", waste: "Waste & Spoilage", use: "Ingredient Usage", sales: "Sales" };
const HOW = {
  buy: ["Start with the four boxes on top. They say what to do today.", "Place each order with the supplier, or buy it at the grocery, then tick it. \"Copy message\" and \"Copy shopping list\" give you text to paste into a chat or notes.", "Open \"More detail\" only when you want to see why."],
  pred: ["The top boxes show how much is expected to be used in the next 7 days.", "In \"Forecast vs actual\", bars are what really happened and the line is what was expected.", "Dotted lines mark paydays and holidays."],
  inv: ["The table lists each ingredient and whether it may run short before the next delivery.", "\"Order when below\" and \"Target stock\" are simple rules of thumb. Review them monthly.", "Click a bar to look at one ingredient."],
  waste: ["\"Use first today\" is the list for the kitchen. Print it if you like.", "\"Dishes to push\" suggests menu items that use the stock that is about to expire.", "Darker squares in the waste table mean more money lost."],
  use: ["Pick a period at the top, or one ingredient, to see how much is used.", "The weekday chart shows the busiest days.", "Click a bar in the last list to look at one ingredient."],
  sales: ["Choose Day, Week or Month to change the chart.", "The table at the bottom shows sales by month and year.", "Pick a menu category at the top to focus on one group of dishes."],
};
function PageHead() {
  const { s, set } = useUI();
  return (
    <>
      <div className="pagehead">
        <h1>{HEADS[s.page]}</h1>
        <button type="button" className="info" data-tip="How to read this page" aria-label="How to read this page" aria-expanded={s.showHelp} onClick={() => set({ showHelp: !s.showHelp })}>i</button>
      </div>
      {s.showHelp ? (
        <div className="how">
          <ol>{HOW[s.page].map((x, k) => <li key={k}>{x}</li>)}</ol>
          <button type="button" className="linkbtn" onClick={() => set({ showHelp: false })}>Got it</button>
        </div>
      ) : null}
    </>
  );
}

/* =====================================================================
   SALES
   ===================================================================== */
/* Net sales chart: colour by view (day = navy with orange weekends, week = warm orange, month = deep navy)
   or by performance against the period average. Dotted crimson line = average. */
const SG = { navy: ["#3A4A8C", "#1E2856"], deep: ["#2A3672", "#141B3D"], orange: ["#FF9F43", "#EA580C"], up: ["#34D399", "#10B981"], down: ["#94A3B8", "#94A3B8"] };
const swatch = (g) => `linear-gradient(180deg,${g[0]},${g[1]})`;
function NetSalesChart({ ks, B, lab, grain, scol }) {
  const v = ks.map((k) => B.get(k).net), many = ks.length > 40;
  const avg = sum(v) / (v.length || 1), vsAvg = scol === "avg", wknd = (k) => grain === "day" && [0, 6].includes(dateOf(k).getUTCDay());
  let grads, pts, lineCol, lg;
  if (vsAvg) { grads = v.map((q) => (q >= avg ? SG.up : SG.down)); pts = v.map((q) => (q >= avg ? "#10B981" : "#94A3B8")); lineCol = "#1E2856"; lg = [["Above average", swatch(SG.up)], ["Below average", swatch(SG.down)]]; }
  else if (grain === "day") { grads = ks.map((k) => (wknd(k) ? SG.orange : SG.navy)); pts = ks.map((k) => (wknd(k) ? "#F97316" : null)); lineCol = "#1E2856"; lg = [["Weekday", swatch(SG.navy)], ["Weekend (Sat–Sun)", swatch(SG.orange)]]; }
  else if (grain === "week") { grads = v.map(() => SG.orange); pts = null; lineCol = "#F97316"; lg = [["Net sales per week", swatch(SG.orange)]]; }
  else { grads = v.map(() => SG.deep); pts = null; lineCol = "#1E2856"; lg = [["Net sales per month", swatch(SG.deep)]]; }
  const avgLine = { vals: v.map(() => avg), color: "#D32F2F", dash: "3 5", w: 2.4, halo: true, nodots: true, name: "Average", fmt: peso, tag: "Avg ₱" + num(avg / 1000) + "k", cls: "avgline" };
  const tipExtra = (i) => { const d = avg ? v[i] / avg - 1 : 0; return <><span style={{ color: d >= 0 ? "#6EE7B7" : "#FCA5A5" }}>{d >= 0 ? "▲" : "▼"} {Math.abs(d * 100).toFixed(0)}% vs average</span>{wknd(ks[i]) ? " · weekend" : ""}</>; };
  return (
    <>
      <Chart x={ks.map(lab)} label="Net sales" yfmt={(q) => "₱" + num(q / 1000) + "k"} h={330} tipExtra={tipExtra}
        bars={many ? [] : [{ vals: v, grads, radius: 6, cls: grads.map((g) => (g === SG.orange ? "warm" : "")), name: "Net sales", fmt: peso }]}
        lines={many ? [{ vals: v, color: lineCol, area: true, areaGrad: true, nodots: true, pts, w: 2.4, name: "Net sales", fmt: peso }, avgLine] : [avgLine]} />
      <div id="lg-sales"><Legend items={lg.concat([["Average", "repeating-linear-gradient(90deg,#D32F2F 0 3px,transparent 3px 6px)"]])} /></div>
    </>
  );
}

function PageSales() {
  const { s, set, w, pickRow } = useUI();
  const ci = s.cat ? D.cats.indexOf(s.cat) : -1;
  const rows = D.sales.filter((r) => r[0] >= w.a && r[0] <= w.b && (ci < 0 || r[1] === ci)), prev = D.sales.filter((r) => r[0] >= w.pa && r[0] <= w.pb && (ci < 0 || r[1] === ci));
  const net = sum(rows.map((r) => r[3])), lines = sum(rows.map((r) => r[5])), qn = sum(rows.map((r) => r[4])), netP = sum(prev.map((r) => r[3])), linesP = sum(prev.map((r) => r[5])), hasPrev = w.pb >= 0 && w.pa <= w.pb;
  const grain = s.grain || (w.n <= 35 ? "day" : w.n <= 200 ? "week" : "month");
  const key = (i) => { if (grain === "day") return i; if (grain === "week") return i - ((dateOf(i).getUTCDay() + 6) % 7); const d = dateOf(i); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const B = new Map();
  rows.forEach((r) => { const k = key(r[0]); const o = B.get(k) || { net: 0, lines: 0, items: 0 }; o.net += r[3]; o.lines += r[5]; o.items += r[4]; B.set(k, o); });
  const ks = [...B.keys()].sort((a, b) => a - b), lab = (k) => (grain === "month" ? `${MON[k % 12]} ${Math.floor(k / 12)}` : fd(Math.max(k, w.a)));
  const byCat = D.cats.map((c, k) => [c, sum(rows.filter((r) => r[1] === k).map((r) => r[3])), c]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const byCh = D.chans.map((c, k) => [c, sum(rows.filter((r) => r[2] === k).map((r) => r[3]))]);
  const allNet = () => sum(D.sales.filter((r) => r[0] >= w.a && r[0] <= w.b).map((r) => r[3])) || 1;
  return (
    <>
      <div className="kpis">
        <Kpi label="Net sales" value={peso(net)} d={hasPrev ? <Delta cur={net} prev={netP} fmt={(v) => peso(v)} /> : ""} info="Sales after discounts in the selected period." spark={ks.map((k) => B.get(k).net)} />
        <Kpi label="Orders" value={num(lines)} d={hasPrev ? <Delta cur={lines} prev={linesP} fmt={num} /> : ""} info="Number of sale lines in the selected period." spark={ks.map((k) => B.get(k).lines)} />
        <Kpi label="Average per order" value={peso(lines ? net / lines : 0, 0)} d="" info="Net sales divided by the number of sale lines." spark={ks.map((k) => { const o = B.get(k); return o.lines ? o.net / o.lines : NaN; })} />
        <Kpi label="Items sold" value={num(qn)} d="" info="Total quantity of menu items sold." spark={ks.map((k) => B.get(k).items)} />
      </div>
      <TabBar items={[["overview", "Overview"], ["products", "Products"], ["compare", "Compare periods"]]} value={s.stab} onChange={(v) => set({ stab: v })} />
      <div className="grid">
        {s.stab === "overview" ? (
          <>
            <div className="panel c8">
              <div className="ph">
                <h2>Net sales</h2>
                <Seg className="seg-sm" label="Bar colours" items={[["view", "By view"], ["avg", "vs average"]]} value={s.scol === "avg" ? "avg" : "view"} onChange={(v) => set({ scol: v })} />
                <Seg label="Group by" items={[["day", "Day"], ["week", "Week"], ["month", "Month"]]} value={grain} onChange={(g) => set({ grain: g })} />
              </div>
              <NetSalesChart ks={ks} B={B} lab={lab} grain={grain} scol={s.scol} />
            </div>
            <div className="grid c4" style={{ gridTemplateColumns: "1fr", alignContent: "start" }}>
              <Panel c="" title="Channels"><Donut items={byCh.filter((x) => x[1] > 0)} pie colors={["#1E2856", "#FF9F43"]} fmt={peso} label="Sales by channel" /></Panel>
              <Panel c="" title={ci >= 0 ? "Share of all sales" : "Top categories"}>
                {ci >= 0
                  ? <><div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0" }}>{pct(net / allNet(), 1)}</div><div className="note">{s.cat} is this share of all net sales in the selected period.</div></>
                  : <HBar items={byCat} w={440} fmt={peso} axis={(v) => "₱" + num(v / 1000) + "k"} short={(v) => "₱" + num(v / 1000) + "k"} name="Net sales" shade="cat" click onPick={pickRow} label="Top categories" />}
              </Panel>
            </div>
          </>
        ) : null}
        {s.stab === "products" ? <><SalesTop w={w} ci={ci} /><SalesGrow w={w} ci={ci} hasPrev={hasPrev} /><SalesDayHeat w={w} ci={ci} /></> : null}
        {s.stab === "compare" ? <><SalesYoy ci={ci} /><SalesUnusual w={w} ci={ci} /><SalesWeekday w={w} rows={rows} /><SalesYearHeat ci={ci} /></> : null}
      </div>
    </>
  );
}
function SalesTop({ w, ci }) {
  const { s, set } = useUI();
  const byQ = s.topby === "q", catName = ci >= 0 ? s.cat : "";
  const byName = new Map();
  itemTotals(w.a, w.b, ci).forEach((o, id) => { const nm = cleanName(IT[id][0]), key = nm.toLowerCase(), c = byName.get(key); if (c) { c.q += o.q; c.n += o.n; } else byName.set(key, { name: nm, q: o.q, n: o.n }); });
  const all = [...byName.values()].sort((x, y) => (byQ ? y.q - x.q : y.n - x.n));
  const total = sum(all.map((x) => (byQ ? x.q : x.n))), top = all.slice(0, 10), share = total ? sum(top.map((x) => (byQ ? x.q : x.n))) / total : 0;
  return (
    <Panel c="c7" title={catName ? "Top sellers · " + catName : "Top 10 sellers"} right={<Seg items={[["n", "By sales (₱)"], ["q", "By number sold"]]} value={byQ ? "q" : "n"} onChange={(v) => set({ topby: v })} />}>
      <HBar items={top.map((x) => [x.name, byQ ? x.q : x.n])} fmt={(v) => (byQ ? num(v) + " sold" : peso(v))} axis={(v) => (byQ ? num(v) : "₱" + num(v))} name={byQ ? "Number sold" : "Net sales"} shade="blue" label="Top sellers" />
      <div className="note">{top.length ? `The top ${top.length} make up ${pct(share, 0)} of ${catName || "all"} ${byQ ? "items sold" : "sales"}.` : "No sales in this period."}</div>
    </Panel>
  );
}
function SalesGrow({ w, ci, hasPrev }) {
  const { s } = useUI();
  let growRows;
  if (ci >= 0) {
    const A = new Map(), Bm = new Map();
    itemTotals(w.a, w.b, ci).forEach((o, id) => { const k = cleanName(IT[id][0]); A.set(k, (A.get(k) || 0) + o.n); });
    if (hasPrev) itemTotals(w.pa, w.pb, ci).forEach((o, id) => { const k = cleanName(IT[id][0]); Bm.set(k, (Bm.get(k) || 0) + o.n); });
    growRows = [...A.keys()].filter((k) => (Bm.get(k) || 0) > 300).sort((a, b) => A.get(b) - A.get(a)).slice(0, 8).map((k) => [k, A.get(k) / Bm.get(k) - 1]);
  } else {
    const cur = {}, prv = {};
    D.sales.forEach((r) => { if (r[0] >= w.a && r[0] <= w.b) cur[r[1]] = (cur[r[1]] || 0) + r[3]; else if (hasPrev && r[0] >= w.pa && r[0] <= w.pb) prv[r[1]] = (prv[r[1]] || 0) + r[3]; });
    growRows = Object.keys(cur).map(Number).filter((k) => (prv[k] || 0) > 1000).sort((a, b) => cur[b] - cur[a]).slice(0, 8).map((k) => [D.cats[k], cur[k] / prv[k] - 1]);
  }
  const title = ci >= 0 ? "Growing and shrinking dishes · " + s.cat : "Growing and shrinking categories";
  return (
    <Panel c="c5" title={title}>
      {growRows.length ? <><DivBars items={growRows} label={title} up="Growing" down="Shrinking" /><div className="note">Net sales compared with the {w.n} days before.</div></> : <Empty>Choose a period that has an earlier period to compare with.</Empty>}
    </Panel>
  );
}
function SalesDayHeat({ w, ci }) {
  const { s } = useUI();
  const wdN = new Array(7).fill(0); for (let i = w.a; i <= w.b; i++) wdN[wdOf(i)]++;
  const cw = {};
  if (ci >= 0) IS.forEach((r) => { if (r[0] < w.a || r[0] > w.b) return; const it = IT[r[1]]; if (!it || it[1] !== ci) return; const nm = cleanName(it[0]); (cw[nm] || (cw[nm] = new Array(7).fill(0)))[wdOf(r[0])] += r[3]; });
  else D.sales.forEach((r) => { if (r[0] < w.a || r[0] > w.b) return; (cw[r[1]] || (cw[r[1]] = new Array(7).fill(0)))[wdOf(r[0])] += r[3]; });
  const keys = Object.keys(cw).sort((a, b) => sum(cw[b]) - sum(cw[a])).slice(0, 10), rowName = (k) => (ci >= 0 ? k : D.cats[+k]);
  const short = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : num(v));
  const rows = keys.map((k) => {
    const avg = cw[k].map((v, d) => v / (wdN[d] || 1)), mx = Math.max(...avg) || 1;
    return { label: rowName(k), cells: avg.map((v, d) => ({ style: { background: heatColor(v / mx), color: v / mx > 0.72 ? "#fff" : undefined }, t: `${rowName(k)} · ${WD[d]}: ${peso(v)} a day on average`, text: short(v) })) };
  });
  return (
    <Panel c="c12" title={`Best day of the week for each ${ci >= 0 ? "dish · " + s.cat : "category"}`}>
      {rows.length ? <Heat labelCol="minmax(110px,180px)" cols={WD} rows={rows} /> : <Empty>No sales in this period.</Empty>}
      <div className="note">Average net sales per day. Each row is shaded on its own, so the darkest square is that {ci >= 0 ? "dish's" : "category's"} best day.</div>
    </Panel>
  );
}
function SalesYoy({ ci }) {
  const { s } = useUI();
  const lastD = dateOf(LAST), mo = lastD.getUTCMonth(), dd = lastD.getUTCDate(), yrs = [];
  for (let y = dateOf(0).getUTCFullYear() + 1; y <= lastD.getUTCFullYear(); y++) {
    const a = Math.round((Date.UTC(y, 0, 1) - D0) / 864e5), b = Math.round((Date.UTC(y, mo, dd) - D0) / 864e5);
    yrs.push({ y, v: sum(D.sales.filter((r) => r[0] >= a && r[0] <= b && (ci < 0 || r[1] === ci)).map((r) => r[3])) });
  }
  const v = yrs.map((o) => o.v);
  return (
    <Panel c="c5" title={`Year over year${ci >= 0 ? " · " + s.cat : ""}`}>
      <div className="sub">Net sales from 1 Jan to {dd} {MON[mo]} of each year</div>
      <Chart x={yrs.map((o) => String(o.y))} h={200} label="Net sales, 1 Jan to the same day each year" yfmt={(q) => "₱" + num(q / 1000000, 1) + "M"} bars={[{ vals: v, colors: v.map((_, k) => ramp(v.length > 1 ? 0.25 + (0.75 * k) / (v.length - 1) : 1)), op: 1, name: "Net sales", fmt: peso }]} />
      <div className="note">
        {yrs.slice(1).map((o, k) => <React.Fragment key={o.y}>{k ? " · " : ""}{o.y}: <b className={o.v >= yrs[k].v ? "t-good" : "t-bad"}>{o.v >= yrs[k].v ? "+" : ""}{((o.v / yrs[k].v - 1) * 100).toFixed(0)}%</b></React.Fragment>)} compared with the year before.
      </div>
    </Panel>
  );
}
function SalesUnusual({ w, ci }) {
  const { s, set } = useUI();
  const dl = dailyDemand(ci >= 0 ? "c:" + ci : "all"), dv = devSeries(dl, true), un = [];
  for (let i = w.a; i <= w.b; i++) if (dv[i] !== null && !(XT.f[i] & 8)) un.push({ i, dv: dv[i], v: dl[i], usual: nbBase(dl, i) });
  un.sort((x, y) => Math.abs(y.dv) - Math.abs(x.dv));
  const far = un.filter((o) => Math.abs(o.dv) >= 0.5), shown = s.unall ? far : un.slice(0, 6);
  return (
    <Panel c="c7" title={`Unusual days${ci >= 0 ? " · " + s.cat : ""}`}>
      <div className="tablewrap" style={s.unall ? { maxHeight: 420, overflow: "auto" } : undefined}>
        <table>
          <thead><tr><th>Day</th><th className="n">Net sales</th><th className="n">Usual for that weekday</th><th>Note</th></tr></thead>
          <tbody>
            {shown.length ? shown.map((o) => (
              <tr key={o.i}><td><b>{dtxt(o.i)}</b></td><td className="n">{peso(o.v)}</td><td className="n">{peso(o.usual)}</td><td>{[o.v === 0 ? "No sales recorded" : "", XT.f[o.i] & 2 ? "Payday" : "", XT.f[o.i] & 1 ? "Holiday" : ""].filter(Boolean).join(" / ")}</td></tr>
            )) : <tr><td colSpan={4} className="empty">No days to show.</td></tr>}
          </tbody>
        </table>
      </div>
      {far.length > 6 || s.unall ? <button type="button" className="linkbtn noprint" onClick={() => set({ unall: !s.unall })}>{s.unall ? "Show only the top 6" : `Show all ${far.length} days that are 50% or more away from usual`}</button> : null}
      <div className="note">The days in this period that differ most from the usual level for that weekday (the middle value of the same weekday in the 4 weeks before and after, leaving out days with no sales).</div>
    </Panel>
  );
}
function SalesWeekday({ w, rows }) {
  const wdS = new Array(7).fill(0), wdC = new Array(7).fill(0);
  for (let i = w.a; i <= w.b; i++) wdC[wdOf(i)]++;
  rows.forEach((r) => { wdS[wdOf(r[0])] += r[3]; });
  const wd = wdS.map((v, k) => v / (wdC[k] || 1)), mx = Math.max(...wd) || 1;
  return (
    <Panel c="c5" title="Best days of the week">
      <Chart x={WD} h={200} label="Sales by weekday" yfmt={(q) => "₱" + num(q / 1000) + "k"} bars={[{ vals: wd, colors: wd.map((q) => ramp(q / mx)), labels: true, lfmt: (q) => "₱" + num(q / 1000) + "k", name: "Average net sales", fmt: peso }]} />
    </Panel>
  );
}
function SalesYearHeat({ ci }) {
  const yr = {};
  D.sales.filter((r) => ci < 0 || r[1] === ci).forEach((r) => { const d = dateOf(r[0]), y = d.getUTCFullYear(); (yr[y] || (yr[y] = new Array(12).fill(0)))[d.getUTCMonth()] += r[3]; });
  const ymx = Math.max(1, ...Object.values(yr).flat()), years = Object.keys(yr).sort(), lastM = dateOf(LAST).getUTCMonth(), lastY = dateOf(LAST).getUTCFullYear();
  const rows = years.map((y) => ({
    label: y,
    cells: yr[y].map((v, m) => {
      const part = (+y === lastY && m === lastM) || (+y === dateOf(0).getUTCFullYear() && m === dateOf(0).getUTCMonth());
      return { style: { background: v ? heatColor(v / ymx) : "var(--soft)", opacity: part ? 0.7 : undefined }, t: `${MON[m]} ${y}: ${peso(v)}${part ? " (part month)" : ""}`, text: v ? num(v / 1000) : "" };
    }),
  }));
  return <Panel c="c7" title="Sales by month and year"><Heat labelCol="44px" cols={MON} rows={rows} /></Panel>;
}

/* the uploaded Loyverse file, shown above the Sales page */
function UpSalesPanel() {
  const { up, openUpload, removeUpload } = useUI();
  if (!up) return null;
  const rc = reconcile(up.rows), top = {};
  up.rows.forEach((r) => { if (!isMgmt(r)) { const k = r.sku || r.name; top[k] = top[k] || { name: cleanName(r.name), net: 0 }; top[k].net += r.net; } });
  const topRows = Object.values(top).sort((a, b) => b.net - a.net).slice(0, 8).map((x) => [x.name, x.net]);
  const days = Object.keys(rc.up).map(Number).sort((a, b) => a - b), weekly = days.length > 120, key = (d) => (weekly ? d - ((dateOf(d).getUTCDay() + 6) % 7) : d);
  const buckets = new Map();
  days.forEach((d) => { const k = key(d), o = buckets.get(k) || { up: 0, ex: 0, hasEx: false }; o.up += rc.up[d]; if (d <= LAST && d >= 0) { o.ex += rc.ex[d] || 0; o.hasEx = true; } buckets.set(k, o); });
  const ks = [...buckets.keys()].sort((a, b) => a - b), x = ks.map((k) => fd(k)), upv = ks.map((k) => buckets.get(k).up), exv = ks.map((k) => (buckets.get(k).hasEx ? buckets.get(k).ex : null));
  const mine = up.rows.filter((r) => !isMgmt(r));
  return (
    <div className="grid" style={{ marginBottom: 14 }}>
      <div className="panel c12">
        <div className="ph"><h2>Your uploaded Loyverse file</h2><Chip tone="good">In use</Chip><button type="button" className="btn sm" onClick={openUpload}>Choose another file</button><button type="button" className="btn sm" onClick={removeUpload}>Remove file</button></div>
        <div className="note" style={{ margin: "0 0 10px" }}><b>{up.name}</b> · {fd(up.from, true)} to {fd(up.to, true)} · {up.nDays} days · {num(up.lines)} lines</div>
        <div className="kpis" style={{ marginBottom: 10 }}>
          <Kpi label="Net sales in file" value={peso(sum(mine.map((r) => r.net)))} d="" info="Sales after discounts in the uploaded file, without the Management category." />
          <Kpi label="Items sold" value={num(sum(mine.map((r) => r.items)))} d="" info="Total quantity of items in the uploaded file." />
          <Kpi label="Same as dashboard" value={rc.overlap ? `${rc.match} of ${rc.overlap}` : "–"} d={<span className="t-flat">days that overlap</span>} info="Days that the dashboard already has and that match the file's net sales within 1%." />
          <Kpi label="New days" value={num(rc.fresh)} d={<span className="t-flat">after {fd(LAST, true)}</span>} info="Days in the file that are newer than the dashboard's sales. They are checked against the forecast on the Forecast page." />
        </div>
        <div className="grid">
          <div className="panel c8" style={{ boxShadow: "none" }}>
            <div className="ph"><h2>{weekly ? "Net sales per week" : "Net sales per day"}</h2></div>
            <Chart x={x} h={230} label="Uploaded net sales" yfmt={(v) => "₱" + num(v / 1000) + "k"}
              {...(x.length > 40
                ? { lines: [{ vals: upv, color: "var(--accent)", name: "Uploaded file", fmt: peso }, { vals: exv, color: "var(--series2)", dash: true, name: "Dashboard's sales", fmt: peso }] }
                : { bars: [{ vals: upv, color: "var(--accent)", op: 0.7, name: "Uploaded file", fmt: peso }], lines: [{ vals: exv, color: "var(--series2)", dash: true, name: "Dashboard's sales", fmt: peso }] })} />
            <Legend items={[["Uploaded file", "var(--accent)"], ["Dashboard's own sales (same days)", "var(--series2)"]]} />
          </div>
          <div className="panel c4" style={{ boxShadow: "none" }}><div className="ph"><h2>Top items in the file</h2></div><BarRows items={topRows} fmt={(v) => peso(v)} color="var(--accent)" /></div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   INGREDIENT USAGE
   ===================================================================== */
function PageUse({ F }) {
  const { s, set, w, pickRow } = useUI();
  const ids = F.map((i) => i.id), single = F.length === 1, daily = w.n <= 90, unit = single ? F[0].uom : "";
  const c = (id) => (single ? 1 : BYID[id].cost), f = (v) => (single ? qty(v, unit) : peso(v));
  const fy = D.fdates.map((_, k) => sum(ids.map((id) => D.fc[id].y[k] * c(id))));
  const byIng = F.map((i) => [i.name, sum(Array.from({ length: w.n }, (_, k) => series(i.id).use[w.a + k])) * i.cost, i.id]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const last7 = sum(ids.map((id) => { let v = 0; for (let i = LAST - 6; i <= LAST; i++) v += series(id).use[i] * c(id); return v; }));
  return (
    <>
      <div className="kpis">
        <Kpi label="Used in period" value={single ? qty(sum(Array.from({ length: w.n }, (_, k) => series(F[0].id).use[w.a + k])), unit) : peso(consumedValue(ids, w.a, w.b))} d={`${w.n} days`} info="Total ingredient use in the selected period, valued at standard cost when several ingredients are shown." />
        <Kpi label="Average per day" value={f(consumedValue(ids, w.a, w.b) / w.n / (single ? F[0].cost : 1))} d={`${w.n} days`} info="Average daily use over the selected period." />
        <Kpi label="Last 7 days" value={f(last7)} d={`${fd(LAST - 6)} to ${fd(LAST)}`} info="Use in the most recent 7 days." />
        <Kpi label="Next 7 days" value={f(sum(fy.slice(0, 7)))} d="forecast, see Forecast page" info="Forecast use for the next 7 days. Details are on the Forecast page." goto="pred" />
      </div>
      <TabBar items={[["time", "Over time"], ["what", "What and which dishes"]]} value={s.utab} onChange={(v) => set({ utab: v })} />
      <div className="grid">
        {s.utab === "time" ? <UseOverTime F={F} /> : null}
        {s.utab === "what" ? (
          <>
            <Panel c="c6" title="What was used most (₱, selected period)"><HBar items={byIng} fmt={(v) => peso(v)} axis={(v) => "₱" + num(v)} name="Ingredient cost used" shade="blue" click onPick={pickRow} label="Most used ingredients" /></Panel>
            <UseDishes F={F} />
          </>
        ) : null}
      </div>
    </>
  );
}
function UseOverTime({ F }) {
  const { w } = useUI();
  const ids = F.map((i) => i.id), single = F.length === 1, daily = w.n <= 90, step = daily ? 1 : 7;
  const c = (id) => (single ? 1 : BYID[id].cost), f = (q) => (single ? qty(q, F[0].uom) : peso(q)), yf = (q) => (single ? num(q) : "₱" + num(q));
  const x = [], v = [];
  for (let st = w.a; st <= w.b; st += step) { const e = Math.min(w.b, st + step - 1); x.push(fd(st)); let t = 0; ids.forEach((id) => { for (let i = st; i <= e; i++) t += series(id).use[i] * c(id); }); v.push(t / (e - st + 1)); }
  const wd = new Array(7).fill(0), cnt = new Array(7).fill(0);
  for (let i = w.a; i <= w.b; i++) { const k = wdOf(i); cnt[k]++; ids.forEach((id) => { wd[k] += series(id).use[i] * c(id); }); }
  const wdAvg = wd.map((q, k) => q / (cnt[k] || 1)), wdMax = Math.max(...wdAvg);
  const ms = new Array(12).fill(0), mc = new Array(12).fill(0);
  for (let i = 0; i < N; i++) { const m = dateOf(i).getUTCMonth(); mc[m]++; ids.forEach((id) => { ms[m] += series(id).use[i] * c(id); }); }
  const avgM = ms.map((q, m) => q / (mc[m] || 1)), meanM = sum(avgM) / 12 || 1;
  return (
    <>
      <Panel c="c12" title={`Use over time${single ? " · " + F[0].name : " (₱)"}`}>
        <Chart x={x} label="Use over time" yfmt={yf} lines={daily
          ? [{ vals: v, color: "#93A4D6", w: 1.6, nodots: true, name: "Per day", fmt: f }, { vals: v.map((_, i) => (i < 6 ? null : sum(v.slice(i - 6, i + 1)) / 7)), color: "#D97706", w: 2.8, nodots: true, name: "7-day average", fmt: f }]
          : [{ vals: v, color: "var(--accent)", nodots: true, name: "Use", fmt: f }]} />
        <Legend items={daily ? [["Per day", "#93A4D6"], ["7-day average", "#D97706"]] : [["Average per day, by week", "var(--accent)"]]} />
      </Panel>
      <Panel c="c6" title="Busiest days of the week">
        <Chart x={WD} h={270} label="Use by weekday" yfmt={yf} bars={[{ vals: wdAvg, colors: wdAvg.map((q) => (q === wdMax ? "var(--accent)" : "#93A4D6")), labels: true, lfmt: yf, name: "Average use", fmt: f }]} lines={[{ vals: WD.map(() => sum(wd) / (sum(cnt) || 1)), color: "#D97706", dash: true, w: 1.4, nodots: true, name: "Average day", fmt: f }]} />
        <Legend items={[["Busiest day", "var(--accent)"], ["Other days", "#93A4D6"], ["Average day", "#D97706"]]} />
      </Panel>
      <Panel c="c6" title="Busy and quiet months">
        <DivCols items={MONTHS.map((nm, k) => [nm, avgM[k] / meanM - 1])} label="Busy and quiet months" up="Busier than the average month" down="Quieter than the average month" />
      </Panel>
    </>
  );
}
function UseDishes({ F }) {
  const { w } = useUI();
  const ids = F.map((i) => i.id), single = F.length === 1, sset = new Set(ids), dishAgg = new Map();
  for (const r of IS) {
    if (r[0] < w.a || r[0] > w.b) continue;
    const bo = UPL.bom[r[1]]; if (!bo) continue;
    let v = 0; for (const [ing, qb] of bo) if (sset.has(ing)) v += r[2] * qb * (single ? 1 : BYID[ing].cost);
    if (v > 0) dishAgg.set(r[1], (dishAgg.get(r[1]) || 0) + v);
  }
  const byName = new Map();
  dishAgg.forEach((v, id) => { const nm = cleanName(IT[id][0]), key = nm.toLowerCase(), c = byName.get(key); if (c) c[1] += v; else byName.set(key, [nm, v]); });
  const rows = [...byName.values()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const fm = (v) => (single ? qty(v, F[0].uom) : peso(v)), ax = (v) => (single ? num(v) : "₱" + num(v));
  return (
    <Panel c="c6" title={`Dishes that use ${single ? F[0].name : "the most ingredients"}`}>
      <HBar items={rows} fmt={fm} axis={ax} short={ax} name={single ? "Amount used" : "Ingredient cost"} shade="green" label="Dishes by ingredient cost" />
      <div className="note">From the recipes and what was sold.{single ? "" : " Pick one ingredient above to see its main dishes."}</div>
    </Panel>
  );
}

/* =====================================================================
   WASTE & SPOILAGE
   ===================================================================== */
function wasteBuckets(a, b) { // calendar months (or quarters over 2 years); a month cut by the period is labelled with the days it covers
  const months = Math.round((b - a) / 30.4), q = months > 24, keys = [], idx = {}, ma = dateOf(a), mb = dateOf(b);
  const startCut = ma.getUTCDate() > 1, endCut = dateOf(b + 1).getUTCDate() !== 1;
  const kf = (i) => {
    const d = dateOf(i), y = d.getUTCFullYear(), m = d.getUTCMonth();
    if (q) return `${y} Q${Math.floor(m / 3) + 1}`;
    let k = `${MON[m]} ${y}`;
    const first = y === ma.getUTCFullYear() && m === ma.getUTCMonth(), last = y === mb.getUTCFullYear() && m === mb.getUTCMonth();
    if (first && startCut && last && endCut) k += ` (${ma.getUTCDate()}-${mb.getUTCDate()})`; else if (first && startCut) k += ` (from ${ma.getUTCDate()} ${MON[m]})`; else if (last && endCut) k += ` (to ${mb.getUTCDate()} ${MON[m]})`;
    return k;
  };
  for (let i = a; i <= b; i++) { const k = kf(i); if (!(k in idx)) { idx[k] = keys.length; keys.push(k); } }
  return { keys, of: (i) => idx[kf(i)] };
}
const REASON_COL = ["#1E2856", "#3B82F6", "#F59E0B", "#94A3B8", "#10B981"];
const reasonName = (r) => r[0].toUpperCase() + r.slice(1).replace(/_/g, " ");
function PageWaste({ F }) {
  const { s, set, w, printBlock } = useUI();
  const set0 = new Set(F.map((i) => i.id));
  return (
    <>
      <TabBar items={[["now", "Use first"], ["lost", "What was lost"], ["slow", "Slow sellers"]]} value={s.wtab} onChange={(v) => set({ wtab: v })} />
      <div className="grid">
        {s.wtab === "now" ? <WasteNow set0={set0} printBlock={printBlock} /> : null}
        {s.wtab === "lost" ? <WasteLost set0={set0} w={w} /> : null}
        {s.wtab === "slow" ? <WasteSlow set0={set0} w={w} /> : null}
      </div>
    </>
  );
}
function WasteNow({ set0, printBlock }) {
  const best = {};
  for (const b of batchesAt(LAST)) {
    if (!set0.has(b[1]) || b[2] <= 0) continue;
    const left = b[4] - LAST, c = best[b[1]];
    if (!c || left < c.left) best[b[1]] = { id: b[1], left, qty: b[2] }; else if (left === c.left) c.qty += b[2];
  }
  const isFish = (id) => BYID[id].cat === "seafood" && /tuna|salmon/i.test(BYID[id].name);
  const useFirst = Object.values(best).sort((a, b) => a.left - b.left || isFish(b.id) - isFish(a.id)).slice(0, 8);
  const rk = riskIngredients([...set0], LAST), list = Object.entries(rk).map(([id, o]) => ({ i: BYID[id], o })).sort((a, b) => a.o.left - b.o.left);
  const lefts = [[1, "≤1 d"], [2, "2 d"], [5, "3–5 d"], [21, "6–21 d"], [60, "22–60 d"], [999, "60+ d"]], lo = [0, 1.5, 2.5, 5.5, 21.5, 61.5];
  const cell = {};
  for (const b of batchesAt(LAST)) { if (!set0.has(b[1]) || b[2] <= 0) continue; const left = b[4] - LAST, k = lefts.findIndex((l) => left <= l[0]); (cell[b[1]] || (cell[b[1]] = {}))[k] = (cell[b[1]][k] || 0) + b[2]; }
  const mrows = Object.keys(cell).map(Number).filter((id) => Object.keys(cell[id]).some((k) => +k <= 4 || BYID[id].store === "chilled"))
    .sort((a, b) => Math.min(...Object.keys(cell[a]).map(Number)) - Math.min(...Object.keys(cell[b]).map(Number))).slice(0, 14);
  const matrixRows = mrows.map((id) => ({
    label: BYID[id].name,
    cells: lefts.map((l, k) => {
      const q = cell[id][k];
      if (!q) return { style: { background: "var(--soft)" } };
      const r = riskOf(BYID[id].store, k === 0 ? 1 : Math.ceil(lo[k]));
      const bg = r === "bad" ? "var(--bad-soft)" : r === "warn" ? "var(--warn-soft)" : "var(--good-soft)", tx = r === "bad" ? "var(--bad)" : r === "warn" ? "var(--warn)" : "var(--good)";
      return { style: { background: bg, color: tx, fontWeight: 700 }, t: `${BYID[id].name} · ${qty(q, BYID[id].uom)} with ${l[1]} left`, text: qty(q, BYID[id].uom) };
    }),
  }));
  return (
    <>
      <Panel c="c12" id="p-usefirst" title="Use first today" right={<button type="button" className="linkbtn noprint" data-print="1" style={{ margin: 0 }} onClick={() => printBlock("p-usefirst", "Use first today")}>Print for the kitchen</button>}>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Ingredient</th><th className="n">Amount</th><th className="n">Days left</th><th>Dishes to push</th></tr></thead>
            <tbody>
              {useFirst.length ? useFirst.map((u) => {
                const i = BYID[u.id], r = riskOf(i.store, u.left), dishes = (D.dishes[i.id] || []).slice(0, 2).map((d) => d.name).join(", ") || "-";
                return <tr key={u.id}><td><b>{i.name}</b>{isFish(u.id) ? <> <Chip>Fish</Chip></> : null}<small>{i.store}</small></td><td className="n">{qty(u.qty, i.uom)}</td><td className="n"><Chip tone={r}>{u.left <= 0 ? "Today" : u.left + (u.left === 1 ? " day" : " days")}</Chip></td><td>{dishes}</td></tr>;
              }) : <tr><td colSpan={4} className="empty">Nothing in stock.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel c="c7" title="Close to expiry" sub="Spoilage Alert Matrix">
        {matrixRows.length ? <Heat labelCol="minmax(80px,130px)" cols={lefts.map((l) => l[1])} rows={matrixRows} /> : <Empty>No stock close to expiry.</Empty>}
      </Panel>
      <Panel c="c5" title="Dishes to push" sub="Promotional Menu Suggestion">
        <div className="promo">
          {list.length ? list.slice(0, 5).map(({ i, o }) => (
            <div className="it" key={i.id}>
              <Chip tone={o.r}>{o.r === "bad" ? "Spoil soon" : "● Watch"}</Chip> <b>{i.name}</b> · {qty(o.qty, i.uom)} {o.left <= 0 ? "that expires today" : "with " + o.left + (o.left === 1 ? " day" : " days") + " left"}<br />
              <small className="t-flat">Push: {(D.dishes[i.id] || []).slice(0, 3).map((d) => d.name).join(", ") || "no dish uses it"}</small>
            </div>
          )) : <Empty>Nothing is close to expiry.</Empty>}
        </div>
      </Panel>
    </>
  );
}
function WasteLost({ set0, w }) {
  const W = wasteIn(set0, w.a, w.b), bk = wasteBuckets(w.a, w.b);
  const byIng = {}; W.forEach((x) => { (byIng[x[1]] || (byIng[x[1]] = new Array(bk.keys.length).fill(0)))[bk.of(x[0])] += x[2]; });
  const order = Object.keys(byIng).map(Number).sort((a, b) => sum(byIng[b]) - sum(byIng[a])).slice(0, 14), mx = Math.max(1, ...order.flatMap((i) => byIng[i]));
  const heatRows = order.map((i) => ({ label: BYID[i].name, title: BYID[i].name, cells: byIng[i].map((v, c) => ({ style: { background: v ? heatColor(v / mx) : "var(--soft)" }, t: `${BYID[i].name} · ${bk.keys[c]}: ${peso(v)}`, text: v >= 1 ? (bk.keys.length > 14 ? "" : num(v)) : "" })) }));
  const bks = w.n <= 90 ? weeksFrom(w.a, w.b) : monthsFrom(w.a, w.b, false), ids3 = [...set0];
  const wv = bks.map((b) => sum(wasteIn(set0, b.a, b.b).map((x) => x[2]))), pv = bks.map((b) => purchaseValue(ids3, b.a, b.b)), share = wv.map((v, i) => (pv[i] ? (v / pv[i]) * 100 : 0));
  const ingTot = Object.keys(byIng).map((id) => [BYID[id].name, sum(byIng[id])]).sort((a, b) => b[1] - a[1]), wTotal = sum(ingTot.map((x) => x[1]));
  const rsn = D.reasons.map((r, k) => ({ name: reasonName(r), vals: bk.keys.map(() => 0), color: REASON_COL[k % 5] }));
  W.forEach((x) => { if (rsn[x[4]]) rsn[x[4]].vals[bk.of(x[0])] += x[2]; });
  const rsnUsed = rsn.filter((r) => sum(r.vals) > 0).slice(0, 5);
  return (
    <>
      <Panel c="c7" title="Waste by ingredient (₱)">{heatRows.length ? <Heat labelCol="minmax(80px,130px)" cols={bk.keys} rows={heatRows} /> : <Empty>No recorded waste in this period.</Empty>}</Panel>
      <Panel c="c5" title="Waste as a share of purchases" right={<Info tip="How much of what was bought ended up as waste, in each period. Lower is better." />}>
        <Chart x={bks.map((b) => b.label)} h={300} label="Waste as a share of purchases" yfmt={(v) => num(v, 0) + "%"} lines={[{ vals: share, color: "var(--accent)", name: "Share of purchases", fmt: (v) => v.toFixed(1) + "%" }]} />
      </Panel>
      <Panel c="c6" title="Where most of the waste comes from">
        {ingTot.length > 1 ? <Pareto items={ingTot.slice(0, 12)} w={560} total={wTotal} fmt={peso} axis={(v) => "₱" + num(v)} name="Waste" label="Waste by ingredient with running share" /> : <Empty>Choose more than one ingredient to see which ones cause most of the waste.</Empty>}
      </Panel>
      <Panel c="c6" title="Why it was lost" right={<Info tip="Each column is one period. The colors show the reasons, so you see the total lost and what caused it. Hover for amounts." />}>
        {rsnUsed.length > 1 ? <StackCols keys={bk.keys} series={rsnUsed.map((r) => ({ ...r, name: r.name + " · " + peso(sum(r.vals)) }))} w={560} fmt={peso} axis={(v) => "₱" + num(v)} label="Waste by reason" /> : <Empty>Only one reason was recorded in this period.</Empty>}
      </Panel>
    </>
  );
}
function WasteSlow({ set0, w }) {
  const soldBy = new Map();
  for (const r of IS) { if (r[0] < w.a || r[0] > w.b) continue; soldBy.set(r[1], (soldBy.get(r[1]) || 0) + r[2]); }
  const dishMap = new Map();
  Object.keys(IT).forEach((k) => {
    const id = +k, it = IT[id]; if (!it[2]) return;
    const bo = UPL.bom[id]; if (!bo) return;
    const use = bo.map((x) => x[0]).filter((i) => set0.has(i)); if (!use.length) return;
    const nm = cleanName(it[0]), key = nm.toLowerCase(), o = dishMap.get(key) || { name: nm, sold: 0, ings: new Set() };
    o.sold += soldBy.get(id) || 0; use.forEach((i) => o.ings.add(i)); dishMap.set(key, o);
  });
  const chilledN = (o) => [...o.ings].filter((i) => BYID[i].store === "chilled").length;
  const slow = [...dishMap.values()].sort((a, b) => a.sold - b.sold || chilledN(b) - chilledN(a)).slice(0, 8);
  return (
    <Panel c="c12" title="Slow sellers that use ingredients that spoil">
      <div className="tablewrap">
        <table>
          <thead><tr><th>Dish</th><th className="n">Sold in this period</th><th>Uses</th></tr></thead>
          <tbody>
            {slow.length ? slow.map((o) => {
              const names = [...o.ings].sort((a, b) => (BYID[b].store === "chilled") - (BYID[a].store === "chilled")).map((i) => BYID[i].name + (BYID[i].store === "chilled" ? " (chilled)" : ""));
              return <tr key={o.name}><td><b>{o.name}</b></td><td className="n">{o.sold ? num(o.sold) : "None"}</td><td>{names.slice(0, 3).join(", ")}{names.length > 3 ? ` +${names.length - 3} more` : ""}</td></tr>;
            }) : <tr><td colSpan={3} className="empty">No dishes to show.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="note">{[...dishMap.values()].filter((o) => o.sold === 0).length} of {dishMap.size} dishes sold none in this period. Fewest sold first; ties go to dishes with more chilled ingredients. Order a little less of those ingredients, or push the dish.</div>
    </Panel>
  );
}

/* =====================================================================
   INVENTORY
   ===================================================================== */
const coverDays = (i) => Math.min(i.shelf, 14);
function invStatus(close, i) {
  const u = consumedValue([i.id], LAST - 27, LAST) / 28 / i.cost, d = u > 0 ? close / u : 99;
  const ds = D.deliveries.filter((x) => x[0] === i.id).map((x) => idxOf(x[3])).filter((x) => x > LAST), wait = ds.length ? Math.min(...ds) - LAST : Math.max(1, i.lead);
  return { d, u, below: u * (i.lead + 1), par: u * (i.interval + i.lead + 1), r: close <= 0 ? "bad" : d < wait ? "warn" : "good" };
}
function PageInv({ F }) {
  const { s, set, w, pickRow, toast } = useUI();
  const ids = F.map((i) => i.id);
  const invAll = F.map((i) => { const close = series(i.id).close[LAST]; return { i, close, st: invStatus(close, i) }; });
  const sev = { bad: 0, warn: 1, good: 2 };
  const todo = (e) => (e.st.r === "bad" ? "Buy now" : e.st.r === "warn" ? "Buy before the delivery" : e.close > e.st.par * 1.5 ? "Hold back orders" : "OK");
  const tableRows = invAll.slice().sort((a, b) => sev[a.st.r] - sev[b.st.r] || a.st.d - b.st.d).slice(0, 14);
  const bul = invAll.slice().sort((a, b) => a.st.d - b.st.d).slice(0, 12).map((e) => ({ i: e.i, days: Math.min(e.st.d, 30), re: e.i.lead + 1, par: e.i.interval + e.i.lead + 1 }));
  const exportStock = () => downloadCsv("makisushi_stock.csv", [["Ingredient", "On hand", "Unit", "Value (PHP)", "Daily use", "Days left", "Order when below", "Target stock", "Status", "What to do"],
    ...invAll.map((e) => [e.i.name, Math.round(e.close), e.i.uom, Math.round(e.close * e.i.cost), e.i.uom === "pc" ? Math.round(e.st.u) : Math.round(e.st.u * 10) / 10, e.st.d >= 99 ? "" : Math.round(e.st.d), Math.round(e.st.below), Math.round(e.st.par), e.st.r === "good" ? "OK" : e.st.r === "warn" ? "Short before delivery" : "Ran out", todo(e)])], toast);
  const catCol = {}; [...new Set(F.map((i) => i.cat))].sort().forEach((c, k) => { catCol[c] = PAL[k % PAL.length]; });
  const tmAll = Object.keys(catCol).map((c) => ({ name: cap1(c), color: catCol[c], items: F.filter((i) => i.cat === c).map((i) => [i.name, Math.max(0, series(i.id).close[LAST]) * i.cost]) }));
  const gsum = (g) => sum(g.items.map((i) => i[1])), tmTot = sum(tmAll.map(gsum)) || 1;
  const tmSmall = tmAll.filter((g) => gsum(g) / tmTot < 0.02), tmGroups = tmAll.filter((g) => !tmSmall.includes(g)).concat(tmSmall.length ? [{ name: "Other small items", color: "#94A3B8", items: tmSmall.flatMap((g) => g.items) }] : []);
  let hist = null;
  if (s.itab === "history") {
    const st0 = w.a, step = w.n > 120 ? 7 : 1, xs = [], vs = [];
    for (let i = st0; i <= w.b; i += step) { xs.push(fd(i)); vs.push(sum(ids.map((id) => series(id).close[i] * BYID[id].cost))); }
    const sm = monthsFrom(Math.max(0, LAST - 730), LAST, false).slice(-24), set2 = new Set(ids);
    hist = { xs, vs, mx: sm.map((m) => m.label), mv: sm.map((m) => D.so.filter((e) => e[0] >= m.a && e[0] <= m.b && set2.has(e[1])).length) };
  }
  return (
    <>
      <TabBar items={[["stock", "Stock levels"], ["history", "Over time"]]} value={s.itab} onChange={(v) => set({ itab: v })} />
      <div className="grid">
        {hist ? (
          <>
            <Panel c="c6" title="Stock value over time"><Chart x={hist.xs} h={210} label="Stock value over time" yfmt={(v) => "₱" + num(v / 1000) + "k"} lines={[{ vals: hist.vs, color: "var(--accent)", name: "Stock value", fmt: peso }]} /></Panel>
            <Panel c="c6" title="Times an ingredient ran out, by month"><Chart x={hist.mx} h={210} label="Ran out by month" yfmt={num} bars={[{ vals: hist.mv, color: "var(--bad)", op: 0.8, name: "Times ran out", fmt: num }]} /></Panel>
          </>
        ) : (
          <>
            <Panel c="c12" title="Days of stock against order level and target">
              <HBar items={bul.map((r) => [r.i.name, r.days, r.i.id])} w={760} click onPick={pickRow} axis={(v) => num(v) + " d"} short={(v) => daysTxt(v) + " d"} name="Days of stock now" label="Days of stock"
                marks={[{ vals: bul.map((r) => r.re), color: "var(--bad)", name: "Order when below" }, { vals: bul.map((r) => r.par), color: "#F59E0B", name: "Target stock" }]} />
            </Panel>
            <Panel c="c12" title="Where the stock money sits">
              {F.length > 3 ? <Treemap groups={tmGroups} w={760} h={300} fmt={peso} label="Stock value by ingredient" /> : <Empty>Choose more ingredients to see how the stock value is shared.</Empty>}
              <div className="note">Each box is one ingredient. Bigger box, more money tied up in stock. Colors group the ingredients by type. For exact amounts, see the Value column in the table below.</div>
            </Panel>
            <Panel c="c12" title="Stock on hand and target levels" right={<button type="button" className="linkbtn" data-export="1" style={{ margin: 0 }} onClick={exportStock}>Export</button>}>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Ingredient</th><th className="n">On hand</th><th className="n">Value</th><th className="n">Daily use</th><th className="n">Lasts about</th><th className="n">Order when below</th><th className="n">Target stock (par)</th><th>Status</th></tr></thead>
                  <tbody>
                    {tableRows.length ? tableRows.map((e) => (
                      <tr key={e.i.id}>
                        <td><b>{e.i.name}</b></td><td className="n">{qty(e.close, e.i.uom)}</td><td className="n">{peso(e.close * e.i.cost)}</td><td className="n">{qty(e.st.u, e.i.uom)}</td>
                        <td className="n">{e.st.d >= 99 ? "–" : daysTxt(e.st.d) + " d"}</td><td className="n">{qty(e.st.below, e.i.uom)}</td><td className="n">{qty(e.st.par, e.i.uom)}</td>
                        <td><Chip tone={e.st.r}>{e.st.r === "good" ? "✔ OK" : e.st.r === "warn" ? "⚠ Short before delivery" : "Ran out"}</Chip><small>{todo(e)}</small></td>
                      </tr>
                    )) : <tr><td colSpan={8} className="empty">No ingredients match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="note">Rules of thumb from recent use. Review them monthly.</div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
/* Running-out warning + extra stock (shown on Purchasing > Stock plan) */
function RiskPanels({ F }) {
  const { s, set, pickRow } = useUI();
  const ids = F.map((i) => i.id), fdays = D.fdates.length;
  const ex = F.map((i) => { const close = series(i.id).close[LAST], keep = sum(D.fc[i.id].y.slice(0, Math.min(coverDays(i), fdays))) * s.wi; return { i, val: Math.max(0, close - keep) * i.cost }; });
  const exVal = sum(ex.map((e) => e.val)), stockVal = stockValue(ids, LAST), frac = stockVal ? exVal / stockVal : 0;
  const top = ex.filter((e) => e.val > 0).sort((a, b) => b.val - a.val).slice(0, 6);
  const sel = BYID[s.sel] && ids.includes(s.sel) ? BYID[s.sel] : F[0];
  let body = <Empty>Pick an ingredient to see its stock outlook.</Empty>;
  if (sel) {
    const y = D.fc[sel.id].y.map((v) => v * s.wi), start = series(sel.id).close[LAST], del = new Array(fdays).fill(0);
    D.deliveries.filter((x) => x[0] === sel.id).forEach((x) => { const k = idxOf(x[3]) - LAST - 1; if (k >= 0 && k < fdays) del[k] += x[4]; });
    let a = start, b = start; const without = [], withp = [];
    for (let k = 0; k < fdays; k++) { a -= y[k]; b = b - y[k] + del[k]; without.push(Math.max(a, 0)); withp.push(Math.max(b, 0)); }
    const firstBelow = (withDel) => { let c = start; for (let k = 0; k < fdays; k++) { c = c - y[k] + (withDel ? del[k] : 0); if (c < 0) return k; } return -1; };
    const runOut = firstBelow(false), covered = firstBelow(true);
    const plan1 = D.plan.find((p) => p.ing === sel.id && p.week === 1), firstArr = D.deliveries.filter((x) => x[0] === sel.id).sort((p, q) => (p[3] < q[3] ? -1 : 1))[0];
    const xs = D.fdates.map(fiso), fq = (v) => qty(v, sel.uom);
    body = (
      <>
        {runOut < 0 ? <div className="banner good">✔ <span><b>{sel.name}</b> has enough stock for the next {fdays} days.</span></div>
          : covered < 0 ? <div className="banner warn">⚠ <span><b>{sel.name}</b> would run out on <b>{xs[runOut]}</b> without a new order. Order <b>{plan1 && plan1.qty ? qty(plan1.qty, sel.uom) : "per the list"}</b>{firstArr ? ", arriving " + fiso(firstArr[3]) : ""}, and stock stays above zero.</span></div>
            : <div className="banner bad"><span><b>{sel.name}</b> runs out on <b>{xs[covered]}</b> even with the planned orders. Add an order or an early top-up.</span></div>}
        <Chart x={xs} h={250} label="Projected stock and forecast use" yfmt={(v) => fq(v).replace(/ (g|pcs|servings)$/, "")} shade={[0, sel.lead, `${sel.lead}-day wait for delivery`]}
          bars={[{ vals: y, color: "var(--warn)", op: 0.55, name: "Forecast use", fmt: fq }]}
          lines={[{ vals: without, color: "var(--series2)", dash: true, name: "Without new orders", fmt: fq }, { vals: withp, color: "var(--accent)", name: "With recommended orders", fmt: fq }]} />
        <Legend items={[["Stock without new orders", "var(--series2)"], ["Stock with recommended orders", "var(--accent)"], ["Forecast use per day", "var(--warn)"]]} />
      </>
    );
  }
  return (
    <>
      <Panel c="c7" title="Running-out warning" sub="Stockout Risk Warning" right={
        <>
          <span className="t-flat" style={{ fontSize: 12 }}>If use is</span>
          <Seg label="What if use differs from the forecast" items={[[0.8, "20% less"], [1, "As forecast"], [1.2, "20% more"], [1.4, "40% more"]]} value={s.wi} onChange={(v) => set({ wi: v })} />
          <Field label="Ingredient"><Dropdown label="Ingredient" value={sel ? sel.id : ""} options={F.map((i) => ({ value: i.id, label: i.name }))} onChange={(v) => set({ sel: +v })} /></Field>
        </>
      }>{body}</Panel>
      <Panel c="c5" title="Extra stock" sub="Excess Capital Gauge">
        <MeterBar value={exVal} cap={stockVal} big={peso(exVal)} sub={`${pct(frac, 0)} of the ${peso(stockVal)} in stock is more than the forecast needs`} warn={0.2} bad={0.4} />
        <div className="note">{frac >= 0.4 ? "Hold back orders for the items below." : frac >= 0.2 ? "Order a little less of the items below next time." : "The stock level is healthy."}</div>
        <div style={{ marginTop: 10 }}><HBar items={top.map((e) => [e.i.name, e.val, e.i.id])} w={480} shade="amber" click onPick={pickRow} axis={(v) => "₱" + num(v)} name="Stock above what the forecast needs" label="Extra stock by ingredient" /></div>
      </Panel>
    </>
  );
}

/* a labelled control inside a panel header (not a <label>, so clicks in an open menu never re-toggle it) */
function Field({ label, children }) {
  return <div className="fld"><span>{label}</span>{children}</div>;
}

/* =====================================================================
   PURCHASING
   ===================================================================== */
const TONE = { a: "Action", b: "Alert", w: "Review", g: "OK" };
function ActionCard({ k, cls, title, main, sub, goto }) {
  const { go } = useUI();
  return (
    <button type="button" className={`k${k} ${cls}`} onClick={() => go(goto)}>
      <div className="h"><span className="num">{k}</span>{title}<span className={`st ${cls === "g" ? "ok" : cls === "b" ? "alert" : ""}`}>{TONE[cls]}</span></div>
      <div className="m">{main}</div>
      <div className="s">{sub}</div>
      <span className="go">Open {NAVN[goto]} <span aria-hidden="true">→</span></span>
    </button>
  );
}
function TodayActions({ F }) {
  const ids = F.map((i) => i.id), set = new Set(ids), fdays = D.fdates.length;
  const buys = D.plan.filter((p) => p.week === 1 && set.has(p.ing) && p.qty > 0 && p.rule !== "daily market buy").sort((a, b) => b.cost - a.cost), buyCost = sum(buys.map((p) => p.cost));
  const names = (arr, n = 3) => arr.slice(0, n).join(", ") + (arr.length > n ? ` +${arr.length - n} more` : "");
  const outs = F.map((i) => {
    let c = series(i.id).close[LAST]; const y = D.fc[i.id].y, del = new Array(fdays).fill(0);
    D.deliveries.filter((x) => x[0] === i.id).forEach((x) => { const k = idxOf(x[3]) - LAST - 1; if (k >= 0 && k < fdays) del[k] += x[4]; });
    for (let k = 0; k < fdays; k++) { c = c - y[k] + del[k]; if (c < 0) return { i, k }; }
    return null;
  }).filter(Boolean).sort((a, b) => a.k - b.k);
  const rk = Object.entries(riskIngredients(ids, LAST)).map(([id, o]) => ({ i: BYID[id], o })).sort((a, b) => a.o.left - b.o.left);
  const ex = F.map((i) => ({ i, v: Math.max(0, series(i.id).close[LAST] - sum(D.fc[i.id].y.slice(0, Math.min(coverDays(i), fdays)))) * i.cost })).filter((e) => e.v > 0).sort((a, b) => b.v - a.v);
  return (
    <div className="todo" aria-label="Today's actions">
      <ActionCard k={1} cls={buys.length ? "a" : "g"} title="Buy" goto="buy"
        main={buys.length ? <>{buys.length} ingredients · <span className="amt">{peso(buyCost)}</span></> : "Nothing to order"}
        sub={buys.length ? names(buys.map((p) => BYID[p.ing].name)) : "Stock covers this week."} />
      <ActionCard k={2} cls={outs.length ? "b" : "g"} title="Watch" goto="inv"
        main={outs.length ? `${outs.length} could still run out` : "Nothing should run out"}
        sub={outs.length ? names(outs.map((o) => `${o.i.name} (${fiso(D.fdates[o.k])})`)) + " even with the planned orders." : `Covered for ${fdays} days if you place the planned orders.`} />
      <ActionCard k={3} cls={rk.length ? "w" : "g"} title="Use or promote" goto="waste"
        main={rk.length ? `${rk.length} close to expiry` : "Nothing close to expiry"}
        sub={rk.length ? names(rk.map((r) => r.i.name)) : "Stock is fresh."} />
      <ActionCard k={4} cls={ex.length && ex[0].v > 500 ? "w" : "g"} title="Trim orders" goto="inv"
        main={ex.length ? <><span className="amt">{peso(sum(ex.map((e) => e.v)))}</span> extra stock</> : "Stock matches forecast"}
        sub={ex.length ? "Most extra: " + names(ex.map((e) => e.i.name), 2) : ""} />
    </div>
  );
}
function PageBuy({ F }) {
  const { s, set } = useUI();
  return (
    <>
      <TodayActions F={F} />
      <TabBar items={[["orders", "Orders"], ["plan", "Stock plan"], ["prices", "Price list"], ["spend", "Spend and method"]]} value={s.btab} onChange={(v) => set({ btab: v })} />
      {s.btab === "orders" ? <BuyOrders F={F} /> : null}
      {s.btab === "plan" ? <div className="grid"><RiskPanels F={F} /><WeeklyStockPlan F={F} /><Panel c="c12" title="The next 14 days"><Calendar14 /></Panel></div> : null}
      {s.btab === "prices" ? <div className="grid"><PriceList F={F} /></div> : null}
      {s.btab === "spend" ? <><OpsKpis F={F} /><BuySpend F={F} /></> : null}
    </>
  );
}
function BuyOrders({ F }) {
  const { s, set, toast, isDone, toggleOrder, printBlock } = useUI();
  const idset = new Set(F.map((i) => i.id)), bud = M.budget[s.scen], wkb = wk(bud), bc = D.opt.budget_check;
  const bcMonth = bc ? new Date(Date.UTC(+bc.month.slice(0, 4), +bc.month.slice(5, 7) - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" }) : "";
  const wkName = s.week === 1 ? "this week" : "next week";
  const wkSpend = sum(D.plan.filter((p) => idset.has(p.ing) && p.week === s.week).map((p) => p.cost));
  const arrive = (p) => { const d = D.deliveries.filter((x) => x[0] === p.ing && x[1] === p.week).sort((a, b) => (a[3] < b[3] ? -1 : 1))[0]; return d ? fiso(d[3]) : null; };
  const groups = {};
  D.plan.filter((p) => p.week === s.week && idset.has(p.ing)).forEach((p) => { const i = BYID[p.ing]; (groups[i.sup] || (groups[i.sup] = { sup: i, rows: [] })).rows.push({ p, i }); });
  let nOrd = 0, nDone = 0, hiddenN = 0; const expRows = [];
  const blocks = Object.values(groups).map((g) => {
    const rows = g.rows.sort((a, b) => (b.p.qty > 0) - (a.p.qty > 0) || b.p.cost - a.p.cost), orders = rows.filter((r) => r.p.qty > 0), shown = s.allrows ? rows : orders;
    hiddenN += rows.length - orders.length;
    if (!shown.length) return null;
    const total = sum(orders.map((r) => r.p.cost)), nxt = nextDelivery(rows.map((r) => r.i.id), s.week), lead = g.sup.lead, walk = isWalkin(g.sup);
    const msgOrders = orders.filter((r) => r.p.rule !== "daily market buy");
    nOrd += orders.length;
    const msg = !msgOrders.length ? "" : walk
      ? `Grocery list - ${g.sup.supname}${nxt === null ? "" : " (buy on " + dtxt(nxt) + ")"}\n` + msgOrders.map((r) => `[ ] ${r.i.name}: ${r.p.packs} x ${qty(r.i.pack, r.i.uom)} (${qty(r.p.qty, r.i.uom)} in total)`).join("\n") + orders.filter((r) => r.p.rule === "daily market buy").map((r) => `\n[ ] ${r.i.name}: about ${qty(r.p.qty, r.i.uom)} for the week (buy fresh each day)`).join("")
      : `Hello ${g.sup.supname}, this is Makisushi. We would like to order for delivery ${nxt === null ? "as soon as possible" : "on " + dtxt(nxt)}:\n` + msgOrders.map((r) => `- ${r.p.packs} x ${qty(r.i.pack, r.i.uom)} ${r.i.name}`).join("\n") + "\nThank you!";
    const when = nxt === null ? "" : walk ? ` · next shopping trip ${dtxt(nxt)}` : ` · next delivery ${dtxt(nxt)}, ${lead > 0 ? "order by " + dtxt(nxt - lead) : "order the same day"}`;
    const items = shown.map(({ p, i }) => {
      const buy = p.qty > 0, daily = p.rule === "daily market buy", a = arrive(p), done = buy && isDone(p);
      if (done) nDone++;
      const onHand = series(i.id).close[LAST], u = consumedValue([i.id], LAST - 27, LAST) / 28 / i.cost, daysLast = u > 0 ? onHand / u : 99;
      const prevEnd = s.week === 2 ? (D.plan.find((x) => x.ing === i.id && x.week === 1) || {}).end || 0 : 0;
      const why = daily ? `Fresh produce bought at the market each day. Expected use ${wkName}: ${qty(p.demand, i.uom)}.`
        : !buy ? (s.week === 1 ? `Enough stock. ${qty(onHand, i.uom)} on hand lasts about ${daysTxt(daysLast)} days, and expected use ${wkName} is ${qty(p.demand, i.uom)}.` : `The stock left after this week's plan (${qty(prevEnd, i.uom)}) covers next week's expected use of ${qty(p.demand, i.uom)}.`)
          : (s.week === 1 ? `${qty(onHand, i.uom)} on hand lasts about ${daysTxt(daysLast)} days. ` : `Stock left after this week's plan: ${qty(prevEnd, i.uom)}. `) + `Expected use ${wkName}: ${qty(p.demand, i.uom)}. ${a ? (walk ? "Buy it on " : "Delivery arrives ") + a + ". " : ""}About ${qty(p.end, i.uom)} would be left as a cushion.`;
      if (buy) expRows.push([g.sup.supname, g.sup.contact, i.name, daily ? "" : p.packs, daily ? "" : Math.round(i.pack), Math.round(p.qty), i.uom, Math.round(p.cost), a || "", s.week, daily ? "buy fresh at the market" : walk ? "buy in store" : "order from supplier"]);
      return (
        <tr key={p.ing} className={`${buy ? "" : "mute"} ${done ? "done" : ""}`}>
          <td className="chk noprint">{buy ? <input type="checkbox" checked={done} onChange={() => toggleOrder(p)} aria-label={`${walk ? "Bought" : "Ordered"} ${i.name}`} /> : null}</td>
          <td><b>{i.name}</b><small>{i.store}</small></td>
          <td>{!buy ? <Chip>No order needed</Chip>
            : daily ? <><b>{qty(p.qty, i.uom)}</b> <Chip tone="good">Buy fresh at the market</Chip> <small>for the week · {peso(p.cost)} · buy a little each day</small></>
              : <><b>{p.packs} × {qty(i.pack, i.uom)}</b> <small>{qty(p.qty, i.uom)} · {peso(p.cost)}{a ? (walk ? " · buy on " : " · arrives ") + a : ""}</small></>}</td>
          <td className="n">{walk ? "Walk-in" : i.lead === 0 ? "Same day" : i.lead + (i.lead === 1 ? " day" : " days")}</td>
          <td><details className="why"><summary>Why?</summary><div>{why}</div></details></td>
        </tr>
      );
    });
    return {
      total,
      node: (
        <React.Fragment key={g.sup.sup}>
          <tr className="sup"><td colSpan={5}><div className="suphead">
            <span><b>{g.sup.supname}</b> · {walk ? "walk-in grocery" : g.sup.contact}<small>{orders.length} to {walk ? "buy" : "order"} · {peso(total)}{when}</small></span>
            {msg ? <button type="button" className="linkbtn noprint" data-copy="1" onClick={() => copyText(msg, walk, toast)}>{walk ? "Copy shopping list" : "Copy message"}</button> : null}
          </div></td></tr>
          {items}
        </React.Fragment>
      ),
    };
  }).filter(Boolean).sort((a, b) => b.total - a.total);
  const exportOrders = () => downloadCsv("makisushi_orders.csv", [["Supplier", "Contact", "Ingredient", "Packs", "Pack size", "Quantity", "Unit", "Cost (PHP)", "Date", "Week", "How"], ...expRows], toast);
  return (
    <div className="grid">
      <div className="panel c8" id="p-order">
        <div className="ph">
          <h2>Supplier orders</h2>
          <Chip tone={nOrd && nDone === nOrd ? "good" : "flat"} className="noprint">Done {nDone} of {nOrd}</Chip>
          <Seg className="noprint" label="Week" items={[[1, `This week · from ${fiso(M.plan_start)}`], [2, "Next week"]]} value={s.week} onChange={(v) => set({ week: v })} />
          <button type="button" className="linkbtn noprint" data-print="1" style={{ margin: 0 }} onClick={() => printBlock("p-order", "Supplier orders")}>Print</button>
          <button type="button" className="linkbtn noprint" data-export="1" style={{ margin: 0 }} onClick={exportOrders}>Export</button>
        </div>
        <div className="tablewrap" style={{ maxHeight: 660, overflow: "auto" }}>
          <table>
            <thead><tr><th className="noprint" /><th>Ingredient</th><th>Order quantity</th><th className="n">Lead time</th><th>Why this order?</th></tr></thead>
            <tbody>{blocks.length ? blocks.map((b) => b.node) : <tr><td colSpan={5} className="empty">No ingredients match these filters.</td></tr>}</tbody>
          </table>
        </div>
        {hiddenN || s.allrows ? <button type="button" className="linkbtn noprint" onClick={() => set({ allrows: !s.allrows })}>{s.allrows ? "Show only ingredients to order" : `Show ${hiddenN} with no order needed`}</button> : null}
      </div>
      <div className="stack c4">
        <Panel c="" title="Budget" right={<Info tip="The plan is made so that spending never goes over the monthly budget." />}>
          <MeterBar value={wkSpend} cap={wkb} big={peso(wkSpend)} sub={`${wkName}, of ${peso(wkb)} a week`} />
          {bc ? <MeterBar value={bc.month_total_php} cap={bc.monthly_budget_php} big={peso(bc.month_total_php)} sub={`${bcMonth} so far plus this plan, of ${peso(bc.monthly_budget_php)}`} /> : null}
          <div className="note">{bc ? `${peso(bc.headroom_php)} left in ${bcMonth}.` : ""}</div>
        </Panel>
      </div>
    </div>
  );
}
function BuySpend({ F }) {
  const { s, set } = useUI();
  const bud = M.budget[s.scen], wkb = wk(bud), O = D.opt, dsg = D.designs, cur = dsg[s.design] || dsg[1], h0 = dsg[0], bc = O.budget_check;
  const bcMonth = bc ? new Date(Date.UTC(+bc.month.slice(0, 4), +bc.month.slice(5, 7) - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" }) : "";
  const ms = weeksFrom(Math.max(0, LAST - 26 * 7 + 1), LAST).filter((m) => m.b - m.a === 6), ids = F.map((i) => i.id), v = ms.map((m) => purchaseValue(ids, m.a, m.b));
  const better = (a, b, low) => ((low ? b < a : b > a) ? "w" : "");
  const wksN = (idxOf(O.window.slice(-10)) - idxOf(O.window.slice(0, 10)) + 1) / 7;
  const rowsCmp = [
    ["Ran out (times)", h0.episodes, cur.episodes, true, (x) => x],
    ["Orders filled", h0.fill, cur.fill, false, (x) => pct(x, 2)],
    ["Waste, total", h0.waste, cur.waste, true, peso],
    ["Waste per week", h0.waste / wksN, cur.waste / wksN, true, peso],
    ["Waste share of purchases", h0.waste / h0.purchases, cur.waste / cur.purchases, true, (x) => pct(x)],
    ["Stock used up (times a month)", h0.turns, cur.turns, false, (x) => x.toFixed(1)],
    ["Purchases", h0.purchases, cur.purchases, true, peso],
  ];
  return (
    <div className="grid">
      <Panel c="c12" title="Weekly spend vs budget">
        <Chart x={ms.map((m) => m.label)} h={230} label="Weekly spend against budget" yfmt={(q) => "₱" + num(q / 1000) + "k"}
          bars={[{ vals: v, colors: v.map((q) => (q > wkb ? "#F59E0B" : "var(--accent)")), name: "Spend", fmt: peso }]}
          lines={[{ vals: ms.map(() => wkb), color: "#DC2626", dash: true, w: 1.6, nodots: true, name: "Budget", fmt: peso }]} />
        <Legend items={[["Spend in the week", "var(--accent)"], ["Over budget", "#F59E0B"], [`Weekly budget (${s.scen})`, "#DC2626"]]} />
      </Panel>
      <Panel c="c5" title="How the plan is made" right={<Chip tone="good">In use</Chip>}>
        <dl className="facts">
          <dt>Plans</dt><dd>{O.method}: the best order for every ingredient, each week</dd>
          <dt>Goal</dt><dd>Least waste and least running out</dd>
          <dt>Cushion</dt><dd>Enough stock to cover demand {Math.round(O.service * 100)} days out of 100</dd>
          <dt>Budget</dt><dd>{peso(wkb)} a week, {peso(bud)} a month ({s.scen})</dd>
          {bc ? <><dt>Budget check</dt><dd>{peso(bc.month_total_php)} of {peso(bc.monthly_budget_php)} spent in {bcMonth} by the end of the plan</dd></> : null}
          <dt>Plan covers</dt><dd>{O.horizon} weeks from {fiso(O.plan_start)}</dd>
          <dt>Result</dt><dd>{O.status}</dd>
        </dl>
      </Panel>
      <Panel c="c7" title="Compare ordering styles" right={<Field label="Style"><Dropdown label="Style" value={s.design} options={dsg.map((d, k) => ({ value: k, label: d.label }))} onChange={(v2) => set({ design: +v2 })} /></Field>}>
        <div className="cmp">
          <span className="h" /><span className="h">Historical</span><span className="h">Selected</span>
          {rowsCmp.map(([lab, a, b, low, f]) => (
            <React.Fragment key={lab}><span>{lab}</span><span className="r">{f(a)}</span><span className={`r ${better(a, b, low)}`}>{f(b)}</span></React.Fragment>
          ))}
        </div>
      </Panel>
    </div>
  );
}
function PriceList({ F }) {
  const { toast } = useUI();
  const per = (i) => (i.uom === "g" ? [i.cost * 1000, "kg"] : i.uom === "ml" ? [i.cost * 1000, "litre"] : [i.cost, i.uom === "pc" ? "piece" : i.uom]);
  const groups = {}; F.forEach((i) => (groups[i.sup] || (groups[i.sup] = { s: i, rows: [] })).rows.push(i));
  const exp = [["Supplier", "Contact", "Ingredient", "Pack", "Price per pack (PHP)", "Price per unit (PHP)", "Unit", "Minimum order (packs)", "Delivery"]];
  const body = Object.values(groups).sort((a, b) => (a.s.supname < b.s.supname ? -1 : 1)).map((g) => {
    const walk = isWalkin(g.s), wait = (i) => (walk ? "Walk-in" : i.lead === 0 ? "Same day" : i.lead + (i.lead === 1 ? " day" : " days") + " after ordering");
    return (
      <React.Fragment key={g.s.sup}>
        <tr className="sup"><td colSpan={6}><div className="suphead"><span><b>{g.s.supname}</b> · {walk ? "walk-in grocery" : g.s.contact}<small>{g.rows.length} {g.rows.length === 1 ? "item" : "items"}{walk ? "" : " · delivers " + (g.s.interval === 1 ? "every day" : "every " + g.s.interval + " days")}</small></span></div></td></tr>
        {g.rows.slice().sort((a, b) => (a.name < b.name ? -1 : 1)).map((i) => {
          const [pu, un] = per(i), pp = i.cost * i.pack;
          exp.push([g.s.supname, g.s.contact, i.name, qty(i.pack, i.uom), Math.round(pp * 100) / 100, Math.round(pu * 100) / 100, un, i.minpacks, wait(i)]);
          return <tr key={i.id}><td><b>{i.name}</b><small>{i.store}</small></td><td>{qty(i.pack, i.uom)}</td><td className="n"><b>{peso(pp, pp < 100 ? 2 : 0)}</b></td><td className="n">{peso(pu, pu < 100 ? 2 : 0)} <small>per {un}</small></td><td className="n">{i.minpacks} {i.minpacks === 1 ? "pack" : "packs"}</td><td>{wait(i)}</td></tr>;
        })}
      </React.Fragment>
    );
  });
  return (
    <Panel c="c12" title="Price list" right={<><Info tip="The standard price of each ingredient and how it is sold. The purchasing plan uses these prices to cost every order." /><button type="button" className="linkbtn noprint" data-export="1" style={{ margin: 0 }} onClick={() => downloadCsv("makisushi_prices.csv", exp, toast)}>Export</button></>}>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Ingredient</th><th>Sold as</th><th className="n">Price per pack</th><th className="n">Price per unit</th><th className="n">Minimum order</th><th>Delivery</th></tr></thead>
          <tbody>{body.length ? body : <tr><td colSpan={6} className="empty">No ingredients match these filters.</td></tr>}</tbody>
        </table>
      </div>
      <div className="note">Standard prices used by the plan. If a supplier changes a price, update it in the data so the plan and the budget stay correct.</div>
    </Panel>
  );
}
/* week by week for one ingredient: opening stock, expected use, orders arriving, expected waste, closing stock */
function WeeklyStockPlan({ F }) {
  const { s, set } = useUI();
  const sel = BYID[s.sel] && F.some((i) => i.id === s.sel) ? BYID[s.sel] : F[0]; if (!sel) return null;
  const p1 = D.plan.find((p) => p.ing === sel.id && p.week === 1), p2 = D.plan.find((p) => p.ing === sel.id && p.week === 2); if (!p1 || !p2) return null;
  const now0 = series(sel.id).close[LAST], I0 = Math.max(0, p1.end - p1.qty + p1.demand - p1.short + p1.waste), wk1 = LAST + 1 + (sel.lead || 0), cols = [[p1, I0], [p2, p1.end]], none = (v) => (v > 0 ? qty(v, sel.uom) : "None");
  const rowsDef = [["Opening stock", (c) => qty(c[1], sel.uom)], ["Expected use", (c) => qty(c[0].demand, sel.uom)], ["Orders arriving", (c) => none(c[0].qty)], ["Expected waste", (c) => none(c[0].waste)], ["Not covered by stock", (c) => none(c[0].short)],
    ["Closing stock", (c) => qty(c[0].end, sel.uom)], ["Days of cover at the end", (c) => (c[0].demand ? daysTxt(c[0].end / (c[0].demand / 7)) + " d" : "–")], ["Value of closing stock", (c) => peso(c[0].end * sel.cost)]];
  const walk = []; let open = I0;
  walk.push(["Stock now", now0, "total"]);
  if (now0 - I0 > 0.5) walk.push(["Used first", -(now0 - I0), "move"], ["Wk 1 start", I0, "total"]);
  [[p1, "wk 1"], [p2, "wk 2"]].forEach(([p, nm]) => {
    walk.push(["Orders", p.qty, "move"], ["Use", -(p.demand - p.short), "move"], ["Waste", -p.waste, "move"]);
    const gap = p.end - (open + p.qty - (p.demand - p.short) - p.waste);
    if (Math.abs(gap) > Math.max(1, p.end * 0.005)) walk.push([gap < 0 ? "Left over" : "Not itemised", gap, "move"]);
    walk.push(["End of " + nm, p.end, "total"]); open = p.end;
  });
  const note = walk.some((x) => x[0] === "Left over") ? "\"Left over\" is stock from the orders that the plan does not carry into the next week, because this ingredient only keeps for a few days. The plan itself counts it as neither use nor waste, so it may end up as waste in practice."
    : walk.some((x) => x[0] === "Not itemised") ? "\"Not itemised\" is the part of the plan's closing stock that the listed orders, use and waste do not explain."
      : sel.lead ? `The plan's first week starts ${sel.lead} ${sel.lead === 1 ? "day" : "days"} from now, when an order placed today can arrive. The stock used before then is shown as "Used first".` : "";
  return (
    <Panel c="c12" title="Week-by-week stock plan" right={<Field label="Ingredient"><Dropdown label="Ingredient" value={sel.id} options={F.map((i) => ({ value: i.id, label: i.name }))} onChange={(v) => set({ sel: +v })} /></Field>}>
      <Waterfall steps={walk} w={760} fmt={(v) => qty(v, sel.uom)} axis={(v) => num(v)} label={"Stock walk for " + sel.name} />
      {note ? <div className="note">{note}</div> : null}
      <div className="tablewrap">
        <table>
          <thead><tr><th /><th className="n">Week of {fd(wk1)}</th><th className="n">Week of {fd(wk1 + 7)}</th></tr></thead>
          <tbody>{rowsDef.map(([l, f]) => <tr key={l}><td>{l}</td>{cols.map((c, k) => <td key={k} className="n">{f(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </Panel>
  );
}
/* the next 14 days: deliveries, stock that expires, paydays and holidays */
function Calendar14() {
  const k0 = LAST + 1, del = {}, exp = {};
  D.deliveries.forEach((x) => { const d = idxOf(x[3]); (del[d] || (del[d] = new Set())).add(BYID[x[0]].supname); });
  batchesAt(LAST).forEach((b) => { if (b[2] > 0 && b[4] >= k0 && b[4] < k0 + 14) (exp[b[4]] || (exp[b[4]] = new Set())).add(BYID[b[1]].name); });
  const short = (set, n = 2) => { const a = [...set]; return a.slice(0, n).join(", ") + (a.length > n ? ` +${a.length - n}` : ""); };
  return (
    <div className="cal">
      {WD.map((d) => <span key={d} className="ch">{d}</span>)}
      {Array.from({ length: wdOf(k0) }, (_, k) => <div key={"e" + k} className="cd empty0" />)}
      {Array.from({ length: 14 }, (_, k) => {
        const d = k0 + k, fl = D.ext.ff[k] || 0;
        return (
          <div key={d} className="cd">
            <b>{fd(d)}</b>
            {del[d] ? <div className="c1">Delivery: {short(del[d])}</div> : null}
            {exp[d] ? <div className="c2">Expires: {short(exp[d])}</div> : null}
            {fl & 2 ? <div className="c3">Payday</div> : null}
            {fl & 1 ? <div className="c3">Holiday</div> : null}
          </div>
        );
      })}
    </div>
  );
}

/* =====================================================================
   FORECAST
   ===================================================================== */
function fvaData(F, fva, fmon) {
  const ids = F.map((i) => i.id), single = F.length === 1, c = (id) => (single ? 1 : BYID[id].cost), s0 = D.ext.bts, n = LAST - s0 + 1;
  const A = new Array(n).fill(0), Fc = new Array(n).fill(0);
  ids.forEach((id) => { const q = D.btd[id]; if (!q) return; for (let k = 0; k < n; k++) if (q.a[k] !== null) { A[k] += q.a[k] * c(id); Fc[k] += q.f[k] * c(id); } });
  let bk;
  if (fva === "month") bk = FV_MON.map((m) => ({ label: m.label + (m.part ? " (part)" : ""), a: m.a - s0, b: m.b - s0 }));
  else if (fva === "week") bk = weeksFrom(s0, LAST).map((x) => ({ label: x.label, a: x.a - s0, b: x.b - s0 }));
  else { const m = FV_MON[Math.min(fmon, FV_MON.length - 1)]; bk = []; for (let i = m.a; i <= m.b; i++) bk.push({ label: fd(i), a: i - s0, b: i - s0 }); }
  const act = bk.map((q) => sum(A.slice(q.a, q.b + 1))), fc = bk.map((q) => sum(Fc.slice(q.a, q.b + 1)));
  const miss = sum(act.map((v, i) => Math.abs(v - fc[i]))) / Math.max(1, sum(act));
  const marks = [];
  if (fva === "day") bk.forEach((q, k) => { const fl = D.ext.f[s0 + q.a] || 0; if (fl & 2) marks.push([k, "Payday"]); else if (fl & 1) marks.push([k, "Holiday"]); });
  return { x: bk.map((q) => q.label), act, fc, miss, single, marks, f: single ? (v) => qty(v, F[0].uom) : peso };
}
function PagePred({ F }) {
  const { s, set, pickRow } = useUI();
  const E = D.engine, ids = F.map((i) => i.id), single = F.length === 1, mkey = s.model, win0 = MWINS[s.mwin] || MWINS[0];
  const cmp = D.mcmp.filter((r) => r.scope === "20 perishables" && r.win === win0), cur = cmp.find((r) => r.model === mkey), hw = cmp.find((r) => r.model === "HW");
  const wts = ids.map((id) => consumedValue([id], LAST - 27, LAST)), wsum = sum(wts) || 1;
  const wm = (m) => sum(ids.map((id, k) => (D.pering[id] ? D.pering[id][m] : 0) * wts[k])) / wsum;
  const f = (v) => (single ? qty(v, F[0].uom) : peso(v)), c = (id) => (single ? 1 : BYID[id].cost);
  const fy = D.fdates.map((_, k) => sum(ids.map((id) => D.fc[id].y[k] * c(id))));
  const last7 = sum(ids.map((id) => { let v = 0; for (let i = LAST - 6; i <= LAST; i++) v += series(id).use[i] * c(id); return v; }));
  const chg = last7 ? sum(fy.slice(0, 7)) / last7 - 1 : 0, inUse = mkey === "HW";
  const tag = (k) => (k === "HW" ? " · in use" : k === "ML" ? " · not used" : "");
  const rows = MODELS.map(([k, n]) => { const r = cmp.find((x) => x.model === k); return [n + tag(k), r ? r.wmape : 0, k, k === mkey ? "var(--accent)" : "var(--series2)"]; }).sort((a, b) => a[1] - b[1]);
  const acc = F.filter((i) => D.pering[i.id]).map((i) => [i.name, D.pering[i.id][mkey], i.id]).sort((a, b) => a[1] - b[1]).slice(0, 12);
  const fmarks = []; D.fdates.forEach((_, k) => { const fl = D.ext.ff[k] || 0; if (fl & 2) fmarks.push([k, "Payday"]); else if (fl & 1) fmarks.push([k, "Holiday"]); });
  const HD = 28, hs0 = D.ext.bts, nF = D.fdates.length;
  const hist = Array.from({ length: HD }, (_, k) => { const di = LAST - HD + 1 + k - hs0; return sum(ids.map((id) => { const q = D.btd[id], v = q && q.a[di] != null ? q.a[di] / (UPL.prof[id] ? UPL.prof[id].y : 1) : 0; return v * c(id); })); });
  const flo = D.fdates.map((_, k) => sum(ids.map((id) => D.fc[id].lo[k] * c(id)))), fhi = D.fdates.map((_, k) => sum(ids.map((id) => D.fc[id].hi[k] * c(id))));
  const hx = [...Array.from({ length: HD }, (_, k) => fd(LAST - HD + 1 + k)), ...D.fdates.map(fiso)];
  const hmarks = [[HD - 1, "Today"], ...fmarks.map(([k, l]) => [k + HD, l])];
  const fva = s.ptab === "forecast" ? fvaData(F, s.fva, s.fmon) : null;
  const yq = (q) => (single ? num(q) : "₱" + num(q));
  return (
    <>
      <div className="kpis">
        <Kpi label="Next 7 days" value={f(sum(fy.slice(0, 7)))} d={<span className="t-flat">{chg >= 0 ? "▲" : "▼"} {Math.abs(chg * 100).toFixed(0)}% vs last 7 days</span>} info="Expected use for the next 7 days, compared with what was really used in the last 7 days." />
        <Kpi label="WMAPE (weekly)" value={pct(wm(mkey), 0)} d={<span className="t-flat">{MNAME[mkey]}</span>} info="Weighted mean absolute percentage error, per week: how far the weekly forecast is typically off from what was really used, during the test weeks. Lower is better." />
        <Kpi label="Beats seasonal naive by" value={((wm("SNAIVE") - wm("HW")) * 100).toFixed(1) + " points"} d={<span className="t-flat">WMAPE, Holt-Winters vs seasonal naive</span>} info="Seasonal naive simply repeats last week. This is how many points of WMAPE the method in use is better by, for the selected ingredients." />
        <Kpi label="Ways tested" value={String(MODELS.length)} d={<span className="t-flat">{inUse ? "Holt-Winters in use" : MNAME[mkey] + " shown for comparison"}</span>} info="Five ways of forecasting were tried on the same weeks. The one in use stays unless another is better by more than 0.5 points." />
      </div>
      <TabBar items={[["forecast", "Forecast"], ["ways", "Ways of forecasting"], ["outside", "External factors"]]} value={s.ptab} onChange={(v) => set({ ptab: v })} />
      <div className="grid">
        {s.ptab === "ways" ? (
          <>
            <Panel c="c5" title="How the forecast is made" right={<><Info tip="The forecast looks at past weeks, including the weekly ups and downs, and learns from five years of daily use. Its typical weekly miss is shown as WMAPE." /><Chip tone="good">In use</Chip></>}>
              <dl className="facts">
                <dt>Method</dt><dd>Holt-Winters exponential smoothing, 7-day season</dd>
                <dt>Learns from</dt><dd>5 years of daily use, to {fiso(E.train_end)}</dd>
                <dt>Set up using</dt><dd>{E.tune}</dd>
                <dt>Checked on</dt><dd>{E.test}, week by week</dd>
                <dt>WMAPE (weekly)</dt><dd>{pct(E.wmape, 1)} (ingredients that spoil)</dd>
              </dl>
            </Panel>
            <Panel c="c7" title="Compare ways of forecasting" right={<>
              <Info tip={MODEL_HELP} />
              <Field label="Way"><Dropdown label="Way" value={mkey} options={MODELS.map(([k, n]) => ({ value: k, label: n + (k === "HW" ? " (in use)" : "") }))} onChange={(v) => set({ model: v })} /></Field>
              <Field label="Test period"><Dropdown label="Test period" value={s.mwin} options={MWINS.map((x, k) => ({ value: k, label: x }))} onChange={(v) => set({ mwin: +v })} /></Field>
            </>}>
              <BarRows items={rows} fmt={(v) => pct(v, 1)} w={290} />
              <div className="note">{mkey === "ML" ? "Gradient boosting fits the past too closely and does worse on new weeks, so it is not used." : inUse ? "Holt-Winters is in use. No other way beat it by more than 0.5 points." : MNAME[mkey] + " is shown for comparison and is not used. " + (cur && hw ? (cur.wmape > hw.wmape ? "Its WMAPE is " + ((cur.wmape - hw.wmape) * 100).toFixed(1) + " points higher than Holt-Winters." : "Its WMAPE is within " + ((hw.wmape - cur.wmape) * 100).toFixed(1) + " points of Holt-Winters, not enough to switch.") : "")}</div>
            </Panel>
          </>
        ) : null}
        {fva ? (
          <>
            <Panel c="c7" title={`What was used, and the next ${nF} days${single ? " · " + F[0].name : " (₱)"}`}>
              <Chart x={hx} h={240} label="What was used and the forecast" yfmt={yq} marks={hmarks}
                lines={[{ vals: [...hist, ...Array(nF).fill(null)], color: "var(--accent)", name: "What was used", fmt: f }, { vals: [...Array(HD).fill(null), ...fy], lo: [...hist, ...flo], hi: [...hist, ...fhi], color: "var(--warn)", name: "Forecast", fmt: f }]} />
              <Legend items={[["What was used (last 4 weeks)", "var(--accent)"], ["Forecast", "var(--warn)"], ["Likely range (4 times out of 5)", "var(--warn)"]]} />
              <div className="note">Dotted lines mark paydays and holidays.</div>
            </Panel>
            <Panel c="c5" title={`How reliable by ingredient · ${MNAME[mkey]}`} right={<Info tip="The typical weekly miss (WMAPE) for each ingredient. A shorter bar means a more reliable forecast." />}>
              {acc.length < 2 ? <Empty>Pick more than one ingredient to compare how reliable the forecast is for each.</Empty> : <HBar items={acc} fmt={(v) => pct(v, 0)} axis={(v) => pct(v, 0)} name="WMAPE, weekly (lower is better)" color="var(--series2)" click onPick={pickRow} label="Forecast miss by ingredient" />}
            </Panel>
            <Panel c="c12" title={`Forecast vs actual, 2026${single ? " · " + F[0].name : ""}`} right={<>
              <Chip>WMAPE {pct(fva.miss, 0)}</Chip>
              <Seg label="Group by" items={[["month", "By month"], ["week", "By week"], ["day", "By day"]]} value={s.fva} onChange={(v) => set({ fva: v })} />
              {s.fva === "day" ? <Field label="Month"><Dropdown label="Month" value={Math.min(s.fmon, FV_MON.length - 1)} options={FV_MON.map((m, k) => ({ value: k, label: m.label }))} onChange={(v) => set({ fmon: +v })} /></Field> : null}
            </>}>
              <Chart x={fva.x} h={250} marks={fva.marks} label="Forecast vs actual" yfmt={yq} bars={[{ vals: fva.act, color: "var(--accent)", op: 0.55, name: "Actual", fmt: fva.f }]} lines={[{ vals: fva.fc, color: "var(--warn)", name: "Expected", fmt: fva.f }]} />
              <Legend items={[["What was really used", "var(--accent)"], ["What was expected", "var(--warn)"]]} />
            </Panel>
            <UpForecastPanel />
          </>
        ) : null}
        {s.ptab === "outside" ? <ExternalPanels /> : null}
      </div>
    </>
  );
}
/* check the forecast against the days in an uploaded file that come after the dashboard's data */
function UpForecastPanel() {
  const { up } = useUI();
  if (!up) return null;
  const k0 = LAST + 1, kN = LAST + D.fdates.length, title = "Check the forecast against your sales";
  const days = [...new Set(up.rows.filter((r) => r.day >= k0 && r.day <= kN).map((r) => r.day))].sort((a, b) => a - b);
  if (!days.length) return <Panel c="c12" title={title}><div className="note" style={{ margin: 0 }}>Your file has no days after {fd(LAST, true)}. Upload a newer export.</div></Panel>;
  const act = {};
  up.rows.filter((r) => r.day >= k0 && r.day <= kN && r.itemId !== null && r.itemId !== undefined).forEach((r) => (UPL.bom[r.itemId] || []).forEach(([ing, q]) => {
    const pr = UPL.prof[ing]; if (!pr || pr.t !== "menu") return;
    const m = act[ing] || (act[ing] = {}); m[r.day] = (m[r.day] || 0) + (r.items * q) / pr.y;
  }));
  const comp = ING.filter((i) => UPL.prof[i.id] && UPL.prof[i.id].t === "menu"), skipped = ING.length - comp.length;
  const perDayF = days.map((d) => sum(comp.map((i) => D.fc[i.id].y[d - k0] * i.cost))), perDayA = days.map((d) => sum(comp.map((i) => ((act[i.id] || {})[d] || 0) * i.cost)));
  const rowsT = comp.map((i) => { const fc = sum(days.map((d) => D.fc[i.id].y[d - k0])), a = sum(days.map((d) => (act[i.id] || {})[d] || 0)); return { i, f: fc, a, diff: a ? fc / a - 1 : null }; })
    .filter((r) => r.f > 0 || r.a > 0).sort((x, y) => Math.abs(y.a - y.f) * y.i.cost - Math.abs(x.a - x.f) * x.i.cost);
  const miss = sum(days.map((_, k) => Math.abs(perDayF[k] - perDayA[k]))) / Math.max(1, sum(perDayA));
  return (
    <Panel c="c12" title={title} right={<Chip tone={miss <= 0.25 ? "good" : "warn"}>WMAPE on these days: {pct(miss, 0)}</Chip>}>
      <div className="note" style={{ margin: "0 0 10px" }}>{days.length} day{days.length === 1 ? "" : "s"} from your file ({fd(days[0])} to {fd(days[days.length - 1])}), turned into ingredient use with the recipes.</div>
      <Chart x={days.map((d) => fd(d))} h={220} label="Forecast against your sales" yfmt={(v) => "₱" + num(v)} bars={[{ vals: perDayA, color: "var(--accent)", op: 0.6, name: "From your sales", fmt: peso }]} lines={[{ vals: perDayF, color: "var(--warn)", name: "Expected", fmt: peso }]} />
      <Legend items={[["Used, from your sales (₱)", "var(--accent)"], ["What was expected (₱)", "var(--warn)"]]} />
      <div className="tablewrap" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>Ingredient</th><th className="n">Expected</th><th className="n">From your sales</th><th>How the forecast did</th></tr></thead>
          <tbody>{rowsT.slice(0, 10).map((r) => {
            const pc = r.diff === null ? null : r.diff * 100, cl = pc === null ? "flat" : Math.abs(pc) <= 15 ? "good" : "warn";
            return <tr key={r.i.id}><td><b>{r.i.name}</b></td><td className="n">{qty(r.f, r.i.uom)}</td><td className="n">{qty(r.a, r.i.uom)}</td><td><Chip tone={cl}>{pc === null ? "no sales" : pc > 0 ? "Forecast " + pc.toFixed(0) + "% too high" : pc < 0 ? "Forecast " + Math.abs(pc).toFixed(0) + "% too low" : "Right on"}</Chip></td></tr>;
          })}</tbody>
        </table>
      </div>
      <div className="note">{skipped} ingredients left out: their forecast includes staff meals and other use.</div>
    </Panel>
  );
}
function ExternalPanels() {
  const { s, set } = useUI();
  const key = s.heat, a = useMemo(() => dailyDemand(key), [key]), y = useMemo(() => devSeries(a), [a]);
  const pairs = []; for (let i = 0; i < N; i++) if (y[i] !== null && XT.hi[i] !== null) pairs.push([XT.hi[i], y[i]]);
  const r = pearson(pairs.map((q) => q[0]), pairs.map((q) => q[1]));
  const mean = (arr) => (arr.length ? sum(arr) / arr.length : null);
  const yBase = mean(y.filter((z) => z !== null)) || 0;
  const eff = (idxs) => { const v = idxs.map((i) => y[i]).filter((z) => z !== null); return { n: v.length, v: v.length ? mean(v) - yBase : null }; };
  const days = (fn) => { const o = []; for (let i = 0; i < N; i++) if (!(XT.f[i] & 8) && fn(i)) o.push(i); return o; };
  const wkend = days((i) => XT.f[i] & 4), wkday = days((i) => !(XT.f[i] & 4));
  const rows = [eff(days((i) => XT.f[i] & 2)), eff(days((i) => XT.f[i] & 1)), { n: wkend.length, v: mean(wkend.map((i) => a[i])) / mean(wkday.map((i) => a[i])) - 1 },
    eff(days((i) => XT.hi[i] !== null && XT.hi[i] < 33)), eff(days((i) => XT.hi[i] !== null && XT.hi[i] >= 33 && XT.hi[i] < 42)), eff(days((i) => XT.hi[i] !== null && XT.hi[i] >= 42))];
  const yrMean = {}; for (let i = 0; i < N; i++) { const yy = dateOf(i).getUTCFullYear(); (yrMean[yy] || (yrMean[yy] = [])).push(a[i]); }
  Object.keys(yrMean).forEach((k) => { yrMean[k] = mean(yrMean[k]) || 1; });
  const mH = Array.from({ length: 12 }, () => []), mD = Array.from({ length: 12 }, () => []);
  for (let i = 0; i < N; i++) { const d = dateOf(i), m = d.getUTCMonth(); if (XT.hi[i] !== null) mH[m].push(XT.hi[i]); if (!(XT.f[i] & 8)) mD[m].push((a[i] / yrMean[d.getUTCFullYear()]) * 100); }
  const hv = mH.map(mean), dv = mD.map(mean), hmn = Math.min(...hv), hmx = Math.max(...hv), dmn = Math.min(...dv), dmx = Math.max(...dv);
  const season = [
    { label: "Feels like (°C)", cells: hv.map((v, m) => ({ style: { background: heatColor((v - hmn) / (hmx - hmn || 1)) }, t: `${MON[m]}: average heat index ${v.toFixed(1)} °C`, text: v.toFixed(0) })) },
    { label: "Busy-ness", cells: dv.map((v, m) => ({ style: { background: heatColor((v - dmn) / (dmx - dmn || 1)) }, t: `${MON[m]}: demand ${v.toFixed(0)} (100 is a typical month)`, text: v.toFixed(0) })) },
  ];
  const sm = monthsFrom(Math.max(0, LAST - 760), LAST, true).slice(-24);
  const smSales = sm.map((m) => sum(D.sales.filter((q) => q[0] >= m.a && q[0] <= m.b).map((q) => q[3]))), smOuts = sm.map((m) => D.so.filter((q) => q[0] >= m.a && q[0] <= m.b).length);
  const item = (l, q) => [q.n < 20 || q.v === null ? l + " (too few days)" : l + " · " + num(q.n) + " days", q.n < 20 || q.v === null ? null : q.v];
  const heatItems = [item("Feels like under 33 °C", rows[3]), item("Feels like 33 to 41 °C", rows[4]), item("Feels like 42 °C and above", rows[5])];
  const calItems = [item("Payday", rows[0]), item("Holiday", rows[1]), item("Weekend (Sat, Sun)", rows[2])];
  const verdict = Math.abs(r) < 0.1 ? "No. Hot days sell about the same as other days." : r > 0 ? "A little. Hotter days sell somewhat more." : "A little. Hotter days sell somewhat less.";
  const meterPos = ((Math.max(-1, Math.min(1, r)) + 1) / 2) * 100;
  const opts = [{ value: "all", label: "All menu sales" }, { header: "Menu category" }, ...TOPCATS.map((c) => ({ value: "c:" + c[1], label: c[0] })), { header: "Ingredient use" }, ...ING.map((i) => ({ value: "i:" + i.id, label: i.name }))];
  return (
    <>
      <div className="panel c12" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px" }}>
        <div style={{ flex: 1, minWidth: 220 }}><h2 style={{ margin: 0, fontSize: 15, color: "var(--brand)" }}>External factors</h2></div>
        <Field label="Demand of"><Dropdown label="Demand of" value={key} options={opts} onChange={(v) => set({ heat: v })} /></Field>
      </div>
      <Panel c="c6" title="Does hot weather change sales?" right={<Info tip="Heat index is the feels-like temperature: it combines air temperature and humidity. Measured at 2 pm each day." />}>
        <div className="big">{verdict}</div>
        <DivBars items={heatItems} label="Sales on hotter days compared with other days" up="Sells more" down="Sells less" />
        <div className="meter"><b style={{ left: meterPos + "%" }} /></div>
        <div className="meterl"><span>Hot days sell less</span><span>No link</span><span>Hot days sell more</span></div>
        <div className="note">Link: {r.toFixed(2)} (0 means none), over {num(pairs.length)} days.</div>
      </Panel>
      <Panel c="c6" title="What makes sales go up or down?"><DivBars items={calItems} label="Sales on these days compared with other days" up="Sells more" down="Sells less" /></Panel>
      <Panel c="c7" title="Sales and stock-outs, month by month">
        <div className="sub">Net sales (₱ thousands)</div>
        <Chart x={sm.map((m) => m.label)} h={150} label="Net sales by month" yfmt={(v) => "₱" + num(v / 1000) + "k"} bars={[{ vals: smSales, color: "var(--accent)", op: 0.7, name: "Net sales", fmt: peso }]} />
        <div className="sub">Times an ingredient ran out</div>
        <Chart x={sm.map((m) => m.label)} h={120} label="Times an ingredient ran out by month" yfmt={num} bars={[{ vals: smOuts, color: "var(--bad)", op: 0.8, name: "Times ran out", fmt: num }]} />
      </Panel>
      <Panel c="c5" title="Which months are hot, and which are busy?">
        <Heat labelCol="96px" cols={MON} rows={season} />
        <div className="note">Feels-like temperature and busy-ness (100 = average month). Weather: Open-Meteo, Quezon City.</div>
      </Panel>
    </>
  );
}

/* =====================================================================
   COMPARE YEARS (Period filter > Compare years)
   ===================================================================== */
function CmpView({ F }) {
  const { s } = useUI();
  const def = CMP[s.page], ys = s.cmpYears.slice().sort((x, y) => x - y);
  if (!ys.length) return <div className="panel empty">Tick at least one year in the Period filter to compare.</div>;
  const a = new Array(N).fill(0), set = new Set(F.map((i) => i.id));
  if (s.page === "sales") { const ci = s.cat ? D.cats.indexOf(s.cat) : -1; dailyDemand(ci >= 0 ? "c:" + ci : "all").forEach((v, k) => { a[k] = v; }); }
  else if (s.page === "use") F.forEach((i) => { const u = series(i.id).use; for (let k = 0; k < N; k++) a[k] += u[k] * i.cost; });
  else if (s.page === "waste") D.waste.forEach((x) => { if (set.has(x[1]) && x[0] >= 0 && x[0] < N) a[x[0]] += x[2]; });
  else if (s.page === "inv") D.so.forEach((x) => { if (set.has(x[1]) && x[0] >= 0 && x[0] < N) a[x[0]] += 1; });
  const lastD = dateOf(LAST), lm = lastD.getUTCMonth(), ld = lastD.getUTCDate(), catName = s.page === "sales" && s.cat ? " · " + s.cat : "";
  const monthVal = (y, m) => { let t = 0, c = 0; for (let i = 0; i < N; i++) { const d = dateOf(i); if (d.getUTCFullYear() === y && d.getUTCMonth() === m) { t += a[i]; c++; } } return c >= 7 ? (t / c) * def.per : null; };
  const lines = ys.map((y) => ({ vals: MON.map((_, m) => monthVal(y, m)), color: YCOL[y] || "#64748B", name: String(y), fmt: def.fmt }));
  const ytd = ys.map((y) => {
    const a0 = Math.round((Date.UTC(y, 0, 1) - D0) / 864e5), b0 = Math.round((Date.UTC(y, lm, ld) - D0) / 864e5);
    if (a0 < 0 || b0 > LAST) return { y, na: true };
    let t = 0; for (let i = a0; i <= b0; i++) t += a[i];
    return { y, total: t, per: (t / (b0 - a0 + 1)) * def.per };
  });
  const lowerBetter = s.page === "waste" || s.page === "inv";
  return (
    <div className="grid">
      <Panel c="c12" title={`${def.title} · year by year${catName}`} right={<Info tip="Each line is one year, month by month. Months with less than a week of data are left out. A year that is missing a line has no data for that month yet." />}>
        <Chart x={MON} h={320} label={def.title + " by year"} yfmt={(v) => (def.k ? "₱" + (v >= 10000 ? num(v / 1000) + "k" : num(v)) : num(v))} lines={lines} />
        <Legend items={ys.map((y) => [String(y), YCOL[y] || "#64748B"])} />
      </Panel>
      <Panel c="c12" title={`Same period of each year · 1 Jan to ${ld} ${MON[lm]}`}>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Year</th><th className="n">{def.what}, total</th><th className="n">{def.per === 1 ? "Per day" : "Per 30 days"}</th><th className="n">Change</th></tr></thead>
            <tbody>{ytd.map((o, k) => {
              if (o.na) return <tr key={o.y}><td><b>{o.y}</b></td><td className="n" colSpan={3}><span className="t-flat">Data starts in September {o.y}, so this period is not complete.</span></td></tr>;
              const prev = ytd.slice(0, k).reverse().find((p) => !p.na), ch = prev && prev.total ? o.total / prev.total - 1 : null;
              return (
                <tr key={o.y}>
                  <td><span className="ydot" style={{ background: YCOL[o.y] || "#64748B" }} /><b>{o.y}</b></td>
                  <td className="n">{def.fmt(o.total)}</td><td className="n">{def.fmt(o.per)}</td>
                  <td className="n">{ch === null ? "–" : <Chip tone={ch >= 0 ? (lowerBetter ? "warn" : "good") : lowerBetter ? "good" : "warn"}>{ch >= 0 ? "+" : ""}{(ch * 100).toFixed(0)}% vs {prev.y}</Chip>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div className="note">Every year is measured over the same dates, so the totals are a fair comparison.{lowerBetter ? " For this measure a lower number is better." : ""}</div>
      </Panel>
    </div>
  );
}

/* =====================================================================
   FILTERS
   ===================================================================== */
function RadioGroup({ name, title, value, items, onChange, className = "" }) {
  return (
    <fieldset className={`rg ${className}`}>
      <legend>{title}</legend>
      {items.map(([v, lab]) => (
        <label key={String(v)} className="rd"><input type="radio" name={name} value={String(v)} checked={String(v) === String(value)} onChange={() => onChange(v)} />{lab}</label>
      ))}
    </fieldset>
  );
}
const Tile = ({ title, children }) => <div className="ftile"><div className="ft">{title}</div>{children}</div>;
function Filters() {
  const { s, set, reset } = useUI();
  const sales = s.page === "sales", pred = s.page === "pred" || (s.page === "buy" && s.btab !== "spend"); // no period on the forecast and on the forward-looking Purchasing tabs
  const cmpOn = s.cmp && !!CMP[s.page];
  const popRef = useRef(null);
  useEffect(() => {
    if (!s.moreF) return undefined;
    const onDoc = (e) => { if (!e.target.closest(".fpop, .fbtn")) set({ moreF: false }); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [s.moreF, set]);
  const ingCats = [...new Set(ING.map((i) => i.cat))].sort();
  const monthsOf = s.year ? Array.from({ length: 12 }, (_, m) => m).filter((m) => { const a = Date.UTC(s.year, m, 1), b = Date.UTC(s.year, m + 1, 0); return b >= D0 && a <= D0 + LAST * 864e5; }) : [];
  const changed = !!(cmpOn || s.year || s.month !== "" || s.range !== 90 || s.cat || s.ing || s.sup || s.store || s.scen !== "Base");
  const nMore = [s.sup, s.cat, s.store, s.page === "buy" && s.scen !== "Base"].filter(Boolean).length;
  const yearOpts = [{ value: "", label: "Or choose a year", menuLabel: "Recent period (no year)", ph: true }, ...YEARS.map((y) => ({ value: y, label: String(y), dot: YCOL[y] || "#64748B" }))];
  const sups = [...new Map(ING.map((i) => [i.sup, i.supname])).entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1));
  return (
    <section className="filters" aria-label="Filters">
      {pred ? null : cmpOn ? (
        <Tile title="Compare years">
          <div className="prow">
            {YEARS.slice().sort((x, y) => x - y).map((y) => (
              <label key={y} className="rd"><input type="checkbox" checked={s.cmpYears.includes(y)} onChange={(e) => set({ cmpYears: e.target.checked ? [...new Set([...s.cmpYears, y])].sort((p, q) => q - p) : s.cmpYears.filter((z) => z !== y) })} /><span className="ydot" style={{ background: YCOL[y] || "#64748B" }} />{y}</label>
            ))}
            <button type="button" className="linkbtn" onClick={() => set({ cmp: false })}>Back to one period</button>
          </div>
        </Tile>
      ) : (
        <Tile title="Period filter">
          <div className="prow">
            <RadioGroup name="f-period" title="Recent" className="inline" value={s.year ? "" : s.range} items={RANGES} onChange={(v) => set({ year: null, range: v, month: "" })} />
            <Dropdown label="Or a year" head="Choose a year" value={s.year || ""} options={yearOpts} onChange={(v) => set({ year: v ? +v : null, month: "" })} />
            {CMP[s.page] ? <button type="button" className="linkbtn" onClick={() => set({ cmp: true })}>Compare years</button> : null}
          </div>
        </Tile>
      )}
      {!pred && !cmpOn && s.year ? (
        <Tile title="Month filter">
          <Dropdown label="Month" value={s.month} options={[{ value: "", label: "Whole year", ph: true }, ...monthsOf.map((m) => ({ value: m, label: MONTHS[m] }))]} onChange={(v) => set({ month: v === "" ? "" : +v })} />
        </Tile>
      ) : null}
      {sales ? (
        <Tile title="Menu category filter">
          <Dropdown label="Menu category" value={s.cat} options={[{ value: "", label: "All menu categories", ph: true }, ...D.cats.map((c) => ({ value: c, label: c }))]} onChange={(v) => set({ cat: v })} />
        </Tile>
      ) : (
        <>
          <Tile title="Ingredient filter">
            <Dropdown label="Ingredient" value={s.ing || ""} options={[{ value: "", label: "All ingredients", ph: true }, ...ING.map((i) => ({ value: i.id, label: i.name })).sort((a, b) => (a.label < b.label ? -1 : 1))]} onChange={(v) => set({ ing: +v || 0, sel: +v || 0 })} />
          </Tile>
          <button type="button" className="fbtn" aria-expanded={s.moreF} onClick={() => set({ moreF: !s.moreF })}>More filters{nMore ? ` (${nMore})` : ""} <span aria-hidden="true">{s.moreF ? "▴" : "▾"}</span></button>
        </>
      )}
      {changed ? <button type="button" className="reset" onClick={reset}>Clear filters</button> : null}
      {!sales && s.moreF ? (
        <div className="fpop" ref={popRef}>
          <RadioGroup name="f-sup" title="Supplier" value={s.sup || ""} items={[["", "All suppliers"], ...sups]} onChange={(v) => set({ sup: +v || 0 })} />
          <Field label="Ingredient type"><Dropdown label="Ingredient type" value={s.cat} options={[{ value: "", label: "All types", ph: true }, ...ingCats.map((c) => ({ value: c, label: cap1(c) }))]} onChange={(v) => set({ cat: v })} /></Field>
          <RadioGroup name="f-store" title="Storage" value={s.store} items={[["", "Chilled and frozen"], ["chilled", "Chilled only"], ["frozen", "Frozen only"]]} onChange={(v) => set({ store: v })} />
          {s.page === "buy" ? <RadioGroup name="f-scen" title="Budget" value={s.scen} items={Object.entries(M.budget).map(([k, v]) => [k, `${k} · ${peso(wk(v))} a week`])} onChange={(v) => set({ scen: v })} /> : null}
        </div>
      ) : null}
    </section>
  );
}

/* =====================================================================
   UPLOAD MODAL
   ===================================================================== */
function UploadModal({ onClose, onUse }) {
  const [res, setRes] = useState(null);
  const [view, setView] = useState(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setRes(null); setView(<div className="result">Reading {f.name}…</div>);
    let text;
    try { text = await f.text(); } catch (err) { setView(<div className="result"><span className="no">✕ This file could not be read.</span></div>); return; }
    const r = analyzeUpload(text, f.name);
    if (r.missing.length) { setView(<div className="result"><b>{f.name}</b><br /><span className="no">✕ Missing columns: {r.missing.join(", ")}</span><br />Please export "Sales by item" from Loyverse with these columns.</div>); return; }
    if (!r.lines) { setView(<div className="result"><b>{f.name}</b><br /><span className="no">✕ No readable sales lines were found{r.bad ? ` (${r.bad} rows have an unreadable date or number)` : ""}.</span></div>); return; }
    const rowsArr = [...r.agg.values()], days = [...r.days].sort((a, b) => a - b), rc = reconcile(rowsArr);
    const um = [...r.unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${cleanName(k.split("|")[1]) || k.split("|")[0]} (${peso(v)})`);
    setView(
      <div className="result">
        <b>{f.name}</b><br />{num(r.lines)} sale lines · {fd(days[0], true)} to {fd(days[days.length - 1], true)} · {days.length} days · {peso(r.net)} net sales
        <br /><span className="ok">✓ All required columns are present{r.bad ? ` (${r.bad} rows skipped: unreadable date or number)` : ""}</span>
        <ul>
          {rc.overlap ? <li>{rc.match} of {rc.overlap} days that the dashboard already has match its sales (within 1%).{rc.match < rc.overlap ? " The others differ by more than 1%, so compare those days before relying on the file." : ""}</li> : null}
          {rc.fresh ? <li><b>{rc.fresh} new days</b> after {fd(LAST, true)}: they will be checked against the forecast.</li> : <li>No days after {fd(LAST, true)} in this file, so the forecast check will not have new days.</li>}
          {r.unmatched.size ? <li>{r.unmatched.size} items are not in the menu list ({pct(r.net ? r.unmatchedNet / r.net : 0, 1)} of sales){um.length ? ": " + um.join(", ") : ""}. They count in sales but not in ingredient use.</li> : <li>Every item matches the menu list.</li>}
        </ul>
      </div>
    );
    setRes(r);
  };
  return (
    <div className="dss-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dss-modal" role="dialog" aria-modal="true" aria-label="Upload Loyverse CSV">
        <h2>Upload Loyverse CSV</h2>
        <p>Choose the Loyverse "Sales by item" CSV. It is read in your browser and not sent anywhere.</p>
        <div className="upfile"><input type="file" accept=".csv,text/csv" aria-label="Loyverse CSV file" onChange={onFile} /></div>
        <div role="status">{view}</div>
        <p className="small">Stock and the purchase plan do not change; they refresh when the data refresh is run.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn pri" disabled={!res} onClick={() => onUse(res)}>Use this file in the dashboard</button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   HEADER (fixed 72px; never changes size when switching tabs)
   ===================================================================== */
function Header({ page, onNav, pillText, onUpload }) {
  const topRef = useRef(null), navRef = useRef(null);
  const [compact, setCompact] = useState(false);
  const [moreRight, setMoreRight] = useState(false);
  const fitW = useRef(-1);
  const navEdge = useCallback(() => { const nav = navRef.current; if (nav) setMoreRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2); }, []);
  /* choose normal or compact widths. Runs on load, resize, font load and status-text change only, so tab clicks never resize the header. */
  const fit = useCallback((force) => {
    const nav = navRef.current; if (!nav) return;
    const w = document.documentElement.clientWidth; if (!force && w === fitW.current) return;
    fitW.current = w;
    // measure the tabs at normal width: drop "compact" on the DOM node for the measurement only, then let React apply the result
    const top = topRef.current, had = !!top && top.classList.contains("compact");
    if (had) top.classList.remove("compact");
    const over = nav.scrollWidth > nav.clientWidth + 1;
    if (had) top.classList.add("compact");
    setCompact(over);
    navEdge();
  }, [navEdge]);
  useLayoutEffect(() => {
    fit(true);
    const onResize = () => fit(false);
    window.addEventListener("resize", onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fit(true));
    return () => window.removeEventListener("resize", onResize);
  }, [fit, navEdge]);
  const firstPill = useRef(true);
  useEffect(() => { if (firstPill.current) { firstPill.current = false; return; } fit(true); }, [pillText, fit]);
  /* when the tabs scroll sideways, keep the active one in view without moving the page */
  useLayoutEffect(() => {
    const nav = navRef.current, on = nav && nav.querySelector(".nav.on");
    if (!on || nav.scrollWidth <= nav.clientWidth) { navEdge(); return; }
    const a = on.getBoundingClientRect(), n = nav.getBoundingClientRect();
    if (a.left >= n.right - 24) nav.scrollLeft += a.right - n.right + 48; else if (a.right <= n.left + 8) nav.scrollLeft -= n.left - a.left + 8;
    navEdge();
  }, [page, navEdge]);
  return (
    <header className={`top${compact ? " compact" : ""}`} id="top" ref={topRef}>
      <div className="topl">
        <a className="logo" href="#buy" aria-label="Makisushi Japanese Restaurant" onClick={(e) => { e.preventDefault(); onNav("buy"); }}>
          <img src={LOGO_SRC} alt="Makisushi Japanese Restaurant" draggable="false" />
        </a>
        <nav className={`navbar${moreRight ? " more-r" : ""}`} id="nav" aria-label="Main" ref={navRef} onScroll={navEdge}>
          {GROUPS.map((g) => (
            <div key={g} className={`grp${PAGES.some((p) => p[2] === g && p[0] === page) ? " cur" : ""}`}>
              <small>{g}</small>
              <div className="btns">
                {PAGES.filter((p) => p[2] === g).map((p) => (
                  <button key={p[0]} type="button" className={`nav${p[0] === page ? " on" : ""}`} aria-current={p[0] === page ? "page" : undefined} onClick={() => onNav(p[0])}>{NAVN[p[0]]}</button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
      <div className="topr">
        <span className="pill" title={pillText.full}><span className="dot" /><span id="datapill"><span className="pl">Data as of </span>{pillText.short}</span></span>
        <button type="button" className="btn cta" id="uploadBtn" aria-label="Upload Loyverse CSV" onClick={onUpload}><span>Upload <span className="ul">Loyverse </span>CSV</span></button>
      </div>
    </header>
  );
}

/* =====================================================================
   ROOT COMPONENT
   ===================================================================== */
const FILTER_DEFAULTS = { cat: "", ing: 0, sup: 0, store: "", scen: "Base" };
const PERIOD_DEFAULTS = { range: 90, year: null, month: "" };
const UI_DEFAULTS = {
  moreF: false, showHelp: false, cmp: false, cmpYears: [2026, 2025, 2024],
  stab: "overview", utab: "time", wtab: "now", itab: "stock", btab: "orders", ptab: "forecast",
  topby: "n", unall: false, scol: "view", heat: "all", fva: "month", fmon: 99, model: "HW", mwin: 0, design: 1, wi: 1, week: 1, allrows: false, sel: 0,
};
const PERIOD_KEYS = Object.keys(PERIOD_DEFAULTS), FILTER_KEYS = Object.keys(FILTER_DEFAULTS);
const initialPage = () => { try { const h = window.location.hash.slice(1); if (PAGES.some((p) => p[0] === h)) return h; } catch (e) { /* no window */ } return "buy"; };

export default function MakisushiDashboard() {
  /* ---- state ---- */
  const [page, setPage] = useState(initialPage);                 // active navigation tab
  const [period, setPeriod] = useState(PERIOD_DEFAULTS);         // period filters: last N days, or a year / month
  const [grain, setGrain] = useState("");                        // Net sales view: "day" | "week" | "month" ("" = automatic)
  const [filters, setFilters] = useState(FILTER_DEFAULTS);       // category, ingredient, supplier, storage, budget
  const [ui, setUi] = useState(UI_DEFAULTS);                      // sub-tabs, toggles and panel choices
  const [up, setUp] = useState(restoreUpload);                   // uploaded Loyverse file (kept in localStorage)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [ordTick, setOrdTick] = useState(0);                     // re-render after an order is ticked
  const tipRef = useRef({ show() {}, hide() {} });
  const toastRef = useRef(() => {});
  const printRef = useRef(null);

  const set = useCallback((p) => {
    if ("page" in p) setPage(p.page);
    if ("grain" in p) setGrain(p.grain);
    const pick = (keys) => { const o = {}; let any = false; keys.forEach((k) => { if (k in p) { o[k] = p[k]; any = true; } }); return any ? o : null; };
    const a = pick(PERIOD_KEYS); if (a) setPeriod((o) => ({ ...o, ...a }));
    const b = pick(FILTER_KEYS); if (b) setFilters((o) => ({ ...o, ...b }));
    const c = pick(Object.keys(UI_DEFAULTS)); if (c) setUi((o) => ({ ...o, ...c }));
  }, []);
  const s = useMemo(() => ({ page, grain, ...period, ...filters, ...ui }), [page, grain, period, filters, ui]);
  const w = useMemo(() => winOf(period), [period]);
  const F = useMemo(() => filterIng(filters), [filters]);

  const tip = useMemo(() => ({ show: (e, c) => tipRef.current.show(e, c), hide: () => tipRef.current.hide() }), []);
  const toast = useCallback((m) => toastRef.current(m), []);
  const go = useCallback((p) => {
    setPage(p); setFilters((o) => ({ ...o, cat: "" }));
    tipRef.current.hide();
    try { window.history.replaceState(null, "", "#" + p); } catch (e) { /* sandboxed */ }
    window.scrollTo(0, 0);
  }, []);
  const pickRow = useCallback((id) => {
    if (id === undefined || id === null || id === "") return;
    if (page === "sales") set({ cat: id }); else set({ ing: +id, sel: +id });
  }, [page, set]);
  const reset = useCallback(() => {
    setPeriod(PERIOD_DEFAULTS); setGrain(""); setFilters(FILTER_DEFAULTS);
    setUi((o) => ({ ...o, heat: "all", fva: "month", fmon: 99, model: "HW", mwin: 0, design: 1, wi: 1, week: 1, sel: 0, cmp: false }));
  }, []);
  const isDone = useCallback((p) => ls.get(orderKey(p)) === "1", [ordTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleOrder = useCallback((p) => { ls.set(orderKey(p), isDone(p) ? "0" : "1"); setOrdTick((t) => t + 1); }, [isDone]);
  const printBlock = useCallback((id, title) => {
    const el = document.getElementById(id), area = printRef.current; if (!el || !area) return;
    area.innerHTML = "";
    const h = document.createElement("h2"); h.textContent = title;
    const p = document.createElement("p"); p.textContent = `Makisushi · data as of ${fd(LAST, true)}`;
    area.append(h, p, el.cloneNode(true));
    document.body.classList.add("mkd-printmode");
    try { window.print(); } catch (e) { toast("Printing is not available here."); }
    setTimeout(() => document.body.classList.remove("mkd-printmode"), 600);
  }, [toast]);
  const applyUpload = useCallback((res) => {
    const rows = [...res.agg.values()];
    setUp(uploadFromRows(res.name, rows));
    try {
      const str = JSON.stringify({ name: res.name, rows: rows.map((r) => [r.day, r.sku, r.name, r.cat, r.itemId, r.items, r.net, r.gross, r.disc]) });
      if (str.length < 3.5e6) ls.set(UP_KEY, str); else toast("The file is used now, but it is too big to be remembered after you close this page.");
    } catch (e) { /* storage blocked */ }
    setUploadOpen(false);
    toast("File is in use. See the Sales and Forecast pages.");
  }, [toast]);
  const removeUpload = useCallback(() => { setUp(null); ls.del(UP_KEY); toast("Uploaded file removed."); }, [toast]);
  const openUpload = useCallback(() => setUploadOpen(true), []);

  const ctx = useMemo(() => ({ s, set, w, F, go, tip, toast, pickRow, reset, up, openUpload, removeUpload, isDone, toggleOrder, printBlock }),
    [s, set, w, F, go, tip, toast, pickRow, reset, up, openUpload, removeUpload, isDone, toggleOrder, printBlock]);

  const pillText = useMemo(() => {
    const short = fd(LAST, true) + (up ? ` · your file to ${fd(up.to, true)}` : "");
    return { short, full: "Data as of " + short };
  }, [up]);

  /* the custom tooltip follows the mouse over anything with an info tip or a data-t label */
  const onMouseMove = (e) => {
    const t = e.target; if (!t || !t.closest) return;
    const info = t.closest(".info");
    if (info && info.dataset.tip) { tip.show(e, info.dataset.tip); return; }
    const c = t.closest("[data-t]");
    if (c) tip.show(e, c.dataset.t); else if (!t.closest(".hit")) tip.hide();
  };

  const cmpMode = s.cmp && !!CMP[page] && (F.length || page === "sales");
  let body;
  if (cmpMode) body = <CmpView F={F} />;
  else if (page === "sales") body = <><UpSalesPanel /><PageSales /></>;
  else if (!F.length) body = <div className="panel empty">No ingredients match these filters. Press Clear filters.</div>;
  else if (page === "buy") body = <PageBuy F={F} />;
  else if (page === "pred") body = <PagePred F={F} />;
  else if (page === "inv") body = <><OpsKpis F={F} /><PageInv F={F} /></>;
  else if (page === "waste") body = <><OpsKpis F={F} /><PageWaste F={F} /></>;
  else body = <PageUse F={F} />;

  return (
    <UICtx.Provider value={ctx}>
      <style>{CSS}</style>
      <div className="mkd" onMouseMove={onMouseMove}>
        <div className="mkd-app">
          <Header page={page} onNav={go} pillText={pillText} onUpload={openUpload} />
          <div className="content">
            <Filters />
            <main id="main" className="enter" key={page}>
              <PageHead />
              {body}
            </main>
          </div>
        </div>
        <TipLayer apiRef={tipRef} />
        <ToastLayer apiRef={toastRef} />
        {uploadOpen ? <UploadModal onClose={() => setUploadOpen(false)} onUse={applyUpload} /> : null}
        <div id="mkd-print" ref={printRef} />
      </div>
    </UICtx.Provider>
  );
}
