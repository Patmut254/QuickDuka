import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { Toast, useToast } from "./Toast";

const PLAN_DAYS = 30;
const ADMIN_EMAIL = "anitajehu13@gmail.com"; // ← Your admin email

export function isAdmin(user) {
  return user?.email === ADMIN_EMAIL;
}

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | active | expired | pending
  const { toast, showToast } = useToast();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const getStatus = (u) => {
    if (u.subscriptionStatus === "active") {
      const expiry = u.subscriptionExpiry?.toDate?.();
      if (expiry && new Date() > expiry) return "expired";
      return "active";
    }
    if (u.subscriptionStatus === "trial") return "pending";
    return u.subscriptionStatus || "pending";
  };

  const extend = async (u, months = 1) => {
    const now = new Date();
    const base = u.subscriptionExpiry?.toDate?.() || now;
    const from = base > now ? base : now;
    const newExpiry = new Date(from.getTime() + months * PLAN_DAYS * 24 * 60 * 60 * 1000);
    await updateDoc(doc(db, "users", u.id), {
      subscriptionStatus: "active",
      subscriptionExpiry: Timestamp.fromDate(newExpiry),
    });
    showToast(`✅ Extended ${u.businessName || u.email} to ${newExpiry.toLocaleDateString("en-KE")}`);
  };

  const suspend = async (u) => {
    await updateDoc(doc(db, "users", u.id), { subscriptionStatus: "expired" });
    showToast(`Suspended ${u.businessName || u.email}`);
  };

  const filtered = users.filter(u => {
    const st = getStatus(u);
    const matchFilter = filter === "all" || st === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || (u.email || "").toLowerCase().includes(q)
      || (u.businessName || "").toLowerCase().includes(q)
      || (u.ownerName || "").toLowerCase().includes(q)
      || (u.phone || "").includes(q);
    return matchFilter && matchSearch;
  });

  const statusBadge = (u) => {
    const st = getStatus(u);
    const colors = { active: "#22c55e", expired: "#ef4444", pending: "#f97316", trial: "#f97316" };
    const labels = { active: "✅ Active", expired: "❌ Expired", pending: "⏳ Pending", trial: "⏳ Pending" };
    return (
      <span className="admin-badge" style={{ background: colors[st] + "22", color: colors[st], border: `1px solid ${colors[st]}44` }}>
        {labels[st] || st}
      </span>
    );
  };

  const expiryLabel = (u) => {
    const d = u.subscriptionExpiry?.toDate?.();
    if (!d) return "—";
    return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
  };

  const stats = {
    total: users.length,
    active: users.filter(u => getStatus(u) === "active").length,
    expired: users.filter(u => getStatus(u) === "expired").length,
    pending: users.filter(u => ["pending", "trial"].includes(getStatus(u))).length,
  };

  return (
    <div className="module-page">
      <Toast toast={toast} />

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Admin Panel</h2>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Manage users and subscriptions</p>
      </div>

      {/* Stats */}
      <div className="admin-stats-row">
        {[
          { label: "Total Users", val: stats.total, color: "#3b82f6" },
          { label: "Active", val: stats.active, color: "#22c55e" },
          { label: "Expired", val: stats.expired, color: "#ef4444" },
          { label: "Pending", val: stats.pending, color: "#f97316" },
        ].map(s => (
          <div key={s.label} className="admin-stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
            <div className="admin-stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="admin-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue estimate */}
      <div className="admin-revenue-bar">
        Monthly Revenue Estimate: <strong>KES {(stats.active * 100).toLocaleString()}</strong>
        {" · "}Referral breakdown below
      </div>

      {/* Referrer breakdown */}
      <ReferrerBreakdown users={users} />

      {/* Filters + Search */}
      <div className="admin-toolbar">
        <div className="filter-pills">
          {["all", "active", "expired", "pending"].map(f => (
            <button key={f} className={"filter-pill" + (filter === f ? " active" : "")} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input
          className="admin-search"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="table-loading">Loading users...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No users found.</div>
      ) : (
        <div className="admin-table-wrap">
          {filtered.map(u => (
            <div key={u.id} className="admin-user-card">
              <div className="admin-user-top">
                <div className="admin-user-main">
                  <div className="admin-user-name">{u.businessName || "Unnamed Business"}</div>
                  <div className="admin-user-meta">
                    {u.ownerName && <span>👤 {u.ownerName}</span>}
                    {u.phone && <span>📱 {u.phone}</span>}
                    <span>✉️ {u.email}</span>
                    {u.county && <span>📍 {u.county}{u.subcounty ? `, ${u.subcounty}` : ""}</span>}
                    {u.referrer && <span>🤝 Ref: {u.referrer}</span>}
                  </div>
                  <div className="admin-user-expiry">
                    Expires: <strong>{expiryLabel(u)}</strong>
                  </div>
                </div>
                <div className="admin-user-right">
                  {statusBadge(u)}
                </div>
              </div>
              <div className="admin-user-actions">
                <button className="admin-btn admin-btn-green" onClick={() => extend(u, 1)}>
                  +30 days
                </button>
                <button className="admin-btn admin-btn-blue" onClick={() => extend(u, 3)}>
                  +3 months
                </button>
                <button className="admin-btn admin-btn-red" onClick={() => suspend(u)}>
                  Suspend
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferrerBreakdown({ users }) {
  const counts = {};
  users.forEach(u => {
    const r = u.referrer || "Direct";
    counts[r] = (counts[r] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  return (
    <div className="admin-referrer-box">
      <div className="admin-referrer-title">🤝 Referral Breakdown</div>
      <div className="admin-referrer-list">
        {sorted.map(([ref, count]) => (
          <div key={ref} className="admin-referrer-row">
            <span className="admin-referrer-name">{ref}</span>
            <span className="admin-referrer-count">{count} user{count !== 1 ? "s" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
