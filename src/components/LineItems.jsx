// LineItems — lets one customer buy (or take on credit) SEVERAL items in a
// single entry. Each line has its own item, quantity and amount, and the
// grand total shows underneath. Used by the Sales and Credits forms.
import ItemPicker from "./ItemPicker";
import { stockOptions } from "../stockOptions";
import { stockLabel, roundMoney } from "../hooks/useStock";
import { priceLimits } from "../stockPrice";
import { newLine, lineStock, linesTotal, filledLines } from "../lineItems";

export default function LineItems({
  lines,
  setLines,
  stock,
  t,
  idPrefix,
  itemLabel,
  qtyLabel,
  amountLabel,
  totalLabel,
}) {
  const update = (key, fn) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...fn(l) } : l)));

  const pick = (key, stockId) => {
    const found = stock.find((s) => s.id === stockId) || null;
    update(key, (l) => {
      const up = found
        ? found.priceMode === "range" && found.maxPrice != null
          ? Number(found.maxPrice)
          : found.price != null
            ? Number(found.price)
            : null
        : null;
      const qty = parseFloat(l.quantity) || 1;
      return {
        stockId: found ? found.id : "",
        text: found ? stockLabel(found) : "",
        unitPrice: up,
        amount: up != null ? String(roundMoney(up * qty)) : l.amount,
      };
    });
  };

  const options = stockOptions(stock, {
    labelFn: stockLabel,
    t,
    disableOut: true,
  });
  const total = linesTotal(lines);
  const many = lines.length > 1;

  return (
    <div className="field-group full-width line-items">
      {lines.map((line, idx) => {
        const s = lineStock(line, stock);
        const qty = parseFloat(line.quantity) || 0;
        const amt = parseFloat(line.amount) || 0;
        const lim = s ? priceLimits(s, qty || 1) : null;
        const outside =
          lim &&
          amt > 0 &&
          (amt < lim.minTotal - 0.01 || amt > lim.maxTotal + 0.01);
        const pre = `${idPrefix}-${idx}`;
        return (
          <div key={line.key} className="line-item">
            {many && (
              <div className="line-item-head">
                <span>
                  {t.itemNo || "Item"} {idx + 1}
                </span>
                <button
                  type="button"
                  className="line-item-remove"
                  onClick={() =>
                    setLines((ls) => ls.filter((l) => l.key !== line.key))
                  }
                >
                  ✕ {t.remove || "Remove"}
                </button>
              </div>
            )}
            <div className="form-grid">
              <ItemPicker
                id={`${pre}-item`}
                label={itemLabel}
                required={idx === 0}
                t={t}
                options={options}
                selectedValue={line.stockId}
                text={line.text}
                onPick={(v) => pick(line.key, v)}
                onCustom={(txt) =>
                  update(line.key, () => ({
                    stockId: "",
                    unitPrice: null,
                    text: txt,
                  }))
                }
              />
              <div className="field-group">
                <label htmlFor={`${pre}-qty`}>
                  {qtyLabel}
                  {s?.unit ? ` (${s.unit})` : ""}
                </label>
                <input
                  id={`${pre}-qty`}
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
                {s?.quantity != null && (
                  <div className="line-item-hint">
                    {t.qtyInStock}: {Number(s.quantity).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="field-group">
                <label htmlFor={`${pre}-amount`}>
                  {amountLabel}
                  {s?.priceMode === "range" && (
                    <span style={{ fontWeight: 400, color: "var(--muted)" }}>
                      {" "}
                      ({t.priceRange}: KES {Number(s.minPrice).toLocaleString()}{" "}
                      to {Number(s.maxPrice).toLocaleString()})
                    </span>
                  )}
                </label>
                <input
                  id={`${pre}-amount`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  min={lim ? lim.minTotal : "0"}
                  max={lim ? lim.maxTotal : undefined}
                  value={line.amount}
                  required={idx === 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(line.key, (l) => ({
                      amount: v,
                      // remember the per-unit price typed, so changing the
                      // quantity afterwards scales from it
                      unitPrice:
                        l.unitPrice != null && v !== ""
                          ? roundMoney(
                              (parseFloat(v) || 0) / (parseFloat(l.quantity) || 1),
                            )
                          : l.unitPrice,
                    }));
                  }}
                />
                {(lim || (line.unitPrice != null && qty > 1)) && (
                  <div
                    className="line-item-hint"
                    style={
                      outside ? { color: "#dc2626", fontWeight: 600 } : undefined
                    }
                  >
                    KES {roundMoney(qty > 0 ? amt / qty : 0).toLocaleString()} /
                    unit × {qty || 1} = KES {amt.toLocaleString()}
                    {lim &&
                      ` · ${t.allowedAmount}: ` +
                        (lim.fixed
                          ? `KES ${lim.minTotal.toLocaleString()}`
                          : `KES ${lim.minTotal.toLocaleString()} to ${lim.maxTotal.toLocaleString()}`)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className="btn-secondary line-item-add"
        onClick={() => setLines((ls) => [...ls, newLine()])}
      >
        + {t.addAnotherItem || "Add another item"}
      </button>

      <div className="line-items-total">
        <span>
          {totalLabel}
          {many ? ` (${filledLines(lines).length} ${t.itemsWord || "items"})` : ""}
        </span>
        <strong>KES {total.toLocaleString()}</strong>
      </div>
    </div>
  );
}
