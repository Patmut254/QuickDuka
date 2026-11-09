/* eslint-disable no-unused-vars */
import { useState } from "react";
import AlertDialog from "./AlertDialog";
import { useLang } from "../LangContext";
import { Pencil, Trash2 } from "lucide-react";
import SearchBar from "./SearchBar";

export default function EntryTable({
  items,
  loading,
  columns,
  onDelete,
  onUpdate,
  emptyMessage,
  showToast,
  totalKey, // optional: sum this column under the table (follows the search)
  totalLabel,
}) {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = items.filter((item) =>
    columns.some((col) => {
      const val = item[col.key];
      return val && String(val).toLowerCase().includes(search.toLowerCase());
    }),
  );

  const startEdit = (item) => {
    // Sanitise editData: convert any non-primitive values (e.g. Firestore
    // Timestamps, objects) to strings so they don't crash controlled inputs.
    const sanitised = {};
    Object.entries(item).forEach(([k, v]) => {
      if (v === null || v === undefined) {
        sanitised[k] = "";
      } else if (typeof v === "object" && typeof v.toDate === "function") {
        // Firestore Timestamp → ISO date string
        sanitised[k] = v.toDate().toISOString().split("T")[0];
      } else if (typeof v === "object") {
        // Any other object: skip (don't put it in an input)
        sanitised[k] = "";
      } else {
        sanitised[k] = v;
      }
    });
    setEditId(item.id);
    setEditData(sanitised);
    setOriginalData({ ...item });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditData({});
    setOriginalData({});
  };

  const saveEdit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { id, createdAt, ...data } = editData;
      const { id: _id, createdAt: _c, ...oldData } = originalData;
      await onUpdate(editId, data, oldData);
      setEditId(null);
      setEditData({});
      setOriginalData({});
      showToast && showToast(t.updatedToast, "success");
    } catch (err) {
      console.error("Update failed:", err);
      showToast &&
        showToast(
          err.userMessage ||
            (t.updatedToast ? "Update failed. Please try again." : "Update failed."),
          "error",
        );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.id, deleteTarget.item);
      showToast && showToast(t.deletedToast, "delete");
    } catch (err) {
      console.error("Delete failed:", err);
      showToast && showToast(t.failedDelete || "Delete failed. Please try again.", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Safely build the delete confirmation message.
  // Guards against t.deleteMsg being undefined (e.g. if a custom LangContext
  // is provided that doesn't include it).
  const getDeleteMessage = () => {
    if (!deleteTarget) return "";
    const name =
      deleteTarget.item?.description ||
      deleteTarget.item?.item ||
      deleteTarget.item?.category ||
      "this record";
    const amount = Number(deleteTarget.item?.amount || 0).toLocaleString();
    if (typeof t.deleteMsg === "function") {
      return t.deleteMsg(name, amount);
    }
    return `Delete "${name}" (KES ${amount})? This cannot be undone.`;
  };

  return (
    <div className="entry-table-wrap">
      <AlertDialog
        open={!!deleteTarget}
        danger
        title={t.delete || "Delete"}
        message={getDeleteMessage()}
        confirmLabel={deleting ? (t.deleting || "Deleting…") : (t.confirmDelete || "Delete")}
        cancelLabel={t.cancel || "Cancel"}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <div className="table-toolbar">
        <SearchBar
          id="table-search"
          label={t.search || "Search"}
          placeholder={t.search || "Search"}
          value={search}
          onChange={setSearch}
        />
        <span className="table-count">
          {filtered.length} {t.records || "records"}
        </span>
      </div>

      {loading ? (
        <div className="table-loading">{t.loading || "Loading…"}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">{search ? (t.noResults || "No results") : emptyMessage}</div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>{t.actions || "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={editId === item.id ? "row-editing" : ""}
                >
                  {columns.map((c) => (
                    <td key={c.key}>
                      {editId === item.id ? (
                        // Edit mode — only render editable columns (skip read-only ones like staffName)
                        c.readOnly ? (
                          // Read-only column: show plain text even in edit mode
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {item[c.key] ?? "-"}
                          </span>
                        ) : c.type === "select" ? (
                          <select
                            className="inline-edit"
                            name={`edit-${c.key}`}
                            value={editData[c.key] || ""}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                [c.key]: e.target.value,
                              })
                            }
                          >
                            {c.options?.map((o) => {
                              // options can be plain strings or {value, label}
                              const val = typeof o === "object" ? o.value : o;
                              const lab = typeof o === "object" ? o.label : o;
                              return (
                                <option key={val} value={val}>
                                  {lab}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <input
                            className="inline-edit"
                            name={`edit-${c.key}`}
                            autoComplete="off"
                            type={c.inputType || "text"}
                            value={editData[c.key] ?? ""}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                [c.key]: e.target.value,
                              })
                            }
                          />
                        )
                      ) : c.format ? (
                        c.format(item[c.key], item)
                      ) : (
                        (item[c.key] ?? "-")
                      )}
                    </td>
                  ))}
                  <td>
                    {editId === item.id ? (
                      <div className="action-btns">
                        <button
                          className="btn-save-inline"
                          onClick={saveEdit}
                          disabled={saving}
                        >
                          {saving ? (t.saving || "Saving…") : (t.save || "Save")}
                        </button>
                        <button
                          className="btn-cancel-sm"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          {t.cancel || "Cancel"}
                        </button>
                      </div>
                    ) : (
                      <div className="action-btns">
                        <button
                          className="edit-btn"
                          onClick={() => startEdit(item)}
                          title={t.edit || "Edit"}
                        >
                          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => setDeleteTarget({ id: item.id, item })}
                          title={t.delete || "Delete"}
                        >
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalKey && !loading && filtered.length > 0 && (
        <div className="table-total">
          <span>
            {totalLabel || t.total || "Total"}
            {search ? ` (${filtered.length} ${t.records || "records"})` : ""}
          </span>
          <strong>
            KES{" "}
            {filtered
              .reduce((a, r) => a + (Number(r[totalKey]) || 0), 0)
              .toLocaleString()}
          </strong>
        </div>
      )}
    </div>
  );
}
