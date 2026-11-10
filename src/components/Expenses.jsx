import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useStock } from "../hooks/useStock";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";
import EntryDate from "./EntryDate";
import { localToday } from "../dates";
import BatchRows from "./BatchRows";
import { newBatchRow, usedRows, newBatchId } from "../batchRows";

export default function Expenses({ ownerUid }) {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("expenses", ownerUid ? { ownerUid } : undefined);
  const stock = useStock();
  const { toast, showToast } = useToast();

  const CATS = t.expenseCategories;
  const OTHER = CATS[CATS.length - 1];

  // Date stays on the last day used, so a batch of old entries can be added
  // one after another without re-picking the date each time.
  const [lastDate, setLastDate] = useState(localToday);

  // Shared details for every expense saved together; each row holds the
  // category, description and amount, so several can be entered at once.
  const emptyForm = {
    date: lastDate,
    payee: "",
    phone: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const makeRow = () =>
    newBatchRow({ category: "", customCategory: "", description: "", amount: "" });
  const [rows, setRows] = useState(() => [makeRow()]);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);

  const rowFields = [
    {
      key: "category",
      label: t.expCategory,
      type: "select",
      options: CATS,
      placeholder: t.selectCategory,
      required: true,
      grow: 1.5,
      extra: {
        when: (r) => r.category === OTHER,
        key: "customCategory",
        placeholder: t.specifyCatPh || t.specifyCategory,
      },
    },
    {
      key: "description",
      label: t.description,
      type: "stock",
      grow: 2,
      placeholder: t.descriptionPh,
      onStockPick: (st, r) =>
        st.price != null && !r.amount ? { amount: String(st.price) } : {},
    },
    { key: "amount", label: t.amount, type: "number", placeholder: "0.00", required: true },
  ];

  const resetForm = (date = lastDate) => {
    setForm({ ...emptyForm, date });
    setRows([makeRow()]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    const used = usedRows(rows, rowFields);
    if (!used.length) {
      showToast(t.addOneItem || "Add at least one entry.", "error");
      return;
    }
    for (const r of used) {
      const amt = parseFloat(r.amount);
      if (!r.category || (r.category === OTHER && !r.customCategory.trim())) {
        showToast(`${t.expCategory}: ${t.selectCategory}`, "error");
        return;
      }
      if (Number.isNaN(amt) || amt <= 0) {
        showToast(`${r.description || r.category}: ${t.enterAmount || "enter the amount."}`, "error");
        return;
      }
    }
    setStatus("saving");
    try {
      const batch = used.length > 1 ? newBatchId() : null;
      await Promise.all(
        used.map((r) =>
          addItem({
            ...form,
            category:
              r.category === OTHER && r.customCategory.trim()
                ? r.customCategory.trim()
                : r.category,
            description: r.description.trim(),
            amount: parseFloat(r.amount),
            ...(batch ? { batch } : {}),
          }),
        ),
      );
      setStatus("saved");
      showToast(t.saved);
      const savedDate = form.date;
      setTimeout(() => {
        setStatus("idle");
        setLastDate(savedDate);
        resetForm(savedDate);
        setShowForm(false);
      }, 500);
    } catch {
      setStatus("idle");
      showToast(t.failedSave, "error");
    }
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const columns = [
    { key: "date", label: t.date, inputType: "date" },
    { key: "category", label: t.expCategory, type: "select", options: CATS },
    { key: "description", label: t.description },
    { key: "payee", label: t.paidTo },
    {
      key: "phone",
      label: t.phone,
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
    {
      key: "amount",
      label: t.amount,
      inputType: "number",
      format: (v) => `KES ${Number(v).toLocaleString()}`,
    },
    { key: "notes", label: t.notes },
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">{t.totalExpenses}</span>
          <span className="stat-value purple">
            KES {total.toLocaleString()}
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
          {showForm ? `${t.cancel}` : `+ ${t.newExpense}`}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>{t.recordExpense}</h3>
          <div className="split-form">
            <div className="split-form-left">
              <div className="form-grid">
                <EntryDate
                  id="exp-date"
                  value={form.date}
                  onChange={(d) => setForm({ ...form, date: d })}
                />
                <div className="field-group">
                  <label htmlFor="exp-payee">{t.paidTo}</label>
                  <input
                    id="exp-payee"
                    name="exp-payee"
                    autoComplete="off"
                    placeholder={t.paidToPh}
                    value={form.payee}
                    onChange={(e) => setForm({ ...form, payee: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="exp-phone">{t.phone}</label>
                  <input
                    id="exp-phone"
                    name="exp-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="07XX XXX XXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="field-group full-width">
                  <label htmlFor="exp-notes">{t.notes}</label>
                  <input
                    id="exp-notes"
                    name="exp-notes"
                    autoComplete="off"
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
                idPrefix="exp"
                makeRow={makeRow}
                totalLabel={t.totalExpenses}
                addLabel={t.addAnotherExpense || "Add another expense"}
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
                        : t.saveExpense}
                  </button>
                }
              />
            </div>
          </div>
        </form>
      )}

      <EntryTable
        items={items}
        loading={loading}
        columns={columns}
        onDelete={deleteItem}
        onUpdate={updateItem}
        showToast={showToast}
        emptyMessage={t.noExpenses}
        totalKey="amount"
        totalLabel={t.totalExpenses}
        groupKey="batch"
        groupShared={["date", "payee", "phone", "notes"]}
        groupLabelKey="description"
      />
    </div>
  );
}
