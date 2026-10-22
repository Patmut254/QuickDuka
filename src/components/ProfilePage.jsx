import { useRef, useState } from "react";
import {
  Store,
  MapPin,
  Camera,
  Trash2,
  ImageUp,
  Save,
  CircleCheck,
  Crown,
  CalendarDays,
  Mail,
  Phone,
  Loader,
} from "lucide-react";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { kenyaCounties } from "../data/kenyaLocations";
import { useLang } from "../LangContext";
import { getPlan } from "../subscription";
import { PlanBadge } from "./FeatureGate";

const db = getFirestore();

const PHOTO_SIZE = 320; // px, square
const MAX_UPLOAD_MB = 10;

// Shrink + centre-crop the chosen picture to a small square JPEG so it can
// live on the user's profile document (no Storage bucket needed).
function fileToSquareJpeg(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = PHOTO_SIZE;
        canvas.height = PHOTO_SIZE;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Firestore keeps writes on the device and syncs them later, but the promise
// only settles once the server answers. On a slow or offline connection we
// stop waiting after a few seconds and tell the user it will sync.
const SYNC_WAIT_MS = 5000;
function saveWithTimeout(promise) {
  return Promise.race([
    promise.then(() => "synced"),
    new Promise((resolve) => setTimeout(() => resolve("pending"), SYNC_WAIT_MS)),
  ]);
}

// setDoc + merge creates users/{uid} if it is missing (the admin account has
// no profile document by default) and otherwise only touches these fields.
function saveProfileFields(user, profile, fields) {
  const extra =
    profile?.role === "admin" ? { role: "admin", email: user.email } : {};
  return setDoc(
    doc(db, "users", user.uid),
    { ...extra, ...fields },
    { merge: true },
  );
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function notifyProfileUpdated(updates) {
  window.dispatchEvent(new CustomEvent("qd-profile-updated", { detail: updates }));
}

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
  const [savedPending, setSavedPending] = useState(false);
  const [error, setError] = useState("");

  const [photo, setPhoto] = useState(profile?.photoURL || "");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState({ type: "", text: "" });
  const fileRef = useRef(null);

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
    if ((d.startsWith("7") || d.startsWith("1")) && d.length === 9)
      return "+254" + d;
    return p;
  };

  // ── Profile photo ─────────────────────────────────────────────────────────
  const savePhoto = async (dataUrl) => {
    if (!user?.uid) return;
    setPhotoBusy(true);
    setPhotoMsg({ type: "", text: "" });
    try {
      const result = await saveWithTimeout(
        saveProfileFields(user, profile, { photoURL: dataUrl }),
      );
      setPhoto(dataUrl);
      notifyProfileUpdated({ photoURL: dataUrl });
      setPhotoMsg({
        type: "ok",
        text:
          result === "pending"
            ? t.savedWillSync || "Saved on this device. It will sync when your internet is back."
            : dataUrl
              ? t.photoSaved || "Profile photo updated."
              : t.photoRemoved || "Profile photo removed.",
      });
    } catch (err) {
      console.error("Photo save error:", err);
      setPhotoMsg({
        type: "err",
        text: t.photoSaveFailed || "Could not save the photo. Please try again.",
      });
    }
    setPhotoBusy(false);
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoMsg({ type: "err", text: t.photoNotImage || "Please choose an image file (JPG or PNG)." });
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setPhotoMsg({
        type: "err",
        text: t.photoTooBig || `That image is larger than ${MAX_UPLOAD_MB} MB. Please choose a smaller one.`,
      });
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToSquareJpeg(file);
      await savePhoto(dataUrl);
    } catch {
      setPhotoBusy(false);
      setPhotoMsg({
        type: "err",
        text: t.photoUnreadable || "Could not read this image. Try a JPG or PNG photo.",
      });
    }
  };

  // ── Details ───────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!user?.uid) {
      setError("Session error, please sign out and sign back in.");
      return;
    }
    if (form.phone.trim()) {
      const norm = normalizePhone(form.phone);
      const digits = form.phone.replace(/\D/g, "");
      if (!/^\+254\d{9}$/.test(norm)) {
        if (digits.length < 10)
          setError("Phone number is too short. Use 0712345678 (10 digits) or +254712345678.");
        else if (digits.length > 12)
          setError("Phone number is too long. Use 0712345678 (10 digits) or +254712345678.");
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
      const result = await saveWithTimeout(
        saveProfileFields(user, profile, updates),
      );
      notifyProfileUpdated(updates);
      setSavedPending(result === "pending");
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
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

  const displayName = form.businessName || profile?.businessName || t.businessName;
  const ownerLine = form.ownerName || profile?.ownerName || "";
  const email = profile?.realEmail || user?.email || "";
  const placeLine = [form.buildingName, form.town, form.county]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(", ");
  const avatarText = initials(form.ownerName || form.businessName || email);

  return (
    <div className="pf-page">
      {/* ── Header: photo + who you are ── */}
      <section className="pf-hero">
        <div className="pf-avatar-wrap">
          <button
            type="button"
            className="pf-avatar"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            aria-label={t.changePhoto || "Change profile photo"}
          >
            {photo ? (
              <img src={photo} alt="" />
            ) : avatarText ? (
              <span className="pf-avatar-initials">{avatarText}</span>
            ) : (
              <Store size={34} strokeWidth={1.5} />
            )}
            <span className="pf-avatar-overlay">
              {photoBusy ? (
                <Loader size={20} strokeWidth={1.75} className="qd-icon-spin" />
              ) : (
                <Camera size={20} strokeWidth={1.75} />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            hidden
          />
        </div>

        <div className="pf-hero-text">
          <h2 className="pf-hero-name">{displayName}</h2>
          {ownerLine && <div className="pf-hero-owner">{ownerLine}</div>}
          <div className="pf-hero-meta">
            {email && (
              <span>
                <Mail size={14} strokeWidth={1.75} /> {email}
              </span>
            )}
            {form.phone && (
              <span>
                <Phone size={14} strokeWidth={1.75} /> {form.phone}
              </span>
            )}
            {placeLine && (
              <span>
                <MapPin size={14} strokeWidth={1.75} /> {placeLine}
              </span>
            )}
          </div>
          <div className="pf-photo-actions">
            <button
              type="button"
              className="pf-btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
            >
              <ImageUp size={16} strokeWidth={1.75} />
              {photo ? t.changePhoto || "Change photo" : t.uploadPhoto || "Upload photo"}
            </button>
            {photo && (
              <button
                type="button"
                className="pf-btn-ghost pf-btn-danger"
                onClick={() => savePhoto("")}
                disabled={photoBusy}
              >
                <Trash2 size={16} strokeWidth={1.75} />
                {t.removePhoto || "Remove"}
              </button>
            )}
            <span className="pf-photo-hint">
              {t.photoHint || "JPG or PNG. A square photo or shop logo works best."}
            </span>
          </div>
          {photoMsg.text && (
            <div className={"pf-photo-msg " + (photoMsg.type === "err" ? "is-err" : "is-ok")}>
              {photoMsg.text}
            </div>
          )}
        </div>
      </section>

      <form onSubmit={handleSave} className="pf-form">
        {/* ── Business details ── */}
        <section className="pf-card">
          <header className="pf-card-head">
            <Store size={18} strokeWidth={1.75} />
            <div>
              <h3>{t.businessDetails}</h3>
              <p>{t.businessDetailsHint || "How your business appears on receipts and reports."}</p>
            </div>
          </header>
          <div className="pf-grid">
            <div className="field-group">
              <label htmlFor="pf-business">{t.businessName}</label>
              <input
                id="pf-business"
                type="text"
                name="businessName"
                placeholder={t.businessNamePh}
                value={form.businessName}
                onChange={handleChange}
              />
            </div>
            <div className="field-group">
              <label htmlFor="pf-owner">{t.ownerName}</label>
              <input
                id="pf-owner"
                type="text"
                name="ownerName"
                placeholder={t.ownerNamePh}
                value={form.ownerName}
                onChange={handleChange}
              />
            </div>
            <div className="field-group">
              <label htmlFor="pf-phone">{t.phone}</label>
              <input
                id="pf-phone"
                type="tel"
                name="phone"
                placeholder={t.phonePh}
                value={form.phone}
                onChange={handleChange}
              />
            </div>
            <div className="field-group">
              <label htmlFor="pf-email">{t.emailLogin}</label>
              <input
                id="pf-email"
                type="email"
                value={email}
                disabled
                className="pf-locked"
              />
              <span className="pf-field-note">
                {t.emailLocked || "Your login email cannot be changed here."}
              </span>
            </div>
          </div>
        </section>

        {/* ── Shop location ── */}
        <section className="pf-card">
          <header className="pf-card-head">
            <MapPin size={18} strokeWidth={1.75} />
            <div>
              <h3>{t.shopLocation}</h3>
              <p>{t.shopLocationHint || "Helps customers and our support team find your shop."}</p>
            </div>
          </header>
          <div className="pf-grid">
            <div className="field-group">
              <label htmlFor="pf-shopno">{t.shopNumber}</label>
              <input
                id="pf-shopno"
                type="text"
                name="shopNumber"
                placeholder={t.shopNumberPh}
                value={form.shopNumber}
                onChange={handleChange}
              />
            </div>
            <div className="field-group">
              <label htmlFor="pf-building">{t.buildingName}</label>
              <input
                id="pf-building"
                type="text"
                name="buildingName"
                placeholder={t.buildingNamePh}
                value={form.buildingName}
                onChange={handleChange}
              />
            </div>
            <div className="field-group">
              <label htmlFor="pf-county">{t.county}</label>
              <select
                id="pf-county"
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
            <div className="field-group">
              <label htmlFor="pf-subcounty">{t.subcounty}</label>
              <select
                id="pf-subcounty"
                name="subcounty"
                value={form.subcounty}
                onChange={handleChange}
                disabled={subcounties.length === 0}
              >
                <option value="">
                  {subcounties.length === 0
                    ? t.pickCountyFirst || "Pick a county first"
                    : t.selectSubcounty}
                </option>
                {subcounties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group pf-span-2">
              <label htmlFor="pf-town">{t.town}</label>
              <input
                id="pf-town"
                type="text"
                name="town"
                placeholder={t.townPh}
                value={form.town}
                onChange={handleChange}
              />
            </div>
            <div className="field-group pf-span-2">
              <label htmlFor="pf-notes">{t.additionalNotes}</label>
              <textarea
                id="pf-notes"
                name="notes"
                placeholder={t.additionalNotesPh}
                value={form.notes}
                onChange={handleChange}
                rows={3}
              />
            </div>
          </div>
        </section>

        {error && <div className="login-error pf-error">{error}</div>}

        <div className="pf-save-bar">
          <span className={"pf-save-status" + (saved ? " is-saved" : "")}>
            {saved ? (
              <>
                <CircleCheck size={16} strokeWidth={1.75} />{" "}
                {savedPending
                  ? t.savedWillSync || "Saved on this device. It will sync when your internet is back."
                  : t.profileSaved}
              </>
            ) : (
              t.saveHint || "Remember to save after making changes."
            )}
          </span>
          <button type="submit" className="btn-primary pf-save-btn" disabled={saving}>
            {saving ? (
              <Loader size={16} strokeWidth={1.75} className="qd-icon-spin" />
            ) : (
              <Save size={16} strokeWidth={1.75} />
            )}
            {saving ? t.saving : t.saveProfile}
          </button>
        </div>
      </form>

      <SubscriptionInfoCard profile={profile} />
    </div>
  );
}

//  Subscription info shown on Profile page
function SubscriptionInfoCard({ profile }) {
  const planId = profile?.subscriptionPlan || "starter";
  const planDef = getPlan(planId);
  const status = profile?.subscriptionStatus || "trial";
  const expiry =
    profile?.subscriptionExpiry?.toDate?.() ??
    (profile?.subscriptionExpiry instanceof Date ? profile.subscriptionExpiry : null);
  const startDate = profile?.subscriptionStartDate?.toDate?.() ?? null;

  const daysLeft = expiry
    ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const statusColor =
    { active: "#22c55e", trial: "#f59e0b", expired: "#ef4444", pending: "#6b7280" }[status] ||
    "#6b7280";
  const statusLabel =
    { active: "Active", trial: "Free Trial", expired: "Expired", pending: "Pending Payment" }[
      status
    ] || status;

  const fmt = (d) =>
    d ? d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <section className="pf-card">
      <header className="pf-card-head">
        <Crown size={18} strokeWidth={1.75} style={{ color: planDef.color }} />
        <div>
          <h3>Subscription</h3>
          <p>Your plan, status and renewal date.</p>
        </div>
      </header>

      <div className="pf-sub-grid">
        <div className="pf-sub-block">
          <div className="pf-sub-label">Current Plan</div>
          <div className="pf-sub-plan">
            <PlanBadge plan={planId} />
            <span>KES {planDef.price.toLocaleString()}/mo</span>
          </div>
          <ul className="pf-sub-features">
            {planDef.features.map((f) => (
              <li key={f}>
                <CircleCheck size={14} strokeWidth={1.75} style={{ color: planDef.color }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="pf-sub-block">
          <div className="pf-sub-label">Status</div>
          <span
            className="pf-status-pill"
            style={{
              background: statusColor + "18",
              borderColor: statusColor + "55",
              color: statusColor,
            }}
          >
            {statusLabel}
          </span>
          <div className="pf-sub-dates">
            {startDate && (
              <div>
                <CalendarDays size={14} strokeWidth={1.75} />
                Started: <strong>{fmt(startDate)}</strong>
              </div>
            )}
            {expiry && (
              <div>
                <CalendarDays size={14} strokeWidth={1.75} />
                {daysLeft > 0 ? (
                  <>
                    Expires in{" "}
                    <strong style={{ color: daysLeft <= 5 ? "#ef4444" : undefined }}>
                      {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                    </strong>{" "}
                    ({fmt(expiry)})
                  </>
                ) : daysLeft === 0 ? (
                  <strong style={{ color: "#ef4444" }}>Expires today</strong>
                ) : (
                  <strong style={{ color: "#ef4444" }}>Expired on {fmt(expiry)}</strong>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pf-sub-note">
        Subscriptions renew monthly. To upgrade your plan, contact support or pay via M-Pesa on
        next renewal.
      </div>
    </section>
  );
}
