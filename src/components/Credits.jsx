import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";

export default function Credits() {
  const {
    items: credits,
    loading,
    addItem,
    deleteItem,
    updateItem,
  } = useCollection("credits");

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

  // ✅ CREATE CREDIT
  const handleSubmit = async (e) => {
    e.preventDefault();

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
  };

  // ✅ PAYMENT
  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    const today = new Date().toISOString().split("T")[0];

    try {
      const newPaid = (payingCredit.paidAmount || 0) + amount;

      const isFullyPaid = newPaid >= payingCredit.totalAmount;

      const newPayments = [
        ...(payingCredit.payments || []),
        { amount, date: today, note: payNote },
      ];

      await updateItem(payingCredit.id, {
        paidAmount: newPaid,
        payments: newPayments,
        status: isFullyPaid ? "paid" : "outstanding",
        lastPaymentDate: today,
      });

      // 🔥 MOVE TO SALES (PAID)
      if (isFullyPaid) {
        await addDoc(collection(db, "sales"), {
          customer: payingCredit.customer,
          itemTaken: payingCredit.itemTaken,
          phone: payingCredit.phone,
          amount: payingCredit.totalAmount,
          dateIssued: payingCredit.dateIssued,
          dueDate: payingCredit.dueDate,
          datePaid: today,
          status: "paid",
          fromCredit: payingCredit.id,
          createdAt: serverTimestamp(),
        });

        showToast("Debt cleared → moved to Sales ✅");
      } else {
        showToast("Payment recorded");
      }

      setPayingCredit(null);
      setPayAmount("");
      setPayNote("");
    } catch (err) {
      console.error(err);
      showToast("Payment failed", "error");
    }
  };

  // 🔴 BAD DEBT
  const markAsBadDebt = async (credit) => {
    const today = new Date().toISOString().split("T")[0];

    try {
      await updateItem(credit.id, {
        status: "bad_debt",
        closedDate: today,
      });

      await addDoc(collection(db, "sales"), {
        customer: credit.customer,
        itemTaken: credit.itemTaken,
        phone: credit.phone,
        amount: credit.totalAmount,
        dateIssued: credit.dateIssued,
        dueDate: credit.dueDate,
        dateClosed: today,
        status: "bad_debt",
        fromCredit: credit.id,
        createdAt: serverTimestamp(),
      });

      showToast("Marked as bad debt ⚠️");
    } catch (err) {
      console.error(err);
    }
  };

  // 🔴 OVERDUE CHECK
  const isOverdue = (credit) => {
    if (!credit.dueDate || credit.status !== "outstanding") return false;
    return new Date(credit.dueDate) < new Date();
  };

  return (
    <div className="module-page">
      <Toast toast={toast} />

      <button onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "+ New Credit"}
      </button>

      {/* FORM */}
      {showForm && (
        <form onSubmit={handleSubmit}>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <input
            placeholder="Customer"
            value={form.customer}
            onChange={(e) => setForm({ ...form, customer: e.target.value })}
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder="Item Taken"
            value={form.itemTaken}
            onChange={(e) => setForm({ ...form, itemTaken: e.target.value })}
          />
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <input
            type="number"
            placeholder="Amount"
            value={form.totalAmount}
            onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
          />

          <button type="submit">Save</button>
        </form>
      )}

      {/* LIST */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        credits.map((credit) => {
          const remaining = credit.totalAmount - (credit.paidAmount || 0);

          const overdue = isOverdue(credit);

          return (
            <div
              key={credit.id}
              style={{
                border: overdue ? "2px solid red" : "1px solid #ccc",
                padding: 10,
                margin: 10,
              }}
            >
              <h4>{credit.customer}</h4>
              <p>{credit.itemTaken}</p>

              <p>Phone: {credit.phone || "-"}</p>
              <p>Issued: {credit.dateIssued}</p>
              <p>Due: {credit.dueDate}</p>

              {overdue && <p style={{ color: "red" }}>⚠️ OVERDUE</p>}

              <p>Total: {credit.totalAmount}</p>
              <p>Remaining: {remaining}</p>

              {credit.payments?.map((p, i) => (
                <div key={i}>
                  Paid {p.amount} on {p.date}
                </div>
              ))}

              {credit.status !== "paid" && (
                <>
                  <button onClick={() => setPayingCredit(credit)}>Pay</button>

                  <button onClick={() => markAsBadDebt(credit)}>
                    Mark Unpaid
                  </button>
                </>
              )}

              <button onClick={() => setDeleteTarget(credit)}>Delete</button>
            </div>
          );
        })
      )}

      {/* PAYMENT */}
      {payingCredit && (
        <div>
          <input
            placeholder="Amount"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <input
            placeholder="Note"
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
          />
          <button onClick={handlePayment}>Confirm</button>
        </div>
      )}

      {/* DELETE */}
      <AlertDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await deleteItem(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
