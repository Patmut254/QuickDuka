import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import {
  recordStockPurchase,
  findStockByLabel,
  roundQty,
  roundMoney,
} from "../hooks/useStock";
import { useLang } from "../LangContext";
import { PAYMENT_METHODS } from "../paymentMethods";
import { paidOf, balanceOf, dueStatus } from "../supplierDebt";
import EntryTable from "./EntryTable";
import EntryDate, { StockUpdateToggle } from "./EntryDate";
import { localToday, stockUpdateWanted } from "../dates";
import { Toast, useToast } from "./Toast";
import BatchRows from "./BatchRows";
import { newBatchRow, usedRows, newBatchId } from "../batchRows";

const todayStr = localToday; // local date, not UTC

// Rendered inside the Stock page (Stock/Purchases). It is no longer a
// top-level tab in App.jsx.
export default function Purchases({ ownerUid, autoOpen = false }) {
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

    // Back-dated purchases entered without "update my current stock" never
    // added to stock, so editing them must not move stock either.
    if (oldData?.stockNotAffected) return;

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
    if (itemData?.stockNotAffected) return; // never added to stock
    const qty = Number(itemData?.quantity || 0);
    const amount = Number(itemData?.amount || 0);
    if (!qty) return;
    const match = findStockMatch(itemData?.item);
    if (match) {
      await recordStockPurchase(match.id, -qty, -amount);
    }
  };

  // Date stays on the last day used, so a batch of old purchases can be entered
  // one after another. `stockChoice`: should a back-dated purchase also add to
  // current stock? (null = default — yes if recent, no if older than a week)
  const [lastDate, setLastDate] = useState(localToday);
  const [stockChoice, setStockChoice] = useState(null);

  // Shared details for everything bought in one go (date, supplier,
  // payment…); each row is one item, so a whole restock can be entered at once.
  const emptyForm = {
    date: lastDate,
    supplier: "",
    phone: "",
    payStatus: "paid", // "paid" | "credit"
    paidNow: "", // only used when payStatus === "credit"
    dueDate: "", // promised repayment date (credit only)
    category: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(!!autoOpen);
  // _unit: per-unit buy price of the picked stock item, so the row total
  // stays unit × quantity as the quantity changes.
  const makeRow = () => newBatchRow({ item: "", quantity: "", amount: "", _unit: null });
  const [rows, setRows] = useState(() => [makeRow()]);

  const rowFields = [
    {
      key: "item",
      label: t.item,
      type: "stock",
      grow: 2,
      required: true,
      onStockPick: (st, r) => {
        const up = st.buyPrice != null ? Number(st.buyPrice) : null;
        const qty = parseFloat(r.quantity) || 1;
        return { _unit: up, ...(up != null ? { amount: String(roundMoney(up * qty)) } : {}) };
      },
    },
    {
      key: "quantity",
      label: t.quantity,
      type: "number",
      placeholder: "0",
      onChange: (v, r) =>
        r._unit != null ? { amount: String(roundMoney(r._unit * (parseFloat(v) || 0))) } : {},
    },
    {
      key: "amount",
      label: t.totalCost || t.amount,
      type: "number",
      placeholder: "0.00",
      required: true,
      onChange: (v, r) =>
        v !== "" && parseFloat(r.quantity) > 0
          ? { _unit: roundMoney((parseFloat(v) || 0) / parseFloat(r.quantity)) }
          : {},
    },
  ];
  const rowsTotal = roundMoney(rows.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0));

  const resetForm = (date = lastDate) => {
    setForm({ ...emptyForm, date });
    setRows([makeRow()]);
    setStockChoice(null);
  };

  // Supplier payment modal
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [payDue, setPayDue] = useState("");
  const [payDate, setPayDate] = useState(todayStr);
  const [paySaving, setPaySaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    const used = usedRows(rows, rowFields);
    if (!used.length) {
      showToast(t.addOneItem || "Add at least one item.", "error");
      return;
    }
    for (const r of used) {
      if (!r.item.trim()) {
        showToast(t.chooseItemEachLine || "Enter the item on every line.", "error");
        return;
      }
      if (r.amount === "" || Number.isNaN(parseFloat(r.amount))) {
        showToast(`${r.item}: ${t.enterAmount || "enter the amount."}`, "error");
        return;
      }
    }
    setStatus("saving");
    try {
      // Old purchases (older than a week) don't add to today's stock unless
      // the user ticks "update my current stock" — see dates.js.
      const touchStock = stockUpdateWanted(form.date, stockChoice);
      const total = roundMoney(used.reduce((a, r) => a + (parseFloat(r.amount) || 0), 0));
      // Paid in full, or bought on credit? On credit, `paidNow` is what has
      // been paid so far for the whole lot; it is applied to the items in
      // order, and whatever is left on each item is owed to the supplier.
      let paidLeft =
        form.payStatus === "credit"
          ? Math.min(Math.max(parseFloat(form.paidNow) || 0, 0), total)
          : total;
      const batch = used.length > 1 ? newBatchId() : null;
      const { paidNow: _paidNow, payStatus: _payStatus, dueDate: _dueDate, ...shared } = form;
      const created = new Map(); // new stock items made in this save (by name)

      for (const r of used) {
        const qty = r.quantity !== "" ? roundQty(parseFloat(r.quantity)) : null;
        const spend = parseFloat(r.amount) || 0;
        const paid = roundMoney(Math.min(paidLeft, spend));
        paidLeft = roundMoney(paidLeft - paid);
        const onCredit = paid < spend;
        const name = r.item.trim();

        await addItem({
          ...shared,
          item: name,
          amount: spend,
          quantity: qty,
          ...(batch ? { batch } : {}),
          // remembered so editing/deleting this purchase later doesn't move stock
          ...(!touchStock && qty ? { stockNotAffected: true } : {}),
          ...(onCredit
            ? {
                paidAmount: paid,
                dueDate: form.dueDate || "",
                payments:
                  paid > 0 ? [{ amount: paid, date: form.date, method: "", note: "" }] : [],
              }
            : {}),
        });

        // Bookkeeping: a purchase brings goods into stock. Top up the matching
        // item, or create one so nothing purchased falls through the cracks.
        // Stock value always uses the FULL cost, paid off or not.
        if (touchStock && qty && name) {
          const match =
            stock.find((x) => x.id === r._stockId) || findStockMatch(name);
          if (match) {
            await recordStockPurchase(match.id, qty, spend);
          } else if (created.has(name.toLowerCase())) {
            await recordStockPurchase(created.get(name.toLowerCase()), qty, spend);
          } else {
            const ref = await addStockItem({
              name,
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
            if (ref?.id) created.set(name.toLowerCase(), ref.id);
          }
        }
      }

      setStatus("saved");
      showToast(t.saved);
      const savedDate = form.date;
      setTimeout(() => {
        setStatus("idle");
        setLastDate(savedDate); // next entry starts on the same day
        resetForm(savedDate);
        setShowForm(false);
      }, 500);
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
    setPayDue(purchase.dueDate || "");
    setPayDate(todayStr());
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
          // partial payment → they may promise a new date for the rest
          ...(amt < balance && payDue ? { dueDate: payDue } : {}),
          payments: [
            ...(payTarget.payments || []),
            { amount: amt, date: payDate || todayStr(), method: payMethod, note: payNote },
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
  const overdueCount = items.filter((p) => dueStatus(p) === "overdue").length;
  const soonCount = items.filter((p) => dueStatus(p) === "soon").length;
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
              (p.note ? `: ${p.note}` : ""),
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
      key: "dueDate",
      label: t.repayDate,
      inputType: "date",
      format: (v, item) => {
        const st = dueStatus(item);
        if (!v || balanceOf(item) <= 0) return "-";
        return (
          <span style={{ whiteSpace: "nowrap" }}>
            {v}
            {st === "overdue" && (
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#a33a2a" }}>
                {t.overdueLabel}
              </span>
            )}
            {st === "soon" && (
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#f59e0b" }}>
                {t.dueSoon}
              </span>
            )}
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
            <span style={{ fontSize: 12, color: "var(--green, #29573f)" }}>
              {t.settled}
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
            <strong style={{ color: "var(--red, #a33a2a)" }}>
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
            style={{ color: totalOwed > 0 ? "var(--red, #a33a2a)" : "inherit" }}
          >
            KES {totalOwed.toLocaleString()}
          </span>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            if (showForm) resetForm();
            setShowForm(!showForm);
            setStatus("idle");
          }}
        >
          {showForm ? `${t.cancel}` : `+ ${t.newPurchase}`}
        </button>
      </div>

      {(overdueCount > 0 || soonCount > 0) && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 0,
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${overdueCount > 0 ? "#a33a2a" : "#f59e0b"}`,
            background: overdueCount > 0 ? "#a33a2a15" : "#f59e0b15",
            color: overdueCount > 0 ? "#a33a2a" : "#b45309",
          }}
        >
          {t.supplierPaymentsDue}:{" "}
          {overdueCount > 0 && `${overdueCount} ${t.overdueLabel.toLowerCase()}`}
          {overdueCount > 0 && soonCount > 0 && " · "}
          {soonCount > 0 && `${soonCount} ${t.dueSoon.toLowerCase()}`}
        </div>
      )}

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>{t.recordPurchase}</h3>
          <div className="split-form">
            <div className="split-form-left">
              <div className="form-grid">
                <EntryDate
                  id="purchase-date"
                  value={form.date}
                  onChange={(d) => {
                    setForm({ ...form, date: d });
                    setStockChoice(null);
                  }}
                />
                {rows.some((r) => r.item.trim() && r.quantity !== "") && (
                  <StockUpdateToggle
                    date={form.date}
                    checked={stockUpdateWanted(form.date, stockChoice)}
                    onChange={setStockChoice}
                  />
                )}
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
                  <label>{t.paymentStatus}</label>
                  <select
                    value={form.payStatus}
                    onChange={(e) => setForm({ ...form, payStatus: e.target.value })}
                  >
                    <option value="paid">{t.paidInFull}</option>
                    <option value="credit">{t.notFullyPaid}</option>
                  </select>
                </div>
                {form.payStatus === "credit" && (
                  <>
                    <div className="field-group">
                      <label>{t.amountPaidNow}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.paidNow}
                        onChange={(e) => setForm({ ...form, paidNow: e.target.value })}
                      />
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        {rowsTotal > 0 ? (
                          <>
                            {t.balanceOwed}: KES{" "}
                            {Math.max(
                              0,
                              roundMoney(rowsTotal - (parseFloat(form.paidNow) || 0)),
                            ).toLocaleString()}
                          </>
                        ) : (
                          t.amountPaidNowHint
                        )}
                      </div>
                    </div>
                    <div className="field-group">
                      <label>{t.repayDate} *</label>
                      <input
                        type="date"
                        min={form.date}
                        value={form.dueDate}
                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
                <div className="field-group full-width">
                  <label>{t.notes}</label>
                  <input
                    placeholder="..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="split-form-right">
              <BatchRows
                rows={rows}
                setRows={setRows}
                fields={rowFields}
                stock={stock}
                t={t}
                idPrefix="purchase"
                makeRow={makeRow}
                totalLabel={t.totalCost || t.totalPurchases}
                addLabel={t.addAnotherItem || "Add another item"}
                action={
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
                }
              />
            </div>
          </div>
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
                        KES {Number(p.amount).toLocaleString()}: {p.date}
                        {p.method ? ` · ${t.paymentMethods?.[p.method] || p.method}` : ""}
                        {p.note ? ` (${p.note})` : ""}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <EntryDate
                    id="supplier-pay-date"
                    label={t.paymentDate}
                    value={payDate}
                    onChange={setPayDate}
                    plain
                    hint={t.paymentDateHint}
                  />
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
                  {entered > 0 && actual < balance && (
                    <div className="field-group">
                      <label>{t.newRepayDate}</label>
                      <input
                        type="date"
                        value={payDue}
                        onChange={(e) => setPayDue(e.target.value)}
                      />
                    </div>
                  )}
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
        totalKey="amount"
        totalLabel={t.totalPurchases}
        groupKey="batch"
        groupShared={["date", "supplier", "phone", "category", "notes"]}
        groupLabelKey="item"
      />
    </div>
  );
}
