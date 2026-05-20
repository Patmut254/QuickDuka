import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useStock } from "../hooks/useStock";
import { useLang } from "../LangContext";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTimes,
  faPhone,
  faCalendar,
  faHandHoldingDollar,
  faCheckCircle,
  faExclamationTriangle,
  faTrash,
  faThumbsDown,
  faArrowRight,
  faMoneyBillWave,
  faChartBar,
} from "@fortawesome/free-solid-svg-icons";

export default function Credits({ ownerUid }) {
  const { t } = useLang();
  const {
    items: credits,
    loading,
    addItem,
    deleteItem,
    updateItem,
  } = useCollection("credits", ownerUid ? { ownerUid } : undefined);

  // ✅ FIX: Pass ownerUid context to addSale and addLoss hooks so that
  // credit payments and bad-debt write-offs are stamped with the correct
  // ownerUid and appear in the owner's Sales/Losses/Dashboard views.
  // Previously these hooks had no ownerUid context, so staff-created
  // records would be stamped with the staff member's uid as ownerUid,
  // making them invisible to the business owner.
  const { addItem: addSale } = useCollection(
    "sales",
    ownerUid ? { ownerUid } : undefined,
  );
  const { addItem: addLoss } = useCollection(
    "losses",
    ownerUid ? { ownerUid } : undefined,
  );
  const stock = useStock();
  const { toast, showToast } = useToast();

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    customer: "",
    phone: "",
    itemTaken: "",
    dueDate: "",
    totalAmount: "",
    notes: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [payingCredit, setPayingCredit] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [badDebtTarget, setBadDebtTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const today = () => new Date().toISOString().split("T")[0];

  // ── Save new credit ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await addItem({
        ...form,
        totalAmount: parseFloat(form.totalAmount),
        paidAmount: 0,
        status: "outstanding",
        payments: [],
        dateIssued: form.date,
      });
      showToast(t.saved);
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
    }
    setSaving(false);
  };

  // ── Record a payment ───────────────────────────────────────────────────────
  // Every payment (partial or full) goes directly to Sales.
  // When fully paid the credit status changes to "paid".
  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    const remaining =
      (payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0);
    const actualAmount = Math.min(amount, remaining);
    const newPaid = (payingCredit.paidAmount || 0) + actualAmount;
    const isFullyPaid = newPaid >= payingCredit.totalAmount;

    try {
      const newPayments = [
        ...(payingCredit.payments || []),
        { amount: actualAmount, date: today(), note: payNote },
      ];

      await updateItem(payingCredit.id, {
        paidAmount: newPaid,
        payments: newPayments,
        status: isFullyPaid ? "paid" : "outstanding",
        lastPaymentDate: today(),
      });

      // ✅ Payment goes to Sales — no extraMeta needed because the addSale
      // hook is already initialised with the correct ownerUid context above.
      // useCollection.addItem will use overrideOwnerUid from its own closure.
      await addSale({
        date: today(),
        description:
          `${t.creditPaymentDesc || "Credit payment"} — ${payingCredit.customer}` +
          (payingCredit.itemTaken ? ` (${payingCredit.itemTaken})` : ""),
        customer: payingCredit.customer,
        phone: payingCredit.phone || "",
        amount: actualAmount,
        notes: (
          `${
            isFullyPaid
              ? t.finalPaymentNote || "Final payment — debt cleared."
              : t.partialPaymentNote || "Partial payment."
          } ` +
          `${t.originallyIssued || "Originally issued"} ${payingCredit.dateIssued}. ` +
          (payNote || "")
        ).trim(),
        fromCredit: payingCredit.id,
      });

      if (isFullyPaid) {
        showToast(t.paidSales);
      } else {
        showToast(
          typeof t.partialPay === "function"
            ? t.partialPay(
                actualAmount.toLocaleString(),
                (payingCredit.totalAmount - newPaid).toLocaleString(),
              )
            : `KES ${actualAmount.toLocaleString()} → ${t.sales || "Sales"} · KES ${(payingCredit.totalAmount - newPaid).toLocaleString()} ${t.remaining?.toLowerCase() || "remaining"}`,
        );
      }

      setPayingCredit(null);
      setPayAmount("");
      setPayNote("");
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
    }
  };

  // ── Write off as bad debt ──────────────────────────────────────────────────
  // Only the REMAINING unpaid amount goes to Losses.
  // Already-paid amounts stay in Sales (recorded at payment time).
  const confirmBadDebt = async () => {
    const credit = badDebtTarget;
    if (!credit) return;
    try {
      const unpaid = Math.max(
        0,
        (credit.totalAmount || 0) - (credit.paidAmount || 0),
      );

      await updateItem(credit.id, {
        status: "bad_debt",
        closedDate: today(),
        badDebtAmount: unpaid,
      });

      // ✅ Unpaid remainder goes to Losses — no extraMeta needed because
      // the addLoss hook is already initialised with the correct ownerUid.
      if (unpaid > 0) {
        await addLoss({
          date: today(),
          item:
            `${t.badDebtWrittenOff || "Bad debt written off"} — ${credit.customer}` +
            (credit.itemTaken ? ` (${credit.itemTaken})` : ""),
          category: t.badDebt || "Bad Debt",
          quantity: "",
          amount: unpaid,
          notes:
            `${t.customer2 || "Customer"}: ${credit.customer}. ` +
            `${t.phone || "Phone"}: ${credit.phone || "N/A"}. ` +
            `${t.totalCredit || "Total credit"}: KES ${(credit.totalAmount || 0).toLocaleString()}, ` +
            `${t.alreadyPaid || "collected"}: KES ${(credit.paidAmount || 0).toLocaleString()}, ` +
            `${t.writtenOff || "written off"}: KES ${unpaid.toLocaleString()}. ` +
            `${t.dateIssued || "Issued"} ${credit.dateIssued}` +
            (credit.dueDate
              ? `, ${t.dueDate?.split(" (")[0] || "due"} ${credit.dueDate}`
              : "") +
            ".",
          fromCredit: credit.id,
        });
      }

      showToast(
        unpaid > 0
          ? `KES ${unpaid.toLocaleString()} ${t.writtenOffToLosses || "written off to Losses"}. ` +
              (credit.paidAmount > 0
                ? `KES ${credit.paidAmount.toLocaleString()} ${t.staysInSales || "already collected stays in Sales"}.`
                : "")
          : t.badDebtNoUnpaid || "Marked as bad debt (nothing to write off).",
      );
      setBadDebtTarget(null);
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
      setBadDebtTarget(null);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const isOverdue = (c) => {
    if (!c.dueDate || c.status !== "outstanding") return false;
    return new Date(c.dueDate) < new Date();
  };

  const outstanding = credits.filter((c) => c.status === "outstanding");
  const badDebts = credits.filter((c) => c.status === "bad_debt");
  const paidList = credits.filter((c) => c.status === "paid");

  const totalOutstanding = outstanding.reduce(
    (a, c) => a + Math.max(0, (c.totalAmount || 0) - (c.paidAmount || 0)),
    0,
  );
  const totalCollected = credits.reduce((a, c) => a + (c.paidAmount || 0), 0);
  const totalWrittenOff = badDebts.reduce(
    (a, c) =>
      a +
      Math.max(
        0,
        c.badDebtAmount ?? (c.totalAmount || 0) - (c.paidAmount || 0),
      ),
    0,
  );
  const grandTotal = credits.reduce((a, c) => a + (c.totalAmount || 0), 0);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="module-page">
      <Toast toast={toast} />

      {/* Summary cards */}
      <div className="credits-summary">
        <div
          className="summary-card"
          style={{ borderTop: "3px solid var(--orange)" }}
        >
          <div
            className="card-icon"
            style={{ background: "var(--orange-bg)", color: "var(--orange)" }}
          >
            <FontAwesomeIcon icon={faHandHoldingDollar} />
          </div>
          <div>
            {/* ✅ FIX: First card shows the KES amount of unpaid debts */}
            <div className="card-label">{t.unpaidDebts}</div>
            <div className="card-value orange">
              KES {totalOutstanding.toLocaleString()}
            </div>
          </div>
        </div>

        <div
          className="summary-card"
          style={{ borderTop: "3px solid var(--red)" }}
        >
          <div
            className="card-icon"
            style={{ background: "var(--red-bg)", color: "var(--red)" }}
          >
            <FontAwesomeIcon icon={faExclamationTriangle} />
          </div>
          <div>
            {/* ✅ FIX: Second card shows the COUNT of outstanding debts.
                Previously both cards used t.unpaidDebts — copy-paste error. */}
            <div className="card-label">{t.outstandingCount || t.unpaidDebts}</div>
            <div className="card-value red">{outstanding.length}</div>
          </div>
        </div>

        <div
          className="summary-card"
          style={{ borderTop: "3px solid var(--green)" }}
        >
          <div
            className="card-icon"
            style={{ background: "var(--green-bg)", color: "var(--green)" }}
          >
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
          <div>
            <div className="card-label">{t.cleared}</div>
            <div className="card-value green">{paidList.length}</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="credits-stats-row">
        <div className="credits-stat-box credits-stat-green">
          <FontAwesomeIcon
            icon={faMoneyBillWave}
            className="credits-stat-icon"
          />
          <div>
            <div className="credits-stat-label">{t.totalCollected}</div>
            <div className="credits-stat-val">
              KES {totalCollected.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="credits-stat-box credits-stat-red">
          <FontAwesomeIcon icon={faThumbsDown} className="credits-stat-icon" />
          <div>
            <div className="credits-stat-label">{t.writtenOff}</div>
            <div className="credits-stat-val">
              KES {totalWrittenOff.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="credits-stat-box credits-stat-neutral">
          <FontAwesomeIcon icon={faChartBar} className="credits-stat-icon" />
          <div>
            <div className="credits-stat-label">{t.allCredits}</div>
            <div className="credits-stat-val">
              KES {grandTotal.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* New Credit Button */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <FontAwesomeIcon icon={showForm ? faTimes : faPlus} />
          {showForm ? " " + t.cancel : " " + t.newCredit}
        </button>
      </div>

      {/* New Credit Form */}
      {showForm && (
        <div className="entry-form" style={{ marginBottom: 20 }}>
          <h3>
            <FontAwesomeIcon icon={faHandHoldingDollar} /> {t.newCredit}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field-group">
                <label>{t.dateIssued}</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="field-group">
                <label>{t.dueDate}</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                />
              </div>
              <div className="field-group">
                <label>{t.customerName}</label>
                <input
                  placeholder={t.customerNamePh}
                  value={form.customer}
                  onChange={(e) =>
                    setForm({ ...form, customer: e.target.value })
                  }
                  required
                />
              </div>
              <div className="field-group">
                <label>{t.phoneNumber}</label>
                <input
                  placeholder="07..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              {stock.length > 0 && (
                <div className="field-group">
                  <label>{t.pickStock}</label>
                  <select
                    onChange={(e) => {
                      const found = stock.find(
                        (c) => c.name === e.target.value,
                      );
                      setForm((f) => ({
                        ...f,
                        itemTaken: found ? found.name : e.target.value,
                        totalAmount:
                          found?.price != null
                            ? String(found.price)
                            : f.totalAmount,
                      }));
                    }}
                    value={form.itemTaken}
                  >
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
                <label>{t.itemTaken}</label>
                <input
                  placeholder={t.itemTakenPh}
                  value={form.itemTaken}
                  onChange={(e) =>
                    setForm({ ...form, itemTaken: e.target.value })
                  }
                />
              </div>
              <div className="field-group">
                <label>{t.totalAmount}</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={form.totalAmount}
                  onChange={(e) =>
                    setForm({ ...form, totalAmount: e.target.value })
                  }
                  required
                  min="1"
                />
              </div>
              <div className="field-group full-width">
                <label>{t.creditNotes}</label>
                <textarea
                  placeholder={t.creditNotesPh}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t.saving : t.saveCredit}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
              >
                {t.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Modal */}
      {payingCredit &&
        (() => {
          const remaining =
            (payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0);
          const entered = parseFloat(payAmount) || 0;
          const actual = Math.min(entered, remaining);
          const willClear = actual >= remaining;
          const afterPay = remaining - actual;

          return (
            <div
              className="modal-overlay"
              onClick={() => setPayingCredit(null)}
            >
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>
                  <FontAwesomeIcon icon={faHandHoldingDollar} />{" "}
                  {t.recordPayment}
                </h3>

                <div className="credit-modal-meta">
                  <div className="credit-modal-row">
                    <span>{t.customer2}</span>
                    <strong>{payingCredit.customer}</strong>
                  </div>
                  <div className="credit-modal-row">
                    <span>{t.totalCredit}</span>
                    <strong>
                      KES {(payingCredit.totalAmount || 0).toLocaleString()}
                    </strong>
                  </div>
                  {(payingCredit.paidAmount || 0) > 0 && (
                    <div className="credit-modal-row">
                      <span>{t.alreadyPaid}</span>
                      <strong className="text-green">
                        KES {payingCredit.paidAmount.toLocaleString()}
                      </strong>
                    </div>
                  )}
                  <div className="credit-modal-row credit-modal-row-highlight">
                    <span>{t.remaining}</span>
                    <strong className="text-red">
                      KES {remaining.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="credit-flow-note">
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    style={{ marginRight: 6 }}
                  />
                  {t.paymentFlowNote}
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div className="field-group">
                    <label>{t.amountPaid}</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      autoFocus
                      min="1"
                      max={remaining}
                    />
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
                    className={`credit-pay-preview ${willClear ? "credit-pay-clear" : "credit-pay-partial"}`}
                  >
                    {willClear
                      ? t.clearDebt
                      : typeof t.partialPay === "function"
                        ? t.partialPay(
                            actual.toLocaleString(),
                            afterPay.toLocaleString(),
                          )
                        : `KES ${actual.toLocaleString()} → ${t.sales || "Sales"} · KES ${afterPay.toLocaleString()} ${t.remaining?.toLowerCase() || "remaining"}`}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setPayingCredit(null);
                      setPayAmount("");
                      setPayNote("");
                    }}
                  >
                    {t.cancel}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handlePayment}
                    disabled={!payAmount || parseFloat(payAmount) <= 0}
                  >
                    {t.confirmPayment}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Credit List */}
      {loading ? (
        <div className="table-loading">{t.loading}</div>
      ) : credits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FontAwesomeIcon icon={faHandHoldingDollar} />
          </div>
          <div>{t.noCredits}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {credits.map((credit) => {
            const remaining =
              (credit.totalAmount || 0) - (credit.paidAmount || 0);
            const pct =
              credit.totalAmount > 0
                ? Math.min(
                    100,
                    ((credit.paidAmount || 0) / credit.totalAmount) * 100,
                  )
                : 0;
            const overdue = isOverdue(credit);
            const isPaid = credit.status === "paid";
            const isBadDebt = credit.status === "bad_debt";
            const isOutstanding = credit.status === "outstanding";
            const writtenOff =
              credit.badDebtAmount ??
              Math.max(0, (credit.totalAmount || 0) - (credit.paidAmount || 0));

            return (
              <div
                key={credit.id}
                className={
                  "credit-card" +
                  (isPaid ? " credit-card-paid" : "") +
                  (isBadDebt ? " credit-card-bad" : "")
                }
                style={
                  overdue && isOutstanding
                    ? { borderColor: "var(--red)", borderWidth: 2 }
                    : {}
                }
              >
                {/* Header */}
                <div className="credit-card-header">
                  <div className="credit-card-info">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <div className="credit-customer">{credit.customer}</div>

                      {isPaid && (
                        <span
                          className="credit-status-badge"
                          style={{
                            background: "var(--green-bg)",
                            color: "var(--green)",
                            borderColor: "#90d8a5",
                          }}
                        >
                          {t.paidSales}
                        </span>
                      )}
                      {isBadDebt && (
                        <span
                          className="credit-status-badge"
                          style={{
                            background: "var(--red-bg)",
                            color: "var(--red)",
                            borderColor: "#f5a5a5",
                          }}
                        >
                          {t.badDebtLabel}
                        </span>
                      )}
                      {overdue && isOutstanding && (
                        <span
                          className="credit-status-badge"
                          style={{
                            background: "#fff3cd",
                            color: "#856404",
                            borderColor: "#ffc107",
                          }}
                        >
                          {t.overdueLabel}
                        </span>
                      )}
                    </div>

                    {credit.itemTaken && (
                      <div className="credit-desc">{credit.itemTaken}</div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 4,
                        alignItems: "center",
                      }}
                    >
                      {credit.phone && (
                        <a
                          href={`tel:${credit.phone}`}
                          className="credit-phone"
                        >
                          <FontAwesomeIcon
                            icon={faPhone}
                            style={{ marginRight: 4, fontSize: 10 }}
                          />
                          {credit.phone}
                        </a>
                      )}
                      <span className="credit-date">
                        <FontAwesomeIcon
                          icon={faCalendar}
                          style={{ marginRight: 4, fontSize: 10 }}
                        />
                        {t.date}: {credit.dateIssued}
                        {credit.dueDate && (
                          <>
                            &nbsp;·&nbsp;{t.dueDate.split(" (")[0]}:{" "}
                            {credit.dueDate}
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Right side amounts */}
                  <div className="credit-amounts-col">
                    <div className="credit-total">
                      KES {(credit.totalAmount || 0).toLocaleString()}
                    </div>

                    {isOutstanding && remaining > 0 && (
                      <div className="credit-remaining">
                        KES {remaining.toLocaleString()}{" "}
                        {t.remaining.toLowerCase()}
                      </div>
                    )}

                    {(credit.paidAmount || 0) > 0 && (
                      <div className="credit-chip credit-chip-green">
                        ✓ KES {credit.paidAmount.toLocaleString()}{" "}
                        {t.alreadyPaid.toLowerCase()}
                      </div>
                    )}

                    {isBadDebt && writtenOff > 0 && (
                      <div className="credit-chip credit-chip-red">
                        ✗ KES {writtenOff.toLocaleString()}{" "}
                        {t.writtenOff.toLowerCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar (outstanding only) */}
                {isOutstanding && credit.totalAmount > 0 && (
                  <div className="credit-progress-wrap">
                    <div className="credit-progress-bar">
                      <div
                        className="credit-progress-fill"
                        style={{
                          width: `${pct}%`,
                          background:
                            pct === 100
                              ? "var(--green)"
                              : pct > 50
                                ? "var(--orange)"
                                : "var(--red)",
                        }}
                      />
                    </div>
                    <span className="credit-pct">{pct.toFixed(0)}%</span>
                  </div>
                )}

                {/* Payment history */}
                {credit.payments?.length > 0 && (
                  <div className="credit-payment-history">
                    <span className="credit-ph-label">{t.payments}: </span>
                    {credit.payments.map((p, i) => (
                      <span key={i} className="credit-ph-item">
                        KES {p.amount.toLocaleString()} — {p.date}
                        {p.note ? ` (${p.note})` : ""}
                      </span>
                    ))}
                  </div>
                )}

                {/* Closed-state notes */}
                {isPaid && (
                  <div
                    className="credit-closed-note"
                    style={{ color: "var(--green)" }}
                  >
                    <FontAwesomeIcon
                      icon={faArrowRight}
                      style={{ marginRight: 6 }}
                    />
                    {t.alreadyPaid} — {t.sales || "Sales"}{" "}
                    {credit.lastPaymentDate || ""}
                  </div>
                )}

                {isBadDebt && (
                  <div className="credit-closed-note-wrap">
                    {(credit.paidAmount || 0) > 0 && (
                      <div
                        className="credit-closed-note"
                        style={{ color: "var(--green)" }}
                      >
                        <FontAwesomeIcon
                          icon={faArrowRight}
                          style={{ marginRight: 6 }}
                        />
                        KES {credit.paidAmount.toLocaleString()}{" "}
                        {t.alreadyPaid.toLowerCase()} →{" "}
                        {t.sales || t.totalCollected}
                      </div>
                    )}
                    {writtenOff > 0 && (
                      <div
                        className="credit-closed-note"
                        style={{ color: "var(--red)" }}
                      >
                        <FontAwesomeIcon
                          icon={faArrowRight}
                          style={{ marginRight: 6 }}
                        />
                        KES {writtenOff.toLocaleString()}{" "}
                        {t.writtenOff.toLowerCase()} →{" "}
                        {t.losses || t.writtenOff} {credit.closedDate || ""}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="credit-actions">
                  {isOutstanding && (
                    <>
                      <button
                        className="btn-pay"
                        onClick={() => {
                          setPayingCredit(credit);
                          setPayAmount("");
                          setPayNote("");
                        }}
                      >
                        <FontAwesomeIcon icon={faHandHoldingDollar} />{" "}
                        {t.recordPayment}
                      </button>
                      <button
                        className="btn-secondary"
                        style={{
                          fontSize: 12,
                          padding: "7px 12px",
                          color: "var(--red)",
                          borderColor: "var(--red)",
                        }}
                        onClick={() => setBadDebtTarget(credit)}
                      >
                        <FontAwesomeIcon icon={faThumbsDown} /> {t.badDebt}
                      </button>
                    </>
                  )}
                  <button
                    className="btn-danger"
                    style={{
                      fontSize: 12,
                      padding: "7px 12px",
                      marginLeft: "auto",
                    }}
                    onClick={() => setDeleteTarget(credit)}
                  >
                    <FontAwesomeIcon icon={faTrash} /> {t.delete}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bad Debt confirm dialog */}
      <AlertDialog
        open={!!badDebtTarget}
        danger
        title={t.writeOff}
        message={
          badDebtTarget
            ? (() => {
                const unpaid = Math.max(
                  0,
                  (badDebtTarget.totalAmount || 0) -
                    (badDebtTarget.paidAmount || 0),
                );
                const alreadyHad = (badDebtTarget.paidAmount || 0) > 0;
                return (
                  `KES ${unpaid.toLocaleString()} (${badDebtTarget.customer}) → ${t.losses || "Losses"}.` +
                  (alreadyHad
                    ? ` KES ${badDebtTarget.paidAmount.toLocaleString()} ${t.staysInSales || "already collected stays in Sales"}.`
                    : "") +
                  ` ${t.cannotBeUndone || "This cannot be undone."}`
                );
              })()
            : ""
        }
        confirmLabel={t.yesWriteOff}
        cancelLabel={t.cancel}
        onCancel={() => setBadDebtTarget(null)}
        onConfirm={confirmBadDebt}
      />

      {/* Delete confirm dialog */}
      <AlertDialog
        open={!!deleteTarget}
        danger
        title={t.deleteRecord}
        message={
          deleteTarget
            ? `"${deleteTarget.customer}" — ${t.cannotBeUndone || "This cannot be undone."}`
            : ""
        }
        confirmLabel={t.confirmDelete}
        cancelLabel={t.cancel}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteItem(deleteTarget.id);
            showToast(t.deletedToast);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
