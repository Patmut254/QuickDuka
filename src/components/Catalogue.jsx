import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";

export default function Catalogue() {
  const { items, loading, addItem, deleteItem, updateItem } = useCollection("catalogue");
  const { toast, showToast } = useToast();

  const emptyForm = { name: "", price: "", unit: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("idle");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setEdit = (k) => (e) => setEditForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    try {
      await addItem({
        name: form.name.trim(),
        price: form.price !== "" ? parseFloat(form.price) : null,
        unit: form.unit.trim(),
        notes: form.notes.trim(),
      });
      setStatus("saved");
      showToast("Item added to catalogue!");
      setTimeout(() => {
        setStatus("idle");
        setForm(emptyForm);
        setShowForm(false);
      }, 1200);
    } catch {
      setStatus("idle");
      showToast("Save failed. Try again.", "error");
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await updateItem(editTarget.id, {
        name: editForm.name.trim(),
        price: editForm.price !== "" ? parseFloat(editForm.price) : null,
        unit: editForm.unit?.trim() || "",
        notes: editForm.notes?.trim() || "",
      }, editTarget);
      showToast("Item updated!");
      setEditTarget(null);
    } catch {
      showToast("Update failed.", "error");
    }
  };

  const filtered = items.filter(i =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="module-page">
      <Toast toast={toast} />

      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">Total Items</span>
          <span className="stat-value" style={{ color: "var(--accent)" }}>{items.length}</span>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setStatus("idle"); }}>
          {showForm ? "✕ Cancel" : "+ Add Item"}
        </button>
      </div>

      <div style={{ marginBottom: 12, color: "var(--muted)", fontSize: 13 }}>
        📦 Your product/item list. Set a price if fixed (e.g. cake KES 80), or leave blank to enter manually when recording a sale.
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>Add Item to Catalogue</h3>
          <div className="form-grid">
            <div className="field-group">
              <label>Item / Product Name *</label>
              <input placeholder="e.g. Sukuma wiki, Cake, Bread..." value={form.name} onChange={set("name")} required />
            </div>
            <div className="field-group">
              <label>Price (KES) — Optional</label>
              <input type="number" min="0" step="0.01" placeholder="Leave blank if price varies" value={form.price} onChange={set("price")} />
            </div>
            <div className="field-group">
              <label>Unit — Optional</label>
              <input placeholder="e.g. bunch, kg, piece, packet" value={form.unit} onChange={set("unit")} />
            </div>
            <div className="field-group full-width">
              <label>Notes</label>
              <input placeholder="Optional notes" value={form.notes} onChange={set("notes")} />
            </div>
          </div>
          <button
            type="submit"
            className={"btn-primary" + (status === "saved" ? " btn-saved" : "")}
            disabled={status !== "idle"}
          >
            {status === "saving" ? "Saving..." : status === "saved" ? "✅ Saved!" : "Add to Catalogue"}
          </button>
        </form>
      )}

      {/* Search */}
      {items.length > 4 && (
        <div className="field-group" style={{ maxWidth: 300, marginBottom: 16 }}>
          <input placeholder="🔍 Search items..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="table-loading">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {search ? "No items match your search." : "No items yet. Add your products or services above."}
        </div>
      ) : (
        <div className="catalogue-grid">
          {filtered.map(item => (
            <div key={item.id} className="catalogue-card">
              <div className="catalogue-card-top">
                <div className="catalogue-item-name">{item.name}</div>
                <div className="catalogue-item-price">
                  {item.price != null
                    ? <span className="price-tag">KES {Number(item.price).toLocaleString()}{item.unit ? ` / ${item.unit}` : ""}</span>
                    : <span className="price-variable">Price varies</span>
                  }
                </div>
              </div>
              {item.notes && <div className="catalogue-item-notes">{item.notes}</div>}
              <div className="catalogue-actions">
                <button className="edit-btn-sm" onClick={() => { setEditTarget(item); setEditForm({ name: item.name, price: item.price ?? "", unit: item.unit || "", notes: item.notes || "" }); }}>
                  ✏️ Edit
                </button>
                <button className="delete-btn" onClick={() => setDeleteTarget(item)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="alert-overlay" onClick={() => setEditTarget(null)}>
          <div className="alert-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="alert-title">✏️ Edit Item</div>
            <form onSubmit={handleEdit} className="login-form" style={{ marginTop: 16 }}>
              <div className="field-group">
                <label>Item Name *</label>
                <input value={editForm.name} onChange={setEdit("name")} required />
              </div>
              <div className="field-group">
                <label>Price (KES)</label>
                <input type="number" min="0" step="0.01" placeholder="Leave blank if varies" value={editForm.price} onChange={setEdit("price")} />
              </div>
              <div className="field-group">
                <label>Unit</label>
                <input placeholder="e.g. kg, piece" value={editForm.unit} onChange={setEdit("unit")} />
              </div>
              <div className="field-group">
                <label>Notes</label>
                <input value={editForm.notes} onChange={setEdit("notes")} />
              </div>
              <div className="alert-actions">
                <button type="button" className="btn-cancel-sm" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        title="Remove from Catalogue?"
        message={deleteTarget ? `Remove "${deleteTarget.name}" from your list?` : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await deleteItem(deleteTarget.id, deleteTarget);
          showToast("Item removed.");
          setDeleteTarget(null);
        }}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
