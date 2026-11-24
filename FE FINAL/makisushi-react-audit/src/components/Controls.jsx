// Slicers (Power BI style): one slim row of drop-downs across the top of the page. Only the filters that change something on the page
// (and tab) that is open are shown, and the ingredient list only offers the ingredients the other filters leave.
import { D, N, ING, MONTHS, dateOf, D0 } from "../lib/model.js";
import { useApp } from "../AppContext.js";
import { SHORT_RANGE as SHORTS, rangeChoices, tabOf, chanName } from "../lib/constants.js";

const RESET = { wyear: "", year: null, month: "", range: 90, cat: "", chan: "", ing: 0, sup: 0, store: "", sel: 0 };

// which filters a page or tab uses
export function filtersFor(S) {
  const page = S.page, tab = tabOf(page, S);
  const none = {};
  switch (page) {
    case "today": return { period: true };
    case "reports": return { period: true };
    case "track": return none;
    case "sales": return tab === "overview" || tab === "products"
      ? { period: true, menuCategory: true, channel: true }
      : { period: true, storage: true, supplier: true, ingredient: true };
    case "waste": return { period: true, storage: true, supplier: true, ingredient: true };
    case "inv": return { period: true, storage: true, supplier: true, ingredient: true };
    case "pred": return tab === "weather" ? { weatherYear: true } : { storage: true, supplier: true, ingredient: true };
    case "buy":
      if (tab === "level") return none;
      return { storage: true, supplier: true };
    default: return none;
  }
}

export function Controls() {
  const { S, set } = useApp();
  const use = filtersFor(S);
  const yrs = [...new Set(Array.from({ length: N }, (_, i) => dateOf(i).getUTCFullYear()))].sort((x, y) => y - x);
  const suppliers = [...new Map(ING.filter((i) => !S.store || i.store === S.store).map((i) => [i.sup, i.supname])).entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1));
  const ingredients = ING.filter((i) => (!S.store || i.store === S.store) && (!S.sup || i.sup === S.sup)).sort((a, b) => (a.name < b.name ? -1 : 1));
  const monthsOf = S.year ? Array.from({ length: 12 }, (_, m) => m).filter((m) => {
    const a = Date.UTC(S.year, m, 1), b = Date.UTC(S.year, m + 1, 0);
    return b >= D0 && a <= D0 + (N - 1) * 864e5;
  }) : [];
  const changed = !!((use.weatherYear && S.wyear) || (use.period && (S.year || S.month || S.range !== 90)) || (use.menuCategory && S.cat) || (use.channel && S.chan) || (use.ingredient && S.ing) || (use.supplier && S.sup) || (use.storage && S.store));
  const slicer = (title, inner) => <label className="slc"><span>{title}</span>{inner}</label>;

  const periodCur = S.year ? "y:" + S.year : "d:" + S.range;
  const onPeriod = (v) => {
    if (v.startsWith("y:")) set({ year: +v.slice(2), month: "" });
    else set({ year: null, range: +v.slice(2), month: "" });
  };
  // changing the storage or the supplier drops a chosen ingredient that no longer fits
  const keepIng = (patch) => {
    const store = "store" in patch ? patch.store : S.store, sup = "sup" in patch ? patch.sup : S.sup;
    const cur = S.ing ? ING.find((i) => i.id === S.ing) : null;
    const ok = !cur || ((!store || cur.store === store) && (!sup || cur.sup === sup));
    set(ok ? patch : { ...patch, ing: 0, sel: 0 });
  };

  return (
    <>
      {use.period && slicer("Period", (
        <select id="f-period" value={periodCur} onChange={(e) => onPeriod(e.target.value)}>
          <optgroup label="Recent">
            {rangeChoices().map((r) => <option key={r[0]} value={"d:" + r[0]}>{SHORTS[r[0]] ? "Last " + SHORTS[r[0]] : "All data"}</option>)}
          </optgroup>
          <optgroup label="Year">
            {yrs.map((y) => <option key={y} value={"y:" + y}>{y}</option>)}
          </optgroup>
        </select>
      ))}
      {use.period && S.year ? slicer("Month", (
        <select id="f-month" value={S.month} onChange={(e) => set({ month: e.target.value })}>
          <option value="">Whole year</option>
          {monthsOf.map((m) => <option key={m} value={m}>{MONTHS[m]}</option>)}
        </select>
      )) : null}
      {use.weatherYear && slicer("Year", (
        <select id="f-wyear" value={S.wyear || ""} onChange={(e) => set({ wyear: e.target.value })}>
          <option value="">All years</option>
          {yrs.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      ))}
      {use.menuCategory && slicer("Menu category", (
        <select id="f-cat" value={S.cat} onChange={(e) => set({ cat: e.target.value })}>
          <option value="">All</option>
          {D.cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ))}
      {use.channel && D.chans && D.chans.length > 1 && slicer("Channel", (
        <select id="f-chan" value={S.chan || ""} onChange={(e) => set({ chan: e.target.value })}>
          <option value="">All</option>
          {D.chans.map((c) => <option key={c} value={c}>{chanName(c)}</option>)}
        </select>
      ))}
      {use.storage && slicer("Storage", (
        <select id="f-store" value={S.store || ""} onChange={(e) => keepIng({ store: e.target.value })}>
          <option value="">Chilled and frozen</option>
          <option value="chilled">Chilled only</option>
          <option value="frozen">Frozen only</option>
        </select>
      ))}
      {use.supplier && slicer("Supplier", (
        <select id="f-sup" value={S.sup || ""} onChange={(e) => keepIng({ sup: +e.target.value || 0 })}>
          <option value="">All</option>
          {suppliers.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ))}
      {use.ingredient && slicer("Ingredient", (
        <select id="f-ing" value={S.ing || ""} onChange={(e) => set({ ing: +e.target.value || 0, sel: +e.target.value || 0 })}>
          <option value="">All ({ingredients.length})</option>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      ))}
      {changed && <button className="reset" id="reset" type="button" onClick={() => set({ ...RESET })}>Clear filters</button>}
    </>
  );
}
