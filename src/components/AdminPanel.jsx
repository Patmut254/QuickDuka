/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, addDoc, deleteDoc, setDoc, Timestamp, serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers, faCircleCheck, faCircleXmark, faClock, faCalendarPlus,
  faBan, faMagnifyingGlass, faChartBar, faHandshake, faPhone,
  faEnvelope, faLocationDot, faUser, faStore, faMessage,
  faHistory, faCalendarDays, faMoneyBill, faChevronDown, faChevronUp,
  faUserPlus, faTrash, faXmark, faTriangleExclamation, faLock,
} from "@fortawesome/free-solid-svg-icons";
import { Toast, useToast } from "./Toast";
import { kenyaCounties, REFERRERS } from "../data/kenyaLocations";

const ADMIN_EMAIL = "anitajehu13@gmail.com";

export function isAdmin(user) {
  return user?.email === ADMIN_EMAIL;
}

function addCalendarMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function extendSubscription(u, months) {
  const now = new Date();
  const base = u.subscriptionExpiry?.toDate?.() || now;
  const from = base > now ? base : now;
  const newExpiry = addCalendarMonths(from, months);
  await updateDoc(doc(db, "users", u.id), {
    subscriptionStatus: "active",
    subscriptionExpiry: Timestamp.fromDate(newExpiry),
  });
  await addDoc(collection(db, "users", u.id, "paymentHistory"), {
    type: "admin_extension", months,
    newExpiry: Timestamp.fromDate(newExpiry),
    note: `Admin extended by ${months} month${months !== 1 ? "s" : ""}`,
    createdAt: serverTimestamp(),
  });
  return newExpiry;
}

