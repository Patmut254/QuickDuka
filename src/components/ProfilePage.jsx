import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore,
  faUser,
  faPhone,
  faEnvelope,
  faMapMarkerAlt,
  faHashtag,
  faFloppyDisk,
  faCheckCircle,
  faCircleUser,
  faCalendarDays,
  faCrown,
} from "@fortawesome/free-solid-svg-icons";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { kenyaCounties } from "../data/kenyaLocations";
import { useLang } from "../LangContext";
import { getPlan } from "../subscription";
import { PlanBadge } from "./FeatureGate";

const db = getFirestore();

export default function ProfilePage({ user, profile }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    businessName: profile?.businessName || "",
    ownerName: profile?.ownerName || "",
    phone: profile?.phone || "",
    shopNumber: profile?.shopNumber || "",
    buildingName: profile?.buildingName || "",
    county: profile?.county || "",
    subcounty: profile?.subcounty || "",
    town: profile?.town || "",
    notes: profile?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const selectedCounty = kenyaCounties.find((c) => c.county === form.county);
  const subcounties = selectedCounty?.subcounties || [];

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const normalizePhone = (p) => {
    const d = p.replace(/\D/g, "");
    if (d.startsWith("07") && d.length === 10) return "+254" + d.slice(1);
    if (d.startsWith("011") && d.length === 10) return "+254" + d.slice(1);
    if (d.startsWith("01") && d.length === 10) return "+254" + d.slice(1);
    if (d.startsWith("254") && d.length === 12) return "+" + d;
    if ((d.startsWith("7") || d.startsWith("1")) && d.length === 9) return "+254" + d;
    return p;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!user?.uid) {
      setError("Session error — please sign out and sign back in.");
      return;
    }
    // Validate phone if provided
    if (form.phone.trim()) {
      const norm = normalizePhone(form.phone);
      const digits = form.phone.replace(/\D/g, "");
      if (!/^\+254\d{9}$/.test(norm)) {
        if (digits.length < 10) setError("Phone number is too short. Use 0712345678 (10 digits) or +254712345678.");
        else if (digits.length > 12) setError("Phone number is too long. Use 0712345678 (10 digits) or +254712345678.");
        else setError("Invalid phone number. Use format: 0712345678 or +254712345678.");
        return;
      }
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const normPhone = form.phone.trim() ? normalizePhone(form.phone) : "";
      const updates = {
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        phone: normPhone || form.phone.trim(),
        shopNumber: form.shopNumber.trim(),
        buildingName: form.buildingName.trim(),
        county: form.county,
        subcounty: form.subcounty,
        town: form.town.trim(),
        notes: form.notes.trim(),
      };
      await updateDoc(doc(db, "users", user.uid), updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Profile save error:", err);
      if (err.code === "permission-denied") {
        setError("Permission denied. Please sign out and sign back in.");
      } else if (err.code === "not-found") {
        setError("Profile document not found. Please contact support.");
      } else {
        setError(t.failedSaveProfile || "Failed to save. Please try again.");
      }
    }
    setSaving(false);
  };

  return (
    <div className="profile-page module-page">
      {/* Avatar row */}
      <div className="profile-avatar-row">
        <div className="profile-avatar">
          <FontAwesomeIcon icon={faCircleUser} />
        </div>
        <div>
          <div className="profile-name">
            {profile?.businessName || t.businessName}
          </div>
          <div className="profile-role">
            {profile?.ownerName || user?.email}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Business info */}
        <div className="info-card" style={{ marginBottom: 14 }}>
          <h2>
            <span className="fa-icon">
              <FontAwesomeIcon icon={faStore} />
            </span>{" "}
            {t.businessDetails}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row-2">
              <div className="field-group">
                <label>{t.businessName}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faStore} />
                  </div>
                  <input
                    type="text"
                    name="businessName"
                    placeholder={t.businessNamePh}
                    value={form.businessName}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="field-group">
                <label>{t.ownerName}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <input
                    type="text"
                    name="ownerName"
                    placeholder={t.ownerNamePh}
                    value={form.ownerName}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
            <div className="form-row-2">
              <div className="field-group">
                <label>{t.phone}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faPhone} />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    placeholder={t.phonePh}
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="field-group">
                <label>{t.emailLogin}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faEnvelope} />
                  </div>
                  <input
                    type="email"
                    value={profile?.realEmail || user?.email || ""}
                    disabled
                    style={{ opacity: 0.65, cursor: "not-allowed" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shop location */}
        <div className="info-card" style={{ marginBottom: 14 }}>
          <h2>
            <span className="fa-icon">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
            </span>{" "}
            {t.shopLocation}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row-2">
              <div className="field-group">
                <label>{t.shopNumber}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faHashtag} />
                  </div>
                  <input
                    type="text"
                    name="shopNumber"
                    placeholder={t.shopNumberPh}
                    value={form.shopNumber}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="field-group">
                <label>{t.buildingName}</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box">
                    <FontAwesomeIcon icon={faStore} />
                  </div>
                  <input
                    type="text"
                    name="buildingName"
                    placeholder={t.buildingNamePh}
                    value={form.buildingName}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
            <div className="form-row-2">
              <div className="field-group">
                <label>{t.county}</label>
                <select
                  name="county"
                  value={form.county}
                  onChange={(e) => {
                    handleChange(e);
                    setForm((p) => ({ ...p, subcounty: "" }));
                  }}
                >
                  <option value="">{t.selectCounty}</option>
                  {kenyaCounties.map((c) => (
                    <option key={c.county} value={c.county}>
                      {c.county}
                    </option>
                  ))}
                </select>
              </div>
              {subcounties.length > 0 && (
                <div className="field-group">
                  <label>{t.subcounty}</label>
                  <select
                    name="subcounty"
                    value={form.subcounty}
                    onChange={handleChange}
                  >
                    <option value="">{t.selectSubcounty}</option>
                    {subcounties.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="field-group">
              <label>{t.town}</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                </div>
                <input
                  type="text"
                  name="town"
                  placeholder={t.townPh}
                  value={form.town}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="field-group">
              <label>{t.additionalNotes}</label>
              <textarea
                name="notes"
                placeholder={t.additionalNotesPh}
                value={form.notes}
                onChange={handleChange}
                rows={2}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="login-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button type="submit" className="profile-save-btn" disabled={saving}>
            <FontAwesomeIcon icon={faFloppyDisk} />
            {saving ? t.saving : t.saveProfile}
          </button>
          {saved && (
            <span className="profile-save-success">
              <FontAwesomeIcon icon={faCheckCircle} /> {t.profileSaved}
            </span>
          )}
        </div>
      </form>

      {/* ── Subscription Info Card ─────────────────────────────────────────── */}
      <SubscriptionInfoCard profile={profile} />
    </div>
  );
}

// ── Subscription info shown on Profile page ──────────────────────────────────
function SubscriptionInfoCard({ profile }) {
  const planId     = profile?.subscriptionPlan || "starter";
  const planDef    = getPlan(planId);
  const status     = profile?.subscriptionStatus || "trial";
  const expiry     = profile?.subscriptionExpiry?.toDate?.()
                     ?? (profile?.subscriptionExpiry instanceof Date ? profile.subscriptionExpiry : null);
  const startDate  = profile?.subscriptionStartDate?.toDate?.() ?? null;

  const daysLeft = expiry
    ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const statusColor = {
    active:  "#22c55e",
    trial:   "#f59e0b",
    expired: "#ef4444",
    pending: "#6b7280",
  }[status] || "#6b7280";

  const statusLabel = {
    active:  "Active",
    trial:   "Free Trial",
    expired: "Expired",
    pending: "Pending Payment",
  }[status] || status;

  const fmt = (d) => d
    ? d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <div
      className="info-card"
      style={{ marginTop: 14, borderLeft: `4px solid ${planDef.color}` }}
    >
      <h2>
        <span className="fa-icon">
          <FontAwesomeIcon icon={faCrown} style={{ color: planDef.color }} />
        </span>{" "}
        Subscription
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        {/* Plan */}
        <div style={{ flex: "1 1 160px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Current Plan
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlanBadge plan={planId} />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              KES {planDef.price.toLocaleString()}/mo
            </span>
          </div>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {planDef.features.map((f) => (
              <li key={f} style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ color: planDef.color, fontSize: 9 }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Status & dates */}
        <div style={{ flex: "1 1 160px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Status
          </div>
          <span style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: 20,
            background: statusColor + "18",
            border: `1.5px solid ${statusColor}40`,
            color: statusColor,
            fontSize: 12,
            fontWeight: 700,
          }}>
            {statusLabel}
          </span>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
            {startDate && (
              <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 10, color: "var(--muted)" }} />
                Started: <strong style={{ color: "var(--text)" }}>{fmt(startDate)}</strong>
              </div>
            )}
            {expiry && (
              <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 10, color: "var(--muted)" }} />
                {daysLeft > 0
                  ? <>Expires in <strong style={{ color: daysLeft <= 5 ? "#ef4444" : "var(--text)" }}>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> ({fmt(expiry)})</>
                  : daysLeft === 0
                  ? <strong style={{ color: "#ef4444" }}>Expires today</strong>
                  : <strong style={{ color: "#ef4444" }}>Expired on {fmt(expiry)}</strong>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 11, color: "var(--muted)" }}>
        📅 Subscriptions renew monthly. To upgrade your plan, contact support or pay via M-Pesa on next renewal.
      </div>
    </div>
  );
}
