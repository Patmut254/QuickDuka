import { useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, updateDoc, addDoc, collection, Timestamp, serverTimestamp } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faCheckCircle,
  faTimesCircle,
  faRotate,
  faArrowRightFromBracket,
  faGift,
  faLock,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import { PLANS as PLAN_MAP, PLAN_ORDER } from "../subscription";

// Set your deployed Django backend URL here
const MPESA_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

// Convert central plan map to ordered array for rendering
const PLANS = PLAN_ORDER.map((id) => ({
  ...PLAN_MAP[id],
  features: PLAN_MAP[id].features,
}));

export default function SubscriptionWall({ profile }) {
  const currentPlanId = profile?.subscriptionPlan || "starter";
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) || PLANS[0];

  const [activePlan, setActivePlan] = useState(currentPlanId);
  const [showPlans, setShowPlans] = useState(false);
  const [phone, setPhone] = useState(profile?.phone || "");
  const [stkStatus, setStkStatus] = useState("idle");
  const [stkMsg, setStkMsg] = useState("");
  const [checkStatus, setCheckStatus] = useState("idle");
  const [checkMsg, setCheckMsg] = useState("");

  const selectedPlan = PLANS.find((p) => p.id === activePlan) || currentPlan;

  const trialExpiry =
    profile?.subscriptionExpiry?.toDate?.() ??
    (profile?.subscriptionExpiry instanceof Date
      ? profile.subscriptionExpiry
      : null);

  const isTrialEnded =
    profile?.subscriptionStatus === "trial" &&
    trialExpiry &&
    new Date() > trialExpiry;
  const isExpired =
    profile?.subscriptionStatus === "expired" ||
    (profile?.subscriptionStatus === "active" &&
      trialExpiry &&
      new Date() > trialExpiry);

  const normalizePhone = (p) => {
    const digits = p.replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length === 10)
      return "254" + digits.slice(1);
    if (digits.startsWith("254") && digits.length === 12) return digits;
    return digits;
  };

  const handleSTKPush = async () => {
    const normalized = normalizePhone(phone);
    if (normalized.length < 12) {
      setStkStatus("error");
      setStkMsg("Enter a valid Kenyan phone number e.g. 0712 345 678");
      return;
    }
    if (!MPESA_BACKEND_URL) {
      setStkStatus("error");
      setStkMsg("Payment system not yet configured. Please contact support.");
      return;
    }
    setStkStatus("sending");
    setStkMsg("");
    try {
      const res = await fetch(`${MPESA_BACKEND_URL}/api/mpesa/stk-push/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          amount: selectedPlan.price,
          user_email: profile?.email,
          user_uid: profile?.id,
          account_ref: (profile?.phone || profile?.email || "QuickDuka").slice(
            0,
            12,
          ),
          description: `QuickDuka ${selectedPlan.name} Plan`,
          plan: selectedPlan.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStkStatus("sent");
        setStkMsg("M-Pesa prompt sent! Check your phone and enter your PIN.");
      } else {
        setStkStatus("error");
        setStkMsg(
          data.error || "Failed to send M-Pesa prompt. Please try again.",
        );
      }
    } catch {
      setStkStatus("error");
      setStkMsg(
        "Could not reach payment server. Check your internet and try again.",
      );
    }
  };

  const handleCheckPayment = async () => {
    setCheckStatus("checking");
    setCheckMsg("");
    try {
      const res = await fetch(
        `${MPESA_BACKEND_URL}/api/mpesa/check-payment/?uid=${profile?.id}`,
      );
      const data = await res.json();
      if (res.ok && data.activated) {
        // ── Save the confirmed plan + subscription to Firestore ──────────────
        // This is the canonical write that activates the plan after payment.
        // The backend confirms payment; the frontend owns the plan selection.
        try {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1);

          const userRef = doc(db, "users", profile.id);
          await updateDoc(userRef, {
            subscriptionPlan:   selectedPlan.id,
            subscriptionStatus: "active",
            subscriptionExpiry: Timestamp.fromDate(endDate),
            subscriptionStartDate: Timestamp.fromDate(startDate),
            lastPaymentAmount: selectedPlan.price,
            lastPaymentAt: serverTimestamp(),
            lastMpesaReceipt: data.mpesa_receipt || data.receipt || null,
          });

          // Log in paymentHistory subcollection for audit trail
          await addDoc(collection(db, "users", profile.id, "paymentHistory"), {
            type: "mpesa_payment",
            plan: selectedPlan.id,
            planName: selectedPlan.name,
            amount: selectedPlan.price,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            mpesaReceipt: data.mpesa_receipt || data.receipt || null,
            activatedAt: serverTimestamp(),
          });
        } catch (dbErr) {
          // DB write failed — still show success since payment went through,
          // but log it so admin can fix manually
          console.error("Failed to save subscription to Firestore:", dbErr);
        }
        // ─────────────────────────────────────────────────────────────────────

        setCheckStatus("ok");
        setCheckMsg("Payment confirmed! Opening your account...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setCheckStatus("pending");
        setCheckMsg(
          "Payment not confirmed yet. Please wait a moment and try again.",
        );
      }
    } catch {
      setCheckStatus("error");
      setCheckMsg("Could not verify. Please try again.");
    }
  };

  const heading = isTrialEnded
    ? "Your Free Trial Has Ended"
    : isExpired
      ? "Subscription Expired"
      : "Activate Your Account";

  const subtext = isTrialEnded
    ? `Your 1-month free trial is over, ${profile?.ownerName || ""}. Subscribe below to keep using QuickDuka.`
    : isExpired
      ? "Your monthly subscription has expired. Renew below to continue."
      : `Welcome, ${profile?.ownerName || ""}! Choose a plan and pay to activate your account.`;

  return (
    <div className="sub-wall">
      <div className="sub-dots sub-dots-tl" />
      <div className="sub-dots sub-dots-br" />

      <div className="sub-wall-card">
        <img src="/logo.png" alt="QuickDuka" className="sub-wall-logo" />

        <div className="sub-wall-icon">
          <FontAwesomeIcon icon={isTrialEnded ? faLock : faGift} />
        </div>

        <h2 className="sub-wall-title">{heading}</h2>
        <p className="sub-wall-msg">{subtext}</p>

        {/* Plan selector */}
        <div style={{ width: "100%", marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setShowPlans((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: `2px solid ${selectedPlan.color}`,
              borderRadius: 10,
              padding: "12px 16px",
              background: `${selectedPlan.color}0f`,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 15,
                  color: selectedPlan.color,
                }}
              >
                {selectedPlan.name} Plan
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                KES {selectedPlan.price.toLocaleString()} / month
              </div>
            </div>
            <FontAwesomeIcon
              icon={showPlans ? faChevronUp : faChevronDown}
              style={{ color: selectedPlan.color, fontSize: 13 }}
            />
          </button>

          {showPlans && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                marginTop: 6,
                overflow: "hidden",
              }}
            >
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setActivePlan(plan.id);
                    setShowPlans(false);
                    setStkStatus("idle");
                    setStkMsg("");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    textAlign: "left",
                    background:
                      activePlan === plan.id ? `${plan.color}0f` : "var(--bg2)",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: `2px solid ${plan.color}`,
                      background:
                        activePlan === plan.id ? plan.color : "transparent",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: plan.color,
                      }}
                    >
                      {plan.name}
                      {plan.badge && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 9,
                            background: plan.color,
                            color: "#fff",
                            padding: "1px 6px",
                            borderRadius: 20,
                          }}
                        >
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {plan.features.join(" · ")}
                    </div>
                  </div>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    KES {plan.price.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected plan features */}
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              background: "var(--bg2)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--muted)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              What&apos;s included
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {selectedPlan.features.map((f) => (
                <li
                  key={f}
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    marginBottom: 4,
                  }}
                >
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    style={{ color: selectedPlan.color, fontSize: 11 }}
                  />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sub-stk-box">
          <div className="sub-stk-label">
            <FontAwesomeIcon icon={faPhone} /> Pay KES{" "}
            {selectedPlan.price.toLocaleString()} via M-Pesa
          </div>
          <p className="sub-stk-hint">
            Enter your M-Pesa number. You&apos;ll receive a pop-up on your phone
            — enter your PIN to pay.
          </p>

          <div className="sub-stk-input-row">
            <input
              className="sub-stk-input"
              type="tel"
              placeholder="e.g. 0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={stkStatus === "sending" || stkStatus === "sent"}
            />
            <button
              className="btn-primary"
              style={{ minWidth: 110, justifyContent: "center" }}
              onClick={handleSTKPush}
              disabled={stkStatus === "sending" || stkStatus === "sent"}
            >
              {stkStatus === "sending"
                ? "Sending..."
                : stkStatus === "sent"
                  ? "Sent!"
                  : "Pay Now"}
            </button>
          </div>

          {stkMsg && (
            <div
              className={`sub-stk-msg ${stkStatus === "error" ? "sub-stk-error" : "sub-stk-success"}`}
            >
              <FontAwesomeIcon
                icon={stkStatus === "error" ? faTimesCircle : faCheckCircle}
                style={{ marginRight: 6 }}
              />
              {stkMsg}
            </div>
          )}
        </div>

        {stkStatus === "sent" && (
          <div style={{ marginTop: 16 }}>
            <p
              style={{
                fontSize: 13,
                color: "var(--muted)",
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              Entered your PIN? Click below to verify:
            </p>
            <button
              className="sub-refresh-btn"
              onClick={handleCheckPayment}
              disabled={checkStatus === "checking"}
            >
              <FontAwesomeIcon icon={faRotate} style={{ marginRight: 7 }} />
              {checkStatus === "checking"
                ? "Checking payment..."
                : "I've Paid — Verify Now"}
            </button>
            {checkMsg && (
              <div
                className={`sub-stk-msg ${checkStatus === "ok" ? "sub-stk-success" : "sub-stk-error"}`}
                style={{ marginTop: 10 }}
              >
                {checkMsg}
              </div>
            )}
          </div>
        )}

        {stkStatus === "error" && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <a
              href={`https://wa.me/254700000000?text=QuickDuka subscription - ${profile?.phone || profile?.email} - ${profile?.businessName || ""}`}
              target="_blank"
              rel="noreferrer"
              className="sub-wa-btn"
            >
              Need help? WhatsApp us
            </a>
          </div>
        )}

        <div className="sub-wall-note">
          <span>
            Account: <strong>{profile?.phone || profile?.email}</strong>
          </span>
          <span>
            Business: <strong>{profile?.businessName || "—"}</strong>
          </span>
          <span style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
            📅 Billed monthly. Your account locks on expiry — renew anytime.
          </span>
        </div>

        <button className="sub-logout-btn" onClick={() => signOut(auth)}>
          <FontAwesomeIcon
            icon={faArrowRightFromBracket}
            style={{ marginRight: 6 }}
          />
          Sign Out
        </button>
      </div>
    </div>
  );
}
