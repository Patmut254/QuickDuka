import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

const LOSS_CATEGORIES = [
  "Stolen",
  "Spoilt / Rotten",
  "Personal Consumption",
  "Damaged",
  "Expired",
  "Other",
];

export default function Losses() {
  const { items, loading, addItem, deleteItem, updateItem } = useCollection("losses");
  const { toast, showToast } = useToast();

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    item: "",
    category: "Stolen",
    quantity: "",
    amount: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    try {
      await addItem({ ...form, amount: parseFloat(form.amount) || 0 });
      setStatus("saved");
      showToast("Loss recorded.");
      setTimeout(() => { setStatus("idle"); setForm(emptyForm); setShowForm(false); }, 1500);
    } catch (err) {
      console.error(err);
      setStatus("idle");
      showToast("Save failed. Try again.", "error");
    }
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // Category breakdown
  const byCategory = LOSS_CATEGORIES.map(cat => ({
    cat,
    total: items.filter(i => i.category === cat).reduce((a, b) => a + (Number(b.amount) || 0), 0),
    count: items.filter(i => i.category === cat).length,
  })).filter(c => c.count > 0);

  const columns = [
    { key: "date",     label: "Date",      inputType: "date" },
    { key: "item",     label: "Item" },
    { key: "category", label: "Category",  inputType: "select", options: LOSS_CATEGORIES },
    { key: "quantity", label: "Qty / Units" },
    { key: "amount",   label: "Est. Value (KES)", inputType: "number",
      format: v => `KES ${Number(v).toLocaleString()}` },
    { key: "notes",    label: "Notes" },
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">Total Losses (All Time)</span>
          <span className="stat-value red">KES {total.toLocaleString()}</span>
        </div>
        <button className="btn-primary" style={{ background: "var(--red)" }}
          onClick={() => { setShowForm(!showForm); setStatus("idle"); }}>
          {showForm ? "✕ Cancel" : "+ Record Loss"}
        </button>
      </div>

      {/* Category Breakdown */}
      {byCategory.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {byCategory.map(c => (
            <div key={c.cat} style={{
              background: "var(--red-bg)", border: "1px solid #f5a5a5",
              borderRadius: 0, padding: "8px 14px", fontSize: 12,
            }}>
              <div style={{ fontWeight: 700, color: "var(--red)", marginBottom: 2 }}>{c.cat}</div>
              <div style={{ color: "var(--muted)" }}>
                {c.count} record{c.count !== 1 ? "s" : ""} · KES {c.total.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>📦 Record a Loss</h3>
          <div className="form-grid">
            <div className="field-group">
              <label>Date *</label>
              <input type="date" value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>Item / Product *</label>
              <input placeholder="What was lost?" value={form.item}
                onChange={e => setForm({ ...form, item: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>Loss Category *</label>
              <select value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}>
                {LOSS_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Quantity / Units</label>
              <input placeholder="e.g. 5 kg, 2 boxes" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Estimated Value (KES) *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="field-group full-width">
              <label>Notes</label>
              <input placeholder="Any additional details..." value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <button type="submit"
            className={"btn-primary" + (status === "saved" ? " btn-saved" : "")}
            style={{ background: status === "saved" ? "var(--green)" : "var(--red)" }}
            disabled={status !== "idle"}>
            {status === "saving" ? "Saving..." : status === "saved" ? "✅ Saved!" : "Record Loss"}
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
        emptyMessage="No losses recorded yet. Click '+ Record Loss' to add one."
      />
    </div>
  );
}
