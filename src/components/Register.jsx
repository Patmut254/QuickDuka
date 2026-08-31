/* eslint-disable no-undef */
import { useState, useEffect } from "react";
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
  onSnapshot,
} from "firebase/firestore";
import {
  createUserProfile,
  beginRegistration,
  endRegistration,
} from "../hooks/useUserProfile";
import { kenyaCounties } from "../data/kenyaLocations";
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
import { PLANS as PLAN_MAP, PLAN_ORDER } from "../subscription";

const db = getFirestore();

// Plans come from the central subscription config so pricing stays in sync
const PLANS = PLAN_ORDER.map((id) => PLAN_MAP[id]);

const STEPS = ["Plan", "Account", "Business", "Done"];

function TrialBadge({ plan }) {
  const p = PLANS.find((x) => x.id === plan);
  return (
    <div className="trial-badge-popup">
      <div className="trial-badge-icon">
        <FontAwesomeIcon icon={faGift} />
      </div>
      <div>
        <div className="trial-badge-title">1 Month Free Trial</div>
        <div className="trial-badge-sub">
          Then KES {p ? p.price : 100}/month — cancel anytime
        </div>
      </div>
    </div>
  );
}

function DoneStep({ onBack }) {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          onBack(); // redirect to login
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onBack]);

  return (
    <div style={{ textAlign: "center", padding: "28px 0 12px" }}>
      <div
        className="reset-sent-icon"
        style={{ background: "var(--green-bg)", color: "var(--green)" }}
      >
        <FontAwesomeIcon icon={faCheckCircle} />
      </div>
      <p
        style={{
          color: "var(--text)",
          fontWeight: 800,
          fontSize: 17,
          marginBottom: 8,
          marginTop: 14,
        }}
      >
        Account Created!
      </p>
      <p
        style={{
          color: "var(--muted)",
          fontSize: 13,
          lineHeight: 1.7,
          marginBottom: 16,
        }}
      >
        Your free 1-month trial has started. Check your email to verify your
        account.
      </p>
      <div
        style={{
          background: "var(--green-bg)",
          border: "1px solid var(--green-lt)",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 13,
          color: "var(--green)",
          fontWeight: 600,
          marginBottom: 16,
        }}
      >
        Taking you to sign in in {countdown} second{countdown !== 1 ? "s" : ""}
        ...
      </div>
      <button className="btn-login" onClick={onBack}>
        Go to Sign In Now
      </button>
    </div>
  );
}

