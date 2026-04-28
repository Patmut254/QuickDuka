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
} from "@fortawesome/free-solid-svg-icons";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { kenyaCounties } from "../data/kenyaLocations";

export default function ProfilePage({ user, profile }) {
  const [form, setForm] = useState({
    businessName:  profile?.businessName  || "",
    ownerName:     profile?.ownerName     || "",
    phone:         profile?.phone         || "",
    shopNumber:    profile?.shopNumber    || "",
    buildingName:  profile?.buildingName  || "",
    county:        profile?.county        || "",
    subcounty:     profile?.subcounty     || "",
    town:          profile?.town          || "",
    notes:         profile?.notes         || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const selectedCounty = kenyaCounties.find(c => c.county === form.county);
  const subcounties = selectedCounty?.subcounties || [];

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        businessName: form.businessName.trim(),
        ownerName:    form.ownerName.trim(),
        phone:        form.phone.trim(),
        shopNumber:   form.shopNumber.trim(),
        buildingName: form.buildingName.trim(),
        county:       form.county,
        subcounty:    form.subcounty,
        town:         form.town.trim(),
        notes:        form.notes.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Failed to save. Please try again.");
      console.error(err);
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
          <div className="profile-name">{profile?.businessName || "Your Business"}</div>
          <div className="profile-role">{profile?.ownerName || user?.email}</div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Business info */}
        <div className="info-card" style={{ marginBottom: 14 }}>
          <h2>
            <span className="fa-icon"><FontAwesomeIcon icon={faStore} /></span> Business Details
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row-2">
              <div className="field-group">
                <label>Business Name</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faStore} /></div>
                  <input type="text" name="businessName" placeholder="e.g. Wanjiru General Store" value={form.businessName} onChange={handleChange} />
                </div>
              </div>
              <div className="field-group">
                <label>Owner Name</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faUser} /></div>
                  <input type="text" name="ownerName" placeholder="Your full name" value={form.ownerName} onChange={handleChange} />
                </div>
              </div>
            </div>
            <div className="form-row-2">
              <div className="field-group">
                <label>Phone Number</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faPhone} /></div>
                  <input type="tel" name="phone" placeholder="07... / 011... / +254..." value={form.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="field-group">
                <label>Email (Login)</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faEnvelope} /></div>
                  <input type="email" value={profile?.realEmail || user?.email || ""} disabled style={{ opacity: .65, cursor: "not-allowed" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shop location */}
        <div className="info-card" style={{ marginBottom: 14 }}>
          <h2>
            <span className="fa-icon"><FontAwesomeIcon icon={faMapMarkerAlt} /></span> Shop Location
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row-2">
              <div className="field-group">
                <label>Shop / Stall Number</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faHashtag} /></div>
                  <input type="text" name="shopNumber" placeholder="e.g. Shop 12, Stall B3" value={form.shopNumber} onChange={handleChange} />
                </div>
              </div>
              <div className="field-group">
                <label>Building / Market Name</label>
                <div className="input-icon-wrap">
                  <div className="input-icon-box"><FontAwesomeIcon icon={faStore} /></div>
                  <input type="text" name="buildingName" placeholder="e.g. Gikomba Market" value={form.buildingName} onChange={handleChange} />
                </div>
              </div>
            </div>
            <div className="form-row-2">
              <div className="field-group">
                <label>County</label>
                <select name="county" value={form.county} onChange={e => { handleChange(e); setForm(p => ({ ...p, subcounty: "" })); }}>
                  <option value="">-- Select County --</option>
                  {kenyaCounties.map(c => <option key={c.county} value={c.county}>{c.county}</option>)}
                </select>
              </div>
              {subcounties.length > 0 && (
                <div className="field-group">
                  <label>Sub-county</label>
                  <select name="subcounty" value={form.subcounty} onChange={handleChange}>
                    <option value="">-- Select --</option>
                    {subcounties.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="field-group">
              <label>Location / Town</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box"><FontAwesomeIcon icon={faMapMarkerAlt} /></div>
                <input type="text" name="town" placeholder="e.g. Nakuru Town, CBD, Gikomba" value={form.town} onChange={handleChange} />
              </div>
            </div>
            <div className="field-group">
              <label>Additional Notes (Directions / Landmark)</label>
              <textarea name="notes" placeholder="e.g. Next to Equity Bank, ground floor" value={form.notes} onChange={handleChange} rows={2} />
            </div>
          </div>
        </div>

        {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button type="submit" className="profile-save-btn" disabled={saving}>
            <FontAwesomeIcon icon={faFloppyDisk} />
            {saving ? "Saving..." : "Save Profile"}
          </button>
          {saved && (
            <span className="profile-save-success">
              <FontAwesomeIcon icon={faCheckCircle} /> Saved!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
