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

export default function Losses({ ownerUid }) {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("losses", ownerUid ? { ownerUid } : undefined);
  const stock = useStock();
  const { toast, showToast } = useToast();

  const CATS = t.lossCategories;

  const [lastDate, setLastDate] = useState(localToday);

  // Shared details (date, notes); each row is one lost item, so several
  // losses can be recorded at once.
  const emptyForm = { date: lastDate, notes: "" };
  const [form, setForm] = useState(emptyForm);
  const makeRow = () =>
    newBatchRow({ item: "", category: CATS[0], quantity: "", amount: "" });
  const [rows, setRows] = useState(() => [makeRow()]);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);

  const rowFields = [
    {
      key: "item",
      label: t.lostItem,
      type: "stock",
      grow: 2,
      required: true,
      onStockPick: (st, r) =>
        st.price != null && !r.amount ? { amount: String(st.price) } : {},
    },
    { key: "category", label: t.lossCategory, type: "select", options: CATS },
    { key: "quantity", label: t.quantity, placeholder: t.quantityPh },
    { key: "amount", label: t.estValue, type: "number", placeholder: "0.00", required: true },
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
      if (!r.item.trim()) {
        showToast(t.chooseItemEachLine || "Enter the item on every line.", "error");
        return;
      }
      if (r.amount === "" || Number.isNaN(parseFloat(r.amount))) {
        showToast(`${r.item}: ${t.enterAmount || "enter the amount."}`, "error");
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
            item: r.item.trim(),
            category: r.category,
            quantity: r.quantity,
            amount: parseFloat(r.amount) || 0,
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

  const byCategory = CATS.map((cat) => ({
    cat,
    total: items
      .filter((i) => i.category === cat)
      .reduce((a, b) => a + (Number(b.amount) || 0), 0),
    count: items.filter((i) => i.category === cat).length,
  })).filter((c) => c.count > 0);

  // Header shows the 3 biggest loss categories; the rest are combined into
  // one "Others" box so the header never gets crowded.
  const sortedCats = [...byCategory].sort((a, b) => b.total - a.total);
  const headerCats =
    sortedCats.length <= 4
      ? sortedCats
      : [
          ...sortedCats.slice(0, 3),
          sortedCats.slice(3).reduce(
            (acc, c) => ({
              cat: `${t.othersLabel || "Others"} (${sortedCats.length - 3})`,
              total: acc.total + c.total,
              count: acc.count + c.count,
            }),
            { total: 0, count: 0 },
          ),
        ];

  const columns = [
    { key: "date", label: t.date, inputType: "date" },
    { key: "item", label: t.lostItem },
    { key: "category", label: t.lossCategory, type: "select", options: CATS },
    { key: "quantity", label: t.quantity },
    {
      key: "amount",
      label: t.estValue,
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
          <span className="stat-label">{t.totalLosses}</span>
          <span className="stat-value red">KES {total.toLocaleString()}</span>
        </div>
        {headerCats.map((c) => (
          <div key={c.cat} className="module-stat module-stat-sub">
            <span className="stat-label">{c.cat}</span>
            <span className="stat-value">KES {c.total.toLocaleString()}</span>
            <span className="stat-sub-count">
              {c.count} {c.count === 1 ? t.recordWord || "record" : t.records || "records"}
            </span>
          </div>
        ))}
        <button
          className="btn-primary"
          style={{ background: "var(--red)" }}
          onClick={() => {
            if (showForm) resetForm();
            setShowForm(!showForm);
            setStatus("idle");
          }}
        >
          {showForm ? `${t.cancel}` : `+ ${t.newLoss}`}
        </button>
      </div>


      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>{t.recordLoss}</h3>
          <div className="split-form">
            <div className="split-form-left">
              <div className="form-grid">
                <EntryDate
                  id="loss-date"
                  value={form.date}
                  onChange={(d) => setForm({ ...form, date: d })}
                />
                <div className="field-group full-width">
                  <label htmlFor="loss-notes">{t.notes}</label>
                  <input
                    id="loss-notes"
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
                idPrefix="loss"
                makeRow={makeRow}
                totalLabel={t.totalLosses}
                addLabel={t.addAnotherLoss || "Add another loss"}
                action={
                  <button
                    type="submit"
                    className={"btn-primary" + (status === "saved" ? " btn-saved" : "")}
                    style={{
                      background: status === "saved" ? "var(--green)" : "var(--red)",
                    }}
                    disabled={status !== "idle"}
                  >
                    {status === "saving"
                      ? t.saving
                      : status === "saved"
                        ? t.saved
                        : t.saveLoss}
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
        emptyMessage={t.noLosses}
        totalKey="amount"
        totalLabel={t.totalLosses}
        groupKey="batch"
        groupShared={["date", "notes"]}
        groupLabelKey="item"
      />
    </div>
  );
}
