import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useStock } from "../hooks/useStock";
import { useLang } from "../LangContext";
import { db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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

  const uid = auth.currentUser?.uid;
  const today = () => new Date().toISOString().split("T")[0];

  // Save new credit
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

  // Record a payment
  // Every payment — partial or full — goes to Sales immediately.
  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    const remaining =
      (payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0);
    // Cap at remaining so you can't overpay
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

      // EVERY payment — partial or full — recorded as Sales immediately
      await addDoc(collection(db, "sales"), {
        userId: uid,
        date: today(),
        description: `Credit payment — ${payingCredit.customer}${payingCredit.itemTaken ? ` (${payingCredit.itemTaken})` : ""}`,
        customer: payingCredit.customer,
        phone: payingCredit.phone || "",
        amount: actualAmount,
        notes:
          `${isFullyPaid ? "Final payment — debt cleared." : "Partial payment."} Originally issued ${payingCredit.dateIssued}. ${payNote || ""}`.trim(),
        fromCredit: payingCredit.id,
        createdAt: serverTimestamp(),
      });

      if (isFullyPaid) {
        showToast(t.paidSales);
      } else {
        showToast(
          t.partialPay(
            actualAmount.toLocaleString(),
            (payingCredit.totalAmount - newPaid).toLocaleString(),
          ),
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

  // Mark as bad debt
  // Only the REMAINING unpaid amount goes to Losses.
  // Already-paid amounts stay in Sales (recorded at payment time).
  const confirmBadDebt = async () => {
    const credit = badDebtTarget;
    if (!credit) return;
    try {
      const unpaid = (credit.totalAmount || 0) - (credit.paidAmount || 0);

      await updateItem(credit.id, {
        status: "bad_debt",
        closedDate: today(),
        // Outstanding is now zero — the unpaid portion is forgone
        badDebtAmount: unpaid,
      });

      // Only the forgone (remaining) amount goes to Losses
      if (unpaid > 0) {
        await addDoc(collection(db, "losses"), {
          userId: uid,
          date: today(),
          item: `Bad debt written off — ${credit.customer}${credit.itemTaken ? ` (${credit.itemTaken})` : ""}`,
          category: "Bad Debt",
          quantity: "",
          amount: unpaid,
          notes: `Customer: ${credit.customer}. Phone: ${credit.phone || "N/A"}. Total credit: KES ${credit.totalAmount.toLocaleString()}, collected: KES ${(credit.paidAmount || 0).toLocaleString()}, written off: KES ${unpaid.toLocaleString()}. Issued ${credit.dateIssued}${credit.dueDate ? `, due ${credit.dueDate}` : ""}.`,
          fromCredit: credit.id,
          createdAt: serverTimestamp(),
        });
      }

      showToast(
        unpaid > 0
          ? `KES ${unpaid.toLocaleString()} imeandikwa / written off to Losses. ${credit.paidAmount > 0 ? `KES ${credit.paidAmount.toLocaleString()} already collected stays in Sales.` : ""}`
          : "Marked as bad debt (nothing to write off — already fully collected).",
      );
      setBadDebtTarget(null);
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
      setBadDebtTarget(null);
    }
  };

  // Helpers
  const isOverdue = (c) => {
    if (!c.dueDate || c.status !== "outstanding") return false;
    return new Date(c.dueDate) < new Date();
  };

  const outstanding = credits.filter((c) => c.status === "outstanding");
  const badDebts = credits.filter((c) => c.status === "bad_debt");
  const paid = credits.filter((c) => c.status === "paid");

  // Outstanding = only active unpaid debts (not bad debts — those are closed)
  const totalOutstanding = outstanding.reduce(
    (a, c) => a + Math.max(0, (c.totalAmount || 0) - (c.paidAmount || 0)),
    0,
  );
  // Total collected across all credits (paid + partial payments on outstanding + bad debts)
  const totalCollected = credits.reduce((a, c) => a + (c.paidAmount || 0), 0);
  // Total written off as bad debt
  const totalWrittenOff = badDebts.reduce(
    (a, c) =>
      a +
      Math.max(
        0,
        c.badDebtAmount || (c.totalAmount || 0) - (c.paidAmount || 0),
      ),
    0,
  );
  // Grand total of all credit ever issued
  const grandTotal = credits.reduce((a, c) => a + (c.totalAmount || 0), 0);

  // Render
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
            <div className="card-label">Total Outstanding</div>
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
            <div className="card-label">{t.unpaidDebts}</div>
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
            <div className="card-value green">{paid.length}</div>
          </div>
        </div>
      </div>

      {/* Stats row — collected / written off / grand total */}
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
            <FontAwesomeIcon icon={faHandHoldingDollar} /> Record Credit / Debt
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
                  placeholder="e.g. John Kamau"
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
                Cancel
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
                  Kila malipo — ya sehemu au yote — yanaenda moja kwa moja
                  kwenye <strong>Mauzo / Sales</strong>
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
                    {willClear ? (
                      <>
                        ✓ Deni limeisha — inahamia{" "}
                        <strong>Mauzo / Sales</strong>
                      </>
                    ) : (
                      <>
                        KES {actual.toLocaleString()} →{" "}
                        <strong>Mauzo / Sales</strong>
                        &nbsp;·&nbsp; KES {afterPay.toLocaleString()} bado
                        inadaiwa / still outstanding
                      </>
                    )}
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
                    Thibitisha Malipo / Confirm Payment
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Credit List */}
      {loading ? (
        <div className="table-loading">Loading credits...</div>
      ) : credits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FontAwesomeIcon icon={faHandHoldingDollar} />
          </div>
          <div>{t.noCredits}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Tap New Credit to record a debt.
          </div>
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

                    {/* Outstanding: show remaining */}
                    {isOutstanding && remaining > 0 && (
                      <div className="credit-remaining">
                        KES {remaining.toLocaleString()}{" "}
                        {t.remaining.toLowerCase()}
                      </div>
                    )}

                    {/* Collected amount (all statuses) */}
                    {(credit.paidAmount || 0) > 0 && (
                      <div className="credit-chip credit-chip-green">
                        ✓ KES {credit.paidAmount.toLocaleString()} imekusanywa /
                        collected
                      </div>
                    )}

                    {/* Bad debt: show what was written off */}
                    {isBadDebt && writtenOff > 0 && (
                      <div className="credit-chip credit-chip-red">
                        ✗ KES {writtenOff.toLocaleString()} imeandikwa / written
                        off
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
                    <span className="credit-ph-label">Malipo: </span>
                    {credit.payments.map((p, i) => (
                      <span key={i} className="credit-ph-item">
                        KES {p.amount.toLocaleString()} on {p.date}
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
                    Imekusanywa yote — imewekwa kwenye Mauzo tarehe{" "}
                    {credit.lastPaymentDate || "completion"}
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
                        KES {credit.paidAmount.toLocaleString()} imekusanywa /
                        imekusanywa — imewekwa Mauzo
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
                        KES {writtenOff.toLocaleString()} imeandikwa /
                        imeandikwa kwenye Hasara tarehe{" "}
                        {credit.closedDate || "closure"}
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
                        {t.payments}
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

      {/* Bad Debt confirm */}
      <AlertDialog
        open={!!badDebtTarget}
        title={t.writeOff}
        message={
          badDebtTarget
            ? `Only the remaining KES ${Math.max(0, (badDebtTarget.totalAmount || 0) - (badDebtTarget.paidAmount || 0)).toLocaleString()} owed by "${badDebtTarget.customer}" will be written off to Losses.${
                (badDebtTarget.paidAmount || 0) > 0
                  ? ` The KES ${badDebtTarget.paidAmount.toLocaleString()} already collected stays in Sales.`
                  : ""
              } This cannot be undone.`
            : ""
        }
        confirmLabel={t.yesWriteOff}
        cancelLabel={t.cancel}
        onCancel={() => setBadDebtTarget(null)}
        onConfirm={confirmBadDebt}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        title="Delete this credit record?"
        message={
          deleteTarget
            ? `This will permanently remove the credit for "${deleteTarget.customer}". This cannot be undone.`
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