export default function Register({ onBack }) {
  const [step, setStep] = useState(0);

  // Step 0 — plan selection
  const [selectedPlan, setSelectedPlan] = useState("starter");

  // Step 1 — credentials
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [credError, setCredError] = useState("");

  // Step 1 — business
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [county, setCounty] = useState("");
  const [subcounty, setSubcounty] = useState("");
  const [referrer, setReferrer] = useState("");
  const [referrerCustom, setReferrerCustom] = useState("");
  const [bizError, setBizError] = useState("");
  const [saving, setSaving] = useState(false);
  const [referrersList, setReferrersList] = useState([]);

  // Load referrers from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "referrers"),
      (snap) => {
        setReferrersList(
          snap.docs.map((d) => ({ id: d.id, name: d.data().name })),
        );
      },
      () => {},
    );
    return unsub;
  }, []);

  const selectedCounty = kenyaCounties.find((c) => c.county === county);
  const subcounties = selectedCounty?.subcounties || [];

  /**
   * Normalize a Kenyan phone number to +254XXXXXXXXX format.
   * Accepts: 07XXXXXXXX (10 digits) or +254XXXXXXXXX (12 chars / 12 digits)
   * Returns normalized string, or original if unrecognized.
   */
  const normalizePhone = (p) => {
    const d = p.replace(/\D/g, ""); // strip everything except digits
    if (d.startsWith("07") && d.length === 10) return "+254" + d.slice(1); // 07XX → +2547XX
    if (d.startsWith("011") && d.length === 10) return "+254" + d.slice(1); // 011X → +25411X
    if (d.startsWith("01") && d.length === 10) return "+254" + d.slice(1); // 01XX → +25401X
    if (d.startsWith("254") && d.length === 12) return "+" + d; // 2547XX → +2547XX
    if ((d.startsWith("7") || d.startsWith("1")) && d.length === 9)
      return "+254" + d; // 7XX → +2547XX
    return p;
  };

  /**
   * Validate phone: returns an error string or empty string if valid.
   * Empty phone = optional, so empty is also valid.
   */
  const validatePhone = (p) => {
    if (!p.trim()) return ""; // optional field
    const digits = p.replace(/\D/g, "");
    const norm = normalizePhone(p);
    const isValid = /^\+254\d{9}$/.test(norm);
    if (isValid) return "";
    if (digits.length < 10)
      return "Phone number is too short. Use format: 0712345678 or +254712345678";
    if (digits.length > 12)
      return "Phone number is too long. Use format: 0712345678 or +254712345678";
    return "Invalid phone number. Use 0700000000 (10 digits) or +254700000000 (12 digits)";
  };

  const normPhone = normalizePhone(phone);
  const hasEmail = email.trim().length > 0;
  const hasPhone = /^\+254\d{9}$/.test(normPhone);
  const phoneError = validatePhone(phone);

  // Step 1 submit
  const handleCredNext = async (e) => {
    e.preventDefault();
    setCredError("");

    if (!hasEmail) {
      return setCredError(
        "Email is required for verification and payment reminders.",
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setCredError("Enter a valid email address.");
    }
    if (phone.trim() && phoneError) {
      return setCredError(phoneError);
    }
    if (password.length < 6) {
      return setCredError("Password must be at least 6 characters.");
    }
    if (password !== confirm) {
      return setCredError("Passwords do not match.");
    }

    // Best-effort duplicate check
    try {
      // Check active users
      const eq = query(
        collection(db, "users"),
        where("email", "==", email.trim()),
      );
      const es = await getDocs(eq);
      if (!es.empty)
        return setCredError(
          "This email address is already linked to an account. Please sign in instead.",
        );

      // Check blocked/deleted emails
      const blockedKey = email.trim().toLowerCase().replace(/\./g, "_");
      const blockedRef = doc(db, "blockedEmails", blockedKey);
      const blockedSnap = await getDoc(blockedRef);
      if (blockedSnap.exists())
        return setCredError(
          "This email address cannot be used to create a new account. Please contact support.",
        );

      if (hasPhone) {
        const pq = query(
          collection(db, "users"),
          where("phone", "==", normPhone),
        );
        const ps = await getDocs(pq);
        if (!ps.empty)
          return setCredError(
            "This phone number is already linked to an account. Each phone can only be used once.",
          );
      }
    } catch {
      // Duplicate check is best-effort — continue regardless
    }

    setStep(2);
  };

  // Step 2 submit
  const handleBizNext = async (e) => {
    e.preventDefault();
    setBizError("");

    if (!businessName.trim()) return setBizError("Business name is required.");
    if (!ownerName.trim()) return setBizError("Your name is required.");
    if (!county) return setBizError("Please select your county.");

    setSaving(true);

    // Tell useUserProfile a signup is in flight so it doesn't sign the new
    // user out the instant createUserWithEmailAndPassword auto-signs them
    // in but before the Firestore profile doc below has been written.
    beginRegistration();

    try {
      const finalReferrer =
        referrer === "__custom__" ? referrerCustom.trim() : referrer;
      const loginEmail = email.trim();

      // 1. Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(
        auth,
        loginEmail,
        password,
      );

      // 2. Send verification email (non-blocking)
      try {
        await sendEmailVerification(cred.user);
      } catch (verifyErr) {
        console.warn("Email verification send failed:", verifyErr.message);
      }

      // 3. Write Firestore profile with trial subscription + chosen plan
      await createUserProfile(cred.user.uid, {
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: hasPhone ? normPhone : null,
        email: loginEmail,
        realEmail: loginEmail,
        county,
        subcounty,
        referrer: finalReferrer || null,
        subscriptionPlan: selectedPlan,
      });

      setStep(3);
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
    } finally {
      endRegistration();
    }
  };

  // Step bar
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
      <TrialBadge plan={selectedPlan} />

      <div className="login-card" style={{ maxWidth: 440 }}>
        <div className="login-header">
          <img
            src="/logo.png"
            alt="QuickDuka"
            className="login-logo-img"
            style={{ height: 58 }}
          />
          <p>Create your free account — 1 month free, then pay monthly.</p>
        </div>

        {stepBar}

        {/* STEP 0: Plan Selection */}
        {step === 0 && (
          <div className="login-form">
            <div className="form-section-label">Choose Your Plan</div>
            <p
              style={{
                fontSize: 12,
                color: "var(--muted)",
                marginBottom: 12,
                marginTop: -6,
              }}
            >
              All plans include a free 1-month trial.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 18,
              }}
            >
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  style={{
                    border: `2px solid ${selectedPlan === plan.id ? plan.color : "var(--border)"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    background:
                      selectedPlan === plan.id
                        ? `${plan.color}0d`
                        : "var(--bg2)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 9 }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: `2px solid ${plan.color}`,
                        background:
                          selectedPlan === plan.id ? plan.color : "transparent",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedPlan === plan.id && (
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "#fff",
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: plan.color,
                      }}
                    >
                      {plan.name}
                    </span>
                    {plan.badge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 20,
                          letterSpacing: 0.5,
                          background: plan.color,
                          color: "#fff",
                        }}
                      >
                        {plan.badge}
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontWeight: 700,
                        fontSize: 13,
                        color: "var(--text)",
                      }}
                    >
                      KES {plan.price.toLocaleString()}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 400,
                          color: "var(--muted)",
                        }}
                      >
                        /mo
                      </span>
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: "5px 0 0 25px",
                      padding: 0,
                      listStyle: "disc",
                    }}
                  >
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          lineHeight: 1.6,
                        }}
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-login"
              onClick={() => setStep(1)}
            >
              Continue with {PLANS.find((p) => p.id === selectedPlan)?.name}{" "}
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        )}

        {/* STEP 1: Credentials */}
        {step === 1 && (
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
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <span className="field-hint">
                Required for verification and subscription reminders.
              </span>
            </div>

            <div className="field-group">
              <label>Phone Number*</label>
              <div className="input-icon-wrap">
                <div className="input-icon-box">
                  <FontAwesomeIcon icon={faPhone} />
                </div>
                <input
                  type="tel"
                  placeholder="07xxxxxxxx or +254700000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
              {phone.trim() && phoneError ? (
                <span
                  className="field-hint"
                  style={{ color: "var(--red, #ef4444)" }}
                >
                  {phoneError}
                </span>
              ) : phone.trim() && hasPhone ? (
                <span className="field-hint" style={{ color: "#16a34a" }}>
                  ✓ {normPhone}
                </span>
              ) : (
                <span className="field-hint">
                  Format: 0712345678 (10 digits) or +254712345678 (12 digits)
                </span>
              )}
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
              Endelea / Continue <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <div className="forgot-pw-wrap">
              <button
                type="button"
                className="forgot-pw-btn"
                onClick={() => setStep(0)}
              >
                <FontAwesomeIcon icon={faChevronLeft} /> Back to Plan
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Business Details */}
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

            <div className="form-section-label">
              Nani Alikushauri? / Referral (Optional)
            </div>
            <div className="field-group">
              <label>Who referred you?</label>
              <select
                value={referrer}
                onChange={(e) => setReferrer(e.target.value)}
              >
                <option value="">No referral</option>
                {referrersList.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
                <option value="__custom__">Other (type name)</option>
              </select>
              <span className="field-hint">
                Helps track marketers and referral payments.
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
                  {" "}
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

        {/* STEP 3: Done */}
        {step === 3 && <DoneStep onBack={onBack} />}

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
