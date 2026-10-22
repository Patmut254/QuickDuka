/* eslint-disable no-unused-vars */
/**
 * BranchesPage — Branch management for Business plan owners.
 *
 * Data model:
 *   users/{ownerUid}/branches/{branchId}
 *   { name, location, managerName, phone, active, createdAt }
 *
 * From this page the owner can:
 *   - Create branches
 *   - See which staff belong to each branch
 *   - Activate / deactivate a branch
 *   - See a live sales total per branch (queries sales where branchId matches)
 */
import { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { auth } from "../firebase";
import { FontAwesomeIcon } from "./Icon";
import {
  faCodeBranch,
  faPlus,
  faTrash,
  faToggleOn,
  faToggleOff,
  faSpinner,
  faPhone,
  faLocationDot,
  faUser,
  faMoneyBillTrendUp,
  faUsers,
  faCheckCircle,
  faStore,
} from "@fortawesome/free-solid-svg-icons";
import FeatureGate from "./FeatureGate";

const db = getFirestore();

//  Branch Form
function BranchForm({ ownerUid, onAdded, onCancel }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErr("Branch name is required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await addDoc(collection(db, "users", ownerUid, "branches"), {
        name: name.trim(),
        location: location.trim(),
        managerName: managerName.trim(),
        phone: phone.trim(),
        active: true,
        createdAt: serverTimestamp(),
      });
      setDone(true);
      setTimeout(() => onAdded(), 1500);
    } catch (e) {
      setErr("Failed to create branch: " + e.message);
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div
        style={{
          background: "var(--bg2)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "24px 20px",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        <FontAwesomeIcon
          icon={faCheckCircle}
          style={{ fontSize: 28, color: "#16a34a", marginBottom: 10 }}
        />
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
          Branch "{name}" created!
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius)",
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
          icon={faPlus}
          style={{ marginRight: 7, color: "var(--accent)" }}
        />
        New Branch
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px 16px",
        }}
      >
        <div className="field-group" style={{ margin: 0 }}>
          <label>Branch Name *</label>
          <input
            placeholder="e.g. Westlands Branch"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field-group" style={{ margin: 0 }}>
          <label>Location / Area</label>
          <div className="input-icon-wrap">
            <div className="input-icon-box">
              <FontAwesomeIcon icon={faLocationDot} />
            </div>
            <input
              placeholder="e.g. Westlands, Nairobi"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
        <div className="field-group" style={{ margin: 0 }}>
          <label>Branch Manager Name</label>
          <div className="input-icon-wrap">
            <div className="input-icon-box">
              <FontAwesomeIcon icon={faUser} />
            </div>
            <input
              placeholder="Optional"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
            />
          </div>
        </div>
        <div className="field-group" style={{ margin: 0 }}>
          <label>Branch Phone</label>
          <div className="input-icon-wrap">
            <div className="input-icon-box">
              <FontAwesomeIcon icon={faPhone} />
            </div>
            <input
              type="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
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
              <FontAwesomeIcon icon={faSpinner} spin /> Saving...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faPlus} /> Create Branch
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

