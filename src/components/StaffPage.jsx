/**
 * StaffPage — Staff account management for Growth and Business plan owners.
 *
 * What this does:
 * - Owner creates real Firebase Auth accounts for staff members
 * - Staff get a Firestore profile with role:"staff" + ownerUid pointing back to owner
 * - Staff log in and enter sales — those sales are tagged with ownerUid
 *   so the owner sees them alongside their own sales
 * - Owner can deactivate or remove staff at any time
 *
 * Uses a secondary Firebase app so creating a staff account never
 * interrupts the owner's current auth session.
 */
import { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth, getSecondaryApp } from "../firebase";
import { FontAwesomeIcon } from "./Icon";
import {
  faUserPlus,
  faUsers,
  faTrash,
  faToggleOn,
  faToggleOff,
  faSpinner,
  faPhone,
  faEnvelope,
  faBriefcase,
  faKey,
  faInfoCircle,
  faEye,
  faEyeSlash,
  faCheckCircle,
  faStore,
} from "@fortawesome/free-solid-svg-icons";
import FeatureGate from "./FeatureGate";

const db = getFirestore();

const ROLES = [
  "Cashier",
  "Sales Assistant",
  "Inventory Manager",
  "Branch Manager",
  "Delivery",
  "Other",
];

//  Add Staff Form
function StaffForm({
  ownerProfile,
  ownerUid,
  onAdded,
  onCancel,
  branches = [],
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErr("Full name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErr("A valid email is required for login.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    setErr("");

    try {
      // Use secondary Firebase app so owner session is never interrupted
      const secondaryApp = getSecondaryApp();
      const secondaryAuth = getAuth(secondaryApp);
      const secondaryDb = getFirestore(secondaryApp);

      // 1. Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim(),
        password,
      );
      const staffUid = cred.user.uid;

      // 2. Immediately sign out from secondary app
      await fbSignOut(secondaryAuth);

      const selectedBranch = branches.find((b) => b.id === branchId) || null;

      // 3. Write staff's Firestore profile
      await setDoc(doc(secondaryDb, "users", staffUid), {
        email: email.trim(),
        ownerName: name.trim(),
        businessName: ownerProfile?.businessName || "",
        role: "staff",
        staffRole: role,
        phone: phone.trim() || null,
        ownerUid,
        branchId: selectedBranch?.id || null,
        branchName: selectedBranch?.name || null,
        // Inherit owner's subscription so the subscription gate passes
        subscriptionStatus: ownerProfile?.subscriptionStatus || "active",
        subscriptionPlan: ownerProfile?.subscriptionPlan || "starter",
        subscriptionExpiry: ownerProfile?.subscriptionExpiry || null,
        active: true,
        createdAt: serverTimestamp(),
      });

      // 4. Record in owner's staff subcollection for the list view
      await setDoc(doc(db, "users", ownerUid, "staff", staffUid), {
        staffUid,
        name: name.trim(),
        role,
        phone: phone.trim() || null,
        email: email.trim(),
        branchId: selectedBranch?.id || null,
        branchName: selectedBranch?.name || null,
        active: true,
        addedAt: serverTimestamp(),
      });

      setDone(true);
      setTimeout(() => {
        onAdded();
      }, 2500);
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use":
          "This email is already registered. Use a different email.",
        "auth/invalid-email": "Invalid email address.",
        "auth/weak-password": "Password too weak (min 6 characters).",
      };
      setErr(msgs[e.code] || "Failed to create account: " + e.message);
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div
        style={{
          background: "var(--bg2)",
          border: "1.5px solid var(--border)",
          borderRadius: 0,
          padding: "24px 20px",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        <FontAwesomeIcon
          icon={faCheckCircle}
          style={{
            fontSize: 28,
            color: "var(--green, #29573f)",
            marginBottom: 10,
          }}
        />
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: "var(--text)",
            marginBottom: 6,
          }}
        >
          Account created for {name}!
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
          They can now log in with <strong>{email}</strong>
          <br />
          and the password you set.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1.5px solid var(--border)",
        borderRadius: 0,
        padding: "20px 20px 18px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 14,
          color: "var(--text)",
        }}
      >
        <FontAwesomeIcon
          icon={faUserPlus}
          style={{ marginRight: 7, color: "var(--accent)" }}
        />
        Add Staff Member
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 16px",
        }}
      >
        <div className="field-group" style={{ margin: 0 }}>
          <label>Full Name *</label>
          <input
            type="text"
            placeholder="e.g. Amina Wangari"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field-group" style={{ margin: 0 }}>
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group" style={{ margin: 0 }}>
          <label>Login Email *</label>
          <div className="input-icon-wrap">
            <div className="input-icon-box">
              <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <input
              type="email"
              placeholder="staff@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="field-group" style={{ margin: 0 }}>
          <label>Phone (optional)</label>
          <div className="input-icon-wrap">
            <div className="input-icon-box">
              <FontAwesomeIcon icon={faPhone} />
            </div>
            <input
              type="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        {branches.length > 0 && (
          <div className="field-group" style={{ margin: 0 }}>
            <label>Assign to Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">No branch assigned</option>
              {branches
                .filter((b) => b.active)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div
          className="field-group"
          style={{ margin: 0, gridColumn: "1 / -1" }}
        >
          <label>Login Password *</label>
          <div className="input-icon-wrap">
            <div className="input-icon-box">
              <FontAwesomeIcon icon={faKey} />
            </div>
            <input
              type={showPw ? "text" : "password"}
              placeholder="Min 6 characters"
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
          <span className="field-hint">
            Share this password with your staff member. They use it to log in.
          </span>
        </div>
      </div>

      {err && (
        <div style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          {saving ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin /> Creating Account...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faUserPlus} /> Create Staff Account
            </>
          )}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

//  Staff Card
function StaffCard({ member, onToggle, onDelete }) {
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    await onToggle(member.id, !member.active);
    setBusy(false);
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Remove ${member.name}? They will no longer be able to log in.`,
      )
    )
      return;
    setBusy(true);
    await onDelete(member.id, member.staffUid);
    setBusy(false);
  };

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1.5px solid var(--border)",
        borderRadius: 0,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: member.active ? 1 : 0.55,
        transition: "opacity .2s",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: member.active ? "var(--accent)18" : "var(--border)",
          border: `2px solid ${member.active ? "var(--accent)40" : "var(--border)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 16,
          color: member.active ? "var(--accent)" : "var(--muted)",
          flexShrink: 0,
        }}
      >
        {member.name?.[0]?.toUpperCase() || "?"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: "var(--text)",
            marginBottom: 2,
          }}
        >
          {member.name}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 12px",
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          <span>
            <FontAwesomeIcon
              icon={faBriefcase}
              style={{ marginRight: 4, fontSize: 10 }}
            />
            {member.role}
          </span>
          {member.branchName && (
            <span style={{ fontWeight: 600, color: "var(--accent)" }}>
              <FontAwesomeIcon
                icon={faStore}
                style={{ marginRight: 4, fontSize: 10 }}
              />
              {member.branchName}
            </span>
          )}
          {member.email && (
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 200,
              }}
            >
              <FontAwesomeIcon
                icon={faEnvelope}
                style={{ marginRight: 4, fontSize: 10 }}
              />
              {member.email}
            </span>
          )}
          {member.phone && (
            <span>
              <FontAwesomeIcon
                icon={faPhone}
                style={{ marginRight: 4, fontSize: 10 }}
              />
              {member.phone}
            </span>
          )}
        </div>
      </div>

      <span
        style={{
          padding: "2px 8px",
          borderRadius: 0,
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
          background: member.active ? "#29573f18" : "var(--border)",
          color: member.active ? "#29573f" : "var(--muted)",
          border: `1.5px solid ${member.active ? "#29573f40" : "var(--border)"}`,
        }}
      >
        {member.active ? "Active" : "Inactive"}
      </span>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          title={member.active ? "Deactivate" : "Activate"}
          onClick={handleToggle}
          disabled={busy}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 0,
            padding: "5px 9px",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            color: member.active ? "var(--accent)" : "var(--muted)",
          }}
        >
          <FontAwesomeIcon icon={member.active ? faToggleOn : faToggleOff} />
        </button>
        <button
          title="Remove staff"
          onClick={handleDelete}
          disabled={busy}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 0,
            padding: "5px 9px",
            cursor: "pointer",
            color: "var(--red)",
            fontSize: 13,
          }}
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    </div>
  );
}

