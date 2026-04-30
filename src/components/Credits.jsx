import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus, faTimes, faPhone, faCalendar, faHandHoldingDollar,
  faCheckCircle, faExclamationTriangle, faTrash, faThumbsDown
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
  const [saving, setSaving] = useState(false);

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

  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    const today = new Date().toISOString().split("T")[0];
    try {
      const newPaid = (payingCredit.paidAmount || 0) + amount;
      const isFullyPaid = newPaid >= payingCredit.totalAmount;
      const newPayments = [...(payingCredit.payments || []), { amount, date: today, note: payNote }];
      await updateItem(payingCredit.id, {
        paidAmount: newPaid, payments: newPayments,
        status: isFullyPaid ? "paid" : "outstanding", lastPaymentDate: today,
      });
      if (isFullyPaid) {
        await addDoc(collection(db, "sales"), {
          customer: payingCredit.customer, itemTaken: payingCredit.itemTaken,
          phone: payingCredit.phone, amount: payingCredit.totalAmount,
          dateIssued: payingCredit.dateIssued, dueDate: payingCredit.dueDate,
          datePaid: today, status: "paid", fromCredit: payingCredit.id, createdAt: serverTimestamp(),
        });
        showToast("Debt cleared and moved to Sales");
      } else {
        showToast("Payment recorded");
      }
      setPayingCredit(null); setPayAmount(""); setPayNote("");
    } catch (err) {
      console.error(err);
      showToast("Payment failed", "error");
    }
  };

  const markAsBadDebt = async (credit) => {
    const today = new Date().toISOString().split("T")[0];
    try {
      await updateItem(credit.id, { status: "bad_debt", closedDate: today });
      await addDoc(collection(db, "sales"), {
        customer: credit.customer, itemTaken: credit.itemTaken, phone: credit.phone,
        amount: credit.totalAmount, dateIssued: credit.dateIssued, dueDate: credit.dueDate,
        dateClosed: today, status: "bad_debt", fromCredit: credit.id, createdAt: serverTimestamp(),
      });
      showToast("Marked as bad debt");
    } catch (err) { console.error(err); }
  };

  const isOverdue = (c) => {
    if (!c.dueDate || c.status !== "outstanding") return false;
    return new Date(c.dueDate) < new Date();
  };

  const outstanding = credits.filter((c) => c.status === "outstanding" || c.status === "bad_debt");
  const paid = credits.filter((c) => c.status === "paid");
  const totalOwed = outstanding.reduce((a, c) => a + ((c.totalAmount || 0) - (c.paidAmount || 0)), 0);

  return (
    <div className="module-page">
      <Toast toast={toast} />

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
            <div className="card-label">Cleared Credits</div>
            <div className="card-value green">{paid.length}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <FontAwesomeIcon icon={showForm ? faTimes : faPlus} />
          {showForm ? "Cancel" : "New Credit"}
        </button>
      </div>

      {showForm && (
        <div className="entry-form" style={{ marginBottom: 20 }}>
          <h3><FontAwesomeIcon icon={faHandHoldingDollar} /> Record Credit</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field-group">
                <label>Date Issued</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="field-group">
                <label>Due Date</label>
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
                <label>Notes (Optional)</label>
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

      {payingCredit && (
        <div className="modal-overlay" onClick={() => setPayingCredit(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3><FontAwesomeIcon icon={faHandHoldingDollar} /> Record Payment</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
              Customer: <strong style={{ color: "var(--text)" }}>{payingCredit.customer}</strong>&nbsp;&middot;&nbsp;
              Remaining: <strong style={{ color: "var(--red)" }}>KES {(payingCredit.totalAmount - (payingCredit.paidAmount || 0)).toLocaleString()}</strong>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field-group">
                <label>Amount Paid (KES)</label>
                <input type="number" placeholder="0.00" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus min="1" />
              </div>
              <div className="field-group">
                <label>Note (Optional)</label>
                <input placeholder="e.g. Cash payment" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setPayingCredit(null)}>Cancel</button>
              <button className="btn-primary" onClick={handlePayment} disabled={!payAmount || parseFloat(payAmount) <= 0}>
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="table-loading">Loading credits...</div>
      ) : credits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FontAwesomeIcon icon={faHandHoldingDollar} /></div>
          <div>No credits recorded yet.</div>
          <div style={{ fontSize: 12 }}>Tap New Credit to record a debt.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {credits.map((credit) => {
            const remaining = credit.totalAmount - (credit.paidAmount || 0);
            const pct = credit.totalAmount > 0 ? Math.min(100, ((credit.paidAmount || 0) / credit.totalAmount) * 100) : 0;
            const overdue = isOverdue(credit);
            const isPaid = credit.status === "paid";
            const isBadDebt = credit.status === "bad_debt";

            return (
              <div key={credit.id} className={"credit-card" + (isPaid ? " credit-card-paid" : "")}
                style={overdue && !isPaid ? { borderColor: "var(--red)", borderWidth: 2 } : {}}>
                <div className="credit-card-header">
                  <div className="credit-card-info">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <div className="credit-customer">{credit.customer}</div>
                      {isPaid && <span style={{ fontSize: 10, background: "var(--green-bg)", color: "var(--green)", border: "1px solid #90d8a5", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>PAID</span>}
                      {isBadDebt && <span style={{ fontSize: 10, background: "var(--orange-bg)", color: "var(--orange)", border: "1px solid #f5c898", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>BAD DEBT</span>}
                      {overdue && !isPaid && <span style={{ fontSize: 10, background: "var(--red-bg)", color: "var(--red)", border: "1px solid #f5a5a5", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>OVERDUE</span>}
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
                    {!isPaid && remaining > 0 && <div className="credit-remaining">KES {remaining.toLocaleString()} remaining</div>}
                    {credit.paidAmount > 0 && <div className="credit-paid-badge">KES {credit.paidAmount.toLocaleString()} paid</div>}
                  </div>
                </div>

                {!isPaid && credit.totalAmount > 0 && (
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

                {credit.payments?.length > 0 && (
                  <div className="credit-payment-history">
                    <span className="credit-ph-label">Payments:</span>
                    {credit.payments.map((p, i) => (
                      <span key={i} className="credit-ph-item">KES {p.amount.toLocaleString()} on {p.date}</span>
                    ))}
                  </div>
                )}

                <div className="credit-actions">
                  {credit.status === "outstanding" && (
                    <>
                      <button className="btn-pay" onClick={() => { setPayingCredit(credit); setPayAmount(""); setPayNote(""); }}>
                        <FontAwesomeIcon icon={faHandHoldingDollar} /> Pay
                      </button>
                      <button className="btn-secondary" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => markAsBadDebt(credit)}>
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

      <AlertDialog
        open={!!deleteTarget}
        title="Delete this credit record?"
        message={deleteTarget ? `This will permanently remove the credit for "${deleteTarget.customer}". This cannot be undone.` : ""}
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
