// Export for the report: any card as a PNG image or its table as CSV, the whole page as one PNG, or the page as a PDF
// (through the browser's print dialog, "Save as PDF"). Images are taken from a copy of the card placed off screen, so a card
// whose table scrolls on screen is saved in full.
import { toPng } from "html-to-image";
import { downloadCsv } from "./actions.js";

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const stamp = () => new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function saveDataUrl(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// an off-screen sheet with the same layout classes as the page, so the copy is styled like the original
function sheet(width) {
  const wrap = document.createElement("div");
  wrap.className = "grid canvas export-sheet";
  wrap.style.cssText = `position:fixed;left:-30000px;top:0;width:${width}px;display:block;background:#ffffff;`;
  document.body.appendChild(wrap);
  return wrap;
}
function clean(node) {
  node.querySelectorAll(".px-tools, .noprint").forEach((n) => n.remove());
  return node;
}
const OPTS = { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: false };

// one card as a PNG
export async function panelToPng(panel, pageName, toast) {
  const title = (panel.querySelector(".ph h2") || {}).textContent || "chart";
  const wrap = sheet(panel.offsetWidth);
  try {
    const copy = clean(panel.cloneNode(true));
    copy.style.width = "100%";
    wrap.appendChild(copy);
    await sleep(60);
    const url = await toPng(copy, OPTS);
    const name = `makisushi_${slug(pageName)}_${slug(title)}_${stamp()}.png`;
    saveDataUrl(url, name);
    toast("Saved " + name);
  } catch (e) {
    toast("The image could not be saved: " + (e && e.message ? e.message : e));
  } finally {
    wrap.remove();
  }
}

// the tables of one card as CSV (several tables are separated by an empty line)
export function panelToCsv(panel, pageName, toast) {
  const title = (panel.querySelector(".ph h2") || {}).textContent || "table";
  const rows = [];
  panel.querySelectorAll("table").forEach((t, k) => {
    if (k) rows.push([]);
    t.querySelectorAll("tr").forEach((tr) => {
      if (tr.closest("tfoot") && false) return;
      const cells = [...tr.children].map((c) => c.innerText.replace(/\s*\n\s*/g, " · ").trim());
      if (cells.some((c) => c !== "")) rows.push(cells);
    });
  });
  if (!rows.length) { toast("There is no table in this card."); return; }
  downloadCsv(`makisushi_${slug(pageName)}_${slug(title)}_${stamp()}.csv`, rows, toast);
}

// the whole page (title, boxes and every card) as one tall PNG
export async function pageToPng(pageName, toast) {
  const page = document.getElementById("main");
  if (!page) return;
  const wrap = sheet(page.clientWidth);
  wrap.className = "export-sheet";
  try {
    const copy = clean(page.cloneNode(true));
    copy.removeAttribute("id");
    copy.style.cssText = "height:auto;overflow:visible;display:block;padding:16px 20px;background:#ffffff;";
    copy.querySelectorAll(".seg.tabs").forEach((n) => { n.style.position = "static"; });
    copy.querySelectorAll(".canvas").forEach((c) => { c.classList.add("tall", "export-sheet"); });
    copy.querySelectorAll(".how").forEach((n) => n.remove());
    wrap.appendChild(copy);
    await sleep(120);
    const url = await toPng(copy, { ...OPTS, pixelRatio: 1.5 });
    const name = `makisushi_${slug(pageName)}_${stamp()}.png`;
    saveDataUrl(url, name);
    toast("Saved " + name);
  } catch (e) {
    toast("The page could not be saved as an image: " + (e && e.message ? e.message : e));
  } finally {
    wrap.remove();
  }
}

// the page as a PDF: the browser's print dialog, with the bars and filters hidden (see the print rules in pbi.css)
export function printPage() {
  document.body.classList.add("printpage");
  const done = () => { document.body.classList.remove("printpage"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  try { window.print(); } catch (e) { done(); }
  setTimeout(done, 60000);
}
