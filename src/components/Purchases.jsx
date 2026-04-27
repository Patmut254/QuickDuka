import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

const CATS = ["Stock / Inventory", "Raw Materials", "Equipment", "Other"];

export default function Purchases() {
  const { items, loading, addItem, deleteItem, updateItem } = useCollection("purchases");
  const { toast, showToast } = useToast();
  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    item: "",
    supplier: "",
    phone: "",
    amount: "",
    category: "",
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
      await addItem({ ...form, amount: parseFloat(form.amount) });
      setStatus("saved");
      showToast("Purchase saved successfully!");
      setTimeout(() => { setStatus("idle"); setForm(emptyForm); setShowForm(false); }, 1500);
    } catch (err) {
      console.error("Save failed:", err);
      setStatus("idle");
      showToast("Save failed. Please try again.", "error");
    }
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const columns = [
    { key: "date", label: "Date", inputType: "date" },
    { key: "item", label: "Item" },
    { key: "supplier", label: "Supplier" },
    { key: "phone", label: "Phone", inputType: "tel", format: v => v ? (
      <a href={`tel:${v}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{v}</a>
    ) : "-" },
    { key: "category", label: "Category", type: "select", options: CATS },
    { key: "amount", label: "Amount (KES)", inputType: "number", format: v => `KES ${Number(v).toLocaleString()}` },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">Total Purchases</span>
          <span className="stat-value orange">KES {total.toLocaleString()}</span>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setStatus("idle"); }}>
          {showForm ? "✕ Cancel" : "+ New Purchase"}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>Record a Purchase</h3>
          <div className="form-grid">
            <div className="field-group">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>Item *</label>
              <input placeholder="What was purchased?" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>Supplier</label>
              <input placeholder="Supplier name" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Supplier Phone</label>
              <input type="tel" placeholder="07XX XXX XXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Select category</option>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Amount (KES) *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="field-group full-width">
              <label>Notes</label>
              <input placeholder="Optional notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <button type="submit" className={"btn-primary" + (status === "saved" ? " btn-saved" : "")} disabled={status !== "idle"}>
            {status === "saving" ? "Saving..." : status === "saved" ? "✅ Saved!" : "Save Purchase"}
          </button>
        </form>
      )}

      <EntryTable items={items} loading={loading} columns={columns} onDelete={deleteItem} onUpdate={updateItem} showToast={showToast} emptyMessage="No purchases recorded yet. Click '+ New Purchase' to add one." />
    </div>
  );
}
