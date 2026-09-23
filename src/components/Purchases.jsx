import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import {
  recordStockPurchase,
  stockLabel,
  findStockByLabel,
  roundQty,
  roundMoney,
} from "../hooks/useStock";
import { useLang } from "../LangContext";
import { PAYMENT_METHODS } from "../paymentMethods";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

const todayStr = () => new Date().toISOString().split("T")[0];

// ── Supplier balances ────────────────────────────────────────────────────────
// `amount` is always the FULL cost of the purchase. `paidAmount` only exists on
// purchases that were bought on credit (or later edited); a record without it
// — every purchase made before this feature — is treated as paid in full, so
// old data keeps showing a zero balance.
const paidOf = (p) =>
  p.paidAmount != null && p.paidAmount !== ""
    ? Number(p.paidAmount)
    : Number(p.amount || 0);
const balanceOf = (p) =>
  Math.max(0, roundMoney(Number(p.amount || 0) - paidOf(p)));

// Rendered inside the Stock page (Stock/Purchases). It is no longer a
// top-level tab in App.jsx.
export default function Purchases({ ownerUid }) {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } = useCollection(
    "purchases",
    ownerUid ? { ownerUid } : undefined,
  );
  // Use the writable stock collection directly (not the read-only
  // useStock hook) so a purchase can auto-create or top up a stock item —
  // purchasing goods should feed straight into the stock ledger.
  const { items: stock, addItem: addStockItem } = useCollection(
    "stock",
    ownerUid ? { ownerUid } : undefined,
  );
  const { toast, showToast } = useToast();

  const findStockMatch = (name) => findStockByLabel(stock, name);

  // Editing an existing purchase row (via the table's inline edit) is
  // still "I purchased this" — if the quantity or amount changes, or the
  // item is renamed, the linked stock entry needs to move by the same
  // delta, not just the Purchases ledger.
  const handleUpdate = async (id, newData, oldData) => {
    // EntryTable hands back every field as an input string, and blanks out
    // arrays — so drop `payments` (it must never be overwritten by "") and
    // turn the numeric fields back into numbers.
    const { payments: _payments, ...rest } = newData;
    const data = { ...rest };
    if (data.amount !== undefined && data.amount !== "")
      data.amount = Number(data.amount);
    if (data.quantity !== undefined)
      data.quantity = data.quantity === "" ? null : roundQty(data.quantity);
    if (data.paidAmount !== undefined) {
      if (data.paidAmount === "") delete data.paidAmount;
      else data.paidAmount = Math.max(0, Number(data.paidAmount));
    }

    await updateItem(id, data, oldData);

    const oldQty = Number(oldData?.quantity || 0);
    const newQty = Number(data.quantity ?? oldQty);
    const oldAmount = Number(oldData?.amount || 0);
    const newAmount = Number(data.amount ?? oldAmount);
    const oldItemName = oldData?.item || "";
    const newItemName = data.item ?? oldItemName;

    if (oldItemName.trim().toLowerCase() === newItemName.trim().toLowerCase()) {
      // Same item — just move by the difference.
      const deltaQty = newQty - oldQty;
      const deltaAmount = newAmount - oldAmount;
      const match = findStockMatch(newItemName);
      if (match && (deltaQty !== 0 || deltaAmount !== 0)) {
        await recordStockPurchase(match.id, deltaQty, deltaAmount);
      }
    } else {
      // Renamed to a different item — reverse the old item's stock,
      // then apply the new quantity/amount to the new item (if it exists
      // in the catalog; if not, leave it — same as the "no match" case
      // on create, this is an edge case worth a manual check).
      const oldMatch = findStockMatch(oldItemName);
      if (oldMatch && oldQty) {
        await recordStockPurchase(oldMatch.id, -oldQty, -oldAmount);
      }
      const newMatch = findStockMatch(newItemName);
      if (newMatch && newQty) {
        await recordStockPurchase(newMatch.id, newQty, newAmount);
      }
    }
  };

  // Deleting a purchase means it never happened — pull that quantity and
  // spend back out of stock too, so Stock stays in sync either direction.
  const handleDelete = async (id, itemData) => {
    await deleteItem(id, itemData);
    const qty = Number(itemData?.quantity || 0);
    const amount = Number(itemData?.amount || 0);
    if (!qty) return;
    const match = findStockMatch(itemData?.item);
    if (match) {
      await recordStockPurchase(match.id, -qty, -amount);
    }
  };

  const emptyForm = {
    date: todayStr(),
    item: "",
    supplier: "",
    phone: "",
    quantity: "",
    amount: "",
    paidNow: "", // blank = paid in full
    category: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState("");
  // Per-unit buy price of the selected stock item — kept separate from
  // form.amount (the TOTAL spend) so total = unitPrice × quantity always
  // stays correct as either one changes.
  const [unitPrice, setUnitPrice] = useState(null);

  // Supplier payment modal
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  const handleStockSelect = (e) => {
    const found = stock.find((c) => c.id === e.target.value);
    setSelectedStockId(found ? found.id : "");
    const up = found?.buyPrice != null ? Number(found.buyPrice) : null;
    setUnitPrice(up);
    const qty = parseFloat(form.quantity) || 1;
    setForm((f) => ({
      ...f,
      item: found ? stockLabel(found) : "",
      amount: up != null ? String(roundMoney(up * qty)) : f.amount,
    }));
  };

  // Quantity changed — recompute the total so "10 items at 1,000 each"
  // always lands on 10,000, not 1,000.
  const handleQuantityChange = (e) => {
    const q = e.target.value;
    setForm((f) => ({
      ...f,
      quantity: q,
      amount:
        unitPrice != null
          ? String(roundMoney(unitPrice * (parseFloat(q) || 0)))
          : f.amount,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    try {
      const qty = form.quantity !== "" ? roundQty(parseFloat(form.quantity)) : null;
      const spend = form.amount ? parseFloat(form.amount) : 0;
      // How much has actually been paid. Blank = paid in full. Anything
      // less means the goods were taken on credit and the rest is owed.
      const paidNow =
        form.paidNow === ""
          ? spend
          : Math.min(Math.max(parseFloat(form.paidNow) || 0, 0), spend);
      const onCredit = paidNow < spend;

      const { paidNow: _paidNow, ...purchaseData } = form;
      await addItem({
        ...purchaseData,
        amount: spend,
        quantity: qty,
        ...(onCredit
          ? {
              paidAmount: roundMoney(paidNow),
              payments:
                paidNow > 0
                  ? [
                      {
                        amount: roundMoney(paidNow),
                        date: form.date,
                        method: "",
                        note: "",
                      },
                    ]
                  : [],
            }
          : {}),
      });

      // Bookkeeping: a purchase brings goods into stock. If a matching
      // catalog item exists, top up its quantity; otherwise create one so
      // nothing purchased falls through the cracks. Stock value always uses
      // the FULL cost, whether or not it has been paid off yet.
      if (qty && form.item.trim()) {
        const match =
          stock.find((s) => s.id === selectedStockId) ||
          findStockMatch(form.item);
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
        setSelectedStockId("");
        setUnitPrice(null);
        setShowForm(false);
      }, 1500);
    } catch {
      setStatus("idle");
      showToast(t.failedSave, "error");
    }
  };

  // ── Pay a supplier (part or all of what's owed) ────────────────────────────
  // The purchase is already counted at its full cost in Dashboard/Reports, so
  // a payment here only reduces the balance — it doesn't create an expense.
  const openPay = (purchase) => {
    setPayTarget(purchase);
    setPayAmount("");
    setPayMethod("cash");
    setPayNote("");
  };

  const handleSupplierPayment = async () => {
    if (!payTarget || paySaving) return;
    const balance = balanceOf(payTarget);
    const amt = Math.min(roundMoney(parseFloat(payAmount) || 0), balance);
    if (amt <= 0) return;
    setPaySaving(true);
    try {
      const { id: _id, createdAt: _c, ...oldData } = payTarget;
      await updateItem(
        payTarget.id,
        {
          paidAmount: roundMoney(paidOf(payTarget) + amt),
          payments: [
            ...(payTarget.payments || []),
            { amount: amt, date: todayStr(), method: payMethod, note: payNote },
          ],
        },
        oldData,
      );
      showToast(t.supplierPaymentSaved);
      setPayTarget(null);
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
    }
    setPaySaving(false);
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const totalOwed = items.reduce((a, b) => a + balanceOf(b), 0);
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
      label: t.totalCost || t.amount,
      inputType: "number",
      format: (v) => `KES ${Number(v).toLocaleString()}`,
    },
    // Paid / balance are display-only: they move through the Pay button (so
    // every payment is recorded with a date + method), never by typing.
    {
      key: "paidAmount",
      label: t.paidLabel,
      readOnly: true,
      format: (_v, item) => {
        const history = (item.payments || [])
          .map(
            (p) =>
              `${p.date}: KES ${Number(p.amount).toLocaleString()}` +
              (p.method ? ` (${t.paymentMethods?.[p.method] || p.method})` : "") +
              (p.note ? ` — ${p.note}` : ""),
          )
          .join("\n");
        return (
          <span title={history || undefined}>
            KES {paidOf(item).toLocaleString()}
          </span>
        );
      },
    },
    {
      key: "balance",
      label: t.balanceOwed,
      readOnly: true,
      format: (_v, item) => {
        const bal = balanceOf(item);
        if (bal <= 0)
          return (
            <span style={{ fontSize: 12, color: "var(--green, #22c55e)" }}>
              ✓ {t.settled}
            </span>
          );
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
            }}
          >
            <strong style={{ color: "var(--red, #ef4444)" }}>
              KES {bal.toLocaleString()}
            </strong>
            <button
              type="button"
              className="btn-pay"
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => openPay(item)}
            >
              {t.paySupplier}
            </button>
          </span>
        );
      },
    },
    { key: "notes", label: t.notes },
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">{t.totalPurchases}</span>
          <span className="stat-value orange">KES {total.toLocaleString()}</span>
        </div>
        <div className="module-stat">
          <span className="stat-label">{t.owedToSuppliers}</span>
          <span
            className="stat-value"
            style={{ color: totalOwed > 0 ? "var(--red, #ef4444)" : "inherit" }}
          >
            KES {totalOwed.toLocaleString()}
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
                <select onChange={handleStockSelect} value={selectedStockId}>
                  <option value="">{t.selectItem}</option>
                  {stock.map((c) => (
                    <option key={c.id} value={c.id}>
                      {stockLabel(c)}
                      {c.buyPrice != null
                        ? ` — KES ${Number(c.buyPrice).toLocaleString()}${c.unit ? `/${c.unit}` : ""}`
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
                step="any"
                inputMode="decimal"
                placeholder={t.quantityPh}
                value={form.quantity}
                onChange={handleQuantityChange}
              />
            </div>
            <div className="field-group">
              <label>{t.totalCost || t.amount} *</label>
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
                  KES {roundMoney(unitPrice * (parseFloat(form.quantity) || 0)).toLocaleString()}
                </div>
              )}
            </div>
            <div className="field-group">
              <label>{t.amountPaidNow}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={form.amount || "0.00"}
                value={form.paidNow}
                onChange={(e) => setForm({ ...form, paidNow: e.target.value })}
              />
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {form.paidNow !== "" && parseFloat(form.amount) > 0 ? (
                  <>
                    {t.balanceOwed}: KES{" "}
                    {Math.max(
                      0,
                      roundMoney(parseFloat(form.amount) - (parseFloat(form.paidNow) || 0)),
                    ).toLocaleString()}
                  </>
                ) : (
                  t.amountPaidNowHint
                )}
              </div>
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

      {/* Pay-supplier modal */}
      {payTarget &&
        (() => {
          const balance = balanceOf(payTarget);
          const entered = parseFloat(payAmount) || 0;
          const actual = Math.min(entered, balance);
          return (
            <div className="modal-overlay" onClick={() => setPayTarget(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>{t.paySupplierTitle}</h3>
                <div className="credit-modal-meta">
                  <div className="credit-modal-row">
                    <span>{t.item}</span>
                    <strong>{payTarget.item}</strong>
                  </div>
                  {payTarget.supplier && (
                    <div className="credit-modal-row">
                      <span>{t.supplier}</span>
                      <strong>{payTarget.supplier}</strong>
                    </div>
                  )}
                  <div className="credit-modal-row">
                    <span>{t.totalCost || t.amount}</span>
                    <strong>
                      KES {Number(payTarget.amount || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div className="credit-modal-row">
                    <span>{t.paidLabel}</span>
                    <strong className="text-green">
                      KES {paidOf(payTarget).toLocaleString()}
                    </strong>
                  </div>
                  <div className="credit-modal-row credit-modal-row-highlight">
                    <span>{t.balanceOwed}</span>
                    <strong className="text-red">
                      KES {balance.toLocaleString()}
                    </strong>
                  </div>
                </div>

                {payTarget.payments?.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0" }}>
                    {payTarget.payments.map((p, i) => (
                      <div key={i}>
                        KES {Number(p.amount).toLocaleString()} — {p.date}
                        {p.method ? ` · ${t.paymentMethods?.[p.method] || p.method}` : ""}
                        {p.note ? ` (${p.note})` : ""}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="field-group">
                    <label>{t.amountPaid}</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      autoFocus
                      min="1"
                      max={balance}
                    />
                  </div>
                  <div className="field-group">
                    <label>{t.paymentMethod}</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {t.paymentMethods?.[m] || m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>{t.paymentNote}</label>
                    <input
                      placeholder={t.paymentNotePh}
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                    />
                  </div>
                </div>

                {entered > 0 && (
                  <div
                    className={`credit-pay-preview ${actual >= balance ? "credit-pay-clear" : "credit-pay-partial"}`}
                  >
                    {t.balanceOwed}: KES {Math.max(0, balance - actual).toLocaleString()}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setPayTarget(null)}
                  >
                    {t.cancel}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSupplierPayment}
                    disabled={!payAmount || entered <= 0 || paySaving}
                  >
                    {t.confirmPayment}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      <EntryTable
        items={items}
        loading={loading}
        columns={columns}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        showToast={showToast}
        emptyMessage={t.noPurchases}
      />
    </div>
  );
}
