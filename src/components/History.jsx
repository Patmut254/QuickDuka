import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { Toast, useToast } from "./Toast";
import AlertDialog from "./AlertDialog";
import { useLang } from "../LangContext";
import { Trash2 } from "lucide-react";

const ACTION_COLORS = {
  CREATE: {
    bg: "#f0fdf4",
    border: "#86efac",
    text: "#16a34a",
    label: "actAdded",
  },
  UPDATE: {
    bg: "#eff6ff",
    border: "#93c5fd",
    text: "#1d4ed8",
    label: "actEdited",
  },
  DELETE: {
    bg: "#fef2f2",
    border: "#fca5a5",
    text: "#dc2626",
    label: "actDeleted",
  },
  RESTORE: {
    bg: "#faf5ff",
    border: "#c4b5fd",
    text: "#7e22ce",
    label: "actRestored",
  },
};

const COL_LABELS = {
  sales: "sales",
  purchases: "purchases",
  expenses: "expenses",
  credits: "credits",
  losses: "losses",
  stock: "stock",
};

function formatVal(obj) {
  if (!obj) return null;

  const parts = [];

  if (obj.date) parts.push(obj.date);
  if (obj.description) parts.push(obj.description);
  if (obj.item) parts.push(obj.item);
  if (obj.category) parts.push(obj.category);
  if (obj.customer) parts.push(`Mteja: ${obj.customer}`);
  if (obj.supplier) parts.push(`Muuzaji: ${obj.supplier}`);
  if (obj.amount) parts.push(`KES ${Number(obj.amount).toLocaleString()}`);
  if (obj.notes) parts.push(`Maelezo: ${obj.notes}`);

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
  const { t } = useLang();
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

  // Real-time audit log listener
  useEffect(() => {
    if (!db) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(
      collection(db, "auditLog"),
      where("userId", "==", uid),
      orderBy("timestamp", "desc"),
      limit(200),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setHistoryLoading(false);
      },
      (err) => {
        console.error("History fetch error:", err.message);
        setHistoryLoading(false);
      },
    );
    return unsub;
  }, []);

  const filtered =
    filter === "ALL" ? logs : logs.filter((log) => log.action === filter);

  const handleRestore = async () => {
    if (!restoreTarget) return;

    try {
      await restoreItem(restoreTarget);
      setRestoreTarget(null);
      showToast(t.restored, "success");
    } catch (error) {
      console.error("Restore failed:", error);
      showToast(t.failedSave, "error");
    }
  };

  const handleClearHistory = async () => {
    const confirmed = window.confirm(t.deleteHistory);

    if (!confirmed) return;

    try {
      setClearing(true);
      await clearCollection("auditLog");
      setLogs([]); // instant UI update
      showToast(t.historyCleared, "success");
    } catch (error) {
      console.error("Clear history failed:", error);
      showToast(t.failedDelete, "error");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="history-page">
      <Toast toast={toast} />

      <AlertDialog
        open={!!restoreTarget}
        title={t.restoreRecord}
        message={
          restoreTarget
            ? `Hii itarudisha "${restoreTarget.description || ""}" kwenye ${
                t[COL_LABELS[restoreTarget.collectionName]] ||
                restoreTarget.collectionName |
                  t[COL_LABELS[restoreTarget.collectionName]] ||
                restoreTarget.collectionName
              }. / This will re-add "${restoreTarget.description || ""}" back to ${
                t[COL_LABELS[restoreTarget.collectionName]] ||
                restoreTarget.collectionName |
                  t[COL_LABELS[restoreTarget.collectionName]] ||
                restoreTarget.collectionName
              }.`
            : ""
        }
        confirmLabel={t.confirmRestore}
        cancelLabel={t.cancel}
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
              {f === "ALL" ? t.allActivity : t[ACTION_COLORS[f]?.label] || f}
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <span className="table-count">
            {filtered.length}
            {filtered.length !== 1 ? "" : ""}
          </span>

          <button
            onClick={handleClearHistory}
            disabled={clearing}
            className="btn-danger"
          >
            {clearing ? t.clearing : t.clearHistory}
          </button>
        </div>
      </div>

      {historyLoading ? (
        <div className="table-loading">{t.historyLoading}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">{t.noHistory}</div>
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
                    {t[style.label] || style.label}
                  </span>

                  <div className="history-info">
                    <div className="history-desc">{log.description || "-"}</div>

                    <div className="history-meta">
                      <span className="history-col">
                        {t[COL_LABELS[log.collectionName]] ||
                          log.collectionName}
                      </span>

                      {log.before && (
                        <span className="history-detail">
                          {t.before}: <em>{formatVal(log.before)}</em>
                        </span>
                      )}

                      {log.after && log.action === "UPDATE" && (
                        <span className="history-detail">
                          {t.after}: <em>{formatVal(log.after)}</em>
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
                      {t.restore}
                    </button>
                  )}

                  <button
                    className="btn-delete-log"
                    onClick={() => deleteLog(log.id)}
                    title="Delete this entry"
                  >
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
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
