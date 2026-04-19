import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";

const ACTION_COLORS = {
  CREATE: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a", label: "Added" },
  UPDATE: {
    bg: "#eff6ff",
    border: "#93c5fd",
    text: "#1d4ed8",
    label: "Edited",
  },
  DELETE: {
    bg: "#fef2f2",
    border: "#fca5a5",
    text: "#dc2626",
    label: "Deleted",
  },
  RESTORE: {
    bg: "#faf5ff",
    border: "#c4b5fd",
    text: "#7e22ce",
    label: "Restored",
  },
};

const COL_LABELS = {
  sales: "Sales",
  purchases: "Purchases",
  expenses: "Expenses",
};

function formatVal(obj) {
  if (!obj) return null;
  const parts = [];
  if (obj.date) parts.push(obj.date);
  if (obj.description) parts.push(obj.description);
  if (obj.item) parts.push(obj.item);
  if (obj.category) parts.push(obj.category);
  if (obj.customer) parts.push(`Customer: ${obj.customer}`);
  if (obj.supplier) parts.push(`Supplier: ${obj.supplier}`);
  if (obj.amount) parts.push(`KES ${Number(obj.amount).toLocaleString()}`);
  if (obj.notes) parts.push(`Notes: ${obj.notes}`);
  return parts.join(" · ");
}

function timeSince(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [restoreTarget, setRestoreTarget] = useState(null);
  const { toast, showToast } = useToast();
  // We need restoreItem - borrow from a dummy collection hook
  const { restoreItem } = useCollection("sales"); // restoreItem is collection-agnostic

  useEffect(() => {
    const q = query(
      collection(db, "auditLog"),
      orderBy("timestamp", "desc"),
      limit(200),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered =
    filter === "ALL" ? logs : logs.filter((l) => l.action === filter);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    await restoreItem(restoreTarget);
    setRestoreTarget(null);
    showToast("Record restored successfully!", "success");
  };

  return (
    <div className="history-page">
      <Toast toast={toast} />
      <AlertDialog
        open={!!restoreTarget}
        title="Restore this record?"
        message={
          restoreTarget
            ? `This will re-add "${restoreTarget.description || ""}" back to ${COL_LABELS[restoreTarget.collectionName] || restoreTarget.collectionName}.`
            : ""
        }
        confirmLabel="Yes, Restore"
        cancelLabel="Cancel"
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />

      <div className="history-toolbar">
        <div className="filter-pills">
          {["ALL", "CREATE", "UPDATE", "DELETE", "RESTORE"].map((f) => (
            <button
              key={f}
              className={"filter-pill" + (filter === f ? " active" : "")}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All Activity" : ACTION_COLORS[f]?.label || f}
            </button>
          ))}
        </div>
        <span className="table-count">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="table-loading">Loading history...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          No activity recorded yet. Changes will appear here automatically.
        </div>
      ) : (
        <div className="history-list">
          {filtered.map((log) => {
            const style = ACTION_COLORS[log.action] || ACTION_COLORS.CREATE;
            const canRestore = log.action === "DELETE" && log.before;
            return (
              <div className="history-card" key={log.id}>
                <div className="history-left">
                  <span
                    className="history-badge"
                    style={{
                      background: style.bg,
                      border: `1px solid ${style.border}`,
                      color: style.text,
                    }}
                  >
                    {style.label}
                  </span>
                  <div className="history-info">
                    <div className="history-desc">{log.description || "-"}</div>
                    <div className="history-meta">
                      <span className="history-col">
                        {COL_LABELS[log.collectionName] || log.collectionName}
                      </span>
                      {log.before && (
                        <span className="history-detail">
                          Before: <em>{formatVal(log.before)}</em>
                        </span>
                      )}
                      {log.after && log.action === "UPDATE" && (
                        <span className="history-detail">
                          After: <em>{formatVal(log.after)}</em>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="history-right">
                  <span className="history-time">
                    {timeSince(log.timestamp)}
                  </span>
                  {canRestore && (
                    <button
                      className="btn-restore"
                      onClick={() => setRestoreTarget(log)}
                    >
                      ↩ Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
