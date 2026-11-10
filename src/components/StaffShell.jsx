/* eslint-disable no-unused-vars */
/**
 * StaffShell — UI for staff accounts when they log in.
 *
 * All staff:
 *   - Enter sales tagged with ownerUid + branchId (owner & branch managers see them)
 *   - See today's own transactions
 *
 * Branch Manager role additionally:
 *   - See a "My Branch Staff" tab showing staff in their branch
 *   - Can add new staff to their branch (using secondary Firebase app,
 *     same pattern as owner StaffPage)
 *
 * Deactivated accounts show a locked screen.
 */
import { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { signOut } from "firebase/auth";
import { auth, getSecondaryApp } from "../firebase";
import { useCollection } from "../hooks/useCollection";
import { Toast, useToast } from "./Toast";
import { FontAwesomeIcon } from "./Icon";
import {
  faMoneyBillTrendUp,
  faRightFromBracket,
  faStore,
  faPlus,
  faBan,
  faUsers,
  faUserPlus,
  faSpinner,
  faPhone,
  faEnvelope,
  faBriefcase,
  faKey,
  faEye,
  faEyeSlash,
  faCheckCircle,
  faToggleOn,
  faToggleOff,
  faCodeBranch,
} from "@fortawesome/free-solid-svg-icons";

const db = getFirestore();

const STAFF_ROLES = ["Cashier", "Sales Assistant", "Delivery", "Other"];

//  Mini Add-Staff Form (Branch Manager only)
function MiniStaffForm({
  ownerUid,
  ownerProfile,
  branchId,
  branchName,
  onAdded,
  onCancel,
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(STAFF_ROLES[0]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErr("Name required.");
      return;
    }
    if (!email.includes("@")) {
      setErr("Valid email required.");
      return;
    }
    if (password.length < 6) {
      setErr("Password min 6 chars.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const secApp = getSecondaryApp();
      const secAuth = getAuth(secApp);
      const secDb = getFirestore(secApp);

      const cred = await createUserWithEmailAndPassword(
        secAuth,
        email.trim(),
        password,
      );
      const staffUid = cred.user.uid;
      await fbSignOut(secAuth);

      await setDoc(doc(secDb, "users", staffUid), {
        email: email.trim(),
        ownerName: name.trim(),
        businessName: ownerProfile?.businessName || "",
        role: "staff",
        staffRole: role,
        phone: phone.trim() || null,
        ownerUid,
        branchId,
        branchName,
        subscriptionStatus: ownerProfile?.subscriptionStatus || "active",
        subscriptionPlan: ownerProfile?.subscriptionPlan || "starter",
        subscriptionExpiry: ownerProfile?.subscriptionExpiry || null,
        active: true,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", ownerUid, "staff", staffUid), {
        staffUid,
        name: name.trim(),
        role,
        phone: phone.trim() || null,
        email: email.trim(),
        branchId,
        branchName,
        active: true,
        addedAt: serverTimestamp(),
      });

      setDone(true);
      setTimeout(() => onAdded(), 2000);
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use": "Email already registered.",
        "auth/weak-password": "Password too weak.",
      };
      setErr(msgs[e.code] || e.message);
      setSaving(false);
    }
  };

  if (done)
    return (
      <div
        style={{
          padding: "16px",
          textAlign: "center",
          background: "var(--bg2)",
          borderRadius: 0,
          marginBottom: 12,
        }}
      >
        <FontAwesomeIcon
          icon={faCheckCircle}
          style={{ color: "#29573f", fontSize: 22, marginBottom: 6 }}
        />
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          Account created for {name}!
        </div>
      </div>
    );

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1.5px solid var(--border)",
        borderRadius: 0,
        padding: "16px",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          marginBottom: 12,
          color: "var(--text)",
        }}
      >
        <FontAwesomeIcon
          icon={faUserPlus}
          style={{ marginRight: 6, color: "var(--accent)" }}
        />
        Add Staff to {branchName}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 14px",
        }}
      >
        {[
          {
            label: "Full Name *",
            val: name,
            set: setName,
            type: "text",
            placeholder: "Staff name",
          },
          {
            label: "Email *",
            val: email,
            set: setEmail,
            type: "email",
            placeholder: "staff@email.com",
          },
          {
            label: "Phone",
            val: phone,
            set: setPhone,
            type: "tel",
            placeholder: "07XX XXX XXX",
          },
        ].map(({ label, val, set, type, placeholder }) => (
          <div key={label} className="field-group" style={{ margin: 0 }}>
            <label>{label}</label>
            <input
              type={type}
              placeholder={placeholder}
              value={val}
              onChange={(e) => set(e.target.value)}
            />
          </div>
        ))}
        <div className="field-group" style={{ margin: 0 }}>
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div
          className="field-group"
          style={{ margin: 0, gridColumn: "1 / -1" }}
        >
          <label>Password *</label>
          <div className="input-icon-wrap">
            <div className="input-icon-box">
              <FontAwesomeIcon icon={faKey} />
            </div>
            <input
              type={showPw ? "text" : "password"}
              placeholder="Min 6 chars"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="pw-reveal"
              onClick={() => setShowPw((v) => !v)}
            >
              <FontAwesomeIcon icon={showPw ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>
      </div>
      {err && (
        <div style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>
          {err}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
          }}
        >
          {saving ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin /> Creating...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faUserPlus} /> Create Account
            </>
          )}
        </button>
        <button
          className="btn-secondary"
          onClick={onCancel}
          style={{ fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

//  Branch Staff Tab (Branch Manager only)
function BranchStaffTab({ ownerUid, ownerProfile, branchId, branchName }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchStaff = async () => {
    if (!ownerUid || !branchId) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", ownerUid, "staff"),
          orderBy("addedAt", "desc"),
        ),
      );
      setStaff(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.branchId === branchId && !s.deleted),
      );
    } catch {
      /* ok */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [ownerUid, branchId]);

  const handleToggle = async (docId, staffUid, active) => {
    await updateDoc(doc(db, "users", ownerUid, "staff", docId), { active });
    if (staffUid) {
      try {
        await updateDoc(doc(db, "users", staffUid), { active });
      } catch {
        /* ok */
      }
    }
    setStaff((prev) =>
      prev.map((s) => (s.id === docId ? { ...s, active } : s)),
    );
  };

  const activeCount = staff.filter((s) => s.active).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          {loading
            ? "Loading..."
            : `${activeCount} active · ${staff.length} total in ${branchName}`}
        </div>
        {!showForm && (
          <button
            className="btn-primary"
            onClick={() => setShowForm(true)}
            style={{
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <FontAwesomeIcon icon={faUserPlus} /> Add Staff
          </button>
        )}
      </div>

      {showForm && (
        <MiniStaffForm
          ownerUid={ownerUid}
          ownerProfile={ownerProfile}
          branchId={branchId}
          branchName={branchName}
          onAdded={() => {
            setShowForm(false);
            fetchStaff();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 6 }} />{" "}
          Loading...
        </div>
      ) : staff.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            border: "1.5px dashed var(--border)",
            borderRadius: 0,
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          No staff in this branch yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {staff.map((s) => (
            <div
              key={s.id}
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 0,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: s.active ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: s.active ? "var(--accent)18" : "var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 13,
                  color: s.active ? "var(--accent)" : "var(--muted)",
                }}
              >
                {s.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--text)",
                  }}
                >
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {s.role}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 0,
                  fontWeight: 700,
                  background: s.active ? "#29573f18" : "var(--border)",
                  color: s.active ? "#29573f" : "var(--muted)",
                }}
              >
                {s.active ? "Active" : "Inactive"}
              </span>
              <button
                onClick={() => handleToggle(s.id, s.staffUid, !s.active)}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 0,
                  padding: "4px 7px",
                  cursor: "pointer",
                  fontSize: 14,
                  color: s.active ? "var(--accent)" : "var(--muted)",
                }}
              >
                <FontAwesomeIcon icon={s.active ? faToggleOn : faToggleOff} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

