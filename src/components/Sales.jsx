import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useCollection } from "../hooks/useCollection";
import {
  useStock,
  recordStockSale,
  findStockByLabel,
} from "../hooks/useStock";
import { PAYMENT_METHODS, paymentMethodOptions } from "../paymentMethods";
import { priceError } from "../stockPrice";
import EntryDate, { StockUpdateToggle } from "./EntryDate";
import { localToday, stockUpdateWanted } from "../dates";
import { useLang } from "../LangContext";
import EntryTable from "./EntryTable";
import { Toast, useToast } from "./Toast";
import LineItems from "./LineItems";
import {
  lineStock,
  lineQty,
  filledLines,
  validateLines,
} from "../lineItems";

export default function Sales({ ownerUid, sub }) {
  const { t } = useLang();
  // If ownerUid is passed, query by ownerUid to get all sales including staff.
  // Otherwise fall back to normal userId query (staff's own view).
  const { items, loading, addItem, deleteItem, updateItem } =
    useCollection("sales", ownerUid ? { ownerUid } : undefined);
  const stock = useStock();
  const { toast, showToast } = useToast();

  // Owner's branches — lets the owner tag a sale with WHERE it happened
  // (e.g. Nairobi vs Mombasa), so Reports can compare locations. Only
  // relevant on the Business plan (multipleBranches), and only when the
  // owner has actually set up at least one branch.
  const [branches, setBranches] = useState([]);
  const canUseBranches = ownerUid && sub?.can?.("multipleBranches");
  useEffect(() => {
    if (!canUseBranches) return;
    const unsub = onSnapshot(
      collection(db, "users", ownerUid, "branches"),
      (snap) =>
        setBranches(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((b) => b.active !== false),
        ),
      () => setBranches([]),
    );
    return () => unsub();
  }, [ownerUid, canUseBranches]);

  // Date stays on the last day used, so a batch of old sales (e.g. April) can be
  // entered one after another without re-picking the date each time.
  const [lastDate, setLastDate] = useState(localToday);
  // Whether a back-dated sale should also change current stock (null = default)
  const [stockChoice, setStockChoice] = useState(null);

  // Shared details for the whole sale; the items themselves live in `lines`
  // so one customer can buy several things in a single entry.
  const emptyForm = {
    date: lastDate,
    customer: "",
    phone: "",
    paymentMethod: "cash",
    branchId: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);
  // When set, the form is adding items to this existing sale (same customer,
  // date and payment) instead of starting a new one.
  const [addTo, setAddTo] = useState(null);

  const newGroupId = () =>
    `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // All rows that belong to the same customer purchase
  const groupRows = (row) =>
    row?.saleGroup ? items.filter((i) => i.saleGroup === row.saleGroup) : row ? [row] : [];

  const resetForm = (date = lastDate) => {
    setForm({ ...emptyForm, date });
    setLines([]);
    setStockChoice(null);
    setAddTo(null);
  };

  const startAddTo = (row) => {
    setAddTo(row);
    setForm({
      date: row.date || localToday(),
      customer: row.customer || "",
      phone: row.phone || "",
      paymentMethod: row.paymentMethod || "cash",
      branchId: row.branchId || "",
      notes: row.notes || "",
    });
    setLines([]);
    setStockChoice(null);
    setStatus("idle");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;

    // Old sales usually don't touch today's stock count (see dates.js)
    const touchStock = stockUpdateWanted(form.date, stockChoice);

    // Price limits + enough stock, checked across ALL lines together (two
    // lines of the same item must not oversell it).
    const problem = validateLines(lines, stock, touchStock, t);
    if (problem) {
      showToast(problem, "error");
      return;
    }

    const used = filledLines(lines);
    setStatus("saving");
    try {
      const chosenBranch = branches.find((b) => b.id === form.branchId);
      const { branchId: _branchId, ...shared } = form;
      // Every item is its own Sales row (so reports per item keep working),
      // tied together by saleGroup so they read as one customer's purchase.
      // Adding to an existing sale joins its group (and gives a single
      // older sale a group id so the rows stay linked).
      let saleGroup = null;
      if (addTo) {
        saleGroup = addTo.saleGroup || newGroupId();
        if (!addTo.saleGroup) updateItem(addTo.id, { saleGroup }, addTo);
      } else if (used.length > 1) {
        saleGroup = newGroupId();
      }

      await Promise.all(
        used.map((line) => {
          const s = lineStock(line, stock);
          const qty = lineQty(line);
          if (touchStock && s && s.quantity != null) recordStockSale(s.id, qty);
          return addItem(
            {
              ...shared,
              description: line.text.trim(),
              quantity: qty,
              amount: parseFloat(line.amount),
              ...(saleGroup ? { saleGroup } : {}),
            },
            chosenBranch
              ? { branchId: chosenBranch.id, branchName: chosenBranch.name }
              : {},
          );
        }),
      );

      setStatus("saved");
      showToast(t.saved);
      const savedDate = form.date;
      setTimeout(() => {
        setStatus("idle");
        setLastDate(savedDate); // next entry starts on the same day
        resetForm(savedDate);
        setShowForm(false);
      }, 500);
    } catch {
      setStatus("idle");
      showToast(t.failedSave, "error");
    }
  };

  // Editing a sale's amount in the table is held to the same price limits as
  // a new sale (only when the amount actually changed, so old entries can
  // still have other fields corrected).
  const handleUpdate = async (id, newData, oldData) => {
    if (
      !oldData?.fromCredit && // credit payments are part-payments, not prices
      Number(newData.amount) !== Number(oldData?.amount)
    ) {
      const item = findStockByLabel(stock, newData.description ?? oldData?.description);
      const qty = Number(newData.quantity ?? oldData?.quantity) || 1;
      const msg = item ? priceError(item, qty, Number(newData.amount), t) : null;
      if (msg) {
        const err = new Error(msg);
        err.userMessage = msg;
        throw err;
      }
    }
    return updateItem(id, newData, oldData);
  };

  const total = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const columns = [
    { key: "date", label: t.date, inputType: "date" },
    {
      key: "description",
      label: t.itemSold,
      // Items bought together in one multi-item sale get a small tag
      format: (v, row) => {
        const n = row?.saleGroup ? groupRows(row).length : 1;
        return (
          <>
            {v || "-"}
            {n > 1 && (
              <span className="sale-group-tag">
                1 of {n} {t.itemsWord || "items"}
              </span>
            )}
          </>
        );
      },
    },
    { key: "customer", label: t.customer },
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
      key: "quantity",
      label: t.quantity,
      inputType: "number",
      format: (v) => (v != null && v !== "" ? Number(v).toLocaleString() : "-"),
    },
    {
      key: "amount",
      label: t.amount,
      inputType: "number",
      format: (v) => `KES ${Number(v).toLocaleString()}`,
    },
    {
      key: "paymentMethod",
      label: t.paymentMethod,
      type: "select",
      options: paymentMethodOptions(t),
      format: (v) => (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 0,
            background: "var(--accent)15",
            color: "var(--accent)",
            textTransform: "capitalize",
          }}
        >
          {t.paymentMethods?.[v] || v || t.paymentMethods?.cash || "Cash"}
        </span>
      ),
    },
    { key: "notes", label: t.notes },
    // branchName is display-only — where this sale happened (Nairobi,
    // Mombasa, etc). Only shown for owners on the Business plan.
    ...(canUseBranches && branches.length > 0
      ? [{
          key: "branchName",
          label: "Location",
          readOnly: true,
          format: (v) => v
            ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 0, background: "#4f6f7d15", color: "#4f6f7d" }}>{v}</span>
            : <span style={{ fontSize: 11, color: "var(--muted)" }}></span>,
        }]
      : []),
    // staffName is display-only — mark readOnly so EntryTable skips it in edit mode
    ...(ownerUid
      ? [{
          key: "staffName",
          label: "By",
          readOnly: true,
          format: (v) => v
            ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 0, background: "var(--accent)15", color: "var(--accent)" }}>{v}</span>
            : <span style={{ fontSize: 11, color: "var(--muted)" }}>Owner</span>,
        }]
      : []),
  ];

  return (
    <div className="module-page">
      <Toast toast={toast} />
      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">{t.totalSales}</span>
          <span className="stat-value green">KES {total.toLocaleString()}</span>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setStatus("idle");
            if (showForm) resetForm();
          }}
        >
          {showForm ? `${t.cancel}` : `+ ${t.newSale}`}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={handleSubmit}>
          <h3>
            {addTo
              ? `${t.addItemsTo || "Add items to sale"}: ${addTo.customer || addTo.description} (${addTo.date})`
              : t.recordSale}
          </h3>
          <div className="form-grid">
            <EntryDate
              id="sale-date"
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
            {canUseBranches && branches.length > 0 && (
              <div className="field-group">
                <label htmlFor="sale-branch">Location / Branch</label>
                <select
                  id="sale-branch"
                  name="sale-branch"
                  value={form.branchId}
                  onChange={(e) =>
                    setForm({ ...form, branchId: e.target.value })
                  }
                >
                  <option value="">No specific branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.location ? ` (${b.location})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field-group">
              <label htmlFor="sale-customer">{t.customer}</label>
              <input
                id="sale-customer"
                name="sale-customer"
                autoComplete="name"
                placeholder={t.customerPh}
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="sale-phone">{t.phone}</label>
              <input
                id="sale-phone"
                name="sale-phone"
                type="tel"
                autoComplete="tel"
                placeholder="07XX XXX XXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="sale-payment-method">{t.paymentMethod}</label>
              <select
                id="sale-payment-method"
                name="sale-payment-method"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t.paymentMethods?.[m] || m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group full-width">
              <label htmlFor="sale-notes">{t.notes}</label>
              <input
                id="sale-notes"
                name="sale-notes"
                autoComplete="off"
                placeholder="..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <LineItems
            lines={lines}
            setLines={setLines}
            stock={stock}
            t={t}
            idPrefix="sale"
            itemLabel={t.itemSold}
            baseTotal={
              addTo
                ? groupRows(addTo).reduce((a, r) => a + (Number(r.amount) || 0), 0)
                : 0
            }
            totalLabel={t.saleTotal || "Sale total"}
          />
          <button
            type="submit"
            className={"btn-primary" + (status === "saved" ? " btn-saved" : "")}
            disabled={status !== "idle"}
          >
            {status === "saving"
              ? t.saving
              : status === "saved"
                ? t.saved
                : t.saveSale}
          </button>
        </form>
      )}

      <EntryTable
        items={items}
        loading={loading}
        columns={columns}
        onDelete={deleteItem}
        onUpdate={handleUpdate}
        showToast={showToast}
        emptyMessage={t.noSales}
        totalKey="amount"
        extraActions={(row) =>
          row.fromCredit ? null : (
            <button
              className="edit-btn add-item-btn"
              onClick={() => startAddTo(row)}
              title={t.addItem || "Add item"}
            >
              + {t.itemNo || "Item"}
            </button>
          )
        }
        totalLabel={t.totalSales}
      />
    </div>
  );
}
