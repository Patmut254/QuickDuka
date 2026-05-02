/* eslint-disable react-hooks/rules-of-hooks */
import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useLang } from "../LangContext";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";

export default function Stock() {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("stock");
  const { toast, showToast } = useToast();

  const emptyForm = { name: "", price: "", unit: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("idle");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setEdit = (k) => (e) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }));

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
      showToast("Item added to stock!");
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
      await updateItem(
        editTarget.id,
        {
          name: editForm.name.trim(),
          price: editForm.price !== "" ? parseFloat(editForm.price) : null,
          unit: editForm.unit?.trim() || "",
          notes: editForm.notes?.trim() || "",
        },
        editTarget,
      );
      showToast("Item updated!");
      setEditTarget(null);
    } catch {
      showToast("Update failed.", "error");
    }
  };

  const filtered = items.filter(
    (i) => !search || i.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="module-page">
      <Toast toast={toast} />

      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">{t.totalItems}</span>
          <span className="stat-value" style={{ color: "var(--accent)" }}>
            {items.length}
          </span>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setStatus("idle");
          }}
        >
          {showForm ? "✕ " + t.cancel : "+ " + t.addItem}
        </button>
      </div>

      <div className="stock-hint">📦 {t.catalogueHint}</div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>{t.addToCatalogue}</h3>
          <div className="form-grid">
            <div className="field-group">
              <label>{t.itemName} *</label>
              <input
                placeholder={t.itemNamePh}
                value={form.name}
                onChange={set("name")}
                required
              />
            </div>
            <div className="field-group">
              <label>{t.price}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={t.pricePh}
                value={form.price}
                onChange={set("price")}
              />
            </div>
            <div className="field-group">
              <label>{t.unit}</label>
              <input
                placeholder={t.unitPh}
                value={form.unit}
                onChange={set("unit")}
              />
            </div>
            <div className="field-group full-width">
              <label>{t.notes}</label>
              <input
                placeholder="..."
                value={form.notes}
                onChange={set("notes")}
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
                : t.addToCatalogue}
          </button>
        </form>
      )}

      {/* Search */}
      {items.length > 4 && (
        <div
          className="field-group"
          style={{ maxWidth: 300, marginBottom: 16 }}
        >
          <input
            placeholder={"🔍 " + t.searchItems}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="table-loading">Inapakia... / Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {search
            ? t.noItemsSearch
            : t.noItems}
        </div>
      ) : (
        <div className="stock-grid">
          {filtered.map((item) => (
            <div key={item.id} className="stock-card">
              <div className="stock-card-top">
                <div className="stock-item-name">{item.name}</div>
                <div className="stock-item-price">
                  {item.price != null ? (
                    <span className="price-tag">
                      KES {Number(item.price).toLocaleString()}
                      {item.unit ? ` / ${item.unit}` : ""}
                    </span>
                  ) : (
                    <span className="price-variable">Bei inabadilika / Price varies</span>
                  )}
                </div>
              </div>
              {item.notes && (
                <div className="stock-item-notes">{item.notes}</div>
              )}
              <div className="stock-actions">
                <button
                  className="edit-btn-sm"
                  onClick={() => {
                    setEditTarget(item);
                    setEditForm({
                      name: item.name,
                      price: item.price ?? "",
                      unit: item.unit || "",
                      notes: item.notes || "",
                    });
                  }}
                >
                  ✏️ Hariri / Edit
                </button>
                <button
                  className="delete-btn"
                  onClick={() => setDeleteTarget(item)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="alert-overlay" onClick={() => setEditTarget(null)}>
          <div
            className="alert-box"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="alert-title">✏️ Hariri Bidhaa / Edit Item</div>
            <form
              onSubmit={handleEdit}
              className="login-form"
              style={{ marginTop: 16 }}
            >
              <div className="field-group">
                <label>{t.itemName} *</label>
                <input
                  value={editForm.name}
                  onChange={setEdit("name")}
                  required
                />
              </div>
              <div className="field-group">
                <label>{t.price}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t.pricePh}
                  value={editForm.price}
                  onChange={setEdit("price")}
                />
              </div>
              <div className="field-group">
                <label>{t.unit}</label>
                <input
                  placeholder={t.unitPh}
                  value={editForm.unit}
                  onChange={setEdit("unit")}
                />
              </div>
              <div className="field-group">
                <label>{t.notes}</label>
                <input value={editForm.notes} onChange={setEdit("notes")} />
              </div>
              <div className="alert-actions">
                <button
                  type="button"
                  className="btn-cancel-sm"
                  onClick={() => setEditTarget(null)}
                >
                  Funga / Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Hifadhi Mabadiliko / Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!deleteTarget}
        title={t.removeItem}
        message={
          deleteTarget ? `Ondoa "${deleteTarget.name}" kutoka kwenye orodha yako? / Remove "${deleteTarget.name}" from your list?` : ""
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await deleteItem(deleteTarget.id, deleteTarget);
          showToast(t.itemRemoved);
          setDeleteTarget(null);
        }}
        confirmLabel={t.removeConfirm}
        danger
      />
    </div>
  );
}