//  Main StaffShell
export default function StaffShell({ user, profile }) {
  const ownerUid = profile?.ownerUid;
  const staffName = profile?.ownerName || user?.email || "Staff";
  const businessName = profile?.businessName || "Your Business";
  const branchName = profile?.branchName || null;
  const branchId = profile?.branchId || null;
  const isBranchManager = profile?.staffRole === "Branch Manager";
  const isActive = profile?.active !== false;

  const [activeTab, setActiveTab] = useState("sales");
  const { items, loading, addItem } = useCollection("sales");
  const { toast, showToast } = useToast();

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    description: "",
    customer: "",
    phone: "",
    amount: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    if (!form.description.trim() || !form.amount) return;
    setStatus("saving");
    try {
      await addItem(
        { ...form, amount: parseFloat(form.amount) },
        { ownerUid, staffName, branchId, branchName },
      );
      setStatus("saved");
      showToast("Sale recorded!");
      setTimeout(() => {
        setStatus("idle");
        setForm(emptyForm);
        setShowForm(false);
      }, 1500);
    } catch {
      setStatus("idle");
      showToast("Failed to save. Try again.", "error");
    }
  };

  const todaysSales = items.filter(
    (i) => i.date === new Date().toISOString().split("T")[0],
  );
  const todaysTotal = todaysSales.reduce(
    (s, i) => s + (Number(i.amount) || 0),
    0,
  );

  //  Deactivated
  if (!isActive) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <FontAwesomeIcon
          icon={faBan}
          style={{ fontSize: 40, color: "var(--red)", marginBottom: 16 }}
        />
        <div
          style={{
            fontWeight: 800,
            fontSize: 18,
            color: "var(--text)",
            marginBottom: 8,
          }}
        >
          Account Deactivated
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--muted)",
            maxWidth: 280,
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          Your account has been deactivated. Contact the business owner for
          assistance.
        </div>
        <button
          onClick={() => signOut(auth)}
          style={{
            background: "none",
            border: "1px solid var(--border2)",
            borderRadius: 0,
            padding: "8px 20px",
            color: "var(--muted)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
          }}
        >
          <FontAwesomeIcon
            icon={faRightFromBracket}
            style={{ marginRight: 7 }}
          />{" "}
          Sign Out
        </button>
      </div>
    );
  }

  //  Main UI
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Toast toast={toast} />

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: "var(--bg2)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo-icon.png" alt="QuickDuka" style={{ height: 28 }} />
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                color: "var(--text)",
                lineHeight: 1.2,
              }}
            >
              {businessName}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              <FontAwesomeIcon icon={faStore} style={{ marginRight: 4 }} />
              {staffName}
              {branchName && (
                <>
                  {" "}
                  ·{" "}
                  <FontAwesomeIcon
                    icon={faCodeBranch}
                    style={{ marginRight: 3 }}
                  />
                  {branchName}
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut(auth)}
          style={{
            background: "none",
            border: "1px solid var(--border2)",
            borderRadius: 0,
            padding: "6px 12px",
            color: "var(--muted)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
        </button>
      </header>

      {/* Tab bar — only Branch Managers see a second tab */}
      {isBranchManager && (
        <div
          style={{
            display: "flex",
            background: "var(--bg2)",
            borderBottom: "1px solid var(--border)",
            padding: "0 20px",
          }}
        >
          {[
            { id: "sales", label: "Sales", icon: faMoneyBillTrendUp },
            { id: "staff", label: "Branch Staff", icon: faUsers },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 18px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                borderBottom:
                  activeTab === tab.id
                    ? "2.5px solid var(--accent)"
                    : "2.5px solid transparent",
                color: activeTab === tab.id ? "var(--accent)" : "var(--muted)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FontAwesomeIcon icon={tab.icon} /> {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
        {/* Branch Staff Tab */}
        {isBranchManager && activeTab === "staff" && (
          <BranchStaffTab
            ownerUid={ownerUid}
            ownerProfile={profile}
            branchId={branchId}
            branchName={branchName}
          />
        )}

        {/* Sales Tab */}
        {activeTab === "sales" && (
          <>
            {/* Today's summary */}
            <div
              style={{
                background: "var(--accent)0d",
                border: "1.5px solid var(--accent)30",
                borderRadius: 0,
                padding: "16px 20px",
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  Today's Sales{branchName ? `: ${branchName}` : ""}
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 22,
                    color: "var(--accent)",
                  }}
                >
                  KES {todaysTotal.toLocaleString()}
                </div>
                <div
                  style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}
                >
                  {todaysSales.length} transaction
                  {todaysSales.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowForm((v) => !v);
                  setStatus("idle");
                }}
                style={{ display: "flex", alignItems: "center", gap: 7 }}
              >
                <FontAwesomeIcon icon={faPlus} />
                {showForm ? "Cancel" : "New Sale"}
              </button>
            </div>

            {/* Sale form */}
            {showForm && (
              <form
                className="entry-form"
                onSubmit={handleSubmit}
                style={{ marginBottom: 20 }}
              >
                <h3 style={{ marginTop: 0 }}>
                  <FontAwesomeIcon
                    icon={faMoneyBillTrendUp}
                    style={{ marginRight: 8, color: "var(--accent)" }}
                  />
                  Record a Sale
                </h3>
                <div className="form-grid">
                  {[
                    { label: "Date *", key: "date", type: "date" },
                    {
                      label: "Item / Description *",
                      key: "description",
                      type: "text",
                      placeholder: "What was sold?",
                    },
                    {
                      label: "Customer Name",
                      key: "customer",
                      type: "text",
                      placeholder: "Optional",
                    },
                    {
                      label: "Customer Phone",
                      key: "phone",
                      type: "tel",
                      placeholder: "07XX XXX XXX",
                    },
                    {
                      label: "Amount (KES) *",
                      key: "amount",
                      type: "number",
                      placeholder: "0.00",
                    },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key} className="field-group">
                      <label>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                        required={label.endsWith("*")}
                        min={key === "amount" ? "0" : undefined}
                        step={key === "amount" ? "0.01" : undefined}
                      />
                    </div>
                  ))}
                  <div className="field-group full-width">
                    <label>Notes</label>
                    <input
                      placeholder="Any extra info..."
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className={
                    "btn-primary" + (status === "saved" ? " btn-saved" : "")
                  }
                  disabled={status !== "idle"}
                >
                  {status === "saving"
                    ? "Saving..."
                    : status === "saved"
                      ? "Saved!"
                      : "Save Sale"}
                </button>
              </form>
            )}

            {/* Today's list */}
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: "var(--text)",
                  marginBottom: 10,
                }}
              >
                Today's Transactions
              </div>
              {loading ? (
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: 13,
                    padding: "20px 0",
                    textAlign: "center",
                  }}
                >
                  Loading...
                </div>
              ) : todaysSales.length === 0 ? (
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: 13,
                    padding: "24px",
                    textAlign: "center",
                    border: "1.5px dashed var(--border)",
                    borderRadius: 0,
                    background: "var(--bg2)",
                  }}
                >
                  No sales recorded today yet. Tap "New Sale" to start.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {todaysSales.map((sale) => (
                    <div
                      key={sale.id}
                      style={{
                        background: "var(--bg2)",
                        border: "1px solid var(--border)",
                        borderRadius: 0,
                        padding: "12px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: "var(--text)",
                          }}
                        >
                          {sale.description}
                        </div>
                        {sale.customer && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              marginTop: 2,
                            }}
                          >
                            {sale.customer}
                            {sale.phone ? ` · ${sale.phone}` : ""}
                          </div>
                        )}
                        {sale.notes && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              marginTop: 1,
                            }}
                          >
                            {sale.notes}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--accent)",
                          fontSize: 14,
                          flexShrink: 0,
                          marginLeft: 12,
                        }}
                      >
                        KES {Number(sale.amount).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
