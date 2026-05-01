import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus, faTimes, faPhone, faCalendar, faHandHoldingDollar,
  faCheckCircle, faExclamationTriangle, faTrash, faThumbsDown,
  faArrowRight, faMoneyBillWave, faChartBar,
} from "@fortawesome/free-solid-svg-icons";

export default function Credits() {
  const { items: credits, loading, addItem, deleteItem, updateItem } = useCollection("credits");
  const { toast, showToast } = useToast();

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    customer: "", phone: "", itemTaken: "", dueDate: "", totalAmount: "", notes: "",
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

  // ── Save new credit ──────────────────────────────────────
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
      showToast("Credit recorded!");
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      showToast("Save failed", "error");
    }
    setSaving(false);
  };

  // ── Record a payment ─────────────────────────────────────
  // Every payment — partial or full — goes to Sales immediately.
  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    const remaining = (payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0);
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
        notes: `${isFullyPaid ? "Final payment — debt cleared." : "Partial payment."} Originally issued ${payingCredit.dateIssued}. ${payNote || ""}`.trim(),
        fromCredit: payingCredit.id,
        createdAt: serverTimestamp(),
      });

      if (isFullyPaid) {
        showToast("Debt cleared! Payment recorded in Sales ✓");
      } else {
        showToast(`KES ${actualAmount.toLocaleString()} recorded in Sales. KES ${(payingCredit.totalAmount - newPaid).toLocaleString()} still outstanding.`);
      }

      setPayingCredit(null);
      setPayAmount("");
      setPayNote("");
    } catch (err) {
      console.error(err);
      showToast("Payment failed", "error");
    }
  };

  // ── Mark as bad debt ─────────────────────────────────────
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
          ? `KES ${unpaid.toLocaleString()} written off to Losses. ${credit.paidAmount > 0 ? `KES ${credit.paidAmount.toLocaleString()} already collected stays in Sales.` : ""}`
          : "Marked as bad debt (nothing to write off — already fully collected)."
      );
      setBadDebtTarget(null);
    } catch (err) {
      console.error(err);
      showToast("Failed to mark as bad debt", "error");
      setBadDebtTarget(null);
    }
  };

  // ── Helpers ──────────────────────────────────────────────
  const isOverdue = (c) => {
    if (!c.dueDate || c.status !== "outstanding") return false;
    return new Date(c.dueDate) < new Date();
  };

  const outstanding = credits.filter((c) => c.status === "outstanding");
  const badDebts    = credits.filter((c) => c.status === "bad_debt");
  const paid        = credits.filter((c) => c.status === "paid");

  // Outstanding = only active unpaid debts (not bad debts — those are closed)
  const totalOutstanding = outstanding.reduce(
    (a, c) => a + Math.max(0, (c.totalAmount || 0) - (c.paidAmount || 0)), 0
  );
  // Total collected across all credits (paid + partial payments on outstanding + bad debts)
  const totalCollected = credits.reduce((a, c) => a + (c.paidAmount || 0), 0);
  // Total written off as bad debt
  const totalWrittenOff = badDebts.reduce(
    (a, c) => a + Math.max(0, (c.badDebtAmount || (c.totalAmount || 0) - (c.paidAmount || 0))), 0
  );
  // Grand total of all credit ever issued
  const grandTotal = credits.reduce((a, c) => a + (c.totalAmount || 0), 0);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="module-page">
      <Toast toast={toast} />

      {/* ── Summary cards ── */}
      <div className="credits-summary">
        <div className="summary-card" style={{ borderTop: "3px solid var(--orange)" }}>
          <div className="card-icon" style={{ background: "var(--orange-bg)", color: "var(--orange)" }}>
            <FontAwesomeIcon icon={faHandHoldingDollar} />
          </div>
          <div>
            <div className="card-label">Total Outstanding</div>
            <div className="card-value orange">KES {totalOutstanding.toLocaleString()}</div>
          </div>
        </div>

        <div className="summary-card" style={{ borderTop: "3px solid var(--red)" }}>
          <div className="card-icon" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
            <FontAwesomeIcon icon={faExclamationTriangle} />
          </div>
          <div>
            <div className="card-label">Unpaid Debts</div>
            <div className="card-value red">{outstanding.length}</div>
          </div>
        </div>

        <div className="summary-card" style={{ borderTop: "3px solid var(--green)" }}>
          <div className="card-icon" style={{ background: "var(--green-bg)", color: "var(--green)" }}>
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
          <div>
            <div className="card-label">Cleared</div>
            <div className="card-value green">{paid.length}</div>
          </div>
        </div>
      </div>

      {/* ── Stats row — collected / written off / grand total ── */}
      <div className="credits-stats-row">
        <div className="credits-stat-box credits-stat-green">
          <FontAwesomeIcon icon={faMoneyBillWave} className="credits-stat-icon" />
          <div>
            <div className="credits-stat-label">Total Collected (in Sales)</div>
            <div className="credits-stat-val">KES {totalCollected.toLocaleString()}</div>
          </div>
        </div>
        <div className="credits-stat-box credits-stat-red">
          <FontAwesomeIcon icon={faThumbsDown} className="credits-stat-icon" />
          <div>
            <div className="credits-stat-label">Written Off (Bad Debts)</div>
            <div className="credits-stat-val">KES {totalWrittenOff.toLocaleString()}</div>
          </div>
        </div>
        <div className="credits-stat-box credits-stat-neutral">
          <FontAwesomeIcon icon={faChartBar} className="credits-stat-icon" />
          <div>
            <div className="credits-stat-label">All Credits Issued</div>
            <div className="credits-stat-val">KES {grandTotal.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* ── New Credit Button ── */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <FontAwesomeIcon icon={showForm ? faTimes : faPlus} />
          {showForm ? " Cancel" : " New Credit"}
        </button>
      </div>

      {/* ── New Credit Form ── */}
      {showForm && (
        <div className="entry-form" style={{ marginBottom: 20 }}>
          <h3><FontAwesomeIcon icon={faHandHoldingDollar} /> Record Credit / Debt</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field-group">
                <label>Date Issued</label>
                <input type="date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="field-group">
                <label>Due Date (optional)</label>
                <input type="date" value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="field-group">
                <label>Customer Name</label>
                <input placeholder="e.g. John Kamau" value={form.customer}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })} required />
              </div>
              <div className="field-group">
                <label>Phone Number</label>
                <input placeholder="07..." value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field-group">
                <label>Item / Description</label>
                <input placeholder="What was taken on credit?" value={form.itemTaken}
                  onChange={(e) => setForm({ ...form, itemTaken: e.target.value })} />
              </div>
              <div className="field-group">
                <label>Total Amount (KES)</label>
                <input type="number" placeholder="0.00" value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  required min="1" />
              </div>
              <div className="field-group full-width">
                <label>Notes (optional)</label>
                <textarea placeholder="Any extra details..." value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Credit"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {payingCredit && (() => {
        const remaining = (payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0);
        const entered   = parseFloat(payAmount) || 0;
        const actual    = Math.min(entered, remaining);
        const willClear = actual >= remaining;
        const afterPay  = remaining - actual;

        return (
          <div className="modal-overlay" onClick={() => setPayingCredit(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3><FontAwesomeIcon icon={faHandHoldingDollar} /> Record Payment</h3>

              <div className="credit-modal-meta">
                <div className="credit-modal-row">
                  <span>Customer</span>
                  <strong>{payingCredit.customer}</strong>
                </div>
                <div className="credit-modal-row">
                  <span>Total credit</span>
                  <strong>KES {(payingCredit.totalAmount || 0).toLocaleString()}</strong>
                </div>
                {(payingCredit.paidAmount || 0) > 0 && (
                  <div className="credit-modal-row">
                    <span>Already paid</span>
                    <strong className="text-green">KES {payingCredit.paidAmount.toLocaleString()}</strong>
                  </div>
                )}
                <div className="credit-modal-row credit-modal-row-highlight">
                  <span>Remaining</span>
                  <strong className="text-red">KES {remaining.toLocaleString()}</strong>
                </div>
              </div>

              <div className="credit-flow-note">
                <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: 6 }} />
                Every payment — partial or full — goes straight to <strong>Sales</strong>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="field-group">
                  <label>Amount Being Paid (KES)</label>
                  <input
                    type="number" placeholder="0.00" value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    autoFocus min="1" max={remaining}
                  />
                </div>
                <div className="field-group">
                  <label>Payment Note (optional)</label>
                  <input placeholder="e.g. M-Pesa, Cash..." value={payNote}
                    onChange={(e) => setPayNote(e.target.value)} />
                </div>
              </div>

              {entered > 0 && (
                <div className={`credit-pay-preview ${willClear ? "credit-pay-clear" : "credit-pay-partial"}`}>
                  {willClear ? (
                    <>✓ This clears the full debt — moves to <strong>Sales</strong></>
                  ) : (
                    <>
                      KES {actual.toLocaleString()} → <strong>Sales</strong>
                      &nbsp;·&nbsp; KES {afterPay.toLocaleString()} still outstanding
                    </>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => {
                  setPayingCredit(null); setPayAmount(""); setPayNote("");
                }}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handlePayment}
                  disabled={!payAmount || parseFloat(payAmount) <= 0}
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Credit List ── */}
      {loading ? (
        <div className="table-loading">Loading credits...</div>
      ) : credits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FontAwesomeIcon icon={faHandHoldingDollar} /></div>
          <div>No credits recorded yet.</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Tap New Credit to record a debt.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {credits.map((credit) => {
            const remaining    = (credit.totalAmount || 0) - (credit.paidAmount || 0);
            const pct          = credit.totalAmount > 0
              ? Math.min(100, ((credit.paidAmount || 0) / credit.totalAmount) * 100)
              : 0;
            const overdue      = isOverdue(credit);
            const isPaid       = credit.status === "paid";
            const isBadDebt    = credit.status === "bad_debt";
            const isOutstanding = credit.status === "outstanding";
            const writtenOff   = credit.badDebtAmount
              ?? Math.max(0, (credit.totalAmount || 0) - (credit.paidAmount || 0));

            return (
              <div
                key={credit.id}
                className={
                  "credit-card" +
                  (isPaid    ? " credit-card-paid" : "") +
                  (isBadDebt ? " credit-card-bad"  : "")
                }
                style={overdue && isOutstanding ? { borderColor: "var(--red)", borderWidth: 2 } : {}}
              >
                {/* Header */}
                <div className="credit-card-header">
                  <div className="credit-card-info">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <div className="credit-customer">{credit.customer}</div>
                      {isPaid && (
                        <span className="credit-status-badge"
                          style={{ background: "var(--green-bg)", color: "var(--green)", borderColor: "#90d8a5" }}>
                          ✓ PAID → Sales
                        </span>
                      )}
                      {isBadDebt && (
                        <span className="credit-status-badge"
                          style={{ background: "var(--red-bg)", color: "var(--red)", borderColor: "#f5a5a5" }}>
                          ✗ BAD DEBT
                        </span>
                      )}
                      {overdue && isOutstanding && (
                        <span className="credit-status-badge"
                          style={{ background: "#fff3cd", color: "#856404", borderColor: "#ffc107" }}>
                          ⚠ OVERDUE
                        </span>
                      )}
                    </div>
                    {credit.itemTaken && <div className="credit-desc">{credit.itemTaken}</div>}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                      {credit.phone && (
                        <a href={`tel:${credit.phone}`} className="credit-phone">
                          <FontAwesomeIcon icon={faPhone} style={{ marginRight: 4, fontSize: 10 }} />
                          {credit.phone}
                        </a>
                      )}
                      <span className="credit-date">
                        <FontAwesomeIcon icon={faCalendar} style={{ marginRight: 4, fontSize: 10 }} />
                        Issued: {credit.dateIssued}
                        {credit.dueDate && <>&nbsp;·&nbsp;Due: {credit.dueDate}</>}
                      </span>
                    </div>
                  </div>

                  {/* Right side amounts */}
                  <div className="credit-amounts-col">
                    <div className="credit-total">KES {(credit.totalAmount || 0).toLocaleString()}</div>

                    {/* Outstanding: show remaining */}
                    {isOutstanding && remaining > 0 && (
                      <div className="credit-remaining">KES {remaining.toLocaleString()} remaining</div>
                    )}

                    {/* Collected amount (all statuses) */}
                    {(credit.paidAmount || 0) > 0 && (
                      <div className="credit-chip credit-chip-green">
                        ✓ KES {credit.paidAmount.toLocaleString()} collected
                      </div>
                    )}

                    {/* Bad debt: show what was written off */}
                    {isBadDebt && writtenOff > 0 && (
                      <div className="credit-chip credit-chip-red">
                        ✗ KES {writtenOff.toLocaleString()} written off
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar (outstanding only) */}
                {isOutstanding && credit.totalAmount > 0 && (
                  <div className="credit-progress-wrap">
                    <div className="credit-progress-bar">
                      <div className="credit-progress-fill" style={{
                        width: `${pct}%`,
                        background: pct === 100
                          ? "var(--green)"
                          : pct > 50
                            ? "var(--orange)"
                            : "var(--red)",
                      }} />
                    </div>
                    <span className="credit-pct">{pct.toFixed(0)}%</span>
                  </div>
                )}

                {/* Payment history */}
                {credit.payments?.length > 0 && (
                  <div className="credit-payment-history">
                    <span className="credit-ph-label">Payments: </span>
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
                  <div className="credit-closed-note" style={{ color: "var(--green)" }}>
                    <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: 6 }} />
                    Fully collected — recorded in Sales on {credit.lastPaymentDate || "completion"}
                  </div>
                )}
                {isBadDebt && (
                  <div className="credit-closed-note-wrap">
                    {(credit.paidAmount || 0) > 0 && (
                      <div className="credit-closed-note" style={{ color: "var(--green)" }}>
                        <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: 6 }} />
                        KES {credit.paidAmount.toLocaleString()} collected — recorded in Sales
                      </div>
                    )}
                    {writtenOff > 0 && (
                      <div className="credit-closed-note" style={{ color: "var(--red)" }}>
                        <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: 6 }} />
                        KES {writtenOff.toLocaleString()} written off to Losses on {credit.closedDate || "closure"}
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
                        onClick={() => { setPayingCredit(credit); setPayAmount(""); setPayNote(""); }}
                      >
                        <FontAwesomeIcon icon={faHandHoldingDollar} /> Pay
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: "7px 12px", color: "var(--red)", borderColor: "var(--red)" }}
                        onClick={() => setBadDebtTarget(credit)}
                      >
                        <FontAwesomeIcon icon={faThumbsDown} /> Bad Debt
                      </button>
                    </>
                  )}
                  <button
                    className="btn-danger"
                    style={{ fontSize: 12, padding: "7px 12px", marginLeft: "auto" }}
                    onClick={() => setDeleteTarget(credit)}
                  >
                    <FontAwesomeIcon icon={faTrash} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bad Debt confirm ── */}
      <AlertDialog
        open={!!badDebtTarget}
        title="Write off as bad debt?"
        message={
          badDebtTarget
            ? `Only the remaining KES ${Math.max(0, (badDebtTarget.totalAmount || 0) - (badDebtTarget.paidAmount || 0)).toLocaleString()} owed by "${badDebtTarget.customer}" will be written off to Losses.${
                (badDebtTarget.paidAmount || 0) > 0
                  ? ` The KES ${badDebtTarget.paidAmount.toLocaleString()} already collected stays in Sales.`
                  : ""
              } This cannot be undone.`
            : ""
        }
        confirmLabel="Yes, Write Off"
        cancelLabel="Cancel"
        onCancel={() => setBadDebtTarget(null)}
        onConfirm={confirmBadDebt}
      />

      {/* ── Delete confirm ── */}
      <AlertDialog
        open={!!deleteTarget}
        title="Delete this credit record?"
        message={
          deleteTarget
            ? `This will permanently remove the credit for "${deleteTarget.customer}". This cannot be undone.`
            : ""
        }
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteItem(deleteTarget.id);
            showToast("Credit deleted");
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
