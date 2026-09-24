import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useStock } from "../hooks/useStock";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";
import EntryDate from "./EntryDate";
import { localToday } from "../dates";

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

  const emptyForm = {
    date: lastDate,
    category: "",
    customCategory: "",
    description: "",
    payee: "",
    phone: "",
    amount: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);

  const isOther = form.category === OTHER;

  const handleStockSelect = (e) => {
    const found = stock.find((c) => c.name === e.target.value);
    setForm((f) => ({
      ...f,
      description: found ? found.name : e.target.value,
      amount: found?.price != null ? String(found.price) : f.amount,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    const finalCategory =
      isOther && form.customCategory.trim()
        ? form.customCategory.trim()
        : form.category;
    try {
      await addItem({
        ...form,
        category: finalCategory,
        amount: parseFloat(form.amount),
      });
      setStatus("saved");
      showToast(t.saved);
      const savedDate = form.date;
      setTimeout(() => {
        setStatus("idle");
        setLastDate(savedDate);
        setForm({ ...emptyForm, date: savedDate });
        setShowForm(false);
      }, 1500);
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
            setShowForm(!showForm);
            setStatus("idle");
          }}
        >
          {showForm ? `✕ ${t.cancel}` : `+ ${t.newExpense}`}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>💸 {t.recordExpense}</h3>
          <div className="form-grid">
            <EntryDate
              id="exp-date"
              value={form.date}
              onChange={(d) => setForm({ ...form, date: d })}
            />
            <div className="field-group">
              <label htmlFor="exp-category">{t.expCategory} *</label>
              <select
                id="exp-category"
                name="exp-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              >
                <option value="">{t.selectCategory}</option>
                {CATS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {isOther && (
              <div className="field-group">
                <label htmlFor="exp-custom-category">
                  {t.specifyCategory} *
                </label>
                <input
                  id="exp-custom-category"
                  name="exp-custom-category"
                  autoComplete="off"
                  placeholder={t.specifyCatPh}
                  value={form.customCategory}
                  onChange={(e) =>
                    setForm({ ...form, customCategory: e.target.value })
                  }
                  required
                />
              </div>
            )}
            {stock.length > 0 && (
              <div className="field-group">
                <label htmlFor="exp-stock">{t.pickStock}</label>
                <select
                  id="exp-stock"
                  name="exp-stock"
                  onChange={handleStockSelect}
                  value={form.description}
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
              <label htmlFor="exp-description">{t.description}</label>
              <input
                id="exp-description"
                name="exp-description"
                autoComplete="off"
                placeholder={t.descriptionPh}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
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
            <div className="field-group">
              <label htmlFor="exp-amount">{t.amount} *</label>
              <input
                id="exp-amount"
                name="exp-amount"
                type="number"
                autoComplete="off"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
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
      />
    </div>
  );
}
