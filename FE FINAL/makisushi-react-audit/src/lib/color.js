// Colours for the heatmaps and meters: the same blue ramp as the original page, and text colours chosen for contrast.
const HEAT0 = [241, 245, 249]; // pale grey, the lowest value (#F1F5F9)
const HEAT1 = [30, 58, 138];   // brand blue, the highest value (#1E3A8A)

const toHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

// f from 0 (pale) to 1 (dark); capped at 85% so the darkest cells keep a visible edge
export function heatHex(f) {
  const t = Math.min(1, Math.max(0, f)) * 0.85;
  return toHex(HEAT0.map((v, i) => v * (1 - t) + HEAT1[i] * t));
}

// relative luminance of a #RRGGBB colour (WCAG)
export function luminance(hex) {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// white or near-black, whichever has the higher contrast on the fill
export function inkOn(fill) {
  const L = luminance(fill);
  const onWhite = 1.05 / (L + 0.05);
  const onDark = (L + 0.05) / (luminance("#0F172A") + 0.05);
  return onDark > onWhite ? "#0F172A" : "#FFFFFF";
}

// one heatmap cell: its fill, text colour, short text, and the hover text
export const cellOf = (fill, text, tip, ink) => ({ fill, ink: ink || inkOn(fill), text, tip });
