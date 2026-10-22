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
import { priceLimits, priceError } from "../stockPrice";
import EntryDate, { StockUpdateToggle } from "./EntryDate";
import { localToday, stockUpdateWanted } from "../dates";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";
import ItemPicker from "./ItemPicker";
import { stockOptions } from "../stockOptions";

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

  // Date stays on the last day used, so a batch of old sales (e.g. April) can be
  // entered one after another without re-picking the date each time.
  const [lastDate, setLastDate] = useState(localToday);
  // Whether a back-dated sale should also change current stock (null = default)
  const [stockChoice, setStockChoice] = useState(null);

  const emptyForm = {
    date: lastDate,
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

  // The seller types the amount actually paid. Remember the per-unit price it
  // implies, so changing the quantity afterwards scales from THAT price rather
  // than jumping back to the list price.
  const handleAmountChange = (e) => {
    const value = e.target.value;
    const qty = parseFloat(form.quantity) || 1;
    setForm((f) => ({ ...f, amount: value }));
    if (unitPrice != null && value !== "") {
      setUnitPrice(roundMoney((parseFloat(value) || 0) / qty));
    }
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

    // Old sales usually don't touch today's stock count (see dates.js)
    const touchStock = stockUpdateWanted(form.date, stockChoice);

    // The amount must stay inside the price set on the stock item: a range
    // (min–max) or the single fixed price — never above or below it.
    const badPrice = matchedStock
      ? priceError(matchedStock, qty, parseFloat(form.amount), t)
      : null;
    if (badPrice) {
      showToast(badPrice, "error");
      return;
    }

    // If this sale is against a tracked stock item, make sure there's
    // enough left — and block entirely if it's out of stock.
    if (touchStock && matchedStock && matchedStock.quantity != null) {
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
      if (touchStock && matchedStock && matchedStock.quantity != null) {
        await recordStockSale(matchedStock.id, qty);
      }

      setStatus("saved");
      showToast(t.saved);
      const savedDate = form.date;
      setTimeout(() => {
        setStatus("idle");
        setLastDate(savedDate); // next entry starts on the same day
        setForm({ ...emptyForm, date: savedDate });
        setStockChoice(null);
        setSelectedStock(null);
        setUnitPrice(null);
        setShowForm(false);
      }, 1500);
    } catch {
      setStatus("idle");
      showToast(t.failedSave, "error");
    }
  };

  // Editing a sale's amount in the table is held to the same price limits as
  // a new sale (only when the amount actually changed, so old entries can
  // still have other fields corrected).
  const handleUpdate = async (id, newData, oldData) => {
    if (
      !oldData?.fromCredit && // credit payments are part-payments, not prices
      Number(newData.amount) !== Number(oldData?.amount)
    ) {
      const item = findStockByLabel(stock, newData.description ?? oldData?.description);
      const qty = Number(newData.quantity ?? oldData?.quantity) || 1;
      const msg = item ? priceError(item, qty, Number(newData.amount), t) : null;
      if (msg) {
        const err = new Error(msg);
        err.userMessage = msg;
        throw err;
      }
    }
    return updateItem(id, newData, oldData);
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
            ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#3b82f615", color: "#3b82f6" }}>{v}</span>
            : <span style={{ fontSize: 11, color: "var(--muted)" }}></span>,
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
          {showForm ? `${t.cancel}` : `+ ${t.newSale}`}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>{t.recordSale}</h3>
          <div className="form-grid">
            <EntryDate
              id="sale-date"
              value={form.date}
              onChange={(d) => {
                setForm({ ...form, date: d });
                setStockChoice(null);
              }}
            />
            {(selectedStock || findStockByLabel(stock, form.description)) && (
              <StockUpdateToggle
                date={form.date}
                checked={stockUpdateWanted(form.date, stockChoice)}
                onChange={setStockChoice}
              />
            )}
            {canUseBranches && branches.length > 0 && (
              <div className="field-group">
                <label htmlFor="sale-branch">Location / Branch</label>
                <select
                  id="sale-branch"
                  name="sale-branch"
                  value={form.branchId}
                  onChange={(e) =>
                    setForm({ ...form, branchId: e.target.value })
                  }
                >
                  <option value="">No specific branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.location ? ` (${b.location})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <ItemPicker
              id="sale-item"
              label={t.itemSold}
              required
              t={t}
              options={stockOptions(stock, { labelFn: stockLabel, t, disableOut: true })}
              selectedValue={selectedStock?.id || ""}
              text={form.description}
              onPick={(v) => handleStockSelect({ target: { value: v } })}
              onCustom={(txt) => {
                handleStockSelect({ target: { value: "" } });
                setForm((f) => ({ ...f, description: txt }));
              }}
            />
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
                    ({t.priceRange}: KES {Number(selectedStock.minPrice).toLocaleString()} to 
                    {Number(selectedStock.maxPrice).toLocaleString()})
                  </span>
                )}
              </label>
              {/* The seller types what the customer actually pays. The amount must
                  stay inside the price set on the stock item (range or fixed). */}
              {(() => {
                const qty = parseFloat(form.quantity) || 0;
                const lim = selectedStock ? priceLimits(selectedStock, qty || 1) : null;
                return (
                  <input
                    id="sale-amount"
                    name="sale-amount"
                    type="number"
                    autoComplete="off"
                    inputMode="decimal"
                    min={lim ? lim.minTotal : "0"}
                    max={lim ? lim.maxTotal : undefined}
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={handleAmountChange}
                    required
                  />
                );
              })()}
              {(() => {
                const qty = parseFloat(form.quantity) || 0;
                const amt = parseFloat(form.amount) || 0;
                const lim = selectedStock ? priceLimits(selectedStock, qty || 1) : null;
                if (!lim && !(unitPrice != null && qty > 1)) return null;
                const perUnit = qty > 0 ? amt / qty : 0;
                const outside =
                  lim && amt > 0 && (amt < lim.minTotal - 0.01 || amt > lim.maxTotal + 0.01);
                return (
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 4,
                      color: outside ? "#dc2626" : "var(--muted)",
                      fontWeight: outside ? 600 : 400,
                    }}
                  >
                    KES {roundMoney(perUnit).toLocaleString()} / unit × {qty || 1} ={" "}
                    KES {amt.toLocaleString()}
                    {lim &&
                      ` · ${t.allowedAmount}: ` +
                        (lim.fixed
                          ? `KES ${lim.minTotal.toLocaleString()}`
                          : `KES ${lim.minTotal.toLocaleString()} to ${lim.maxTotal.toLocaleString()}`)}
                  </div>
                );
              })()}
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
        onUpdate={handleUpdate}
        showToast={showToast}
        emptyMessage={t.noSales}
      />
    </div>
  );
}
