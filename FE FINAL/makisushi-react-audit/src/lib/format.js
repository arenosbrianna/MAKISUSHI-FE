// Number and text formatting, as in the original page.
export const peso = (v, d = 0) => "₱" + Number(v).toLocaleString("en-PH", { minimumFractionDigits: d, maximumFractionDigits: d });
export const num = (v, d = 0) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d });
export const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
// short peso for axes: ₱24k, and ₱2.5k where a whole number would repeat on nearby ticks
export const kpeso = (v) => "₱" + (Math.abs(v) >= 10000 || v % 1000 === 0 ? num(v / 1000) : num(v / 1000, 1)) + "k";
export const whole = (q) => (q > 0 && q < 0.5 ? "<1" : num(Math.round(q)));
export const daysTxt = (d) => (d <= 0 ? "0" : d < 1 ? "<1" : num(Math.round(d)));
export const qty = (q, uom) => uom === "g"
  ? (q >= 1000 ? num(q / 1000, 1) + " kg" : num(q) + " g")
  : whole(q) + (uom === "pc" ? (Math.round(q) === 1 ? " pc" : " pcs") : (Math.round(q) === 1 ? " serving" : " servings"));
// a pack size shown as a round number: grams to the nearest 100 (980 g -> 1 kg, 460 g -> 500 g), under 100 g to the nearest 50
export const packQty = (q, uom) => qty(uom === "g" ? (q >= 100 ? Math.round(q / 100) * 100 : Math.max(50, Math.round(q / 50) * 50)) : Math.round(q), uom);
// a number of days with the right word: "<1 day", "1 day", "5 days"
export const daysWord = (d) => { const t = daysTxt(d); return t + (t === "1" || t.startsWith("<") ? " day" : " days"); };
export const sum = (a) => a.reduce((x, y) => x + y, 0);
export const csvCell =(v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
