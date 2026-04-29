import { useState, useEffect, useRef } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
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
  faMobileAlt,
  faCheckCircle,
  faRotateLeft,
  faShieldHalved,
  faGift,
} from "@fortawesome/free-solid-svg-icons";

function AppFooter() {
  return (
    <div className="app-footer">© 2026 QuickDuka. All rights reserved.</div>
  );
}

const db = getFirestore();

// ─── OTP helpers ──────────────────────────────────────────────────────────────
// Calls Django backend for real email/SMS OTP.
// Backend URL: set VITE_BACKEND_URL in your .env (e.g. https://quickduka-back.onrender.com)
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "https://quickduka-back.onrender.com";

async function sendOTPCode(identifier, method) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/otp/send/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, method }),
    });
    const data = await res.json();
    if (!res.ok)
      return { success: false, error: data.error || "Failed to send code." };
    // dev_code is only present in development when email is not configured
    return { success: true, devCode: data.dev_code || null };
  } catch {
    return {
      success: false,
      error: "Could not reach the server. Check your internet connection.",
    };
  }
}

async function verifyOTPCode(identifier, inputCode) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/otp/verify/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code: inputCode }),
    });
    const data = await res.json();
    if (!res.ok)
      return { valid: false, reason: data.error || "Verification failed." };
    if (!data.valid)
      return { valid: false, reason: data.error || "Incorrect code." };
    return { valid: true };
  } catch {
    return {
      valid: false,
      reason: "Could not reach the server. Please try again.",
    };
  }
}

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(targetMs) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!targetMs) return;
    const tick = () => {
      const left = Math.ceil((targetMs - Date.now()) / 1000);
      setSecs(Math.max(0, left));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [targetMs]);
  return secs;
}

// ─── OTP digit input ──────────────────────────────────────────────────────────
function OTPInput({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = (value + "      ").slice(0, 6).split("");

  const handleChange = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const arr = (value + "      ").slice(0, 6).split("");
    arr[i] = v;
    const next = arr.join("").replace(/ /g, "").slice(0, 6);
    onChange(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted) {
      onChange(pasted);
      e.preventDefault();
    }
  };

  return (
    <div className="otp-digits">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="otp-digit"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i].trim()}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

// ─── Trial badge (top-right corner) ──────────────────────────────────────────
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

const STEPS = ["Account", "Verify", "Business", "Done"];

