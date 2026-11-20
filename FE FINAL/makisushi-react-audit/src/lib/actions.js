// Browser actions: CSV export, print, copy to clipboard. Same behaviour as the original page.
import { csvCell } from "./format.js";

export function downloadCsv(name, rows, toast) {
  const text = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Saved " + name);
  } catch (e) {
    toast("The file could not be saved here.");
  }
}

// Print one block (by element id) under a title, like the original print button
export function printBlock(id, title, dataDate) {
  const el = document.getElementById(id);
  if (!el) return;
  const area = document.getElementById("printarea");
  area.innerHTML = `<h2>${title}</h2><p>Makisushi · data as of ${dataDate}</p>` + el.innerHTML;
  document.body.classList.add("printmode");
  try { window.print(); } catch (e) { /* printing not available */ }
  setTimeout(() => document.body.classList.remove("printmode"), 600);
}

export function copyText(txt, walk, toast) {
  const ok = () => toast(walk ? "Shopping list copied. Paste it into your notes or chat." : "Message copied. Paste it into your chat with the supplier.");
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); ok(); } catch (e) { toast("Could not copy. Please select the text and copy it yourself."); }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback);
  else fallback();
}
