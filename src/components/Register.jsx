import { useState, useRef } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { createUserProfile } from "../hooks/useUserProfile";
import { kenyaCounties, REFERRERS } from "../data/kenyaLocations";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhone, faEnvelope, faLock, faUser, faStore, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

// ============================================================
// OTP via Africa's Talking — replace dummy when going live
// See Django backend otpviews.py for the endpoint
// ============================================================
const BACKEND_URL = "https://DUMMY-REPLACE-WITH-YOUR-VERCEL-URL.vercel.app";

const STEPS = ["Phone", "Verify", "Details", "Account"];

export default function Register({ onBack }) {
  const [step, setStep] = useState(0); // 0=phone, 1=otp, 2=details, 3=account
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    businessName: "", ownerName: "", county: "", subcounty: "", referrer: "", referrerCustom: "",
    email: "", password: "", confirm: "",
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const otpRefs = useRef([]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const normalizePhone = (p) => {
    const d = p.replace(/\D/g, "");
    if (d.startsWith("0") && d.length === 10) return "+254" + d.slice(1);
    if (d.startsWith("254") && d.length === 12) return "+" + d;
    return p;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!/^\+254\d{9}$/.test(normalized)) {
      setOtpError("Enter a valid Kenyan number e.g. 0712 345 678");
      return;
    }
    setOtpSending(true);
    setOtpError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/send/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep(1);
      } else {
        setOtpError(data.error || "Failed to send OTP. Try again.");
      }
    } catch {
      // DUMMY fallback: skip OTP in dev
      setStep(1);
    }
    setOtpSending(false);
  };

  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Enter the 6-digit code."); return; }
    setOtpSending(true);
    setOtpError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(phone), code }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setStep(2);
      } else {
        setOtpError("Incorrect code. Please try again.");
      }
    } catch {
      // DUMMY: skip in dev
      setStep(2);
    }
    setOtpSending(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    setStatus("saving");
    setError("");
    try {
      const normalized = normalizePhone(phone);
      const syntheticEmail = form.email || `${normalized.replace("+", "")}@quickduka.app`;
      const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, form.password);
      const finalReferrer = form.referrer === "__custom__" ? form.referrerCustom.trim() : form.referrer;
      await createUserProfile(cred.user.uid, {
        businessName: form.businessName,
        ownerName: form.ownerName,
        phone: normalized,
        email: syntheticEmail,
        county: form.county,
        subcounty: form.subcounty,
        referrer: finalReferrer || null,
      });
    } catch (err) {
      const msg = {
        "auth/email-already-in-use": "This phone/email is already registered.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/weak-password": "Password is too weak.",
      }[err.code] || "Registration failed. Please try again.";
      setError(msg);
      setStatus("idle");
    }
  };

  const selectedCounty = kenyaCounties.find(c => c.county === form.county);
  const subcounties = selectedCounty?.subcounties || [];

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 500 }}>
        <div className="login-header">
          <img src="/logo.png" alt="QuickDuka" className="login-logo-img" style={{ height: 60 }} />
          <p>Create your account — KES 100/month</p>
        </div>

        {/* Progress dots */}
        <div className="otp-steps" style={{ marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div key={i} className={`otp-step-dot${i <= step ? (i < step ? " done" : " active") : ""}`} title={s} />
          ))}
        </div>

        {/* STEP 0: Phone */}
        {step === 0 && (
          <form onSubmit={handleSendOTP} className="login-form">
            <div className="form-section-label">Your Phone Number</div>
            <div className="field-group">
              <label>M-Pesa / Phone Number *</label>
              <div className="login-input-icon">
                <span className="fa-icon-prefix"><FontAwesomeIcon icon={faPhone} /></span>
                <input type="tel" placeholder="07XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>We'll send a verification code via SMS.</span>
            </div>
            {otpError && <div className="login-error">{otpError}</div>}
            <button type="submit" className="btn-login" disabled={otpSending}>
              {otpSending ? "Sending code..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {/* STEP 1: OTP */}
        {step === 1 && (
          <form onSubmit={handleVerifyOTP} className="login-form">
            <div className="form-section-label">Verify Your Number</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Enter the 6-digit code sent to <strong>{normalizePhone(phone)}</strong></p>
            <div className="otp-input-row" style={{ justifyContent: "center", gap: 10, marginBottom: 8 }}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  className="otp-digit"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                />
              ))}
            </div>
            {otpError && <div className="login-error">{otpError}</div>}
            <button type="submit" className="btn-login" disabled={otpSending}>
              {otpSending ? "Verifying..." : "Verify Code"}
            </button>
            <div className="forgot-pw-wrap">
              <button type="button" className="forgot-pw-btn" onClick={() => setStep(0)}>← Change number</button>
            </div>
          </form>
        )}

        {/* STEP 2: Business Details */}
        {step === 2 && (
          <form onSubmit={e => { e.preventDefault(); setStep(3); }} className="login-form">
            <div className="form-section-label">Business Info</div>
            <div className="field-group">
              <label>Business Name *</label>
              <div className="login-input-icon">
                <span className="fa-icon-prefix"><FontAwesomeIcon icon={faStore} /></span>
                <input placeholder="e.g. Mama Mboga Supplies" value={form.businessName} onChange={set("businessName")} required />
              </div>
            </div>
            <div className="field-group">
              <label>Your Name *</label>
              <div className="login-input-icon">
                <span className="fa-icon-prefix"><FontAwesomeIcon icon={faUser} /></span>
                <input placeholder="Full name" value={form.ownerName} onChange={set("ownerName")} required />
              </div>
            </div>
            <div className="form-section-label" style={{ marginTop: 8 }}>Location</div>
            <div className="field-group">
              <label>County *</label>
              <select value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value, subcounty: "" }))} required>
                <option value="">-- Select County --</option>
                {kenyaCounties.map(c => <option key={c.county} value={c.county}>{c.county}</option>)}
              </select>
            </div>
            {subcounties.length > 0 && (
              <div className="field-group">
                <label>Sub-county</label>
                <select value={form.subcounty} onChange={set("subcounty")}>
                  <option value="">-- Select Sub-county --</option>
                  {subcounties.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="form-section-label" style={{ marginTop: 8 }}>Referral (Optional)</div>
            <div className="field-group">
              <label>Who referred you?</label>
              <select value={form.referrer} onChange={set("referrer")}>
                <option value="">-- No referral --</option>
                {REFERRERS.map(r => <option key={r} value={r}>{r}</option>)}
                <option value="__custom__">Other (type name)</option>
              </select>
            </div>
            {form.referrer === "__custom__" && (
              <div className="field-group">
                <label>Referrer Name</label>
                <input placeholder="Type referrer name" value={form.referrerCustom} onChange={set("referrerCustom")} />
              </div>
            )}
            <button type="submit" className="btn-login">Next →</button>
          </form>
        )}

        {/* STEP 3: Account credentials */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-section-label">Account Credentials</div>
            <div className="field-group">
              <label>Email (optional — can login with phone)</label>
              <div className="login-input-icon">
                <span className="fa-icon-prefix"><FontAwesomeIcon icon={faEnvelope} /></span>
                <input type="email" placeholder="you@example.com (optional)" value={form.email} onChange={set("email")} />
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Leave blank to use phone number as login only.</span>
            </div>
            <div className="field-group">
              <label>Password *</label>
              <div className="login-input-icon" style={{ position: "relative" }}>
                <span className="fa-icon-prefix"><FontAwesomeIcon icon={faLock} /></span>
                <input type={showPw ? "text" : "password"} placeholder="Min 6 characters" value={form.password} onChange={set("password")} required style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}>
                  <FontAwesomeIcon icon={showPw ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>
            <div className="field-group">
              <label>Confirm Password *</label>
              <input type="password" placeholder="Repeat password" value={form.confirm} onChange={set("confirm")} required />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn-login" disabled={status === "saving"}>
              {status === "saving" ? "Creating Account..." : "Create Account →"}
            </button>
            <div className="forgot-pw-wrap">
              <button type="button" className="forgot-pw-btn" onClick={() => setStep(2)}>← Back</button>
            </div>
          </form>
        )}

        <div className="forgot-pw-wrap" style={{ marginTop: 16 }}>
          <button className="forgot-pw-btn" onClick={onBack}>← Back to Sign In</button>
        </div>
      </div>
    </div>
  );
}
