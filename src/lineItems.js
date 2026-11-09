// Helpers for multi-item Sales / Credits entries (see components/LineItems.jsx)
import { stockLabel, findStockByLabel, roundQty, roundMoney } from "./hooks/useStock";
import { priceError } from "./stockPrice";

let _seq = 0;
export const newLine = () => ({
  key: `l${Date.now()}_${_seq++}`,
  stockId: "",
  text: "",
  quantity: "1",
  amount: "",
  unitPrice: null, // per-unit price, so total = unit × qty as qty changes
});

// The stock item a line refers to (picked from the list, or typed exactly)
export const lineStock = (line, stock) =>
  (line.stockId && stock.find((s) => s.id === line.stockId)) ||
  findStockByLabel(stock, line.text);

export const lineQty = (line) => roundQty(parseFloat(line.quantity)) || 1;

export const linesTotal = (lines) =>
  roundMoney(lines.reduce((a, l) => a + (parseFloat(l.amount) || 0), 0));

// Lines that actually have something on them (blank extra rows are ignored)
export const filledLines = (lines) =>
  lines.filter((l) => l.text.trim() || l.stockId || l.amount !== "");

// → error text, or null when every line can be saved.
export function validateLines(lines, stock, touchStock, t) {
  const used = filledLines(lines);
  if (used.length === 0) return t.addOneItem || "Add at least one item.";

  const needed = new Map(); // stockId → total qty across all lines
  for (const line of used) {
    if (!line.text.trim())
      return t.chooseItemEachLine || "Choose an item on every line.";
    const amt = parseFloat(line.amount);
    if (Number.isNaN(amt) || amt <= 0)
      return `${line.text}: ${t.enterAmount || "enter the amount."}`;
    const s = lineStock(line, stock);
    if (!s) continue;
    const bad = priceError(s, lineQty(line), amt, t);
    if (bad) return `${stockLabel(s)}: ${bad}`;
    if (touchStock && s.quantity != null)
      needed.set(s.id, roundQty((needed.get(s.id) || 0) + lineQty(line)));
  }

  for (const [id, qty] of needed) {
    const s = stock.find((x) => x.id === id);
    const available = Number(s.quantity);
    if (available <= 1e-9) return `${stockLabel(s)} is out of stock.`;
    if (qty > available + 1e-9)
      return `Only ${available.toLocaleString()} ${stockLabel(s)} left in stock.`;
  }
  return null;
}

// "Sugar × 2, Bread × 1" — a short summary for one-line displays
export const summarizeLines = (items) =>
  items
    .map((i) =>
      Number(i.quantity) && Number(i.quantity) !== 1
        ? `${i.description} × ${Number(i.quantity).toLocaleString()}`
        : i.description,
    )
    .join(", ");