//  Branch Card
function BranchCard({ branch, ownerUid, staffList, onToggle, onDelete }) {
  const [busy, setBusy] = useState(false);

  const branchStaff = staffList.filter(
    (s) => s.branchId === branch.id && !s.deleted,
  );
  const activeStaff = branchStaff.filter((s) => s.active);

  const handleToggle = async () => {
    setBusy(true);
    await onToggle(branch.id, !branch.active);
    setBusy(false);
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete branch "${branch.name}"? Staff assigned to it will not be deleted, but will lose their branch assignment.`,
      )
    )
      return;
    setBusy(true);
    await onDelete(branch.id);
    setBusy(false);
  };

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px 18px",
        opacity: branch.active ? 1 : 0.6,
        transition: "opacity .2s",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            flexShrink: 0,
            background: branch.active ? "var(--accent)18" : "var(--border)",
            border: `2px solid ${branch.active ? "var(--accent)40" : "var(--border)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: branch.active ? "var(--accent)" : "var(--muted)",
            fontSize: 18,
          }}
        >
          <FontAwesomeIcon icon={faStore} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: "var(--text)",
              marginBottom: 3,
            }}
          >
            {branch.name}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "3px 12px",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            {branch.location && (
              <span>
                <FontAwesomeIcon
                  icon={faLocationDot}
                  style={{ marginRight: 4, fontSize: 10 }}
                />
                {branch.location}
              </span>
            )}
            {branch.managerName && (
              <span>
                <FontAwesomeIcon
                  icon={faUser}
                  style={{ marginRight: 4, fontSize: 10 }}
                />
                {branch.managerName}
              </span>
            )}
            {branch.phone && (
              <span>
                <FontAwesomeIcon
                  icon={faPhone}
                  style={{ marginRight: 4, fontSize: 10 }}
                />
                {branch.phone}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              background: branch.active ? "#16a34a18" : "var(--border)",
              color: branch.active ? "#16a34a" : "var(--muted)",
              border: `1.5px solid ${branch.active ? "#16a34a40" : "var(--border)"}`,
            }}
          >
            {branch.active ? "Active" : "Inactive"}
          </span>
          <button
            title={branch.active ? "Deactivate" : "Activate"}
            onClick={handleToggle}
            disabled={busy}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "5px 9px",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              color: branch.active ? "var(--accent)" : "var(--muted)",
            }}
          >
            <FontAwesomeIcon icon={branch.active ? faToggleOn : faToggleOff} />
          </button>
          <button
            title="Delete branch"
            onClick={handleDelete}
            disabled={busy}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
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

      {/* Staff summary */}
      <div
        style={{
          display: "flex",
          gap: 16,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          fontSize: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--muted)",
          }}
        >
          <FontAwesomeIcon icon={faUsers} style={{ color: "var(--accent)" }} />
          <span>
            <strong style={{ color: "var(--text)" }}>
              {activeStaff.length}
            </strong>{" "}
            active staff
          </span>
          {branchStaff.length > activeStaff.length && (
            <span style={{ color: "var(--muted)" }}>
              · {branchStaff.length - activeStaff.length} inactive
            </span>
          )}
        </div>
        {branchStaff.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {branchStaff.slice(0, 5).map((s) => (
              <span
                key={s.id}
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 20,
                  background: s.active ? "var(--accent)15" : "var(--border)",
                  color: s.active ? "var(--accent)" : "var(--muted)",
                  border: `1px solid ${s.active ? "var(--accent)30" : "var(--border)"}`,
                }}
              >
                {s.name}
              </span>
            ))}
            {branchStaff.length > 5 && (
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                +{branchStaff.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

//  Main Page
export default function BranchesPage({ sub }) {
  const [branches, setBranches] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const uid = auth.currentUser?.uid;

  const fetchAll = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [bSnap, sSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "users", uid, "branches"),
            orderBy("createdAt", "asc"),
          ),
        ),
        getDocs(
          query(
            collection(db, "users", uid, "staff"),
            orderBy("addedAt", "desc"),
          ),
        ),
      ]);
      setBranches(bSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStaffList(sSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [uid]);

  const handleToggle = async (branchId, active) => {
    await updateDoc(doc(db, "users", uid, "branches", branchId), { active });
    setBranches((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, active } : b)),
    );
  };

  const handleDelete = async (branchId) => {
    await deleteDoc(doc(db, "users", uid, "branches", branchId));
    setBranches((prev) => prev.filter((b) => b.id !== branchId));
  };

  const activeBranches = branches.filter((b) => b.active).length;

  return (
    <FeatureGate feature="multipleBranches" sub={sub} lockedLabel="Branches">
      <div style={{ maxWidth: 760 }}>
        {/* Header */}
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
                icon={faCodeBranch}
                style={{ marginRight: 8, color: "var(--accent)" }}
              />
              Branches
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {loading
                ? "Loading..."
                : `${activeBranches} active · ${branches.length} total`}
            </div>
          </div>
          {!showForm && (
            <button
              className="btn-primary"
              onClick={() => setShowForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              <FontAwesomeIcon icon={faPlus} /> Add Branch
            </button>
          )}
        </div>

        {showForm && (
          <BranchForm
            ownerUid={uid}
            onAdded={() => {
              setShowForm(false);
              fetchAll();
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
            Loading branches...
          </div>
        ) : branches.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              border: "1.5px dashed var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--bg2)",
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            <FontAwesomeIcon
              icon={faCodeBranch}
              style={{
                fontSize: 28,
                marginBottom: 12,
                display: "block",
                opacity: 0.4,
              }}
            />
            No branches yet. Create your first branch, then assign staff to it
            from the Team page.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {branches.map((branch) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                ownerUid={uid}
                staffList={staffList}
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
