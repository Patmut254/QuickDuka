/* eslint-disable react-hooks/rules-of-hooks */
import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { recordStockPurchase } from "../hooks/useStock";
import { useLang } from "../LangContext";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";
import FeatureGate from "./FeatureGate";

export default function Stock({ sub, ownerUid }) {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("stock", ownerUid ? { ownerUid } : undefined);
  // A restock (or a manual quantity increase) is a purchase — it should
  // land in the Purchases ledger too, not just bump the stock counters.
  const { addItem: addPurchase } = useCollection(
    "purchases",
    ownerUid ? { ownerUid } : undefined,
  );
  const { toast, showToast } = useToast();

  // buyPrice: what you paid per item (always fixed — you know your cost).
  // priceMode/price/minPrice/maxPrice: what you SELL it for — fixed, or a
  // range so you can offer a discount while selling.
  const emptyForm = {
    name: "",
    variant: "",
    buyPrice: "",
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
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockForm, setRestockForm] = useState({ quantity: "", cost: "" });
  const [restockStatus, setRestockStatus] = useState("idle");
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
      const qty = form.quantity !== "" ? parseFloat(form.quantity) : 0;
      const buyPrice = form.buyPrice !== "" ? parseFloat(form.buyPrice) : 0;
      await addItem({
        name: form.name.trim(),
        variant: form.variant.trim(),
        buyPrice,
        priceMode: form.priceMode,
        price: !isRange ? parseFloat(form.price) : null,
        minPrice: isRange ? parseFloat(form.minPrice) : null,
        maxPrice: isRange ? parseFloat(form.maxPrice) : null,
        unit: form.unit.trim(),
        quantity: qty,
        // Every item starts its life as a "purchase" of the opening
        // quantity, so Purchased/Sold/Remaining/Total Bought all add up
        // from day one instead of only counting from here on.
        totalPurchased: qty,
        totalSold: 0,
        totalPurchaseValue: qty * buyPrice,
        notes: form.notes.trim(),
      });

      // A brand-new item's opening quantity is a purchase too — log it
      // in the Purchases ledger, same as a restock or an edit-quantity
      // increase would. Without this, the very first stock-in for an
      // item never shows up on the Purchases page.
      if (qty > 0) {
        await addPurchase({
          date: new Date().toISOString().split("T")[0],
          item: form.name.trim(),
          supplier: "",
          phone: "",
          quantity: qty,
          amount: qty * buyPrice,
          category: "Stock update",
          notes: "Auto-added from a new stock item",
        });
      }

      setStatus("saved");
      showToast(t.saved || "Saved!");
      setTimeout(() => {
        setStatus("idle");
        setForm(emptyForm);
        setShowForm(false);
      }, 1200);
    } catch {
      setStatus("idle");
      showToast(t.failedSave || "Save failed. Try again.", "error");
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const isRange = editForm.priceMode === "range";
      const buyPrice =
        editForm.buyPrice !== "" ? parseFloat(editForm.buyPrice) : 0;
      const newQty =
        editForm.quantity !== "" ? parseFloat(editForm.quantity) : 0;
      const originalQty = Number(editTarget.quantity || 0);
      // If the edit raised the quantity, that increase is a purchase —
      // log it (using the BUY price, never the selling price) and roll it
      // into the running "purchased" totals so Purchased/Total Bought
      // stay accurate. A lowered quantity is left alone here (use Losses
      // for shrinkage/damage, or Sales for an actual sale).
      const delta = newQty - originalQty;

      await updateItem(
        editTarget.id,
        {
          name: editForm.name.trim(),
          variant: editForm.variant?.trim() || "",
          buyPrice,
          priceMode: editForm.priceMode || "fixed",
          price: !isRange ? parseFloat(editForm.price) : null,
          minPrice: isRange ? parseFloat(editForm.minPrice) : null,
          maxPrice: isRange ? parseFloat(editForm.maxPrice) : null,
          unit: editForm.unit?.trim() || "",
          quantity: newQty,
          notes: editForm.notes?.trim() || "",
          ...(delta > 0
            ? {
                totalPurchased: Number(editTarget.totalPurchased || 0) + delta,
                totalPurchaseValue:
                  Number(editTarget.totalPurchaseValue || 0) + delta * buyPrice,
              }
            : {}),
        },
        editTarget,
      );

      if (delta > 0) {
        await addPurchase({
          date: new Date().toISOString().split("T")[0],
          item: editForm.name.trim(),
          supplier: "",
          phone: "",
          quantity: delta,
          amount: delta * buyPrice,
          category: "Stock update",
          notes: "Auto-added from a stock quantity edit",
        });
      }

      showToast(t.saved || "Updated!");
      setEditTarget(null);
    } catch {
      showToast(t.failedSave || "Update failed.", "error");
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    if (restockStatus !== "idle") return;
    const qty = parseFloat(restockForm.quantity);
    if (!qty || qty <= 0) return;
    setRestockStatus("saving");
    try {
      // Cost defaults to this item's known purchase price if left blank.
      const costPerItem =
        restockForm.cost !== ""
          ? parseFloat(restockForm.cost)
          : Number(restockTarget.buyPrice || 0);
      await recordStockPurchase(restockTarget.id, qty, costPerItem * qty);
      // A restock IS a purchase — log it in the Purchases ledger too, using
      // the buy price (costPerItem), never the item's selling price.
      await addPurchase({
        date: new Date().toISOString().split("T")[0],
        item: restockTarget.name,
        supplier: "",
        phone: "",
        quantity: qty,
        amount: costPerItem * qty,
        category: "Restock",
        notes: "Auto-added from a stock restock",
      });
      showToast(`${restockTarget.name} +${qty} ${t.qtyInStock || "in stock"}.`);
      setRestockStatus("idle");
      setRestockTarget(null);
      setRestockForm({ quantity: "", cost: "" });
    } catch {
      setRestockStatus("idle");
      showToast(t.failedSave || "Restock failed. Try again.", "error");
    }
  };

  const filtered = items.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.name?.toLowerCase().includes(q) ||
      i.variant?.toLowerCase().includes(q)
    );
  });

  const sellPriceLabel = (item) => {
    if (item.priceMode === "range") {
      return item.minPrice != null && item.maxPrice != null
        ? `KES ${Number(item.minPrice).toLocaleString()}–${Number(
            item.maxPrice,
          ).toLocaleString()}${item.unit ? ` / ${item.unit}` : ""}`
        : t.priceVaries;
    }
    return item.price != null
      ? `KES ${Number(item.price).toLocaleString()}${item.unit ? ` / ${item.unit}` : ""}`
      : t.priceVaries;
  };

  // Sale value used for "Stock Value" — what the remaining stock could
  // sell for at today's price(s).
  const sellUnitValue = (item) => {
    if (item.priceMode === "range") {
      return item.minPrice != null && item.maxPrice != null
        ? (Number(item.minPrice) + Number(item.maxPrice)) / 2
        : null;
    }
    return item.price;
  };

  // Expected profit — if ALL remaining stock sells at the listed price.
  // Actual profit — from units already sold, using the same listed price
  // as a stand-in for the real sale price (a fair estimate since discounts
  // on individual sales aren't tracked back to the stock item).
  const profitFigures = (item) => {
    const uv = sellUnitValue(item);
    const buy = Number(item.buyPrice || 0);
    if (uv == null) return { expected: null, actual: null };
    const margin = uv - buy;
    const remaining = Number(item.quantity || 0);
    const sold = Number(item.totalSold || 0);
    return { expected: margin * remaining, actual: margin * sold };
  };

  // Business-wide totals for the header stat row.
  const totalExpectedProfit = items.reduce(
    (a, item) => a + (profitFigures(item).expected || 0),
    0,
  );
  const totalActualProfit = items.reduce(
    (a, item) => a + (profitFigures(item).actual || 0),
    0,
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
        <div className="module-stat" title={t.expectedProfitHint}>
          <span className="stat-label">{t.totalExpectedProfit}</span>
          <span
            className="stat-value"
            style={{ color: totalExpectedProfit >= 0 ? "#22c55e" : "#ef4444" }}
          >
            KES {totalExpectedProfit.toLocaleString()}
          </span>
        </div>
        <div className="module-stat" title={t.actualProfitHint}>
          <span className="stat-label">{t.totalActualProfit}</span>
          <span
            className="stat-value"
            style={{ color: totalActualProfit >= 0 ? "#22c55e" : "#ef4444" }}
          >
            KES {totalActualProfit.toLocaleString()}
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
              <label htmlFor="stock-variant">{t.variant}</label>
              <input
                id="stock-variant"
                name="stock-variant"
                autoComplete="off"
                placeholder={t.variantPh}
                value={form.variant}
                onChange={set("variant")}
              />
            </div>
            <div className="field-group">
              <label htmlFor="stock-buy-price">{t.buyPrice} *</label>
              <input
                id="stock-buy-price"
                name="stock-buy-price"
                type="number"
                autoComplete="off"
                min="0"
                step="0.01"
                placeholder={t.buyPricePh}
                value={form.buyPrice}
                onChange={set("buyPrice")}
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
                  <label htmlFor="stock-min-price">{t.minPrice} *</label>
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
                    required
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="stock-max-price">{t.maxPrice} *</label>
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
                    required
                  />
                </div>
              </>
            ) : (
              <div className="field-group">
                <label htmlFor="stock-price">{t.price} *</label>
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
                  required
                />
              </div>
            )}
            <div className="field-group">
              <label htmlFor="stock-unit">{t.unit} *</label>
              <input
                id="stock-unit"
                name="stock-unit"
                autoComplete="off"
                placeholder={t.unitPh}
                value={form.unit}
                onChange={set("unit")}
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="stock-quantity">{t.quantity} *</label>
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
                required
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

      {/* Table listing — bookkeeping view: in, out, and what's left */}
      {loading ? (
        <div className="table-loading">Inapakia... / Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {search ? t.noItemsSearch : t.noItems}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table stock-table">
            <thead>
              <tr>
                <th>{t.itemName}</th>
                <th>{t.buyPrice}</th>
                <th>{t.price}</th>
                <th style={{ textAlign: "right" }}>{t.purchased}</th>
                <th style={{ textAlign: "right" }}>{t.sold}</th>
                <th style={{ textAlign: "right" }}>{t.qtyInStock}</th>
                <th style={{ textAlign: "right" }}>{t.stockValue}</th>
                <th style={{ textAlign: "right" }}>{t.totalBought}</th>
                <th style={{ textAlign: "right" }} title={t.expectedProfitHint}>
                  {t.expectedProfit}
                </th>
                <th style={{ textAlign: "right" }} title={t.actualProfitHint}>
                  {t.actualProfit}
                </th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const remaining = Number(item.quantity || 0);
                const uv = sellUnitValue(item);
                const stockVal = uv != null ? remaining * uv : null;
                const { expected, actual } = profitFigures(item);
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {item.name}
                        {item.variant && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "1px 7px",
                              borderRadius: 20,
                              background: "var(--accent)15",
                              color: "var(--accent)",
                            }}
                          >
                            {item.variant}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      {item.buyPrice != null
                        ? `KES ${Number(item.buyPrice).toLocaleString()}${item.unit ? ` / ${item.unit}` : ""}`
                        : "—"}
                    </td>
                    <td>{sellPriceLabel(item)}</td>
                    <td style={{ textAlign: "right" }}>
                      {Number(item.totalPurchased || 0).toLocaleString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {Number(item.totalSold || 0).toLocaleString()}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: remaining <= 0 ? "#ef4444" : "inherit",
                      }}
                    >
                      {remaining.toLocaleString()}
                      {remaining <= 0 && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#ef4444",
                            textTransform: "uppercase",
                          }}
                        >
                          {t.outOfStock}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {stockVal != null
                        ? `KES ${stockVal.toLocaleString()}`
                        : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      KES {Number(item.totalPurchaseValue || 0).toLocaleString()}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        color:
                          expected != null
                            ? expected >= 0
                              ? "#22c55e"
                              : "#ef4444"
                            : "inherit",
                      }}
                    >
                      {expected != null
                        ? `KES ${expected.toLocaleString()}`
                        : "—"}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        color:
                          actual != null
                            ? actual >= 0
                              ? "#22c55e"
                              : "#ef4444"
                            : "inherit",
                      }}
                    >
                      {actual != null ? `KES ${actual.toLocaleString()}` : "—"}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="edit-btn"
                          title={t.restock}
                          onClick={() => {
                            setRestockTarget(item);
                            setRestockForm({ quantity: "", cost: "" });
                          }}
                        >
                          ➕
                        </button>
                        <button
                          className="edit-btn"
                          title={t.edit}
                          onClick={() => {
                            setEditTarget(item);
                            setEditForm({
                              name: item.name,
                              variant: item.variant || "",
                              buyPrice: item.buyPrice ?? "",
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
                          ✏️
                        </button>
                        <button
                          className="delete-btn"
                          title={t.delete}
                          onClick={() => setDeleteTarget(item)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Restock Modal — quick way to top up quantity when items run out */}
      {restockTarget && (
        <div className="alert-overlay" onClick={() => setRestockTarget(null)}>
          <div
            className="alert-box"
            style={{ maxWidth: 380 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="alert-title">
              📥 {t.restock} — {restockTarget.name}
            </div>
            <form
              onSubmit={handleRestock}
              className="login-form"
              style={{ marginTop: 16 }}
            >
              <div className="field-group">
                <label htmlFor="restock-qty">{t.restockQty} *</label>
                <input
                  id="restock-qty"
                  name="restock-qty"
                  type="number"
                  autoComplete="off"
                  min="1"
                  step="1"
                  value={restockForm.quantity}
                  onChange={(e) =>
                    setRestockForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor="restock-cost">{t.restockCost}</label>
                <input
                  id="restock-cost"
                  name="restock-cost"
                  type="number"
                  autoComplete="off"
                  min="0"
                  step="0.01"
                  placeholder={
                    restockTarget.buyPrice != null
                      ? `${Number(restockTarget.buyPrice).toLocaleString()}`
                      : "0.00"
                  }
                  value={restockForm.cost}
                  onChange={(e) =>
                    setRestockForm((f) => ({ ...f, cost: e.target.value }))
                  }
                />
              </div>
              <div className="alert-actions">
                <button
                  type="button"
                  className="btn-cancel-sm"
                  onClick={() => setRestockTarget(null)}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={restockStatus !== "idle"}
                >
                  {restockStatus === "saving" ? t.saving : t.restock}
                </button>
              </div>
            </form>
          </div>
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
                <label htmlFor="edit-stock-variant">{t.variant}</label>
                <input
                  id="edit-stock-variant"
                  name="edit-stock-variant"
                  autoComplete="off"
                  placeholder={t.variantPh}
                  value={editForm.variant || ""}
                  onChange={setEdit("variant")}
                />
              </div>
              <div className="field-group">
                <label htmlFor="edit-stock-buy-price">{t.buyPrice} *</label>
                <input
                  id="edit-stock-buy-price"
                  name="edit-stock-buy-price"
                  type="number"
                  autoComplete="off"
                  min="0"
                  step="0.01"
                  value={editForm.buyPrice}
                  onChange={setEdit("buyPrice")}
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
                    <label htmlFor="edit-stock-min-price">{t.minPrice} *</label>
                    <input
                      id="edit-stock-min-price"
                      name="edit-stock-min-price"
                      type="number"
                      autoComplete="off"
                      min="0"
                      step="0.01"
                      value={editForm.minPrice}
                      onChange={setEdit("minPrice")}
                      required
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="edit-stock-max-price">{t.maxPrice} *</label>
                    <input
                      id="edit-stock-max-price"
                      name="edit-stock-max-price"
                      type="number"
                      autoComplete="off"
                      min="0"
                      step="0.01"
                      value={editForm.maxPrice}
                      onChange={setEdit("maxPrice")}
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="field-group">
                  <label htmlFor="edit-stock-price">{t.price} *</label>
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
                    required
                  />
                </div>
              )}
              <div className="field-group">
                <label htmlFor="edit-stock-unit">{t.unit} *</label>
                <input
                  id="edit-stock-unit"
                  name="edit-stock-unit"
                  autoComplete="off"
                  placeholder={t.unitPh}
                  value={editForm.unit}
                  onChange={setEdit("unit")}
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor="edit-stock-quantity">{t.quantity} *</label>
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
                  required
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
