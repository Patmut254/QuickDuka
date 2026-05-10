import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faPhone,
  faEnvelope,
  faHandshake,
  faCheckCircle,
  faChevronLeft,
  faFileArrowUp,
  faCircleInfo,
  faLocationDot,
  faIdCard,
  faPiggyBank,
} from "@fortawesome/free-solid-svg-icons";

export default function ReferrerRegister({ onBack }) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    idNumber: "",
    mpesaName: "",
    mpesaPhone: "",
    county: "",
    experience: "",
    willingToEarn: "",
    cvFileName: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleCvChange = (e) => {
    const file = e.target.files?.[0];
    if (file) set("cvFileName", file.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!form.phone.trim()) return setError("Phone number is required.");
    if (!form.email.trim() || !form.email.includes("@"))
      return setError("Valid email is required.");
    if (!form.mpesaPhone.trim())
      return setError("M-Pesa phone number is required.");
    if (!form.mpesaName.trim())
      return setError("M-Pesa registered name is required.");
    if (!form.willingToEarn)
      return setError("Please confirm if you're willing to participate.");

    setSaving(true);
    try {
      await addDoc(collection(db, "referrerApplications"), {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        idNumber: form.idNumber.trim() || null,
        mpesaName: form.mpesaName.trim(),
        mpesaPhone: form.mpesaPhone.trim(),
        county: form.county.trim() || null,
        experience: form.experience.trim() || null,
        willingToEarn: form.willingToEarn === "yes",
        cvFileName: form.cvFileName || null,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setDone(true);
    } catch {
      setError("Failed to submit. Please check your connection and try again.");
    }
    setSaving(false);
  };

  if (done) {
    return (
      <div className="login-page ref-reg-page">
        <div className="login-dots login-dots-tl" />
        <div className="login-card" style={{ maxWidth: 460 }}>
          <div className="ref-success-wrap">
            <div className="ref-success-icon">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <h2 className="ref-success-title">Application Submitted!</h2>
            <p className="ref-success-sub">
              Thank you, <strong>{form.fullName}</strong>. We'll review your
              application and reach out within 1–7 business days.
            </p>
            <div className="ref-earnings-summary">
              <div className="ref-earnings-row">
                <span className="ref-earn-label">
                  First payment per customer - Month 2
                </span>
                <span className="ref-earn-val">KES 50</span>
              </div>
              <div className="ref-earnings-row">
                <span className="ref-earn-label">Months 3–7 per customer</span>
                <span className="ref-earn-val">
                  KES 20<span className="ref-earn-sub">/mo</span>
                </span>
              </div>
              <div className="ref-earnings-row ref-earnings-total">
                <span className="ref-earn-label">
                  Maximum per customer (6 months)
                </span>
                <span className="ref-earn-val">KES 150</span>
              </div>
            </div>
            <button
              className="btn-login"
              onClick={onBack}
              style={{ marginTop: 8 }}
            >
              Back to Sign In
            </button>
          </div>
        </div>
        <div className="ref-page-footer">
          © 2026 QuickDuka. All rights reserved.
        </div>
      </div>
    );
  }

  return (
    <div className="login-page ref-reg-page">
      <div className="login-dots login-dots-tl" />
      <div className="login-dots login-dots-br" />

      <div className="login-card ref-reg-card">
        <div className="ref-reg-header">
          <img
            src="/logo.png"
            alt="QuickDuka"
            className="login-logo-img"
            style={{ height: 48 }}
          />
          <h1 className="ref-reg-title">Become a Referrer</h1>
          <p className="ref-reg-sub">
            Earn money by bringing businesses onto QuickDuka
          </p>
          <p className="ref-reg-sub">
            Note: Month 1 is free for every customer.
          </p>
        </div>

        <div className="ref-earn-strip">
          <div className="ref-earn-strip-item">
            <span className="ref-earn-strip-val">KES 50</span>
            <span className="ref-earn-strip-lbl">First payment in Month 2</span>
          </div>
          <div className="ref-earn-strip-divider" />
          <div className="ref-earn-strip-item">
            <span className="ref-earn-strip-val">KES 20</span>
            <span className="ref-earn-strip-lbl">Months 3–7</span>
          </div>
          <div className="ref-earn-strip-divider" />
          <div className="ref-earn-strip-item">
            <span className="ref-earn-strip-val">KES 150</span>
            <span className="ref-earn-strip-lbl">Max / customer</span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="login-form ref-reg-form"
          noValidate
        >
          <div className="ref-section-label">Personal Details</div>

          <div className="field-group">
            <label>
              Full Name <span className="ref-required">*</span>
            </label>
            <div className="input-icon-wrap">
              <div className="input-icon-box">
                <FontAwesomeIcon icon={faUser} />
              </div>
              <input
                placeholder="Your full name"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="field-group">
              <label>
                Phone Number <span className="ref-required">*</span>
              </label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faPhone} />
                </div>
                <input
                  type="tel"
                  placeholder="07xx xxx xxx"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
            </div>
            <div className="field-group">
              <label>
                Email Address <span className="ref-required">*</span>
              </label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faEnvelope} />
                </div>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-row-2">
            <div className="field-group">
              <label>
                ID Number <span className="ref-optional">(optional)</span>
              </label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faIdCard} />
                </div>
                <input
                  placeholder="National ID"
                  value={form.idNumber}
                  onChange={(e) => set("idNumber", e.target.value)}
                />
              </div>
            </div>
            <div className="field-group">
              <label>
                County / Area <span className="ref-optional">(optional)</span>
              </label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faLocationDot} />
                </div>
                <input
                  placeholder="e.g. Nairobi"
                  value={form.county}
                  onChange={(e) => set("county", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="ref-section-label">M-Pesa Details</div>
          <p className="ref-section-hint">
            Earnings will be sent to this number.
          </p>

          <div className="form-row-2">
            <div className="field-group">
              <label>
                M-Pesa Name <span className="ref-required">*</span>
              </label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faPiggyBank} />
                </div>
                <input
                  placeholder="Name on M-Pesa"
                  value={form.mpesaName}
                  onChange={(e) => set("mpesaName", e.target.value)}
                />
              </div>
            </div>
            <div className="field-group">
              <label>
                M-Pesa Phone <span className="ref-required">*</span>
              </label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faPhone} />
                </div>
                <input
                  type="tel"
                  placeholder="07xx xxx xxx"
                  value={form.mpesaPhone}
                  onChange={(e) => set("mpesaPhone", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="ref-section-label">Background</div>

          <div className="field-group">
            <label>
              Why would you make a good referrer?{" "}
              <span className="ref-optional">(optional)</span>
            </label>
            <textarea
              className="ref-textarea"
              placeholder="e.g. I work with shop owners in Gikomba and have strong relationships..."
              value={form.experience}
              onChange={(e) => set("experience", e.target.value)}
              rows={3}
            />
          </div>

          <div className="field-group">
            <label>
              Upload CV <span className="ref-optional">(optional)</span>
            </label>
            <label className="ref-upload-btn">
              <FontAwesomeIcon
                icon={faFileArrowUp}
                className="ref-upload-icon"
              />
              <span className="ref-upload-text">
                {form.cvFileName || "Click to attach CV (PDF or Word)"}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleCvChange}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div className="ref-section-label">Confirmation</div>

          <div className="field-group">
            <label>
              Are you willing to earn commissions per customer?{" "}
              <span className="ref-required">*</span>
            </label>
            <div className="ref-radio-row">
              {[
                { val: "yes", emoji: "✅", label: "Yes, I'm in!" },
                { val: "no", emoji: "❌", label: "Not interested" },
              ].map(({ val, emoji, label }) => (
                <label
                  key={val}
                  className={`ref-radio-option${form.willingToEarn === val ? " selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="willing"
                    value={val}
                    checked={form.willingToEarn === val}
                    onChange={() => set("willingToEarn", val)}
                    style={{ display: "none" }}
                  />
                  <span>
                    {emoji} {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="ref-notice">
            <FontAwesomeIcon icon={faCircleInfo} className="ref-notice-icon" />
            <span>
              Once approved, you'll be added to our system and can start
              referring customers immediately.
            </span>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-login" disabled={saving}>
            {saving ? (
              "Submitting..."
            ) : (
              <>
                <FontAwesomeIcon
                  icon={faHandshake}
                  style={{ marginRight: 8 }}
                />
                Submit Application
              </>
            )}
          </button>
        </form>

        <div className="forgot-pw-wrap" style={{ marginTop: 12 }}>
          <button className="forgot-pw-btn" onClick={onBack}>
            <FontAwesomeIcon icon={faChevronLeft} /> Back to Sign In
          </button>
        </div>
      </div>

      <div className="ref-page-footer">
        © 2026 QuickDuka. All rights reserved.
      </div>
    </div>
  );
}