//  Main Page
export default function StaffPage({ sub, profile, isAdmin = false }) {
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const uid = auth.currentUser?.uid;

  const fetchBranches = async () => {
    if (!uid || !sub?.can("multipleBranches")) return;
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", uid, "branches"),
          orderBy("createdAt", "asc"),
        ),
      );
      setBranches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      /* ok */
    }
  };

  const fetchStaff = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "users", uid, "staff"),
        orderBy("addedAt", "desc"),
      );
      const snap = await getDocs(q);
      setStaff(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => !m.deleted),
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchBranches();
  }, [uid]);

  const handleToggle = async (docId, active) => {
    const member = staff.find((m) => m.id === docId);
    await updateDoc(doc(db, "users", uid, "staff", docId), { active });
    if (member?.staffUid) {
      try {
        await updateDoc(doc(db, "users", member.staffUid), { active });
      } catch {
        /* ok */
      }
    }
    setStaff((prev) =>
      prev.map((m) => (m.id === docId ? { ...m, active } : m)),
    );
  };

  const handleDelete = async (docId, staffUid) => {
    await updateDoc(doc(db, "users", uid, "staff", docId), {
      active: false,
      deleted: true,
    });
    if (staffUid) {
      try {
        await updateDoc(doc(db, "users", staffUid), { active: false });
      } catch {
        /* ok */
      }
    }
    setStaff((prev) => prev.filter((m) => m.id !== docId));
  };

  const activeCount = staff.filter((m) => m.active).length;

  return (
    <FeatureGate
      feature="multipleUsers"
      sub={sub}
      lockedLabel="Team / Staff"
      forceAllow={isAdmin}
    >
      <div style={{ maxWidth: 700 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 18,
                color: "var(--text)",
                marginBottom: 3,
              }}
            >
              <FontAwesomeIcon
                icon={faUsers}
                style={{ marginRight: 8, color: "var(--accent)" }}
              />
              Team Members
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {loading
                ? "Loading..."
                : `${activeCount} active · ${staff.length} total`}
            </div>
          </div>
          {!showForm && (
            <button
              className="btn-primary"
              onClick={() => setShowForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              <FontAwesomeIcon icon={faUserPlus} /> Add Staff Member
            </button>
          )}
        </div>

        {staff.length === 0 && !showForm && (
          <div
            style={{
              background: "var(--accent)0a",
              border: "1.5px solid var(--accent)30",
              borderRadius: 0,
              padding: "14px 16px",
              marginBottom: 20,
              fontSize: 12,
              color: "var(--text)",
              lineHeight: 1.8,
            }}
          >
            <FontAwesomeIcon
              icon={faInfoCircle}
              style={{ color: "var(--accent)", marginRight: 7 }}
            />
            <strong>How staff accounts work:</strong>
            <ul
              style={{
                margin: "8px 0 0 18px",
                padding: 0,
                color: "var(--muted)",
              }}
            >
              <li>
                Each staff member gets their own login (email + password you
                set)
              </li>
              <li>
                They log in at the same app and see a simple sales entry screen
              </li>
              <li>
                Every sale they record appears in your Sales page instantly
              </li>
              <li>You can deactivate or remove a staff member at any time</li>
            </ul>
          </div>
        )}

        {showForm && (
          <StaffForm
            ownerProfile={profile}
            ownerUid={uid}
            branches={branches}
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
              padding: 40,
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />
            Loading team...
          </div>
        ) : staff.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              border: "1.5px dashed var(--border)",
              borderRadius: 0,
              background: "var(--bg2)",
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            <FontAwesomeIcon
              icon={faUsers}
              style={{
                fontSize: 28,
                marginBottom: 12,
                display: "block",
                opacity: 0.4,
              }}
            />
            No staff added yet. Click "Add Staff Member" to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {staff.map((member) => (
              <StaffCard
                key={member.id}
                member={member}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
