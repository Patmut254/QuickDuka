import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";

const ACTION_COLORS = {
  CREATE: {
    bg: "#f0fdf4",
    border: "#86efac",
    text: "#16a34a",
    label: "Added",
  },
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
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);

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
  const [historyLoading, setHistoryLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [clearing, setClearing] = useState(false);
  const { toast, showToast } = useToast();

  // hooks
  const { restoreItem } = useCollection("sales");
  const { silentDelete: deleteLog, clearCollection } =
    useCollection("auditLog");

  // ✅ FIXED: NO onSnapshot — safe fetch
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, "auditLog"),
          orderBy("timestamp", "desc"),
          limit(200),
        );

        const snap = await getDocs(q);

        setLogs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setHistoryLoading(false);
      } catch (err) {
        console.error("History fetch error:", err.message);
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filtered =
    filter === "ALL" ? logs : logs.filter((log) => log.action === filter);

  const handleRestore = async () => {
    if (!restoreTarget) return;

    try {
      await restoreItem(restoreTarget);
      setRestoreTarget(null);
      showToast("Record restored successfully!", "success");
    } catch (error) {
      console.error("Restore failed:", error);
      showToast("Failed to restore record.", "error");
    }
  };

  const handleClearHistory = async () => {
    const confirmed = window.confirm(
      "Delete ALL history permanently? This cannot be undone.",
    );

    if (!confirmed) return;

    try {
      setClearing(true);
      await clearCollection("auditLog");
      setLogs([]); // instant UI update
      showToast("History cleared.", "success");
    } catch (error) {
      console.error("Clear history failed:", error);
      showToast("Failed to clear history.", "error");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="history-page">
      <Toast toast={toast} />

      <AlertDialog
        open={!!restoreTarget}
        title="Restore this record?"
        message={
          restoreTarget
            ? `This will re-add "${restoreTarget.description || ""}" back to ${
                COL_LABELS[restoreTarget.collectionName] ||
                restoreTarget.collectionName
              }.`
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
              className={`filter-pill${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All Activity" : ACTION_COLORS[f]?.label || f}
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <span className="table-count">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>

          <button
            onClick={handleClearHistory}
            disabled={clearing}
            className="btn-danger"
          >
            {clearing ? "Clearing..." : "🗑 Clear All History"}
          </button>
        </div>
      </div>

      {historyLoading ? (
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

                  <button
                    className="btn-delete-log"
                    onClick={() => deleteLog(log.id)}
                    title="Delete this entry"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
