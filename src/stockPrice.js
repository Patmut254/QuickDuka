// Selling-price limits set on a stock item (Stock page):
//   - "fixed" price  → the price is the only allowed amount (min = max)
//   - "range"  price → any amount from minPrice to maxPrice per unit
// Sales and Credits must stay inside these limits; items without a price set
// (or entries not tied to a stock item) have no limits.
import { roundMoney } from "./hooks/useStock";

export function priceLimits(stockItem, qty = 1) {
  if (!stockItem) return null;
  const n = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  let lo;
  let hi;
  if (stockItem.priceMode === "range") {
    lo = n(stockItem.minPrice);
    hi = n(stockItem.maxPrice);
  } else {
    lo = hi = n(stockItem.price);
  }
  if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
  const q = Number(qty) > 0 ? Number(qty) : 1;
  return {
    minUnit: lo,
    maxUnit: hi,
    minTotal: roundMoney(lo * q),
    maxTotal: roundMoney(hi * q),
    fixed: lo === hi,
  };
}

// → null when the total is fine, otherwise the error text.
// `t` is the language object (needs amountBetween / amountExactly).
export function priceError(stockItem, qty, total, t) {
  const lim = priceLimits(stockItem, qty);
  if (!lim) return null;
  const amt = Number(total);
  if (Number.isNaN(amt)) return null;
  // 1-cent slack so rounding on fractional quantities never blocks a valid amount
  if (amt >= lim.minTotal - 0.01 && amt <= lim.maxTotal + 0.01) return null;
  const fmt = (n) => Number(n).toLocaleString();
  return lim.fixed
    ? t.amountExactly.replace("{total}", fmt(lim.minTotal))
    : t.amountBetween
        .replace("{min}", fmt(lim.minTotal))
        .replace("{max}", fmt(lim.maxTotal));
}
