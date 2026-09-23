import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "../hooks/useCollection";
import {
  useStock,
  recordStockSale,
  stockLabel,
  findStockByLabel,
  roundQty,
  roundMoney,
} from "../hooks/useStock";
import { PAYMENT_METHODS, paymentMethodOptions } from "../paymentMethods";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

export default function Sales({ ownerUid, sub }) {
  const { t } = useLang();
  // If ownerUid is passed, query by ownerUid to get all sales including staff.
  // Otherwise fall back to normal userId query (staff's own view).
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("sales", ownerUid ? { ownerUid } : undefined);
  const stock = useStock();
  const { toast, showToast } = useToast();

  // Owner's branches — lets the owner tag a sale with WHERE it happened
  // (e.g. Nairobi vs Mombasa), so Reports can compare locations. Only
  // relevant on the Business plan (multipleBranches), and only when the
  // owner has actually set up at least one branch.
  const [branches, setBranches] = useState([]);
  const canUseBranches = ownerUid && sub?.can?.("multipleBranches");
  useEffect(() => {
    if (!canUseBranches) return;
    const unsub = onSnapshot(
      collection(db, "users", ownerUid, "branches"),
      (snap) =>
        setBranches(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((b) => b.active !== false),
        ),
      () => setBranches([]),
    );
    return () => unsub();
  }, [ownerUid, canUseBranches]);

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    description: "",
    customer: "",
    phone: "",
    quantity: "1",
    amount: "",
    paymentMethod: "cash",
    branchId: "",
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

  // The picker goes by stock id (not name) so two sizes of the same product —
  // e.g. Water 0.375 L and Water 0.5 L — can each be picked, priced and
  // deducted separately.
  const handleStockSelect = (e) => {
    const found = stock.find((c) => c.id === e.target.value);
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
      description: found ? stockLabel(found) : "",
      amount: up != null ? String(roundMoney(up * qty)) : f.amount,
    }));
  };

  // Quantity changed — recompute the total from the known unit price so
  // "10 items at 1,000 each" always lands on 10,000, not 1,000.
  const handleQuantityChange = (e) => {
    const q = e.target.value;
    setForm((f) => ({
      ...f,
      quantity: q,
      amount:
        unitPrice != null
          ? String(roundMoney(unitPrice * (parseFloat(q) || 0)))
          : f.amount,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;

    // Quantity may be fractional (0.375 L, 0.5 kg …)
    const qty = roundQty(parseFloat(form.quantity)) || 1;

    // Resolve the stock match even if it wasn't picked from the dropdown
    // (e.g. typed straight into the description field), so a zero-stock
    // item can't be sold just by bypassing the picker.
    const matchedStock =
      selectedStock || findStockByLabel(stock, form.description);

    // If this sale is against a tracked stock item, make sure there's
    // enough left — and block entirely if it's out of stock.
    if (matchedStock && matchedStock.quantity != null) {
      const available = Number(matchedStock.quantity);
      if (available <= 1e-9) {
        showToast(`${stockLabel(matchedStock)} is out of stock.`, "error");
        return;
      }
      if (qty > available + 1e-9) {
        showToast(
          `Only ${available.toLocaleString()} ${stockLabel(matchedStock)} left in stock.`,
          "error",
        );
        return;
      }
    }

    setStatus("saving");
    try {
      const chosenBranch = branches.find((b) => b.id === form.branchId);
      const { branchId: _branchId, ...saleData } = form;
      await addItem(
        {
          ...saleData,
          amount: parseFloat(form.amount),
          quantity: qty,
        },
        chosenBranch
          ? { branchId: chosenBranch.id, branchName: chosenBranch.name }
          : {},
      );

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
      options: paymentMethodOptions(t),
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
    // branchName is display-only — where this sale happened (Nairobi,
    // Mombasa, etc). Only shown for owners on the Business plan.
    ...(canUseBranches && branches.length > 0
      ? [{
          key: "branchName",
          label: "Location",
          readOnly: true,
          format: (v) => v
            ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#3b82f615", color: "#3b82f6" }}>📍 {v}</span>
            : <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>,
        }]
      : []),
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
            {canUseBranches && branches.length > 0 && (
              <div className="field-group">
                <label htmlFor="sale-branch">📍 Location / Branch</label>
                <select
                  id="sale-branch"
                  name="sale-branch"
                  value={form.branchId}
                  onChange={(e) =>
                    setForm({ ...form, branchId: e.target.value })
                  }
                >
                  <option value="">— No specific branch —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.location ? ` (${b.location})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {stock.length > 0 && (
              <div className="field-group">
                <label htmlFor="sale-stock">{t.pickStock}</label>
                <select
                  id="sale-stock"
                  name="sale-stock"
                  onChange={handleStockSelect}
                  value={selectedStock?.id || ""}
                >
                  <option value="">{t.selectItem}</option>
                  {stock.map((c) => {
                    const outOfStock = c.quantity != null && Number(c.quantity) <= 0;
                    return (
                      <option key={c.id} value={c.id} disabled={outOfStock}>
                        {stockLabel(c)}
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
              <label htmlFor="sale-quantity">
                {t.quantity}
                {selectedStock?.unit ? ` (${selectedStock.unit})` : ""}
              </label>
              <input
                id="sale-quantity"
                name="sale-quantity"
                type="number"
                autoComplete="off"
                min="0.001"
                step="any"
                inputMode="decimal"
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
                      setForm((f) => ({
                        ...f,
                        amount: String(roundMoney(up * qty)),
                      }));
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
