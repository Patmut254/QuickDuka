import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useStock } from "../hooks/useStock";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

export default function Losses({ ownerUid }) {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("losses", ownerUid ? { ownerUid } : undefined);
  const stock = useStock();
  const { toast, showToast } = useToast();

  const CATS = t.lossCategories;

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    item: "",
    category: CATS[0],
    quantity: "",
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
      item: found ? found.name : e.target.value,
      amount: found?.price != null ? String(found.price) : f.amount,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    try {
      await addItem({ ...form, amount: parseFloat(form.amount) || 0 });
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

  const byCategory = CATS.map((cat) => ({
    cat,
    total: items
      .filter((i) => i.category === cat)
      .reduce((a, b) => a + (Number(b.amount) || 0), 0),
    count: items.filter((i) => i.category === cat).length,
  })).filter((c) => c.count > 0);

  const columns = [
    { key: "date", label: t.date, inputType: "date" },
    { key: "item", label: t.lostItem },
    { key: "category", label: t.lossCategory, type: "select", options: CATS },
    { key: "quantity", label: t.quantity },
    {
      key: "amount",
      label: t.estValue,
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
          <span className="stat-label">{t.totalLosses}</span>
          <span className="stat-value red">KES {total.toLocaleString()}</span>
        </div>
        <button
          className="btn-primary"
          style={{ background: "var(--red)" }}
          onClick={() => {
            setShowForm(!showForm);
            setStatus("idle");
          }}
        >
          {showForm ? `✕ ${t.cancel}` : `+ ${t.newLoss}`}
        </button>
      </div>

      {byCategory.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {byCategory.map((c) => (
            <div
              key={c.cat}
              style={{
                background: "var(--red-bg)",
                border: "1px solid #f5a5a5",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "var(--red)",
                  marginBottom: 2,
                }}
              >
                {c.cat}
              </div>
              <div style={{ color: "var(--muted)" }}>
                {c.count} · KES {c.total.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>⚠️ {t.recordLoss}</h3>
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
              <label>{t.lostItem} *</label>
              <input
                placeholder={t.lostItemPh}
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                required
              />
            </div>
            <div className="field-group">
              <label>{t.lossCategory} *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>{t.quantity}</label>
              <input
                placeholder={t.quantityPh}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>{t.estValue} *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
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
            style={{
              background: status === "saved" ? "var(--green)" : "var(--red)",
            }}
            disabled={status !== "idle"}
          >
            {status === "saving"
              ? t.saving
              : status === "saved"
                ? t.saved
                : t.saveLoss}
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
        emptyMessage={t.noLosses}
      />
    </div>
  );
}
