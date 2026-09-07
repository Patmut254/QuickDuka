import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { recordStockPurchase } from "../hooks/useStock";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

export default function Purchases({ ownerUid }) {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("purchases", ownerUid ? { ownerUid } : undefined);
  // Use the writable stock collection directly (not the read-only
  // useStock hook) so a purchase can auto-create or top up a stock item —
  // purchasing goods should feed straight into the stock ledger.
  const {
    items: stock,
    addItem: addStockItem,
  } = useCollection("stock", ownerUid ? { ownerUid } : undefined);
  const { toast, showToast } = useToast();

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    item: "",
    supplier: "",
    phone: "",
    quantity: "",
    amount: "",
    category: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);
  // Per-unit buy price of the selected stock item — kept separate from
  // form.amount (the TOTAL spend) so total = unitPrice × quantity always
  // stays correct as either one changes.
  const [unitPrice, setUnitPrice] = useState(null);

  const handleStockSelect = (e) => {
    const found = stock.find((c) => c.name === e.target.value);
    const up = found?.buyPrice != null ? Number(found.buyPrice) : null;
    setUnitPrice(up);
    const qty = parseFloat(form.quantity) || 1;
    setForm((f) => ({
      ...f,
      item: found ? found.name : e.target.value,
      amount: up != null ? String(up * qty) : f.amount,
    }));
  };

  // Quantity changed — recompute the total so "10 items at 1,000 each"
  // always lands on 10,000, not 1,000.
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
    setStatus("saving");
    try {
      const qty = form.quantity !== "" ? parseFloat(form.quantity) : null;
      const spend = form.amount ? parseFloat(form.amount) : 0;
      await addItem({ ...form, amount: parseFloat(form.amount), quantity: qty });

      // Bookkeeping: a purchase brings goods into stock. If a matching
      // catalog item exists, top up its quantity; otherwise create one so
      // nothing purchased falls through the cracks.
      if (qty && form.item.trim()) {
        const match = stock.find(
          (s) => s.name.trim().toLowerCase() === form.item.trim().toLowerCase(),
        );
        if (match) {
          await recordStockPurchase(match.id, qty, spend);
        } else {
          await addStockItem({
            name: form.item.trim(),
            buyPrice: qty ? spend / qty : 0,
            priceMode: "fixed",
            price: null,
            minPrice: null,
            maxPrice: null,
            unit: "",
            quantity: qty,
            totalPurchased: qty,
            totalSold: 0,
            totalPurchaseValue: spend,
            notes: "Auto-added from a purchase",
          });
        }
      }

      setStatus("saved");
      showToast(t.saved);
      setTimeout(() => {
        setStatus("idle");
        setForm(emptyForm);
        setUnitPrice(null);
        setShowForm(false);
      }, 1500);
    } catch {
      setStatus("idle");
      showToast(t.failedSave, "error");
    }
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const CATS = t.purchaseCategories;

  const columns = [
    { key: "date", label: t.date, inputType: "date" },
    { key: "item", label: t.item },
    { key: "supplier", label: t.supplier },
    {
      key: "phone",
      label: t.supplierPhone,
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
    { key: "category", label: t.category, type: "select", options: CATS },
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
    { key: "notes", label: t.notes },
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">{t.totalPurchases}</span>
          <span className="stat-value orange">
            KES {total.toLocaleString()}
          </span>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setStatus("idle");
          }}
        >
          {showForm ? `✕ ${t.cancel}` : `+ ${t.newPurchase}`}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>🛒 {t.recordPurchase}</h3>
          <div className="form-grid">
            <div className="field-group">
              <label>{t.date} *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            {stock.length > 0 && (
              <div className="field-group">
                <label>{t.pickStock}</label>
                <select onChange={handleStockSelect} value={form.item}>
                  <option value="">{t.selectItem}</option>
                  {stock.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                      {c.price != null
                        ? ` — KES ${Number(c.price).toLocaleString()}${c.unit ? `/${c.unit}` : ""}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field-group">
              <label>{t.item} *</label>
              <input
                placeholder={t.itemPh}
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                required
              />
            </div>
            <div className="field-group">
              <label>{t.supplier}</label>
              <input
                placeholder={t.supplierPh}
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>{t.supplierPhone}</label>
              <input
                type="tel"
                placeholder="07XX XXX XXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>{t.category}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">{t.selectCategory}</option>
                {CATS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>{t.quantity}</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder={t.quantityPh}
                value={form.quantity}
                onChange={handleQuantityChange}
              />
            </div>
            <div className="field-group">
              <label>{t.amount} *</label>
              <input
                type="number"
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
            </div>
            <div className="field-group full-width">
              <label>{t.notes}</label>
              <input
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
                : t.savePurchase}
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
        emptyMessage={t.noPurchases}
      />
    </div>
  );
}
