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
  faArrowRight
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
  // When fully paid → move to Sales as a completed sale
  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    try {
      const newPaid = (payingCredit.paidAmount || 0) + amount;
      const isFullyPaid = newPaid >= payingCredit.totalAmount;
      const newPayments = [
        ...(payingCredit.payments || []),
        { amount, date: today(), note: payNote },
      ];

      // Update credit record
      await updateItem(payingCredit.id, {
        paidAmount: newPaid,
        payments: newPayments,
        status: isFullyPaid ? "paid" : "outstanding",
        lastPaymentDate: today(),
      });

      // If fully paid → create a Sales record
      if (isFullyPaid) {
        await addDoc(collection(db, "sales"), {
          userId: uid,
          date: today(),
          description: payingCredit.itemTaken || "Credit repayment",
          customer: payingCredit.customer,
          phone: payingCredit.phone || "",
          amount: payingCredit.totalAmount,
          notes: `Paid in full. Originally issued ${payingCredit.dateIssued}${payingCredit.dueDate ? `, due ${payingCredit.dueDate}` : ""}. ${payNote || ""}`.trim(),
          fromCredit: payingCredit.id,
          createdAt: serverTimestamp(),
        });
        showToast("Debt cleared! Moved to Sales ✓");
      } else {
        showToast(`Payment of KES ${amount.toLocaleString()} recorded`);
      }

      setPayingCredit(null);
      setPayAmount("");
      setPayNote("");
    } catch (err) {
      console.error(err);
      showToast("Payment failed", "error");
    }
  };

  // ── Mark as bad debt → move to Losses ───────────────────
  const confirmBadDebt = async () => {
    const credit = badDebtTarget;
    if (!credit) return;
    try {
      // Update credit status
      await updateItem(credit.id, {
        status: "bad_debt",
        closedDate: today(),
      });

      // Add to Losses
      const unpaid = credit.totalAmount - (credit.paidAmount || 0);
      await addDoc(collection(db, "losses"), {
        userId: uid,
        date: today(),
        item: `Bad debt — ${credit.customer}${credit.itemTaken ? ` (${credit.itemTaken})` : ""}`,
        category: "Bad Debt",
        quantity: "",
        amount: unpaid,
        notes: `Customer: ${credit.customer}. Phone: ${credit.phone || "N/A"}. Originally KES ${credit.totalAmount.toLocaleString()}, collected KES ${(credit.paidAmount || 0).toLocaleString()}. Issued ${credit.dateIssued}${credit.dueDate ? `, due ${credit.dueDate}` : ""}.`,
        fromCredit: credit.id,
        createdAt: serverTimestamp(),
      });

      showToast("Marked as bad debt — moved to Losses");
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
  const badDebts = credits.filter((c) => c.status === "bad_debt");
  const paid = credits.filter((c) => c.status === "paid");
  const totalOwed = [...outstanding, ...badDebts]
    .reduce((a, c) => a + Math.max(0, (c.totalAmount || 0) - (c.paidAmount || 0)), 0);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="module-page">
      <Toast toast={toast} />

      {/* Summary */}
      <div className="credits-summary">
        <div className="summary-card" style={{ borderTop: "3px solid var(--orange)" }}>
          <div className="card-icon" style={{ background: "var(--orange-bg)", color: "var(--orange)" }}>
            <FontAwesomeIcon icon={faHandHoldingDollar} />
          </div>
          <div>
            <div className="card-label">Total Outstanding</div>
            <div className="card-value orange">KES {totalOwed.toLocaleString()}</div>
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

      {/* New Credit Button */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <FontAwesomeIcon icon={showForm ? faTimes : faPlus} />
          {showForm ? " Cancel" : " New Credit"}
        </button>
      </div>

      {/* New Credit Form */}
      {showForm && (
        <div className="entry-form" style={{ marginBottom: 20 }}>
          <h3><FontAwesomeIcon icon={faHandHoldingDollar} /> Record Credit / Debt</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field-group">
                <label>Date Issued</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="field-group">
                <label>Due Date (optional)</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="field-group">
                <label>Customer Name</label>
                <input placeholder="e.g. John Kamau" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} required />
              </div>
              <div className="field-group">
                <label>Phone Number</label>
                <input placeholder="07..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field-group">
                <label>Item / Description</label>
                <input placeholder="What was taken on credit?" value={form.itemTaken} onChange={(e) => setForm({ ...form, itemTaken: e.target.value })} />
              </div>
              <div className="field-group">
                <label>Total Amount (KES)</label>
                <input type="number" placeholder="0.00" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} required min="1" />
              </div>
              <div className="field-group full-width">
                <label>Notes (optional)</label>
                <textarea placeholder="Any extra details..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Credit"}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Modal */}
      {payingCredit && (
        <div className="modal-overlay" onClick={() => setPayingCredit(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3><FontAwesomeIcon icon={faHandHoldingDollar} /> Record Payment</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 6 }}>
              Customer: <strong style={{ color: "var(--text)" }}>{payingCredit.customer}</strong>
            </p>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
              Remaining: <strong style={{ color: "var(--red)" }}>
                KES {((payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0)).toLocaleString()}
              </strong>
            </p>
            <div className="credit-flow-note">
              <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: 6 }} />
              If this clears the debt, it will automatically move to <strong>Sales</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field-group">
                <label>Amount Paid (KES)</label>
                <input
                  type="number" placeholder="0.00" value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)} autoFocus min="1"
                  max={(payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0)}
                />
              </div>
              <div className="field-group">
                <label>Payment Note (optional)</label>
                <input placeholder="e.g. M-Pesa, Cash..." value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </div>
            </div>
            {parseFloat(payAmount) > 0 && (
              <div style={{
                marginTop: 12, padding: "8px 12px", borderRadius: 6,
                background: parseFloat(payAmount) >= ((payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0))
                  ? "var(--green-bg)" : "var(--orange-bg)",
                border: `1px solid ${parseFloat(payAmount) >= ((payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0))
                  ? "var(--green-lt)" : "#f5c898"}`,
                fontSize: 12,
                color: parseFloat(payAmount) >= ((payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0))
                  ? "var(--green)" : "var(--orange)",
                fontWeight: 600,
              }}>
                {parseFloat(payAmount) >= ((payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0))
                  ? "✓ This clears the full debt — will move to Sales"
                  : `KES ${((payingCredit.totalAmount || 0) - (payingCredit.paidAmount || 0) - parseFloat(payAmount || 0)).toLocaleString()} will remain outstanding`
                }
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setPayingCredit(null); setPayAmount(""); setPayNote(""); }}>Cancel</button>
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
      )}

      {/* Credit List */}
      {loading ? (
        <div className="table-loading">Loading credits...</div>
      ) : credits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FontAwesomeIcon icon={faHandHoldingDollar} /></div>
          <div>No credits recorded yet.</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Tap New Credit to record a debt.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {credits.map((credit) => {
            const remaining = (credit.totalAmount || 0) - (credit.paidAmount || 0);
            const pct = credit.totalAmount > 0 ? Math.min(100, ((credit.paidAmount || 0) / credit.totalAmount) * 100) : 0;
            const overdue = isOverdue(credit);
            const isPaid = credit.status === "paid";
            const isBadDebt = credit.status === "bad_debt";
            const isOutstanding = credit.status === "outstanding";

            return (
              <div
                key={credit.id}
                className={"credit-card" + (isPaid ? " credit-card-paid" : isBadDebt ? " credit-card-bad" : "")}
                style={overdue && isOutstanding ? { borderColor: "var(--red)", borderWidth: 2 } : {}}
              >
                {/* Header */}
                <div className="credit-card-header">
                  <div className="credit-card-info">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <div className="credit-customer">{credit.customer}</div>
                      {isPaid && (
                        <span className="credit-status-badge" style={{ background: "var(--green-bg)", color: "var(--green)", borderColor: "#90d8a5" }}>
                          ✓ PAID → Sales
                        </span>
                      )}
                      {isBadDebt && (
                        <span className="credit-status-badge" style={{ background: "var(--red-bg)", color: "var(--red)", borderColor: "#f5a5a5" }}>
                          ✗ BAD DEBT → Losses
                        </span>
                      )}
                      {overdue && isOutstanding && (
                        <span className="credit-status-badge" style={{ background: "#fff3cd", color: "#856404", borderColor: "#ffc107" }}>
                          ⚠ OVERDUE
                        </span>
                      )}
                    </div>
                    {credit.itemTaken && <div className="credit-desc">{credit.itemTaken}</div>}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                      {credit.phone && (
                        <a href={`tel:${credit.phone}`} className="credit-phone">
                          <FontAwesomeIcon icon={faPhone} style={{ marginRight: 4, fontSize: 10 }} />{credit.phone}
                        </a>
                      )}
                      <span className="credit-date">
                        <FontAwesomeIcon icon={faCalendar} style={{ marginRight: 4, fontSize: 10 }} />
                        Issued: {credit.dateIssued}
                        {credit.dueDate && <>&nbsp;&middot;&nbsp;Due: {credit.dueDate}</>}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="credit-total">KES {(credit.totalAmount || 0).toLocaleString()}</div>
                    {isOutstanding && remaining > 0 && (
                      <div className="credit-remaining">KES {remaining.toLocaleString()} remaining</div>
                    )}
                    {(credit.paidAmount || 0) > 0 && (
                      <div className="credit-paid-badge">KES {credit.paidAmount.toLocaleString()} paid</div>
                    )}
                  </div>
                </div>

                {/* Progress Bar (outstanding only) */}
                {isOutstanding && credit.totalAmount > 0 && (
                  <div className="credit-progress-wrap">
                    <div className="credit-progress-bar">
                      <div className="credit-progress-fill" style={{
                        width: `${pct}%`,
                        background: pct === 100 ? "var(--green)" : pct > 50 ? "var(--orange)" : "var(--red)"
                      }} />
                    </div>
                    <span className="credit-pct">{pct.toFixed(0)}%</span>
                  </div>
                )}

                {/* Payment History */}
                {credit.payments?.length > 0 && (
                  <div className="credit-payment-history">
                    <span className="credit-ph-label">Payments: </span>
                    {credit.payments.map((p, i) => (
                      <span key={i} className="credit-ph-item">
                        KES {p.amount.toLocaleString()} on {p.date}{p.note ? ` (${p.note})` : ""}
                      </span>
                    ))}
                  </div>
                )}

                {/* Destination note for closed credits */}
                {isPaid && (
                  <div className="credit-closed-note" style={{ color: "var(--green)" }}>
                    <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: 6 }} />
                    Recorded in Sales on {credit.lastPaymentDate || "completion"}
                  </div>
                )}
                {isBadDebt && (
                  <div className="credit-closed-note" style={{ color: "var(--red)" }}>
                    <FontAwesomeIcon icon={faArrowRight} style={{ marginRight: 6 }} />
                    Written off to Losses on {credit.closedDate || "closure"}
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

      {/* Bad Debt Confirm */}
      <AlertDialog
        open={!!badDebtTarget}
        title="Mark as bad debt?"
        message={
          badDebtTarget
            ? `KES ${((badDebtTarget.totalAmount || 0) - (badDebtTarget.paidAmount || 0)).toLocaleString()} owed by "${badDebtTarget.customer}" will be written off and moved to Losses. This cannot be undone.`
            : ""
        }
        confirmLabel="Yes, Write Off"
        cancelLabel="Cancel"
        onCancel={() => setBadDebtTarget(null)}
        onConfirm={confirmBadDebt}
      />

      {/* Delete Confirm */}
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
