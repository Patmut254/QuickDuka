// LineItems — a till-style cart. Search or tap an item and it drops into
// the list below; tap it again to add one more. Each row's quantity and
// amount can be adjusted, and the total shows underneath.
// Used by the Sales and Credits forms (new entries and "add item").
import ItemPicker from "./ItemPicker";
import { stockOptions } from "../stockOptions";
import { roundMoney } from "../hooks/useStock";
import { priceLimits } from "../stockPrice";
import {
  newLine,
  lineStock,
  linesTotal,
  addStockToLines,
} from "../lineItems";

export default function LineItems({
  lines,
  setLines,
  stock,
  t,
  idPrefix,
  itemLabel,
  totalLabel,
  baseTotal = 0, // already-saved amount when adding to an existing entry
}) {
  const update = (key, fn) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...fn(l) } : l)));
  const remove = (key) => setLines((ls) => ls.filter((l) => l.key !== key));

  const options = stockOptions(stock, {
    labelFn: (s) => (s.variant ? `${s.name} (${s.variant})` : s.name),
    t,
    disableOut: true,
  });
  const total = roundMoney(baseTotal + linesTotal(lines));

  return (
    <div className="field-group full-width cart">
      <div className="cart-picker">
        <ItemPicker
          id={`${idPrefix}-item`}
          label={itemLabel}
          t={t}
          options={options}
          selectedValue=""
          text=""
          listOnType
          onPick={(v) => {
            const s = stock.find((x) => x.id === v);
            if (s) setLines((ls) => addStockToLines(ls, s));
          }}
          onCustom={(txt) =>
            setLines((ls) => [...ls, { ...newLine(), text: txt }])
          }
        />
      </div>

      {lines.length === 0 ? (
        <div className="cart-empty">
          {t.cartEmpty || "Type an item name above, then tap it to add."}
        </div>
      ) : (
        <div className="cart-list">
          <div className="cart-row cart-row-head">
            <span>{t.itemNo || "Item"}</span>
            <span>{t.quantity || "Qty"}</span>
            <span>{t.amount || "Amount"}</span>
            <span />
          </div>
          {lines.map((line) => {
            const s = lineStock(line, stock);
            const qty = parseFloat(line.quantity) || 0;
            const amt = parseFloat(line.amount) || 0;
            const lim = s ? priceLimits(s, qty || 1) : null;
            const outside =
              lim &&
              amt > 0 &&
              (amt < lim.minTotal - 0.01 || amt > lim.maxTotal + 0.01);
            return (
              <div key={line.key} className="cart-row">
                <span className="cart-name">
                  {line.text}
                  {!s && (
                    <em className="cart-tag">{t.notInStock || "Not in stock"}</em>
                  )}
                  {(outside || (lim && !lim.fixed)) && (
                    <small style={outside ? { color: "#a33a2a" } : undefined}>
                      {t.allowedAmount}:{" "}
                      {lim.fixed
                        ? `KES ${lim.minTotal.toLocaleString()}`
                        : `KES ${lim.minTotal.toLocaleString()} to ${lim.maxTotal.toLocaleString()}`}
                    </small>
                  )}
                </span>
                <input
                  aria-label={t.quantity || "Quantity"}
                  type="number"
                  min="0.001"
                  step="any"
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(e) => {
                    const q = e.target.value;
                    update(line.key, (l) => ({
                      quantity: q,
                      amount:
                        l.unitPrice != null
                          ? String(roundMoney(l.unitPrice * (parseFloat(q) || 0)))
                          : l.amount,
                    }));
                  }}
                />
                <input
                  aria-label={t.amount || "Amount"}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0"
                  value={line.amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(line.key, (l) => ({
                      amount: v,
                      // remember the per-unit price typed, so changing the
                      // quantity afterwards scales from it
                      unitPrice:
                        v !== ""
                          ? roundMoney(
                              (parseFloat(v) || 0) / (parseFloat(l.quantity) || 1),
                            )
                          : l.unitPrice,
                    }));
                  }}
                />
                <button
                  type="button"
                  className="cart-remove"
                  title={t.remove || "Remove"}
                  onClick={() => remove(line.key)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="line-items-total">
        <span>{totalLabel}</span>
        <strong>KES {total.toLocaleString()}</strong>
      </div>
    </div>
  );
}
