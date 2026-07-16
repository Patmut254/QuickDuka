/* eslint-disable react-hooks/rules-of-hooks */
import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useLang } from "../LangContext";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";
import FeatureGate from "./FeatureGate";

export default function Stock({ sub, ownerUid }) {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("stock", ownerUid ? { ownerUid } : undefined);
  const { toast, showToast } = useToast();

  const emptyForm = {
    name: "",
    priceMode: "fixed", // "fixed" | "range"
    price: "",
    minPrice: "",
    maxPrice: "",
    unit: "",
    quantity: "",
    notes: "",
  };
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
      const isRange = form.priceMode === "range";
      await addItem({
        name: form.name.trim(),
        priceMode: form.priceMode,
        price: !isRange && form.price !== "" ? parseFloat(form.price) : null,
        minPrice: isRange && form.minPrice !== "" ? parseFloat(form.minPrice) : null,
        maxPrice: isRange && form.maxPrice !== "" ? parseFloat(form.maxPrice) : null,
        unit: form.unit.trim(),
        quantity: form.quantity !== "" ? parseFloat(form.quantity) : null,
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
      const isRange = editForm.priceMode === "range";
      await updateItem(
        editTarget.id,
        {
          name: editForm.name.trim(),
          priceMode: editForm.priceMode || "fixed",
          price:
            !isRange && editForm.price !== "" ? parseFloat(editForm.price) : null,
          minPrice:
            isRange && editForm.minPrice !== ""
              ? parseFloat(editForm.minPrice)
              : null,
          maxPrice:
            isRange && editForm.maxPrice !== ""
              ? parseFloat(editForm.maxPrice)
              : null,
          unit: editForm.unit?.trim() || "",
          quantity:
            editForm.quantity !== "" && editForm.quantity != null
              ? parseFloat(editForm.quantity)
              : null,
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

      {/* Branch stock gate — only visible on Starter/Growth plans */}
      {sub && !sub.can("multipleBranches") && (
        <div style={{ marginBottom: 16 }}>
          <FeatureGate
            feature="multipleBranches"
            sub={sub}
            lockedLabel="Multi-Branch Stock Management"
          >
            {/* Children shown when Business plan is active */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              Multi-branch stock view is enabled on your Business plan.
            </div>
          </FeatureGate>
        </div>
      )}

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

      <div className="stock-hint">📦 {t.stockHint}</div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>{t.addToStock}</h3>
          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="stock-name">{t.itemName} *</label>
              <input
                id="stock-name"
                name="stock-name"
                autoComplete="off"
                placeholder={t.itemNamePh}
                value={form.name}
                onChange={set("name")}
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="stock-price-mode">{t.priceMode}</label>
              <select
                id="stock-price-mode"
                name="stock-price-mode"
                value={form.priceMode}
                onChange={set("priceMode")}
              >
                <option value="fixed">{t.fixedPrice}</option>
                <option value="range">{t.priceRange}</option>
              </select>
            </div>
            {form.priceMode === "range" ? (
              <>
                <div className="field-group">
                  <label htmlFor="stock-min-price">{t.minPrice}</label>
                  <input
                    id="stock-min-price"
                    name="stock-min-price"
                    type="number"
                    autoComplete="off"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.minPrice}
                    onChange={set("minPrice")}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="stock-max-price">{t.maxPrice}</label>
                  <input
                    id="stock-max-price"
                    name="stock-max-price"
                    type="number"
                    autoComplete="off"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.maxPrice}
                    onChange={set("maxPrice")}
                  />
                </div>
              </>
            ) : (
              <div className="field-group">
                <label htmlFor="stock-price">{t.price}</label>
                <input
                  id="stock-price"
                  name="stock-price"
                  type="number"
                  autoComplete="off"
                  min="0"
                  step="0.01"
                  placeholder={t.pricePh}
                  value={form.price}
                  onChange={set("price")}
                />
              </div>
            )}
            <div className="field-group">
              <label htmlFor="stock-unit">{t.unit}</label>
              <input
                id="stock-unit"
                name="stock-unit"
                autoComplete="off"
                placeholder={t.unitPh}
                value={form.unit}
                onChange={set("unit")}
              />
            </div>
            <div className="field-group">
              <label htmlFor="stock-quantity">{t.quantity}</label>
              <input
                id="stock-quantity"
                name="stock-quantity"
                type="number"
                autoComplete="off"
                min="0"
                step="1"
                placeholder={t.quantityPh}
                value={form.quantity}
                onChange={set("quantity")}
              />
            </div>
            <div className="field-group full-width">
              <label htmlFor="stock-notes">{t.notes}</label>
              <input
                id="stock-notes"
                name="stock-notes"
                autoComplete="off"
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
                : t.addToStock}
          </button>
        </form>
      )}

      {/* Search */}
      {items.length > 4 && (
        <div
          className="field-group"
          style={{ maxWidth: 300, marginBottom: 16 }}
        >
          <label htmlFor="stock-search" className="sr-only">
            {t.searchItems}
          </label>
          <input
            id="stock-search"
            name="stock-search"
            autoComplete="off"
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
          {search ? t.noItemsSearch : t.noItems}
        </div>
      ) : (
        <div className="stock-grid">
          {filtered.map((item) => {
            const isRange = item.priceMode === "range";
            const unitValue = isRange
              ? item.minPrice != null && item.maxPrice != null
                ? (Number(item.minPrice) + Number(item.maxPrice)) / 2
                : null
              : item.price;
            const hasQty = item.quantity != null;
            const stockValue =
              hasQty && unitValue != null ? Number(item.quantity) * unitValue : null;
            return (
              <div key={item.id} className="stock-card">
                <div className="stock-card-top">
                  <div className="stock-item-name">{item.name}</div>
                  <div className="stock-item-price">
                    {isRange ? (
                      item.minPrice != null && item.maxPrice != null ? (
                        <span className="price-tag">
                          KES {Number(item.minPrice).toLocaleString()}–
                          {Number(item.maxPrice).toLocaleString()}
                          {item.unit ? ` / ${item.unit}` : ""}
                        </span>
                      ) : (
                        <span className="price-variable">
                          Bei inabadilika / Price varies
                        </span>
                      )
                    ) : item.price != null ? (
                      <span className="price-tag">
                        KES {Number(item.price).toLocaleString()}
                        {item.unit ? ` / ${item.unit}` : ""}
                      </span>
                    ) : (
                      <span className="price-variable">
                        Bei inabadilika / Price varies
                      </span>
                    )}
                  </div>
                </div>

                {hasQty && (
                  <div
                    className="stock-item-notes"
                    style={{ display: "flex", gap: 14, flexWrap: "wrap" }}
                  >
                    <span>
                      {t.qtyInStock}:{" "}
                      <strong
                        style={{
                          color: Number(item.quantity) <= 0 ? "#ef4444" : "inherit",
                        }}
                      >
                        {Number(item.quantity).toLocaleString()}
                      </strong>
                    </span>
                    {stockValue != null && (
                      <span>
                        {t.stockValue}: <strong>KES {stockValue.toLocaleString()}</strong>
                      </span>
                    )}
                  </div>
                )}

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
                        priceMode: item.priceMode || "fixed",
                        price: item.price ?? "",
                        minPrice: item.minPrice ?? "",
                        maxPrice: item.maxPrice ?? "",
                        unit: item.unit || "",
                        quantity: item.quantity ?? "",
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
            );
          })}
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
                <label htmlFor="edit-stock-name">{t.itemName} *</label>
                <input
                  id="edit-stock-name"
                  name="edit-stock-name"
                  autoComplete="off"
                  value={editForm.name}
                  onChange={setEdit("name")}
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor="edit-stock-price-mode">{t.priceMode}</label>
                <select
                  id="edit-stock-price-mode"
                  name="edit-stock-price-mode"
                  value={editForm.priceMode || "fixed"}
                  onChange={setEdit("priceMode")}
                >
                  <option value="fixed">{t.fixedPrice}</option>
                  <option value="range">{t.priceRange}</option>
                </select>
              </div>
              {editForm.priceMode === "range" ? (
                <>
                  <div className="field-group">
                    <label htmlFor="edit-stock-min-price">{t.minPrice}</label>
                    <input
                      id="edit-stock-min-price"
                      name="edit-stock-min-price"
                      type="number"
                      autoComplete="off"
                      min="0"
                      step="0.01"
                      value={editForm.minPrice}
                      onChange={setEdit("minPrice")}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="edit-stock-max-price">{t.maxPrice}</label>
                    <input
                      id="edit-stock-max-price"
                      name="edit-stock-max-price"
                      type="number"
                      autoComplete="off"
                      min="0"
                      step="0.01"
                      value={editForm.maxPrice}
                      onChange={setEdit("maxPrice")}
                    />
                  </div>
                </>
              ) : (
                <div className="field-group">
                  <label htmlFor="edit-stock-price">{t.price}</label>
                  <input
                    id="edit-stock-price"
                    name="edit-stock-price"
                    type="number"
                    autoComplete="off"
                    min="0"
                    step="0.01"
                    placeholder={t.pricePh}
                    value={editForm.price}
                    onChange={setEdit("price")}
                  />
                </div>
              )}
              <div className="field-group">
                <label htmlFor="edit-stock-unit">{t.unit}</label>
                <input
                  id="edit-stock-unit"
                  name="edit-stock-unit"
                  autoComplete="off"
                  placeholder={t.unitPh}
                  value={editForm.unit}
                  onChange={setEdit("unit")}
                />
              </div>
              <div className="field-group">
                <label htmlFor="edit-stock-quantity">{t.quantity}</label>
                <input
                  id="edit-stock-quantity"
                  name="edit-stock-quantity"
                  type="number"
                  autoComplete="off"
                  min="0"
                  step="1"
                  placeholder={t.quantityPh}
                  value={editForm.quantity}
                  onChange={setEdit("quantity")}
                />
              </div>
              <div className="field-group">
                <label htmlFor="edit-stock-notes">{t.notes}</label>
                <input
                  id="edit-stock-notes"
                  name="edit-stock-notes"
                  autoComplete="off"
                  value={editForm.notes}
                  onChange={setEdit("notes")}
                />
              </div>
              <div className="alert-actions">
                <button
                  type="button"
                  className="btn-cancel-sm"
                  onClick={() => setEditTarget(null)}
                >
                  {t.cancel}
                </button>
                <button type="submit" className="btn-primary">
                  {t.saveChanges}
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
          deleteTarget
            ? typeof t.removeMsg === "function"
              ? t.removeMsg(deleteTarget.name)
              : `Remove "${deleteTarget.name}" from stock? This cannot be undone.`
            : ""
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
