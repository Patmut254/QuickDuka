import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useStock, recordStockSale } from "../hooks/useStock";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

const PAYMENT_METHODS = ["cash", "mpesa", "airtel", "card"];

export default function Sales({ ownerUid }) {
  const { t } = useLang();
  // If ownerUid is passed, query by ownerUid to get all sales including staff.
  // Otherwise fall back to normal userId query (staff's own view).
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("sales", ownerUid ? { ownerUid } : undefined);
  const stock = useStock();
  const { toast, showToast } = useToast();

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    description: "",
    customer: "",
    phone: "",
    quantity: "1",
    amount: "",
    paymentMethod: "cash",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);
  // Tracks the matched stock item (if any) so we know its id (to decrement
  // quantity on save) and its price mode (to bound the discount slider).
  const [selectedStock, setSelectedStock] = useState(null);
  // Per-unit price of the selected stock item — kept separate from
  // form.amount (which is the TOTAL) so total = unitPrice × quantity
  // always stays correct as either one changes.
  const [unitPrice, setUnitPrice] = useState(null);

  const handleStockSelect = (e) => {
    const found = stock.find((c) => c.name === e.target.value);
    setSelectedStock(found || null);
    let up = null;
    if (found) {
      // default to full price; discount by dragging the range slider down
      up =
        found.priceMode === "range" && found.maxPrice != null
          ? Number(found.maxPrice)
          : found.price != null
            ? Number(found.price)
            : null;
    }
    setUnitPrice(up);
    const qty = parseFloat(form.quantity) || 1;
    setForm((f) => ({
      ...f,
      description: found ? found.name : e.target.value,
      amount: up != null ? String(up * qty) : f.amount,
    }));
  };

  // Quantity changed — recompute the total from the known unit price so
  // "10 items at 1,000 each" always lands on 10,000, not 1,000.
  const handleQuantityChange = (e) => {
    const q = e.target.value;
    setForm((f) => ({
      ...f,
      quantity: q,
      amount: unitPrice != null ? String(unitPrice * (parseFloat(q) || 0)) : f.amount,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;

    const qty = parseFloat(form.quantity) || 1;

    // Resolve the stock match even if it wasn't picked from the dropdown
    // (e.g. typed straight into the description field), so a zero-stock
    // item can't be sold just by bypassing the picker.
    const matchedStock =
      selectedStock ||
      stock.find(
        (c) => c.name.trim().toLowerCase() === form.description.trim().toLowerCase(),
      ) ||
      null;

    // If this sale is against a tracked stock item, make sure there's
    // enough left — and block entirely if it's out of stock.
    if (matchedStock && matchedStock.quantity != null) {
      const available = Number(matchedStock.quantity);
      if (available <= 0) {
        showToast(`${matchedStock.name} is out of stock.`, "error");
        return;
      }
      if (qty > available) {
        showToast(
          `Only ${available.toLocaleString()} ${matchedStock.name} left in stock.`,
          "error",
        );
        return;
      }
    }

    setStatus("saving");
    try {
      await addItem({
        ...form,
        amount: parseFloat(form.amount),
        quantity: qty,
      });

      // Bookkeeping: reduce stock quantity by the amount sold.
      if (matchedStock && matchedStock.quantity != null) {
        await recordStockSale(matchedStock.id, qty);
      }

      setStatus("saved");
      showToast(t.saved);
      setTimeout(() => {
        setStatus("idle");
        setForm(emptyForm);
        setSelectedStock(null);
        setUnitPrice(null);
        setShowForm(false);
      }, 1500);
    } catch {
      setStatus("idle");
      showToast(t.failedSave, "error");
    }
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const columns = [
    { key: "date", label: t.date, inputType: "date" },
    { key: "description", label: t.itemSold },
    { key: "customer", label: t.customer },
    {
      key: "phone",
      label: t.phone,
      inputType: "tel",
      format: (v) =>
        v ? (
          <a
            href={`tel:${v}`}
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            {v}
          </a>
        ) : (
          "-"
        ),
    },
    {
      key: "quantity",
      label: t.quantity,
      inputType: "number",
      format: (v) => (v != null && v !== "" ? Number(v).toLocaleString() : "-"),
    },
    {
      key: "amount",
      label: t.amount,
      inputType: "number",
      format: (v) => `KES ${Number(v).toLocaleString()}`,
    },
    {
      key: "paymentMethod",
      label: t.paymentMethod,
      type: "select",
      options: PAYMENT_METHODS,
      format: (v) => (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 20,
            background: "var(--accent)15",
            color: "var(--accent)",
            textTransform: "capitalize",
          }}
        >
          {t.paymentMethods?.[v] || v || t.paymentMethods?.cash || "Cash"}
        </span>
      ),
    },
    { key: "notes", label: t.notes },
    // staffName is display-only — mark readOnly so EntryTable skips it in edit mode
    ...(ownerUid
      ? [{
          key: "staffName",
          label: "By",
          readOnly: true,
          format: (v) => v
            ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: "var(--accent)15", color: "var(--accent)" }}>{v}</span>
            : <span style={{ fontSize: 11, color: "var(--muted)" }}>Owner</span>,
        }]
      : []),
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">{t.totalSales}</span>
          <span className="stat-value green">KES {total.toLocaleString()}</span>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setStatus("idle");
            if (showForm) {
              setForm(emptyForm);
              setSelectedStock(null);
              setUnitPrice(null);
            }
          }}
        >
          {showForm ? `✕ ${t.cancel}` : `+ ${t.newSale}`}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>📦 {t.recordSale}</h3>
          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="sale-date">{t.date} *</label>
              <input
                id="sale-date"
                name="sale-date"
                type="date"
                autoComplete="off"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            {stock.length > 0 && (
              <div className="field-group">
                <label htmlFor="sale-stock">{t.pickStock}</label>
                <select
                  id="sale-stock"
                  name="sale-stock"
                  onChange={handleStockSelect}
                  value={form.description}
                >
                  <option value="">{t.selectItem}</option>
                  {stock.map((c) => {
                    const outOfStock = c.quantity != null && Number(c.quantity) <= 0;
                    return (
                      <option key={c.id} value={c.name} disabled={outOfStock}>
                        {c.name}
                        {c.price != null
                          ? ` — KES ${Number(c.price).toLocaleString()}${c.unit ? `/${c.unit}` : ""}`
                          : ""}
                        {outOfStock ? ` (${t.outOfStock || "Out of stock"})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <div className="field-group">
              <label htmlFor="sale-description">{t.itemSold} *</label>
              <input
                id="sale-description"
                name="sale-description"
                autoComplete="off"
                placeholder={t.itemSoldPh}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="sale-customer">{t.customer}</label>
              <input
                id="sale-customer"
                name="sale-customer"
                autoComplete="name"
                placeholder={t.customerPh}
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="sale-phone">{t.phone}</label>
              <input
                id="sale-phone"
                name="sale-phone"
                type="tel"
                autoComplete="tel"
                placeholder="07XX XXX XXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="sale-quantity">{t.quantity}</label>
              <input
                id="sale-quantity"
                name="sale-quantity"
                type="number"
                autoComplete="off"
                min="1"
                step="1"
                value={form.quantity}
                onChange={handleQuantityChange}
              />
              {selectedStock?.quantity != null && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {t.qtyInStock}: {Number(selectedStock.quantity).toLocaleString()}
                </div>
              )}
            </div>
            <div className="field-group">
              <label htmlFor="sale-amount">
                {t.amount} *
                {selectedStock?.priceMode === "range" && (
                  <span style={{ fontWeight: 400, color: "var(--muted)" }}>
                    {" "}
                    ({t.priceRange}: KES {Number(selectedStock.minPrice).toLocaleString()}–
                    {Number(selectedStock.maxPrice).toLocaleString()})
                  </span>
                )}
              </label>
              {selectedStock?.priceMode === "range" &&
              selectedStock.minPrice != null &&
              selectedStock.maxPrice != null ? (
                <div>
                  <input
                    id="sale-amount"
                    name="sale-amount"
                    type="range"
                    min={selectedStock.minPrice}
                    max={selectedStock.maxPrice}
                    step="0.01"
                    value={unitPrice ?? selectedStock.maxPrice}
                    onChange={(e) => {
                      const up = parseFloat(e.target.value);
                      const qty = parseFloat(form.quantity) || 1;
                      setUnitPrice(up);
                      setForm((f) => ({ ...f, amount: String(up * qty) }));
                    }}
                    style={{ width: "100%" }}
                  />
                  <div style={{ fontWeight: 600, marginTop: 4 }}>
                    KES {Number(unitPrice ?? selectedStock.maxPrice).toLocaleString()} / unit
                    {" × "}
                    {parseFloat(form.quantity) || 1} = KES{" "}
                    {Number(form.amount || 0).toLocaleString()}
                  </div>
                </div>
              ) : (
                <>
                  <input
                    id="sale-amount"
                    name="sale-amount"
                    type="number"
                    autoComplete="off"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                  {unitPrice != null && Number(form.quantity) > 1 && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      KES {unitPrice.toLocaleString()} × {form.quantity} ={" "}
                      KES {(unitPrice * (parseFloat(form.quantity) || 0)).toLocaleString()}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="field-group">
              <label htmlFor="sale-payment-method">{t.paymentMethod}</label>
              <select
                id="sale-payment-method"
                name="sale-payment-method"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t.paymentMethods?.[m] || m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group full-width">
              <label htmlFor="sale-notes">{t.notes}</label>
              <input
                id="sale-notes"
                name="sale-notes"
                autoComplete="off"
                placeholder="..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <button
            type="submit"
            className={"btn-primary" + (status === "saved" ? " btn-saved" : "")}
            disabled={status !== "idle"}
          >
            {status === "saving"
              ? t.saving
              : status === "saved"
                ? t.saved
                : t.saveSale}
          </button>
        </form>
      )}

      <EntryTable
        items={items}
        loading={loading}
        columns={columns}
        onDelete={deleteItem}
        onUpdate={updateItem}
        showToast={showToast}
        emptyMessage={t.noSales}
      />
    </div>
  );
}
