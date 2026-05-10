import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useStock } from "../hooks/useStock";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

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
    amount: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);

  const handleStockSelect = (e) => {
    const found = stock.find((c) => c.name === e.target.value);
    setForm((f) => ({
      ...f,
      description: found ? found.name : e.target.value,
      amount: found?.price != null ? String(found.price) : f.amount,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    try {
      await addItem({ ...form, amount: parseFloat(form.amount) });
      setStatus("saved");
      showToast(t.saved);
      setTimeout(() => {
        setStatus("idle");
        setForm(emptyForm);
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
      key: "amount",
      label: t.amount,
      inputType: "number",
      format: (v) => `KES ${Number(v).toLocaleString()}`,
    },
    { key: "notes", label: t.notes },
    ...(ownerUid
      ? [{
          key: "staffName",
          label: "By",
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
              <label htmlFor="sale-amount">{t.amount} *</label>
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
