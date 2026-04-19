import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

const EXPENSE_CATS = ["Rent", "Utilities", "Transport", "Salaries", "Marketing", "Internet", "Office Supplies", "Repairs", "Bank Charges", "Other"];

export default function Expenses() {
  const { items, loading, addItem, deleteItem, updateItem } = useCollection("expenses");
  const { toast, showToast } = useToast();
  const emptyForm = { date: new Date().toISOString().split("T")[0], category: "", description: "", amount: "", notes: "" };
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
      showToast("Expense saved successfully!");
      setTimeout(() => {
        setStatus("idle");
        setForm(emptyForm);
        setShowForm(false);
      }, 1500);
    } catch (err) {
      console.error("Save failed:", err);
      setStatus("idle");
      showToast("Save failed. Please try again.", "error");
    }
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const columns = [
    { key: "date", label: "Date", inputType: "date" },
    { key: "category", label: "Category", type: "select", options: EXPENSE_CATS },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount (KES)", inputType: "number", format: v => `KES ${Number(v).toLocaleString()}` },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">Total Expenses</span>
          <span className="stat-value purple">KES {total.toLocaleString()}</span>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setStatus("idle"); }}>
          {showForm ? "✕ Cancel" : "+ New Expense"}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>Record an Expense</h3>
          <div className="form-grid">
            <div className="field-group">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>Category *</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
                <option value="">Select category</option>
                {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Description</label>
              <input placeholder="Brief description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
          <button
            type="submit"
            className={"btn-primary" + (status === "saved" ? " btn-saved" : "")}
            disabled={status !== "idle"}
          >
            {status === "saving" ? "Saving..." : status === "saved" ? "✅ Saved!" : "Save Expense"}
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
        emptyMessage="No expenses recorded yet. Click '+ New Expense' to add one."
      />
    </div>
  );
}
