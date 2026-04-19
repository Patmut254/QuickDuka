import { useState } from "react";
import AlertDialog from "./AlertDialog";

export default function EntryTable({
  items,
  loading,
  columns,
  onDelete,
  onUpdate,
  emptyMessage,
  showToast,
}) {
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
    setEditId(item.id);
    setEditData({ ...item });
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
      showToast && showToast("Record updated successfully!", "success");
    } catch (err) {
      console.error("Update failed:", err);
      showToast && showToast("Update failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.id, deleteTarget.item);
      showToast &&
        showToast("Deleted. Restore it anytime from History.", "delete");
    } catch (err) {
      console.error("Delete failed:", err);
      showToast && showToast("Delete failed. Please try again.", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="entry-table-wrap">
      <AlertDialog
        open={!!deleteTarget}
        danger
        title="Delete this record?"
        message={
          deleteTarget
            ? `You are about to delete "${deleteTarget.item?.description || deleteTarget.item?.item || deleteTarget.item?.category || "this record"}" - KES ${Number(deleteTarget.item?.amount || 0).toLocaleString()}. You can restore it from the History tab.`
            : ""
        }
        confirmLabel={deleting ? "Deleting..." : "Yes, Delete"}
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <div className="table-toolbar">
        <input
          className="search-input"
          placeholder="🔍 Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="table-count">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="table-loading">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {search ? "No results found." : emptyMessage}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Actions</th>
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
                        c.type === "select" ? (
                          <select
                            className="inline-edit"
                            value={editData[c.key] || ""}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                [c.key]: e.target.value,
                              })
                            }
                          >
                            {c.options?.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="inline-edit"
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
                          {saving ? "Saving..." : "Save ✓"}
                        </button>
                        <button
                          className="btn-cancel-sm"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="action-btns">
                        <button
                          className="edit-btn"
                          onClick={() => startEdit(item)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => setDeleteTarget({ id: item.id, item })}
                          title="Delete"
                        >
                          🗑
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
    </div>
  );
}