export default function Register({ onBack }) {
  const [step, setStep] = useState(0);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [credError, setCredError] = useState("");

  const [verifyMethod, setVerifyMethod] = useState("email");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendAt, setResendAt] = useState(null);
  const countdown = useCountdown(resendAt);
  const canResend = countdown === 0;

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
    if ((d.startsWith("7") || d.startsWith("1")) && d.length === 9)
      return "+254" + d;
    return p;
  };

  const normPhone = normalizePhone(phone);
  const hasEmail = email.trim().length > 0;
  const hasPhone = /^\+254\d{9}$/.test(normPhone);
  const verifyIdentifier = verifyMethod === "email" ? email.trim() : normPhone;

  const handleCredNext = async (e) => {
    e.preventDefault();
    setCredError("");
    if (!hasEmail && !hasPhone)
      return setCredError("Please enter at least an email or phone number.");
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setCredError("Enter a valid email address.");
    if (hasPhone === false && phone.trim())
      return setCredError(
        "Enter a valid Kenyan phone number e.g. 0712 345 678.",
      );
    if (password.length < 6)
      return setCredError("Password must be at least 6 characters.");
    if (password !== confirm) return setCredError("Passwords do not match.");

    try {
      if (hasEmail) {
        const eq = query(
          collection(db, "users"),
          where("email", "==", email.trim()),
        );
        const es = await getDocs(eq);
        if (!es.empty)
          return setCredError(
            "This email is already registered. Please log in.",
          );
      }
      if (hasPhone) {
        const pq = query(
          collection(db, "users"),
          where("phone", "==", normPhone),
        );
        const ps = await getDocs(pq);
        if (!ps.empty)
          return setCredError(
            "This phone number is already registered. Please log in.",
          );
      }
    } catch {
      // duplicate check is best-effort
    }

    setVerifyMethod(hasEmail ? "email" : "sms");
    setStep(1);
  };

  const handleSendOTP = async (method) => {
    const id = method === "email" ? email.trim() : normPhone;
    if (!id) return;
    setOtpSending(true);
    setOtpError("");
    setOtpCode("");
    const result = await sendOTPCode(id, method);
    if (!result.success) {
      setOtpError(result.error || "Failed to send code. Please try again.");
      setOtpSending(false);
      return;
    }
    // In dev mode, backend returns the code directly so you can test
    if (result.devCode) {
      console.info(`[DEV] OTP for ${id}: ${result.devCode}`);
      setOtpError(
        `[Dev mode] Code not sent via email/SMS yet. Check browser console or server logs. Code: ${result.devCode}`,
      );
    }
    setResendAt(Date.now() + 60000);
    setOtpSent(true);
    setOtpSending(false);
    setVerifyMethod(method);
  };

  useEffect(() => {
    if (step === 1 && !otpSent) {
      handleSendOTP(hasEmail ? "email" : "sms");
    }
  }, [step]);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setOtpError("");
    if (otpCode.length < 6) return setOtpError("Enter the full 6-digit code.");
    const result = await verifyOTPCode(verifyIdentifier, otpCode);
    if (!result.valid) return setOtpError(result.reason);
    setStep(2);
  };

  const handleBizNext = async (e) => {
    e.preventDefault();
    setBizError("");

    if (!businessName.trim()) return setBizError("Business name is required.");
    if (!ownerName.trim()) return setBizError("Your name is required.");
    if (!county) return setBizError("Please select your county.");

    await handleCreateAccount(); // WAIT for it
  };

  const handleCreateAccount = async () => {
    setSaving(true);

    try {
      const finalReferrer =
        referrer === "__custom__" ? referrerCustom.trim() : referrer;

      const loginEmail = hasEmail
        ? email.trim()
        : `${normPhone.replace("+", "")}@quickduka.app`;

      const cred = await createUserWithEmailAndPassword(
        auth,
        loginEmail,
        password,
      );

      await createUserProfile(cred.user.uid, {
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: hasPhone ? normPhone : null,
        email: loginEmail,
        realEmail: hasEmail ? email.trim() : null,
        county,
        subcounty,
        referrer: finalReferrer || null,
      });

      // ONLY after Firestore succeeds
      setStep(3);
    } catch (err) {
      console.error(err);
      setSaving(false);

      const msg =
        {
          "auth/email-already-in-use": "This email is already registered.",
          "auth/invalid-email": "Invalid email address.",
          "auth/weak-password": "Password is too weak.",
        }[err.code] || "Registration failed. Please try again.";

      setBizError(msg);
      setStep(2);
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
      {/* 3D gradient dot field — fades left → transparent */}
      <div className="login-dots login-dots-tl" />
      <div className="login-dots login-dots-br" />
      <AppFooter />

      {/* Trial popup badge — top right */}
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

        {/* ── STEP 0: Credentials ── */}
        {step === 0 && (
          <form onSubmit={handleCredNext} className="login-form" noValidate>
            <div className="form-section-label">Your Login Details</div>

            <div className="field-group">
              <label>Email Address</label>
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
                Optional if you provide a phone number.
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
                Optional if you provide an email.
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

        {/* ── STEP 1: OTP Verification ── */}
        {step === 1 && (
          <div className="login-form">
            <div className="form-section-label">Verify Your Identity</div>

            {hasEmail && hasPhone && (
              <div className="otp-method-row">
                <span className="otp-method-label">Send code to:</span>
                <button
                  type="button"
                  className={`otp-method-btn${verifyMethod === "email" ? " selected" : ""}`}
                  onClick={() => {
                    setVerifyMethod("email");
                    setOtpSent(false);
                    setOtpCode("");
                    setOtpError("");
                  }}
                >
                  <FontAwesomeIcon icon={faEnvelope} /> Email
                </button>
                <button
                  type="button"
                  className={`otp-method-btn${verifyMethod === "sms" ? " selected" : ""}`}
                  onClick={() => {
                    setVerifyMethod("sms");
                    setOtpSent(false);
                    setOtpCode("");
                    setOtpError("");
                  }}
                >
                  <FontAwesomeIcon icon={faMobileAlt} /> SMS
                </button>
              </div>
            )}

            {!otpSent ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  We will send a 6-digit code to your{" "}
                  {verifyMethod === "email"
                    ? `email (${email})`
                    : `phone (${normPhone})`}
                  .
                </p>
                <button
                  type="button"
                  className="btn-login"
                  onClick={() => handleSendOTP(verifyMethod)}
                  disabled={otpSending}
                >
                  {otpSending
                    ? "Sending..."
                    : `Send Code via ${verifyMethod === "email" ? "Email" : "SMS"}`}
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleVerifyOTP}
                className="login-form"
                style={{ gap: 14 }}
              >
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  Code sent to{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {verifyMethod === "email" ? email : normPhone}
                  </strong>
                  . Enter it below.
                </p>

                <OTPInput
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={false}
                />

                {otpError && <div className="login-error">{otpError}</div>}

                <button
                  type="submit"
                  className="btn-login"
                  disabled={otpCode.length < 6}
                >
                  Verify Code <FontAwesomeIcon icon={faCheckCircle} />
                </button>

                <div className="otp-resend-row">
                  {canResend ? (
                    <button
                      type="button"
                      className="otp-resend-btn"
                      onClick={() => handleSendOTP(verifyMethod)}
                      disabled={otpSending}
                    >
                      <FontAwesomeIcon icon={faRotateLeft} />{" "}
                      {otpSending ? "Sending..." : "Resend code"}
                    </button>
                  ) : (
                    <span className="otp-countdown">
                      Resend available in {countdown}s
                    </span>
                  )}
                </div>
              </form>
            )}

            <div className="forgot-pw-wrap" style={{ marginTop: 12 }}>
              <button
                className="forgot-pw-btn"
                onClick={() => {
                  setStep(0);
                  setOtpSent(false);
                  setOtpCode("");
                  setOtpError("");
                }}
              >
                <FontAwesomeIcon icon={faChevronLeft} /> Back
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Business Details ── */}
        {step === 2 && (
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
                onClick={() => setStep(1)}
              >
                <FontAwesomeIcon icon={faChevronLeft} /> Back
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 3 && (
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
              Your free 1-month trial has started. Welcome to QuickDuka!
            </p>
          </div>
        )}

        {step < 3 && (
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
