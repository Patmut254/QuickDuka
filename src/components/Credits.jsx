import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoneyBill, faPen, faTrash, faExclamationTriangle, faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { useCollection } from "../hooks/useCollection";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";

export default function Credits() {
  const { items: credits, loading, addItem, deleteItem, updateItem } = useCollection("credits");
  const { toast, showToast } = useToast();

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    customer: "",
    phone: "",
    description: "",
    totalAmount: "",
    notes: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState("idle");

  // Edit modal state
  const [editingCredit, setEditingCredit] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editStatus, setEditStatus] = useState("idle");

  // Payment modal state
  const [payingCredit, setPayingCredit] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payStatus, setPayStatus] = useState("idle");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filter
  const [filter, setFilter] = useState("all");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    try {
      await addItem({
        ...form,
        totalAmount: parseFloat(form.totalAmount),
        paidAmount: 0,
        status: "outstanding",
        payments: [],
      });
      setStatus("saved");
      showToast("Credit recorded!");
      setTimeout(() => {
        setStatus("idle");
        setForm(emptyForm);
        setShowForm(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      setStatus("idle");
      showToast("Save failed. Please try again.", "error");
    }
  };

  const openEdit = (credit) => {
    setEditingCredit(credit);
    setEditForm({
      date: credit.date || "",
      customer: credit.customer || "",
      phone: credit.phone || "",
      description: credit.description || "",
      totalAmount: credit.totalAmount?.toString() || "",
      notes: credit.notes || "",
    });
    setEditStatus("idle");
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (editStatus !== "idle" || !editingCredit) return;
    const newTotal = parseFloat(editForm.totalAmount);
    if (isNaN(newTotal) || newTotal <= 0) return showToast("Enter a valid amount", "error");
    if (newTotal < (editingCredit.paidAmount || 0)) {
      return showToast(`Total cannot be less than amount already paid (KES ${editingCredit.paidAmount?.toLocaleString()})`, "error");
    }
    setEditStatus("saving");
    try {
      const isPaid = (editingCredit.paidAmount || 0) >= newTotal;
      await updateItem(editingCredit.id, {
        date: editForm.date,
        customer: editForm.customer,
        phone: editForm.phone || "",
        description: editForm.description,
        totalAmount: newTotal,
        notes: editForm.notes,
        status: isPaid ? "paid" : "outstanding",
      }, editingCredit);
      showToast("Credit updated ✅");
      setEditingCredit(null);
    } catch (err) {
      console.error(err);
      showToast("Update failed. Please try again.", "error");
    }
    setEditStatus("idle");
  };

  const handlePayment = async () => {
    if (payStatus !== "idle" || !payingCredit) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return showToast("Enter a valid amount", "error");

    const remaining = payingCredit.totalAmount - (payingCredit.paidAmount || 0);
    if (amount > remaining) return showToast(`Max payable is KES ${remaining.toLocaleString()}`, "error");

    setPayStatus("saving");
    try {
      const newPaid = (payingCredit.paidAmount || 0) + amount;
      const isFullyPaid = newPaid >= payingCredit.totalAmount;
      const newPayments = [
        ...(payingCredit.payments || []),
        { amount, date: new Date().toISOString().split("T")[0], note: payNote },
      ];

      await updateItem(payingCredit.id, {
        paidAmount: newPaid,
        payments: newPayments,
        status: isFullyPaid ? "paid" : "outstanding",
      }, payingCredit);

      if (isFullyPaid) {
        await addDoc(collection(db, "sales"), {
          date: payingCredit.date,
          description: payingCredit.description,
          customer: payingCredit.customer,
          amount: payingCredit.totalAmount,
          notes: `Credit fully paid. ${payingCredit.notes || ""}`.trim(),
          fromCredit: payingCredit.id,
          createdAt: serverTimestamp(),
        });
        showToast("Fully paid! Moved to Sales ✅");
      } else {
        showToast(`Payment of KES ${amount.toLocaleString()} recorded`);
      }

      setPayingCredit(null);
      setPayAmount("");
      setPayNote("");
      setPayStatus("idle");
    } catch (err) {
      console.error(err);
      setPayStatus("idle");
      showToast("Payment failed. Please try again.", "error");
    }
  };

  const filteredCredits = credits.filter(c => {
    if (filter === "outstanding") return c.status !== "paid";
    if (filter === "paid") return c.status === "paid";
    return true;
  });

  const totalDebt = credits
    .filter(c => c.status !== "paid")
    .reduce((a, b) => a + ((b.totalAmount || 0) - (b.paidAmount || 0)), 0);

  const totalCreditSales = credits.reduce((a, b) => a + (b.totalAmount || 0), 0);

  return (
    <div className="module-page">
      <Toast toast={toast} />

      <div className="module-header">
        <div className="credits-stats">
          <div className="module-stat">
            <span className="stat-label">Total Outstanding Debt</span>
            <span className="stat-value" style={{ color: "#ef4444" }}>KES {totalDebt.toLocaleString()}</span>
          </div>
          <div className="module-stat">
            <span className="stat-label">Total Credit Sales</span>
            <span className="stat-value" style={{ color: "#f97316" }}>KES {totalCreditSales.toLocaleString()}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setStatus("idle"); }}>
          {showForm ? "Cancel" : "+ New Credit"}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>Record a Credit Sale</h3>
          <div className="form-grid">
            <div className="field-group">
              <label>Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>Customer *</label>
              <input placeholder="Customer name" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>Customer Phone</label>
              <input type="tel" placeholder="07XX XXX XXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field-group">
              <label>Item / Service *</label>
              <input placeholder="What was sold on credit?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>Total Amount (KES) *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} required />
            </div>
            <div className="field-group full-width">
              <label>Notes</label>
              <input placeholder="Optional notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <button
            type="submit"
            className={"btn-primary" + (status === "saved" ? " btn-saved" : "")}
            disabled={status !== "idle"}
          >
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved!" : "Save Credit"}
          </button>
        </form>
      )}

      {/* Filter pills */}
      <div className="filter-pills" style={{ marginBottom: 16 }}>
        {["all", "outstanding", "paid"].map(f => (
          <button key={f} className={"filter-pill" + (filter === f ? " active" : "")} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "outstanding" ? "Outstanding" : "Paid"}
          </button>
        ))}
      </div>

      {/* Credits List */}
      <div className="entry-table-wrap">
        <div className="table-toolbar">
          <span className="table-count">{filteredCredits.length} records</span>
        </div>

        {loading ? (
          <div className="table-loading">Loading...</div>
        ) : filteredCredits.length === 0 ? (
          <div className="empty-state">No {filter !== "all" ? filter : ""} credit records found.</div>
        ) : (
          <div className="credits-list">
            {filteredCredits.map(credit => {
              const paid = credit.paidAmount || 0;
              const remaining = credit.totalAmount - paid;
              const pct = Math.min(100, Math.round((paid / credit.totalAmount) * 100));
              const isPaid = credit.status === "paid";

              return (
                <div key={credit.id} className={"credit-card" + (isPaid ? " credit-card-paid" : "")}>
                  <div className="credit-card-header">
                    <div className="credit-card-info">
                      <div className="credit-customer">{credit.customer}</div>
                      <div className="credit-desc">{credit.description}</div>
                      <div className="credit-date">{credit.date}</div>
                      {credit.phone && (
                        <a href={`tel:${credit.phone}`} className="credit-phone">{credit.phone}</a>
                      )}
                    </div>
                    <div className="credit-card-right" style={{flexShrink:0,textAlign:"right"}}>
                      <div className="credit-amounts">
                        <div className="credit-total">KES {(credit.totalAmount || 0).toLocaleString()}</div>
                        {!isPaid && <div className="credit-remaining">Remaining: KES {remaining.toLocaleString()}</div>}
                        {isPaid && <div className="credit-paid-badge">Fully Paid</div>}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="credit-progress-wrap">
                    <div className="credit-progress-bar">
                      <div className="credit-progress-fill" style={{ width: `${pct}%`, background: isPaid ? "#22c55e" : "#f97316" }} />
                    </div>
                    <span className="credit-pct">{pct}%</span>
                  </div>

                  {/* Payment history */}
                  {credit.payments && credit.payments.length > 0 && (
                    <div className="credit-payment-history">
                      <span className="credit-ph-label">Payments:</span>
                      {credit.payments.map((p, i) => (
                        <span key={i} className="credit-ph-item">
                          KES {p.amount.toLocaleString()} on {p.date}{p.note ? ` (${p.note})` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="credit-actions">
                    {!isPaid && (
                      <button className="btn-pay" onClick={() => { setPayingCredit(credit); setPayAmount(""); setPayNote(""); }}>
                        Record Payment
                      </button>
                    )}
                    <button className="btn-edit-sm" title="Edit" onClick={() => openEdit(credit)}>Edit</button>
                    <button className="delete-btn" title="Delete" onClick={() => setDeleteTarget(credit)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingCredit && (
        <div className="alert-overlay" onClick={() => setEditingCredit(null)}>
          <div className="alert-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="alert-icon">Edit</div>
            <div className="alert-title">Edit Credit Record</div>
            <form onSubmit={handleEditSave} className="payment-form" style={{ textAlign: "left" }}>
              <div className="field-group" style={{ marginBottom: 10 }}>
                <label>Date</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="field-group" style={{ marginBottom: 10 }}>
                <label>Customer</label>
                <input placeholder="Customer name" value={editForm.customer} onChange={e => setEditForm(f => ({ ...f, customer: e.target.value }))} required />
              </div>
              <div className="field-group" style={{ marginBottom: 10 }}>
                <label>Customer Phone</label>
                <input type="tel" placeholder="07XX XXX XXX" value={editForm.phone || ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="field-group" style={{ marginBottom: 10 }}>
                <label>Item / Service</label>
                <input placeholder="What was sold?" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div className="field-group" style={{ marginBottom: 10 }}>
                <label>Total Amount (KES)</label>
                <input type="number" min="0.01" step="0.01" placeholder="0.00" value={editForm.totalAmount} onChange={e => setEditForm(f => ({ ...f, totalAmount: e.target.value }))} required />
                {editingCredit.paidAmount > 0 && (
                  <small style={{ color: "#94a3b8" }}>Already paid: KES {editingCredit.paidAmount.toLocaleString()}</small>
                )}
              </div>
              <div className="field-group" style={{ marginBottom: 16 }}>
                <label>Notes</label>
                <input placeholder="Optional notes" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="alert-actions">
                <button type="button" className="btn-cancel-sm" onClick={() => setEditingCredit(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={editStatus !== "idle"}>
                  {editStatus === "saving" ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingCredit && (
        <div className="alert-overlay" onClick={() => setPayingCredit(null)}>
          <div className="alert-box" onClick={e => e.stopPropagation()}>
            <div className="alert-icon">💵</div>
            <div className="alert-title">Record Payment</div>
            <div className="alert-message">
              <strong>{payingCredit.customer}</strong> — {payingCredit.description}<br />
              Remaining: KES {(payingCredit.totalAmount - (payingCredit.paidAmount || 0)).toLocaleString()}
            </div>
            <div className="payment-form">
              <div className="field-group" style={{ marginBottom: 12 }}>
                <label>Amount Paid (KES) *</label>
                <input
                  type="number" min="0.01" step="0.01"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field-group">
                <label>Note (optional)</label>
                <input placeholder="e.g. M-Pesa ref #..." value={payNote} onChange={e => setPayNote(e.target.value)} />
              </div>
            </div>
            <div className="alert-actions" style={{ marginTop: 20 }}>
              <button className="btn-cancel-sm" onClick={() => setPayingCredit(null)}>Cancel</button>
              <button className="btn-primary" disabled={payStatus !== "idle" || !payAmount} onClick={handlePayment}>
                {payStatus === "saving" ? "Saving..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteTarget}
        title="Delete Credit Record?"
        message={deleteTarget ? `Delete credit for "${deleteTarget.customer}"? This cannot be undone.` : ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await deleteItem(deleteTarget.id, deleteTarget);
          showToast("Credit deleted");
          setDeleteTarget(null);
        }}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
