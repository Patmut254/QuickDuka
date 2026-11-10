// BatchRows — enter several expenses / losses / purchases in one go.
// Shared details (date, supplier, notes…) stay in the form; each row holds
// only what changes per entry. A total shows under the rows, with the Save
// button beside it (same layout as the Sales cart).
//
// fields: [{ key, label, type: "text" | "number" | "select" | "stock",
//            options, placeholder, required, grow,
//            onStockPick(stockItem, row) -> patch,   (type "stock": free text
//                                      with stock suggestions)
//            onChange(value, row) -> patch,          (optional extra patch)
//            extra: { when(row), key, placeholder } } (e.g. "Other" category)
import { stockLabel, findStockByLabel } from "../hooks/useStock";
import { usedRows } from "../batchRows";

export default function BatchRows({
  rows,
  setRows,
  fields,
  stock = [],
  t,
  idPrefix,
  makeRow,
  totalKey = "amount",
  totalLabel,
  addLabel,
  action,
}) {
  const patch = (key, p) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const total = rows.reduce((a, r) => a + (parseFloat(r[totalKey]) || 0), 0);
  const cols = fields.map((f) => (f.grow ? `minmax(0, ${f.grow}fr)` : "minmax(0, 1fr)")).join(" ");

  return (
    <div className="batch">
      {fields.some((f) => f.type === "stock") && (
        <datalist id={`${idPrefix}-stocklist`}>
          {stock.map((s) => (
            <option key={s.id} value={stockLabel(s)} />
          ))}
        </datalist>
      )}
      <div className="batch-head" style={{ gridTemplateColumns: `${cols} 32px` }}>
        {fields.map((f) => (
          <span key={f.key}>
            {f.label}
            {f.required ? " *" : ""}
          </span>
        ))}
        <span />
      </div>

      {rows.map((row, i) => (
        <div key={row.key} className="batch-row" style={{ gridTemplateColumns: `${cols} 32px` }}>
          {fields.map((f) => {
            const id = `${idPrefix}-${f.key}-${i}`;
            const set = (v) => patch(row.key, { [f.key]: v, ...(f.onChange ? f.onChange(v, row) : {}) });
            let input;
            if (f.type === "stock") {
              input = (
                <input
                  id={id}
                  aria-label={f.label}
                  list={`${idPrefix}-stocklist`}
                  autoComplete="off"
                  placeholder={f.placeholder || t.searchItems || "Search items"}
                  value={row[f.key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const s = findStockByLabel(stock, v);
                    patch(row.key, {
                      [f.key]: v,
                      _stockId: s ? s.id : "",
                      ...(s && f.onStockPick ? f.onStockPick(s, row) : {}),
                    });
                  }}
                />
              );
            } else if (f.type === "select") {
              input = (
                <select id={id} aria-label={f.label} value={row[f.key] ?? ""} onChange={(e) => set(e.target.value)}>
                  {f.placeholder && <option value="">{f.placeholder}</option>}
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              );
            } else {
              input = (
                <input
                  id={id}
                  aria-label={f.label}
                  type={f.type === "number" ? "number" : "text"}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  min={f.type === "number" ? "0" : undefined}
                  step={f.type === "number" ? "any" : undefined}
                  autoComplete="off"
                  placeholder={f.placeholder || ""}
                  value={row[f.key] ?? ""}
                  onChange={(e) => set(e.target.value)}
                />
              );
            }
            return (
              <div key={f.key} className="batch-cell" data-label={f.label}>
                {input}
                {f.extra && f.extra.when(row) && (
                  <input
                    aria-label={f.extra.placeholder}
                    autoComplete="off"
                    placeholder={f.extra.placeholder}
                    value={row[f.extra.key] ?? ""}
                    onChange={(e) => patch(row.key, { [f.extra.key]: e.target.value })}
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="cart-remove"
            title={t.remove || "Remove"}
            aria-label={t.remove || "Remove"}
            disabled={rows.length === 1}
            style={rows.length === 1 ? { visibility: "hidden" } : undefined}
            onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
          >
            ✕
          </button>
        </div>
      ))}

      <button type="button" className="batch-add" onClick={() => setRows((rs) => [...rs, makeRow()])}>
        + {addLabel || t.addAnotherRow || "Add another"}
      </button>

      <div className="line-items-total">
        <div className="line-items-total-amount">
          <span>
            {totalLabel}
            {usedRows(rows, fields).length > 1 ? ` · ${usedRows(rows, fields).length} ${t.itemsWord || "items"}` : ""}
          </span>
          <strong>KES {Math.round(total * 100) / 100 > 0 ? (Math.round(total * 100) / 100).toLocaleString() : 0}</strong>
        </div>
        {action}
      </div>
    </div>
  );
}
