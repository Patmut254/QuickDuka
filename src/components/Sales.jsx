import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useCatalogue } from "../hooks/useCatalogue";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";

export default function Sales() {
  const { t } = useLang();
  const { items, loading, addItem, deleteItem, updateItem } = useCollection("sales");
  const catalogue = useCatalogue();
  const { toast, showToast } = useToast();

  const emptyForm = { date: new Date().toISOString().split("T")[0], description: "", customer: "", phone: "", amount: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);

  const handleCatalogueSelect = (e) => {
    const found = catalogue.find((c) => c.name === e.target.value);
    setForm((f) => ({ ...f, description: found ? found.name : e.target.value, amount: found?.price != null ? String(found.price) : f.amount }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    setStatus("saving");
    try {
      await addItem({ ...form, amount: parseFloat(form.amount) });
      setStatus("saved");
      showToast(t.saved);
      setTimeout(() => { setStatus("idle"); setForm(emptyForm); setShowForm(false); }, 1500);
    } catch {
      setStatus("idle");
      showToast(t.failedSave, "error");
    }
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const columns = [
    { key: "date",        label: t.date,     inputType: "date" },
    { key: "description", label: t.itemSold },
    { key: "customer",    label: t.customer },
    { key: "phone",       label: t.phone,    inputType: "tel", format: v => v ? <a href={`tel:${v}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{v}</a> : "-" },
    { key: "amount",      label: t.amount,   inputType: "number", format: v => `KES ${Number(v).toLocaleString()}` },
    { key: "notes",       label: t.notes },
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">{t.totalSales}</span>
          <span className="stat-value green">KES {total.toLocaleString()}</span>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setStatus("idle"); }}>
          {showForm ? `✕ ${t.cancel}` : `+ ${t.newSale}`}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>📦 {t.recordSale}</h3>
          <div className="form-grid">
            <div className="field-group">
              <label>{t.date} *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            {catalogue.length > 0 && (
              <div className="field-group">
                <label>{t.pickCatalogue}</label>
                <select onChange={handleCatalogueSelect} value={form.description}>
                  <option value="">{t.selectItem}</option>
                  {catalogue.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}{c.price != null ? ` — KES ${Number(c.price).toLocaleString()}${c.unit ? `/${c.unit}` : ""}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field-group">
              <label>{t.itemSold} *</label>
              <input placeholder={t.itemSoldPh} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="field-group">
              <label>{t.customer}</label>
              <input placeholder={t.customerPh} value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} />
            </div>
            <div className="field-group">
              <label>{t.phone}</label>
              <input type="tel" placeholder="07XX XXX XXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field-group">
              <label>{t.amount} *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="field-group full-width">
              <label>{t.notes}</label>
              <input placeholder="..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <button type="submit" className={"btn-primary" + (status === "saved" ? " btn-saved" : "")} disabled={status !== "idle"}>
            {status === "saving" ? t.saving : status === "saved" ? t.saved : t.saveSale}
          </button>
        </form>
      )}

      <EntryTable items={items} loading={loading} columns={columns} onDelete={deleteItem} onUpdate={updateItem} showToast={showToast} emptyMessage={t.noSales} />
    </div>
  );
}
