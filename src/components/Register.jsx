/* eslint-disable react-hooks/set-state-in-effect */
import { useState } from "react";
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { createUserProfile } from "../hooks/useUserProfile";
import { kenyaCounties, REFERRERS } from "../data/kenyaLocations";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faEnvelope,
  faLock,
  faUser,
  faStore,
  faEye,
  faEyeSlash,
  faChevronRight,
  faChevronLeft,
  faCheckCircle,
  faShieldHalved,
  faGift,
} from "@fortawesome/free-solid-svg-icons";

function AppFooter() {
  return (
    <div className="app-footer">© 2026 QuickDuka. All rights reserved.</div>
  );
}

const db = getFirestore();

function TrialBadge() {
  return (
    <div className="trial-badge-popup">
      <div className="trial-badge-icon">
        <FontAwesomeIcon icon={faGift} />
      </div>
      <div>
        <div className="trial-badge-title">1 Month Free Trial</div>
        <div className="trial-badge-sub">
          Then KES 100/month — cancel anytime
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Account", "Business", "Done"];

export default function Register({ onBack }) {
  const [step, setStep] = useState(0);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [credError, setCredError] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [county, setCounty] = useState("");
  const [subcounty, setSubcounty] = useState("");
  const [referrer, setReferrer] = useState("");
  const [referrerCustom, setReferrerCustom] = useState("");
  const [bizError, setBizError] = useState("");

  const [saving, setSaving] = useState(false);

  const selectedCounty = kenyaCounties.find((c) => c.county === county);
  const subcounties = selectedCounty?.subcounties || [];

  const normalizePhone = (p) => {
    const d = p.replace(/\D/g, "");

    if (d.startsWith("07") && d.length === 10) return "+254" + d.slice(1);
    if (d.startsWith("011") && d.length === 10) return "+254" + d.slice(1);
    if (d.startsWith("01") && d.length === 10) return "+254" + d.slice(1);
    if (d.startsWith("254") && d.length === 12) return "+" + d;
    if ((d.startsWith("7") || d.startsWith("1")) && d.length === 9) {
      return "+254" + d;
    }

    return p;
  };

  const normPhone = normalizePhone(phone);
  const hasEmail = email.trim().length > 0;
  const hasPhone = /^\+254\d{9}$/.test(normPhone);

  const handleCredNext = async (e) => {
    e.preventDefault();
    setCredError("");

    if (!hasEmail) {
      return setCredError(
        "Email is required because we need it for verification and payment reminders.",
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setCredError("Enter a valid email address.");
    }

    if (phone.trim() && !hasPhone) {
      return setCredError(
        "Enter a valid Kenyan phone number e.g. 0712 345 678.",
      );
    }

    if (password.length < 6) {
      return setCredError("Password must be at least 6 characters.");
    }

    if (password !== confirm) {
      return setCredError("Passwords do not match.");
    }

    try {
      const eq = query(
        collection(db, "users"),
        where("email", "==", email.trim()),
      );
      const es = await getDocs(eq);

      if (!es.empty) {
        return setCredError("This email is already registered. Please log in.");
      }

      if (hasPhone) {
        const pq = query(
          collection(db, "users"),
          where("phone", "==", normPhone),
        );
        const ps = await getDocs(pq);

        if (!ps.empty) {
          return setCredError(
            "This phone number is already registered. Please log in.",
          );
        }
      }
    } catch (err) {
      console.warn("Duplicate check failed:", err);
    }

    setStep(1);
  };

  const handleBizNext = async (e) => {
    e.preventDefault();
    setBizError("");

    if (!businessName.trim()) return setBizError("Business name is required.");
    if (!ownerName.trim()) return setBizError("Your name is required.");
    if (!county) return setBizError("Please select your county.");

    await handleCreateAccount();
  };

  const handleCreateAccount = async () => {
    setSaving(true);
    setBizError("");

    try {
      const finalReferrer =
        referrer === "__custom__" ? referrerCustom.trim() : referrer;

      const loginEmail = email.trim();

      const cred = await createUserWithEmailAndPassword(
        auth,
        loginEmail,
        password,
      );

      try {
        await sendEmailVerification(cred.user);

        await createUserProfile(cred.user.uid, {
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          phone: hasPhone ? normPhone : null,
          email: loginEmail,
          realEmail: loginEmail,
          emailVerified: false,
          county,
          subcounty,
          referrer: finalReferrer || null,
        });
      } catch (err) {
        await cred.user.delete();
        throw err;
      }

      setStep(2);
    } catch (err) {
      console.error("Registration failed:", err);
      setSaving(false);

      const msg =
        {
          "auth/email-already-in-use": "This email is already registered.",
          "auth/invalid-email": "Invalid email address.",
          "auth/weak-password": "Password is too weak.",
        }[err.code] || "Registration failed. Please try again.";

      setBizError(msg);
      setStep(1);
    }
  };

  const stepBar = (
    <div className="reg-step-bar">
      {STEPS.map((s, i) => (
        <div
          key={i}
          className={`reg-step${i < step ? " done" : i === step ? " active" : ""}`}
        >
          <div className="reg-step-dot">
            {i < step ? <FontAwesomeIcon icon={faCheckCircle} /> : i + 1}
          </div>
          <span className="reg-step-label">{s}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="login-page">
      <div className="login-dots login-dots-tl" />
      <div className="login-dots login-dots-br" />
      <AppFooter />
      <TrialBadge />

      <div className="login-card" style={{ maxWidth: 480, paddingTop: 32 }}>
        <div className="login-header">
          <img
            src="/logo.png"
            alt="QuickDuka"
            className="login-logo-img"
            style={{ height: 58 }}
          />
          <p>Create your free account — 1 month free, then KES 100/month.</p>
        </div>

        {stepBar}

        {step === 0 && (
          <form onSubmit={handleCredNext} className="login-form" noValidate>
            <div className="form-section-label">Your Login Details</div>

            <div className="field-group">
              <label>Email Address *</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faEnvelope} />
                </div>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <span className="field-hint">
                Required for email verification and subscription reminders.
              </span>
            </div>

            <div className="field-group">
              <label>Phone Number</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faPhone} />
                </div>
                <input
                  type="tel"
                  placeholder="0712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <span className="field-hint">
                Optional now, but useful later for M-Pesa and support.
              </span>
            </div>

            <div className="form-section-label">Set Password</div>

            <div className="field-group">
              <label>Password</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faLock} />
                </div>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

            <div className="field-group">
              <label>Confirm Password</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faShieldHalved} />
                </div>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {credError && <div className="login-error">{credError}</div>}

            <button type="submit" className="btn-login">
              Continue <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleBizNext} className="login-form" noValidate>
            <div className="form-section-label">Business Details</div>

            <div className="field-group">
              <label>Business Name *</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faStore} />
                </div>
                <input
                  placeholder="e.g. Wanjiru General Store"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label>Your Full Name *</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faUser} />
                </div>
                <input
                  placeholder="Your name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-section-label">Location</div>

            <div className="form-row-2">
              <div className="field-group">
                <label>County *</label>
                <select
                  value={county}
                  onChange={(e) => {
                    setCounty(e.target.value);
                    setSubcounty("");
                  }}
                  required
                >
                  <option value="">Select County</option>
                  {kenyaCounties.map((c) => (
                    <option key={c.county} value={c.county}>
                      {c.county}
                    </option>
                  ))}
                </select>
              </div>

              {subcounties.length > 0 && (
                <div className="field-group">
                  <label>Sub-county</label>
                  <select
                    value={subcounty}
                    onChange={(e) => setSubcounty(e.target.value)}
                  >
                    <option value="">Select Sub-county</option>
                    {subcounties.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="form-section-label">Referral (Optional)</div>

            <div className="field-group">
              <label>Who referred you?</label>
              <select
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
              >
                <option value="">No referral</option>
                {REFERRERS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="__custom__">Other (type name)</option>
              </select>
              <span className="field-hint">
                This helps you track marketers and referral payments.
              </span>
            </div>

            {referrer === "__custom__" && (
              <div className="field-group">
                <label>Referrer Name</label>
                <input
                  placeholder="Type referrer name"
                  value={referrerCustom}
                  onChange={(e) => setReferrerCustom(e.target.value)}
                />
              </div>
            )}

            {bizError && <div className="login-error">{bizError}</div>}

            <button type="submit" className="btn-login" disabled={saving}>
              {saving ? (
                "Creating Account..."
              ) : (
                <>
                  Start My Free Month <FontAwesomeIcon icon={faChevronRight} />
                </>
              )}
            </button>

            <div className="forgot-pw-wrap">
              <button
                type="button"
                className="forgot-pw-btn"
                onClick={() => setStep(0)}
              >
                <FontAwesomeIcon icon={faChevronLeft} /> Back
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div style={{ textAlign: "center", padding: "28px 0 12px" }}>
            <div className="reset-sent-icon">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>

            <p
              style={{
                color: "var(--text)",
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 6,
                marginTop: 12,
              }}
            >
              Account Created!
            </p>

            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Your free 1-month trial has started. Please check your email and
              verify your account.
            </p>
          </div>
        )}

        {step < 2 && (
          <div className="forgot-pw-wrap" style={{ marginTop: 14 }}>
            <button className="forgot-pw-btn" onClick={onBack}>
              Already have an account? Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