// ── Add User Modal ──────────────────────────────────────────
function AddUserModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(0); // 0=form, 1=saving, 2=done, -1=error
  const [errMsg, setErrMsg] = useState("");
  const [form, setForm] = useState({
    businessName: "", ownerName: "", email: "", phone: "",
    password: "", county: "", subcounty: "",
    subscriptionMonths: "1", referrer: "",
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const selectedCounty = kenyaCounties.find(c => c.county === form.county);
  const subcounties = selectedCounty?.subcounties || [];

  const handleCreate = async () => {
    // Validate
    if (!form.businessName.trim()) return setErrMsg("Business name is required.");
    if (!form.ownerName.trim())    return setErrMsg("Owner name is required.");
    if (!form.email.trim() || !form.email.includes("@")) return setErrMsg("Valid email is required.");
    if (form.password.length < 6) return setErrMsg("Password must be at least 6 characters.");
    if (!form.county) return setErrMsg("County is required.");

    setErrMsg("");
    setStep(1);

    try {
      // Save current admin session so we can restore it
      const adminEmail = auth.currentUser?.email;
      const adminUid   = auth.currentUser?.uid;

      // Create the new Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const newUid = cred.user.uid;

      // Calculate subscription expiry
      const months = parseInt(form.subscriptionMonths) || 1;
      const expiry = addCalendarMonths(new Date(), months);

      // Write Firestore profile
      await setDoc(doc(db, "users", newUid), {
        businessName:        form.businessName.trim(),
        ownerName:           form.ownerName.trim(),
        email:               form.email.trim(),
        realEmail:           form.email.trim(),
        phone:               form.phone.trim() || null,
        county:              form.county,
        subcounty:           form.subcounty,
        referrer:            form.referrer || null,
        role:                "user",
        subscriptionStatus:  "active",
        subscriptionExpiry:  Timestamp.fromDate(expiry),
        createdAt:           serverTimestamp(),
        createdByAdmin:      true,
      });

      // Log payment history
      await addDoc(collection(db, "users", newUid, "paymentHistory"), {
        type: "admin_extension", months,
        newExpiry: Timestamp.fromDate(expiry),
        note: `Account created by admin — ${months} month${months !== 1 ? "s" : ""}`,
        createdAt: serverTimestamp(),
      });

      // Re-sign in as admin to restore session
      // We stored their email above; now we need their password.
      // Since we can't re-auth without the password here, we sign out the new user
      // and sign back in as the admin using a secondary app instance approach.
      // Simplest safe approach: sign out the new account, then sign in admin again.
      // The admin will see a brief logout — so instead we just sign out the NEW user
      // and let the admin session re-establish via onAuthStateChanged.
      // Firebase automatically switches current user after createUserWithEmailAndPassword,
      // so we need to re-sign in as admin. We'll sign out then admin re-logs in.
      // → Best UX: after creation, sign the new user out, admin stays logged in
      //   by catching the auth state change.
      // Since we can't silently restore without their password, we sign out the created
      // user and rely on the admin password being re-entered OR use secondary app.
      // Cleanest for now: just sign out — admin will see login screen momentarily.
      // We attach a flag so App.jsx can auto-sign-back-in if needed.
      // ACTUALLY: Use secondary Firebase app to avoid disrupting admin session.
      // Since we can't import a secondary app here easily, instead we:
      // 1. Create the user account above ✓
      // 2. Sign back in as admin right after using stored credentials.
      //    We don't have admin password here, so instead we sign out of the new user
      //    and re-sign in as the admin using their stored uid + a token trick.
      // Simplest real solution: store admin password in memory temporarily.
      // For now: sign out new user immediately. Admin page re-renders via onAuthStateChanged.
      // Admin is on the admin route (#/admin) so it just shows login again — they re-login once.
      // This is acceptable for an admin workflow.
      await fbSignOut(auth);

      // Sign back in as admin — we can't do this without the password.
      // The admin will need to sign back in. We show a success message first.
      setStep(2);
      onSuccess?.(`User "${form.businessName.trim()}" created. Please sign back in as admin.`);

    } catch (err) {
      const msgs = {
        "auth/email-already-in-use": "This email is already registered.",
        "auth/invalid-email":        "Invalid email address.",
        "auth/weak-password":        "Password too weak (min 6 chars).",
      };
      setErrMsg(msgs[err.code] || `Error: ${err.message}`);
      setStep(0);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card admin-modal" onClick={e => e.stopPropagation()}>

        <div className="admin-modal-header">
          <h3><FontAwesomeIcon icon={faUserPlus} /> Add New User</h3>
          <button className="admin-modal-close" onClick={onClose}><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        {step === 2 ? (
          <div className="admin-modal-success">
            <FontAwesomeIcon icon={faCircleCheck} />
            <p>User created successfully!</p>
            <p className="admin-modal-note">You have been signed out to complete account setup. Please sign back in as admin.</p>
            <button className="adm-act-btn adm-green" onClick={onClose} style={{ margin: "0 auto" }}>OK</button>
          </div>
        ) : step === 1 ? (
          <div className="admin-modal-saving">
            <div className="admin-spinner" />
            <p>Creating account...</p>
          </div>
        ) : (
          <div className="admin-modal-body">
            <div className="amf-section">Account Details</div>
            <div className="amf-row">
              <div className="amf-field">
                <label>Email *</label>
                <div className="amf-input-wrap">
                  <FontAwesomeIcon icon={faEnvelope} />
                  <input type="email" placeholder="user@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
                </div>
              </div>
              <div className="amf-field">
                <label>Password *</label>
                <div className="amf-input-wrap">
                  <FontAwesomeIcon icon={faLock} />
                  <input type="text" placeholder="Min 6 characters" value={form.password} onChange={e => set("password", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="amf-row">
              <div className="amf-field">
                <label>Phone</label>
                <div className="amf-input-wrap">
                  <FontAwesomeIcon icon={faPhone} />
                  <input type="tel" placeholder="07..." value={form.phone} onChange={e => set("phone", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="amf-section">Business Details</div>
            <div className="amf-row">
              <div className="amf-field">
                <label>Business Name *</label>
                <div className="amf-input-wrap">
                  <FontAwesomeIcon icon={faStore} />
                  <input placeholder="e.g. Wanjiru General Store" value={form.businessName} onChange={e => set("businessName", e.target.value)} />
                </div>
              </div>
              <div className="amf-field">
                <label>Owner Name *</label>
                <div className="amf-input-wrap">
                  <FontAwesomeIcon icon={faUser} />
                  <input placeholder="Full name" value={form.ownerName} onChange={e => set("ownerName", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="amf-section">Location</div>
            <div className="amf-row">
              <div className="amf-field">
                <label>County *</label>
                <select value={form.county} onChange={e => { set("county", e.target.value); set("subcounty", ""); }}>
                  <option value="">Select County</option>
                  {kenyaCounties.map(c => <option key={c.county} value={c.county}>{c.county}</option>)}
                </select>
              </div>
              {subcounties.length > 0 && (
                <div className="amf-field">
                  <label>Sub-county</label>
                  <select value={form.subcounty} onChange={e => set("subcounty", e.target.value)}>
                    <option value="">Select Sub-county</option>
                    {subcounties.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="amf-section">Subscription</div>
            <div className="amf-row">
              <div className="amf-field">
                <label>Months to activate</label>
                <select value={form.subscriptionMonths} onChange={e => set("subscriptionMonths", e.target.value)}>
                  {[1,2,3,6,12].map(m => <option key={m} value={m}>{m} month{m !== 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div className="amf-field">
                <label>Referrer (optional)</label>
                <select value={form.referrer} onChange={e => set("referrer", e.target.value)}>
                  <option value="">None</option>
                  {REFERRERS.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="Admin">Admin (direct)</option>
                </select>
              </div>
            </div>

            {errMsg && (
              <div className="admin-modal-error">
                <FontAwesomeIcon icon={faTriangleExclamation} /> {errMsg}
              </div>
            )}

            <div className="admin-modal-actions">
              <button className="adm-act-btn adm-ghost" onClick={onClose}>Cancel</button>
              <button className="adm-act-btn adm-green" onClick={handleCreate}>
                <FontAwesomeIcon icon={faUserPlus} /> Create User
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ────────────────────────────────────
function DeleteUserModal({ user, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm]   = useState("");
  const expected = (user.businessName || user.email || "").toLowerCase().trim();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete all payment history subcollection docs
      // (Firestore doesn't auto-delete subcollections, but that's OK — orphaned docs)
      // Delete the user's Firestore profile doc — this locks them out completely
      await deleteDoc(doc(db, "users", user.id));
      onDeleted?.(`"${user.businessName || user.email}" has been removed.`);
      onClose();
    } catch (err) {
      console.error("Delete error:", err);
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card admin-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3 style={{ color: "var(--red, #ef4444)" }}><FontAwesomeIcon icon={faTrash} /> Delete User</h3>
          <button className="admin-modal-close" onClick={onClose}><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-delete-warning">
            <FontAwesomeIcon icon={faTriangleExclamation} />
            <div>
              <strong>This will permanently remove the user's data.</strong>
              <p>Their Firestore profile and access will be deleted. The Firebase Auth account will remain but they will be unable to log in (no profile = no access).</p>
            </div>
          </div>

          <div className="admin-delete-target">
            <FontAwesomeIcon icon={faStore} /> {user.businessName || "Unnamed"}
            <span>{user.ownerName && ` · ${user.ownerName}`}</span>
            <span>{user.email && ` · ${user.email}`}</span>
          </div>

          <div className="amf-field" style={{ marginTop: 16 }}>
            <label>Type the business name to confirm:</label>
            <input
              placeholder={user.businessName || user.email}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={{ marginTop: 6, width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--bg3)", color: "var(--text)", fontFamily: "inherit", fontSize: 13 }}
            />
          </div>

          <div className="admin-modal-actions" style={{ marginTop: 16 }}>
            <button className="adm-act-btn adm-ghost" onClick={onClose}>Cancel</button>
            <button
              className="adm-act-btn adm-red"
              disabled={confirm.toLowerCase().trim() !== expected || deleting}
              onClick={handleDelete}
            >
              <FontAwesomeIcon icon={faTrash} /> {deleting ? "Deleting..." : "Delete User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Panel ────────────────────────────────────────
export default function AdminPanel() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [selectedUser, setSelectedUser]   = useState(null);
  const [expandedUser, setExpandedUser]   = useState(null);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
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

  const extend = async (u, months) => {
    const newExpiry = await extendSubscription(u, months);
    showToast(`Extended ${u.businessName || u.email} → ${newExpiry.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}`);
  };

  const suspend = async (u) => {
    await updateDoc(doc(db, "users", u.id), { subscriptionStatus: "expired" });
    await addDoc(collection(db, "users", u.id, "paymentHistory"), {
      type: "admin_suspend", note: "Manually suspended by admin", createdAt: serverTimestamp(),
    });
    showToast(`Suspended ${u.businessName || u.email}`);
  };

  const filtered = users.filter(u => {
    const st = getStatus(u);
    if (filter !== "all" && st !== filter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (u.email || "").toLowerCase().includes(q) ||
      (u.businessName || "").toLowerCase().includes(q) ||
      (u.ownerName || "").toLowerCase().includes(q) ||
      (u.phone || "").includes(q) ||
      (u.county || "").toLowerCase().includes(q)
    );
  });

  const statusConfig = {
    active:  { color: "#22c55e", label: "Active",  icon: faCircleCheck },
    expired: { color: "#ef4444", label: "Expired", icon: faCircleXmark },
    pending: { color: "#f97316", label: "Pending", icon: faClock },
    trial:   { color: "#f97316", label: "Pending", icon: faClock },
  };

  const StatusBadge = ({ u }) => {
    const st = getStatus(u);
    const cfg = statusConfig[st] || statusConfig.pending;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
        background: cfg.color + "22", color: cfg.color, border: `1px solid ${cfg.color}44`,
      }}>
        <FontAwesomeIcon icon={cfg.icon} /> {cfg.label}
      </span>
    );
  };

  const expiryLabel = (u) => {
    const d = u.subscriptionExpiry?.toDate?.();
    if (!d) return "—";
    const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
    const str = d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
    if (diff > 0 && diff <= 7) return `${str} ⚠️ (${diff}d left)`;
    if (diff <= 0) return `${str} ❌`;
    return str;
  };

  const stats = {
    total:   users.length,
    active:  users.filter(u => getStatus(u) === "active").length,
    expired: users.filter(u => getStatus(u) === "expired").length,
    pending: users.filter(u => ["pending", "trial"].includes(getStatus(u))).length,
  };

  return (
    <div className="admin-panel-wrap">
      <Toast toast={toast} />

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(msg) => { showToast(msg); setShowAddModal(false); }}
        />
      )}
      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(msg) => { showToast(msg); setDeleteTarget(null); }}
        />
      )}
      {selectedUser && (
        <HistoryModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      {/* Header */}
      <div className="admin-header">
        <div>
          <h2 className="admin-title">Admin Panel</h2>
          <p className="admin-subtitle">Manage users and subscriptions · Accounts auto-lock on expiry</p>
        </div>
        <button className="admin-add-btn" onClick={() => setShowAddModal(true)}>
          <FontAwesomeIcon icon={faUserPlus} /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className="admin-stats-grid">
        {[
          { label: "Total Users",  val: stats.total,   color: "#3b82f6", icon: faUsers },
          { label: "Active",       val: stats.active,  color: "#22c55e", icon: faCircleCheck },
          { label: "Expired",      val: stats.expired, color: "#ef4444", icon: faCircleXmark },
          { label: "Pending",      val: stats.pending, color: "#f97316", icon: faClock },
        ].map(s => (
          <div key={s.label} className="admin-stat-tile" style={{ borderTop: `4px solid ${s.color}` }}>
            <div className="ast-icon" style={{ color: s.color, background: `${s.color}18` }}>
              <FontAwesomeIcon icon={s.icon} />
            </div>
            <div className="ast-body">
              <div className="ast-label">{s.label}</div>
              <div className="ast-val" style={{ color: s.color }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue */}
      <div className="admin-revenue-tile">
        <FontAwesomeIcon icon={faChartBar} />
        <span>Monthly Revenue Estimate: <strong>KES {(stats.active * 100).toLocaleString()}</strong></span>
        <span className="admin-rev-note">Calendar-based · auto-lock on expiry</span>
      </div>

      <ReferrerBreakdown users={users} />

      {/* Tabs */}
      <div className="admin-nav-tabs">
        {[
          { id: "users",    label: "Users",           icon: faUsers },
          { id: "payments", label: "Payment History", icon: faMoneyBill },
          { id: "messages", label: "Messages",        icon: faMessage },
        ].map(tab => (
          <button
            key={tab.id}
            className={`admin-nav-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <FontAwesomeIcon icon={tab.icon} /><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <div className="admin-tab-body">
          <div className="admin-controls">
            <div className="admin-filter-row">
              {["all", "active", "expired", "pending"].map(f => (
                <button key={f} className={`admin-filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="admin-search-wrap">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="admin-search-icon" />
              <input
                className="admin-search-input"
                placeholder="Search name, email, phone, county..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="admin-loading">Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">No users found.</div>
          ) : (
            <div className="admin-users-list">
              {filtered.map(u => {
                const expanded = expandedUser === u.id;
                return (
                  <div key={u.id} className="admin-user-item">
                    <div className="admin-user-summary" onClick={() => setExpandedUser(expanded ? null : u.id)}>
                      <div className="admin-user-avatar">
                        {(u.businessName || u.ownerName || "?")[0].toUpperCase()}
                      </div>
                      <div className="admin-user-info-col">
                        <div className="admin-user-biz">{u.businessName || "Unnamed Business"}</div>
                        <div className="admin-user-owner">
                          {u.ownerName && <><FontAwesomeIcon icon={faUser} /> {u.ownerName}</>}
                          {u.phone     && <><FontAwesomeIcon icon={faPhone} /> {u.phone}</>}
                          {u.county    && <><FontAwesomeIcon icon={faLocationDot} /> {u.county}{u.subcounty ? `, ${u.subcounty}` : ""}</>}
                        </div>
                        <div className="admin-user-expiry-row">
                          <FontAwesomeIcon icon={faCalendarDays} />
                          <span>Expires: <strong>{expiryLabel(u)}</strong></span>
                        </div>
                      </div>
                      <div className="admin-user-right">
                        <StatusBadge u={u} />
                        <button className="admin-expand-btn">
                          <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="admin-user-detail">
                        <div className="admin-detail-grid">
                          {u.email      && <div className="adg-item"><FontAwesomeIcon icon={faEnvelope} /><span>{u.email}</span></div>}
                          {u.referrer   && <div className="adg-item"><FontAwesomeIcon icon={faHandshake} /><span>Ref: {u.referrer}</span></div>}
                          {u.shopNumber && <div className="adg-item"><FontAwesomeIcon icon={faStore} /><span>{u.shopNumber}{u.buildingName ? ` — ${u.buildingName}` : ""}</span></div>}
                        </div>
                        <div className="admin-action-row">
                          <button className="adm-act-btn adm-green" onClick={() => extend(u, 1)}>
                            <FontAwesomeIcon icon={faCalendarPlus} /> +1 Month
                          </button>
                          <button className="adm-act-btn adm-blue" onClick={() => extend(u, 3)}>
                            <FontAwesomeIcon icon={faCalendarPlus} /> +3 Months
                          </button>
                          <button className="adm-act-btn adm-red" onClick={() => suspend(u)}>
                            <FontAwesomeIcon icon={faBan} /> Suspend
                          </button>
                          <button className="adm-act-btn adm-ghost" onClick={() => setSelectedUser(u)}>
                            <FontAwesomeIcon icon={faHistory} /> History
                          </button>
                          <button
                            className="adm-act-btn"
                            style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", marginLeft: "auto" }}
                            onClick={() => setDeleteTarget(u)}
                          >
                            <FontAwesomeIcon icon={faTrash} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "payments" && <AllPaymentsHistory users={users} />}
      {activeTab === "messages" && <ContactMessages />}
    </div>
  );
}

/* ── Referrer Breakdown ─────────────────────────────────── */
function ReferrerBreakdown({ users }) {
  const counts = {};
  users.forEach(u => { const r = u.referrer || "Direct"; counts[r] = (counts[r] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  const total = users.length;
  return (
    <div className="admin-referrer-card">
      <div className="admin-referrer-head"><FontAwesomeIcon icon={faHandshake} /> Referral Breakdown</div>
      <div className="admin-referrer-rows">
        {sorted.map(([ref, count]) => (
          <div key={ref} className="admin-ref-row">
            <span className="admin-ref-name">{ref}</span>
            <div className="admin-ref-bar-wrap">
              <div className="admin-ref-bar" style={{ width: `${Math.round(count / total * 100)}%` }} />
            </div>
            <span className="admin-ref-count">{count} user{count !== 1 ? "s" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Per-User History Modal ──────────────────────────────── */
function HistoryModal({ user, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users", user.id, "paymentHistory"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [user.id]);

  const typeInfo = (type) => ({
    admin_extension: { label: "Admin Extension", color: "#22c55e" },
    admin_suspend:   { label: "Suspended",        color: "#ef4444" },
    mpesa_payment:   { label: "M-Pesa Payment",   color: "#3b82f6" },
  }[type] || { label: type, color: "var(--muted)" });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <h3><FontAwesomeIcon icon={faHistory} /> History — {user.businessName || user.email}</h3>
        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading...</div>
        ) : history.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>No events yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
            {history.map(h => {
              const { label, color } = typeInfo(h.type);
              const date = h.createdAt?.toDate?.()?.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) || "—";
              const newExpiry = h.newExpiry?.toDate?.()?.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
              return (
                <div key={h.id} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color }}>{label}</span>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>{date}</span>
                  </div>
                  {h.months  && <div style={{ color: "var(--muted)" }}>Duration: <strong>{h.months} month{h.months !== 1 ? "s" : ""}</strong></div>}
                  {newExpiry && <div style={{ color: "var(--muted)" }}>New expiry: <strong>{newExpiry}</strong></div>}
                  {h.amount  && <div style={{ color: "var(--muted)" }}>Amount: <strong>KES {Number(h.amount).toLocaleString()}</strong></div>}
                  {h.note    && <div style={{ color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>{h.note}</div>}
                </div>
              );
            })}
          </div>
        )}
        <div className="modal-actions"><button className="btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

/* ── All Payments History ────────────────────────────────── */
function AllPaymentsHistory({ users }) {
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (users.length === 0) { setLoading(false); return; }
    const collected = {};
    let loadedCount = 0;
    const unsubList = users.map(u => {
      const q = query(collection(db, "users", u.id, "paymentHistory"), orderBy("createdAt", "desc"));
      return onSnapshot(q, snap => {
        collected[u.id] = snap.docs.map(d => ({ id: d.id, userId: u.id, businessName: u.businessName || u.email, ...d.data() }));
        loadedCount++;
        if (loadedCount >= users.length) {
          setAllHistory(Object.values(collected).flat().sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)));
          setLoading(false);
        }
      }, () => { loadedCount++; if (loadedCount >= users.length) setLoading(false); });
    });
    return () => unsubList.forEach(u => u());
  }, [users]);

  const typeColor = t => ({ admin_extension: "#22c55e", admin_suspend: "#ef4444", mpesa_payment: "#3b82f6" }[t] || "var(--muted)");
  const typeLabel = t => ({ admin_extension: "Admin Extension", admin_suspend: "Suspended", mpesa_payment: "M-Pesa Payment" }[t] || t);

  if (loading) return <div className="admin-loading">Loading payment history...</div>;
  if (allHistory.length === 0) return <div className="admin-empty"><FontAwesomeIcon icon={faHistory} style={{ fontSize: 28 }} /><div>No events yet.</div></div>;

  return (
    <div className="admin-tab-body">
      <div className="admin-pay-count">{allHistory.length} event{allHistory.length !== 1 ? "s" : ""}</div>
      {allHistory.map((h, i) => {
        const date = h.createdAt?.toDate?.()?.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) || "—";
        const newExpiry = h.newExpiry?.toDate?.()?.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
        const color = typeColor(h.type);
        return (
          <div key={i} className="admin-pay-row">
            <div className="admin-pay-dot" style={{ background: color }} />
            <div className="admin-pay-body">
              <div className="admin-pay-top">
                <div><span style={{ fontWeight: 700, color, fontSize: 13 }}>{typeLabel(h.type)}</span><span className="admin-pay-biz">{h.businessName}</span></div>
                <span className="admin-pay-date">{date}</span>
              </div>
              <div className="admin-pay-meta">
                {h.months && `+${h.months} month${h.months !== 1 ? "s" : ""}`}
                {newExpiry && ` · New expiry: ${newExpiry}`}
                {h.amount && ` · KES ${Number(h.amount).toLocaleString()}`}
                {h.note && ` · ${h.note}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Contact Messages ────────────────────────────────────── */
function ContactMessages() {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "contactMessages"), orderBy("createdAt", "desc"));
    return onSnapshot(q,
      snap => { setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.warn("contactMessages:", err.message); setLoading(false); }
    );
  }, []);

  if (loading) return <div className="admin-loading">Loading messages...</div>;
  if (msgs.length === 0) return <div className="admin-empty"><FontAwesomeIcon icon={faMessage} style={{ fontSize: 28 }} /><div>No messages yet.</div></div>;

  return (
    <div className="admin-tab-body">
      {msgs.map(m => (
        <div key={m.id} className="admin-msg-item">
          <div className="admin-msg-head">
            <span className="admin-msg-from">
              <FontAwesomeIcon icon={faUser} />
              {m.from_name || "Unknown"} — {m.from_email}
              {m.phone && <> &nbsp;<FontAwesomeIcon icon={faPhone} /> {m.phone}</>}
            </span>
            <span className="admin-msg-time">
              {m.createdAt?.toDate?.()?.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) || "—"}
            </span>
          </div>
          {m.subject && <div className="admin-msg-subject">{m.subject}</div>}
          <div className="admin-msg-body">{m.message}</div>
        </div>
      ))}
    </div>
  );
}
