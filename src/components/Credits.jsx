import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import {
  useStock,
  recordStockSale,
  recordStockReturn,
  roundMoney,
} from "../hooks/useStock";
import { PAYMENT_METHODS } from "../paymentMethods";
import { useLang } from "../LangContext";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";
import EntryDate, { StockUpdateToggle } from "./EntryDate";
import { localToday, stockUpdateWanted } from "../dates";
import { FontAwesomeIcon } from "./Icon";
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
  faPen,
} from "@fortawesome/free-solid-svg-icons";
import LineItems from "./LineItems";
import {
  lineStock,
  lineQty,
  linesTotal,
  filledLines,
  validateLines,
  summarizeLines,
} from "../lineItems";

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
  // `sales` / `losses` are also read so a payment or write-off can be found
  // again (and undone) when the credit is edited later.
  const {
    items: sales,
    addItem: addSale,
    updateItem: updateSale,
    deleteItem: deleteSale,
  } = useCollection("sales", ownerUid ? { ownerUid } : undefined);
  const {
    items: losses,
    addItem: addLoss,
    updateItem: updateLoss,
    deleteItem: deleteLoss,
  } = useCollection("losses", ownerUid ? { ownerUid } : undefined);
  const stock = useStock();
  const { toast, showToast } = useToast();

  // Issue date stays on the last day used, so a batch of old credits can be
  // entered one after another. `stockChoice`: should a back-dated credit also
  // take goods out of current stock? (null = yes if recent, no if older than a week)
  const [lastDate, setLastDate] = useState(localToday);
  const [stockChoice, setStockChoice] = useState(null);

  const emptyForm = {
    date: lastDate,
    customer: "",
    phone: "",
    dueDate: "",
    notes: "",
  };
  // Items taken on this credit — one customer can take several things
  // and owe one combined total.
  const [lines, setLines] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [payingCredit, setPayingCredit] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(localToday);
  // Day a debt was written off (asked for when writing off; editable later)
  const [badDebtDate, setBadDebtDate] = useState(localToday);
  const [closeDateEdit, setCloseDateEdit] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [badDebtTarget, setBadDebtTarget] = useState(null);
  // Edit-credit modal (fix a wrong payment / reopen a written-off debt)
  const [manageId, setManageId] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("cash");
  const [editDate, setEditDate] = useState("");
  const [confirmIdx, setConfirmIdx] = useState(null);
  const [manageBusy, setManageBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = localToday; // local date (not UTC)

  // When set, the form is adding items to this existing credit.
  const [addTo, setAddTo] = useState(null);

  const resetCreditForm = (date = lastDate) => {
    setForm({ ...emptyForm, date });
    setLines([]);
    setStockChoice(null);
    setAddTo(null);
  };

  const startAddTo = (credit) => {
    setAddTo(credit);
    setForm({
      date: localToday(), // the day the extra items were taken
      customer: credit.customer || "",
      phone: credit.phone || "",
      dueDate: credit.dueDate || "",
      notes: credit.notes || "",
    });
    setLines([]);
    setStockChoice(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Items already on a credit (older single-item credits have no array)
  const itemsOf = (c) =>
    c.items?.length
      ? c.items
      : c.itemTaken
        ? [
            {
              description: c.itemTaken,
              quantity: Number(c.quantity) || 1,
              amount: Number(c.totalAmount) || 0,
              stockId: c.stockId || null,
            },
          ]
        : [];

  // ── Save new credit ────────────────────────────────────────────────────────
  // A credit is a sale that hasn't been paid for yet, so items that come
  // from stock leave stock right now (just like a sale). Several items can
  // go on one credit; the customer owes their combined total.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    // Old credits (older than a week) don't take goods out of today's stock
    // unless the user ticks "update my current stock" — see dates.js.
    const touchStock = stockUpdateWanted(form.date, stockChoice);
    const problem = validateLines(lines, stock, touchStock, t);
    if (problem) {
      showToast(problem, "error");
      return;
    }

    const items = filledLines(lines).map((line) => {
      const s = lineStock(line, stock);
      return {
        description: line.text.trim(),
        quantity: lineQty(line),
        amount: roundMoney(parseFloat(line.amount)),
        // remember which stock item each line came from so a cancelled
        // credit can put the goods back
        stockId: touchStock && s && s.quantity != null ? s.id : null,
      };
    });
    const single = items.length === 1 ? items[0] : null;

    // ── Adding items to an existing credit ──
    if (addTo) {
      setSaving(true);
      try {
        const all = [...itemsOf(addTo), ...items];
        const newTotal = roundMoney(
          Number(addTo.totalAmount || 0) + linesTotal(lines),
        );
        await updateItem(
          addTo.id,
          {
            customer: form.customer,
            phone: form.phone,
            dueDate: form.dueDate,
            notes: form.notes,
            items: all,
            itemTaken:
              all.length === 1 ? all[0].description : summarizeLines(all),
            quantity: all.length === 1 ? all[0].quantity : null,
            stockId: all.length === 1 ? all[0].stockId : null,
            totalAmount: newTotal,
            // a cleared credit owes money again once more goods are taken
            status:
              addTo.status === "paid" && (addTo.paidAmount || 0) < newTotal
                ? "outstanding"
                : addTo.status,
          },
          addTo,
        );
        items.forEach((i) => {
          if (i.stockId) recordStockSale(i.stockId, i.quantity);
        });
        showToast(t.saved);
        resetCreditForm();
        setShowForm(false);
      } catch (err) {
        console.error(err);
        showToast(t.failedSave, "error");
      }
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      await addItem({
        ...form,
        items,
        // Single-item credits keep the original fields exactly as before;
        // multi-item ones get a readable summary in itemTaken.
        itemTaken: single ? single.description : summarizeLines(items),
        quantity: single ? single.quantity : null,
        stockId: single ? single.stockId : null,
        totalAmount: linesTotal(lines),
        paidAmount: 0,
        status: "outstanding",
        payments: [],
        dateIssued: form.date,
      });

      // Bookkeeping: the goods have left the shelf.
      items.forEach((i) => {
        if (i.stockId) recordStockSale(i.stockId, i.quantity);
      });

      showToast(t.saved);
      setLastDate(form.date); // next credit starts on the same day
      resetCreditForm(form.date);
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
      // ✅ Payment goes to Sales — no extraMeta needed because the addSale
      // hook is already initialised with the correct ownerUid context above.
      // The new Sales entry's id is kept on the payment so the payment can be
      // corrected or undone later (Edit on the credit card).
      const saleRef = await addSale({
        date: payDate || today(),
        description:
          `${t.creditPaymentDesc || "Credit payment"}: ${payingCredit.customer}` +
          (payingCredit.itemTaken ? ` (${payingCredit.itemTaken})` : ""),
        customer: payingCredit.customer,
        phone: payingCredit.phone || "",
        amount: actualAmount,
        paymentMethod: payMethod,
        notes: (
          `${
            isFullyPaid
              ? t.finalPaymentNote || "Final payment, debt cleared."
              : t.partialPaymentNote || "Partial payment."
          } ` +
          `${t.originallyIssued || "Originally issued"} ${payingCredit.dateIssued}. ` +
          (payNote || "")
        ).trim(),
        fromCredit: payingCredit.id,
      });

      const newPayments = [
        ...(payingCredit.payments || []),
        {
          amount: actualAmount,
          date: payDate || today(),
          note: payNote,
          method: payMethod,
          saleId: saleRef?.id || null,
        },
      ];

      await updateItem(payingCredit.id, {
        paidAmount: roundMoney(newPaid),
        payments: newPayments,
        status: isFullyPaid ? "paid" : "outstanding",
        lastPaymentDate: payDate || today(),
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
      setPayMethod("cash");
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

      // ✅ Unpaid remainder goes to Losses — no extraMeta needed because
      // the addLoss hook is already initialised with the correct ownerUid.
      // The loss id is kept on the credit so the write-off can be reversed
      // ("Reopen debt") if the customer decides to pay after all.
      let lossId = null;
      if (unpaid > 0) {
        const lossRef = await addLoss({
          date: badDebtDate || today(),
          item:
            `${t.badDebtWrittenOff || "Bad debt written off"}: ${credit.customer}` +
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
        lossId = lossRef?.id || null;
      }

      await updateItem(credit.id, {
        status: "bad_debt",
        closedDate: badDebtDate || today(),
        badDebtAmount: unpaid,
        lossId,
      });

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

  // ── Edit a paid / written-off credit ───────────────────────────────────────
  const managed = manageId ? credits.find((c) => c.id === manageId) : null;

  const closeManage = () => {
    setManageId(null);
    setEditIdx(null);
    setConfirmIdx(null);
  };

  // The Sales entry a payment created. New payments carry its id; payments
  // recorded before that existed are matched on credit + amount + date.
  const findSaleFor = (credit, p) => {
    if (p.saleId) return sales.find((s) => s.id === p.saleId) || null;
    return (
      sales.find(
        (s) =>
          s.fromCredit === credit.id &&
          Number(s.amount) === Number(p.amount) &&
          s.date === p.date,
      ) || null
    );
  };

  // Paid amount / status / last payment date, recomputed from the payment list
  const summarize = (credit, payments) => {
    const paid = roundMoney(
      payments.reduce((a, p) => a + Number(p.amount || 0), 0),
    );
    return {
      paidAmount: paid,
      status: paid >= Number(credit.totalAmount || 0) - 0.005 ? "paid" : "outstanding",
      lastPaymentDate: payments.length ? payments[payments.length - 1].date : null,
    };
  };

  const removePayment = async (idx) => {
    const credit = managed;
    if (!credit || manageBusy) return;
    setManageBusy(true);
    try {
      const p = credit.payments[idx];
      const sale = findSaleFor(credit, p);
      const payments = credit.payments.filter((_, i) => i !== idx);
      await updateItem(credit.id, { payments, ...summarize(credit, payments) }, credit);
      if (sale) await deleteSale(sale.id, sale);
      showToast(sale ? t.paymentRemovedToast : t.salesEntryMissing, sale ? "success" : "error");
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
    }
    setConfirmIdx(null);
    setManageBusy(false);
  };

  const saveEditedPayment = async (idx) => {
    const credit = managed;
    if (!credit || manageBusy) return;
    const entered = roundMoney(parseFloat(editAmount) || 0);
    if (entered <= 0) return;
    setManageBusy(true);
    try {
      const others = credit.payments.reduce(
        (a, p, i) => (i === idx ? a : a + Number(p.amount || 0)),
        0,
      );
      // can't take more than the credit's total across all payments
      const amt = Math.min(entered, roundMoney(Number(credit.totalAmount || 0) - others));
      const old = credit.payments[idx];
      const sale = findSaleFor(credit, old);
      const payments = credit.payments.map((p, i) =>
        i === idx
          ? {
              ...p,
              amount: amt,
              method: editMethod,
              date: editDate || p.date,
              saleId: sale?.id || p.saleId || null,
            }
          : p,
      );
      await updateItem(credit.id, { payments, ...summarize(credit, payments) }, credit);
      if (sale) {
        await updateSale(
          sale.id,
          { amount: amt, paymentMethod: editMethod, date: editDate || sale.date },
          sale,
        );
      }
      showToast(sale ? t.paymentUpdatedToast : t.salesEntryMissing, sale ? "success" : "error");
      setEditIdx(null);
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
    }
    setManageBusy(false);
  };

  // Correct the day a debt was written off (credit's closedDate + its Losses entry)
  const saveWriteOffDate = async () => {
    const credit = managed;
    if (!credit || manageBusy || !closeDateEdit) return;
    setManageBusy(true);
    try {
      const loss =
        (credit.lossId && losses.find((l) => l.id === credit.lossId)) ||
        losses.find((l) => l.fromCredit === credit.id) ||
        null;
      await updateItem(credit.id, { closedDate: closeDateEdit }, credit);
      if (loss) await updateLoss(loss.id, { date: closeDateEdit }, loss);
      showToast(t.paymentUpdatedToast);
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
    }
    setManageBusy(false);
  };

  // Written-off debt → active again: take the write-off back out of Losses.
  // Anything already collected stays in Sales; stock stays deducted.
  const reopenDebt = async () => {
    const credit = managed;
    if (!credit || manageBusy) return;
    setManageBusy(true);
    try {
      const loss =
        (credit.lossId && losses.find((l) => l.id === credit.lossId)) ||
        losses.find((l) => l.fromCredit === credit.id) ||
        null;
      await updateItem(
        credit.id,
        { status: "outstanding", closedDate: null, badDebtAmount: null, lossId: null },
        credit,
      );
      if (loss) await deleteLoss(loss.id, loss);
      showToast(t.debtReopenedToast);
      closeManage();
    } catch (err) {
      console.error(err);
      showToast(t.failedSave, "error");
    }
    setManageBusy(false);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  // Stock lines on a credit: the items array (new credits) or the single
  // stockId/quantity pair (credits saved before multi-item support).
  const stockLinesOf = (c) =>
    (c.items?.length
      ? c.items
      : [{ stockId: c.stockId, quantity: c.quantity, description: c.itemTaken }]
    ).filter((i) => i.stockId && Number(i.quantity) > 0);

  const returnsToStock = (c) =>
    stockLinesOf(c).length > 0 &&
    c.status === "outstanding" &&
    !(c.paidAmount > 0);

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
          style={{ "--tint": "var(--orange)" }}
        >
          <div
            className="card-icon"
            style={{ color: "var(--orange)" }}
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
          style={{ "--tint": "var(--red)" }}
        >
          <div
            className="card-icon"
            style={{ color: "var(--red)" }}
          >
            <FontAwesomeIcon icon={faExclamationTriangle} />
          </div>
          <div>
            {/* ✅ FIX: Second card shows the COUNT of outstanding debts.
                Previously both cards used t.unpaidDebts, copy-paste error. */}
            <div className="card-label">{t.outstandingCount || t.unpaidDebts}</div>
            <div className="card-value red">{outstanding.length}</div>
          </div>
        </div>

        <div
          className="summary-card"
          style={{ "--tint": "var(--green)" }}
        >
          <div
            className="card-icon"
            style={{ color: "var(--green)" }}
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
        <button
          className="btn-primary"
          onClick={() => {
            if (showForm) resetCreditForm();
            setShowForm(!showForm);
          }}
        >
          <FontAwesomeIcon icon={showForm ? faTimes : faPlus} />
          {showForm ? " " + t.cancel : " " + t.newCredit}
        </button>
      </div>

      {/* New Credit Form */}
      {showForm && (
        <div className="entry-form" style={{ marginBottom: 20 }}>
          <h3>
            <FontAwesomeIcon icon={faHandHoldingDollar} />{" "}
            {addTo
              ? `${t.addItemsTo || "Add items to"}: ${addTo.customer}`
              : t.newCredit}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <EntryDate
                id="credit-date"
                label={t.dateIssued}
                value={form.date}
                onChange={(d) => {
                  setForm({ ...form, date: d });
                  setStockChoice(null);
                }}
              />
              {lines.some((l) => lineStock(l, stock)) && (
                <StockUpdateToggle
                  date={form.date}
                  checked={stockUpdateWanted(form.date, stockChoice)}
                  onChange={setStockChoice}
                />
              )}
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
            <LineItems
              lines={lines}
              setLines={setLines}
              stock={stock}
              t={t}
              idPrefix="credit"
              itemLabel={t.itemTaken}
              baseTotal={addTo ? Number(addTo.totalAmount) || 0 : 0}
              totalLabel={t.creditTotal || "Credit total"}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t.saving : t.saveCredit}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  resetCreditForm();
                  setShowForm(false);
                }}
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
                  <EntryDate
                    id="credit-pay-date"
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
                      max={remaining}
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
                      setPayMethod("cash");
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

                    {credit.items?.length > 1 ? (
                      <ul className="credit-items">
                        {credit.items.map((i, n) => (
                          <li key={n}>
                            <span>
                              {i.description}
                              {Number(i.quantity) !== 1 &&
                                ` × ${Number(i.quantity).toLocaleString()}`}
                            </span>
                            <span>KES {Number(i.amount).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : credit.itemTaken && (
                      <div className="credit-desc">
                        {credit.itemTaken}
                        {credit.quantity != null && credit.quantity !== "" && (
                          <> × {Number(credit.quantity).toLocaleString()}</>
                        )}
                      </div>
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
                        KES {credit.paidAmount.toLocaleString()}{" "}
                        {t.alreadyPaid.toLowerCase()}
                      </div>
                    )}

                    {isBadDebt && writtenOff > 0 && (
                      <div className="credit-chip credit-chip-red">
                        KES {writtenOff.toLocaleString()}{" "}
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
                        KES {p.amount.toLocaleString()}: {p.date}
                        {p.method
                          ? ` · ${t.paymentMethods?.[p.method] || p.method}`
                          : ""}
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
                    {t.alreadyPaid}: {t.sales || "Sales"}{" "}
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
                  {!isBadDebt && (
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 12, padding: "7px 12px" }}
                      onClick={() => startAddTo(credit)}
                    >
                      <FontAwesomeIcon icon={faPlus} /> {t.itemNo || "Item"}
                    </button>
                  )}
                  {isOutstanding && (
                    <>
                      <button
                        className="btn-pay"
                        onClick={() => {
                          setPayingCredit(credit);
                          setPayDate(localToday());
                          setPayAmount("");
                          setPayNote("");
                          setPayMethod("cash");
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
                        onClick={() => {
                          setBadDebtDate(localToday());
                          setBadDebtTarget(credit);
                        }}
                      >
                        <FontAwesomeIcon icon={faThumbsDown} /> {t.badDebt}
                      </button>
                    </>
                  )}
                  {(!isOutstanding || credit.payments?.length > 0) && (
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 12, padding: "7px 12px" }}
                      onClick={() => {
                        setManageId(credit.id);
                        setCloseDateEdit(credit.closedDate || localToday());
                        setEditIdx(null);
                        setConfirmIdx(null);
                      }}
                    >
                      <FontAwesomeIcon icon={faPen} /> {t.edit}
                    </button>
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

      {/* Totals under the list of credits */}
      {credits.length > 0 && (
        <div className="table-total" style={{ marginTop: 12 }}>
          <span>
            {t.creditTotals || "Credit totals"} ({credits.length})
          </span>
          <span style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>
              {t.allCredits}: <strong>KES {grandTotal.toLocaleString()}</strong>
            </span>
            <span>
              {t.totalCollected}:{" "}
              <strong>KES {totalCollected.toLocaleString()}</strong>
            </span>
            <span>
              {t.unpaidDebts}:{" "}
              <strong style={{ color: "var(--orange)" }}>
                KES {totalOutstanding.toLocaleString()}
              </strong>
            </span>
          </span>
        </div>
      )}

      {/* Edit credit: fix a wrong payment / reopen a written-off debt */}
      {managed && (
        <div className="modal-overlay" onClick={closeManage}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {t.editCreditTitle}: {managed.customer}
            </h3>
            <div className="credit-modal-meta">
              <div className="credit-modal-row">
                <span>{t.totalAmount}</span>
                <strong>KES {Number(managed.totalAmount || 0).toLocaleString()}</strong>
              </div>
              <div className="credit-modal-row">
                <span>{t.alreadyPaid}</span>
                <strong className="text-green">
                  KES {Number(managed.paidAmount || 0).toLocaleString()}
                </strong>
              </div>
              <div className="credit-modal-row credit-modal-row-highlight">
                <span>{t.remaining}</span>
                <strong className="text-red">
                  KES{" "}
                  {Math.max(
                    0,
                    Number(managed.totalAmount || 0) - Number(managed.paidAmount || 0),
                  ).toLocaleString()}
                </strong>
              </div>
            </div>

            {managed.status === "bad_debt" && (
              <div style={{ margin: "12px 0" }}>
                <EntryDate
                  id="edit-writeoff-date"
                  label={t.writeOffDate}
                  value={closeDateEdit}
                  onChange={setCloseDateEdit}
                  min={managed.dateIssued || undefined}
                  plain
                />
                <button
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: "6px 12px", margin: "6px 0 14px" }}
                  onClick={saveWriteOffDate}
                  disabled={manageBusy || closeDateEdit === managed.closedDate}
                >
                  {t.saveDate}
                </button>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                  {t.reopenDebtHint}
                </p>
                <button
                  className="btn-primary"
                  onClick={reopenDebt}
                  disabled={manageBusy}
                >
                  {t.reopenDebt}
                </button>
              </div>
            )}

            {managed.payments?.length > 0 && (
              <div style={{ margin: "12px 0" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  {t.paymentsReceived}
                </div>
                {managed.status === "bad_debt" ? (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    {t.reopenPaymentsHint}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    {t.removePaymentHint}
                  </p>
                )}
                {managed.payments.map((p, i) => {
                  const canEdit = managed.status !== "bad_debt";
                  if (editIdx === i) {
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          alignItems: "center",
                          padding: "6px 0",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <input
                          type="date"
                          value={editDate}
                          max={localToday()}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          style={{ width: 110 }}
                          autoFocus
                        />
                        <select
                          value={editMethod}
                          onChange={(e) => setEditMethod(e.target.value)}
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {t.paymentMethods?.[m] || m}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn-primary"
                          style={{ fontSize: 12, padding: "6px 12px" }}
                          onClick={() => saveEditedPayment(i)}
                          disabled={manageBusy}
                        >
                          {t.save}
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: 12, padding: "6px 12px" }}
                          onClick={() => setEditIdx(null)}
                        >
                          {t.cancel}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        padding: "6px 0",
                        fontSize: 13,
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <span>
                        KES {Number(p.amount).toLocaleString()}: {p.date}
                        {p.method
                          ? ` · ${t.paymentMethods?.[p.method] || p.method}`
                          : ""}
                        {p.note ? ` (${p.note})` : ""}
                      </span>
                      {canEdit &&
                        (confirmIdx === i ? (
                          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 12 }}>{t.removePaymentSure}</span>
                            <button
                              className="btn-danger"
                              style={{ fontSize: 12, padding: "4px 10px" }}
                              onClick={() => removePayment(i)}
                              disabled={manageBusy}
                            >
                              {t.yes}
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ fontSize: 12, padding: "4px 10px" }}
                              onClick={() => setConfirmIdx(null)}
                            >
                              {t.no}
                            </button>
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              className="btn-secondary"
                              style={{ fontSize: 12, padding: "4px 10px" }}
                              onClick={() => {
                                setEditIdx(i);
                                setEditAmount(String(p.amount));
                                setEditMethod(p.method || "cash");
                                setEditDate(p.date || "");
                                setConfirmIdx(null);
                              }}
                            >
                              {t.edit}
                            </button>
                            <button
                              className="btn-danger"
                              style={{ fontSize: 12, padding: "4px 10px" }}
                              onClick={() => {
                                setConfirmIdx(i);
                                setEditIdx(null);
                              }}
                            >
                              {t.removePayment}
                            </button>
                          </span>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeManage}>
                {t.closeLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bad Debt: write off, with the day it actually happened */}
      {badDebtTarget &&
        (() => {
          const unpaid = Math.max(
            0,
            (badDebtTarget.totalAmount || 0) - (badDebtTarget.paidAmount || 0),
          );
          const alreadyHad = (badDebtTarget.paidAmount || 0) > 0;
          return (
            <div className="modal-overlay" onClick={() => setBadDebtTarget(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>{t.writeOff}</h3>
                <p style={{ fontSize: 13, margin: "8px 0 14px" }}>
                  {`KES ${unpaid.toLocaleString()} (${badDebtTarget.customer}) → ${t.losses || "Losses"}.` +
                    (alreadyHad
                      ? ` KES ${badDebtTarget.paidAmount.toLocaleString()} ${t.staysInSales || "already collected stays in Sales"}.`
                      : "") +
                    ` ${t.badDebtCanReopen}`}
                </p>
                <EntryDate
                  id="bad-debt-date"
                  label={t.writeOffDate}
                  value={badDebtDate}
                  onChange={setBadDebtDate}
                  min={badDebtTarget.dateIssued || undefined}
                  plain
                  hint={t.writeOffDateHint}
                />
                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setBadDebtTarget(null)}
                  >
                    {t.cancel}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={confirmBadDebt}
                    disabled={!badDebtDate}
                  >
                    {t.yesWriteOff}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Delete confirm dialog */}
      <AlertDialog
        open={!!deleteTarget}
        danger
        title={t.deleteRecord}
        message={
          deleteTarget
            ? `"${deleteTarget.customer}": ${t.cannotBeUndone || "This cannot be undone."}` +
              (returnsToStock(deleteTarget)
                ? ` ${stockLinesOf(deleteTarget)
                    .map((i) => `${Number(i.quantity).toLocaleString()} ${i.description}`)
                    .join(", ")} → ${t.stock || "Stock"}.`
                : "")
            : ""
        }
        confirmLabel={t.confirmDelete}
        cancelLabel={t.cancel}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteItem(deleteTarget.id);
            // Cancelled before the customer paid anything → goods go back on
            // the shelf. (Partly-paid or written-off credits keep their stock
            // deduction: those goods really did leave.)
            if (returnsToStock(deleteTarget)) {
              stockLinesOf(deleteTarget).forEach((i) =>
                recordStockReturn(i.stockId, Number(i.quantity)),
              );
            }
            showToast(t.deletedToast);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
