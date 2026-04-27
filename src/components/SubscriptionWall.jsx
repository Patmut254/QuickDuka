import { useState } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

// ============================================================
// 🔴 DUMMY API — REPLACE BEFORE GOING LIVE
// Replace MPESA_BACKEND_URL with your deployed Django backend URL
// e.g. "https://quickduka-backend.vercel.app"
// See django_backend/ folder for the full Django code
// ============================================================
const MPESA_BACKEND_URL = "https://DUMMY-REPLACE-WITH-YOUR-VERCEL-URL.vercel.app";

export default function SubscriptionWall({ profile }) {
  const [phone, setPhone] = useState(profile?.phone || "");
  const [stkStatus, setStkStatus] = useState("idle"); // idle | sending | sent | error
  const [stkMsg, setStkMsg] = useState("");
  const [checkStatus, setCheckStatus] = useState("idle");
  const [checkMsg, setCheckMsg] = useState("");

  const isExpired = profile?.subscriptionStatus === "expired" ||
    (profile?.subscriptionExpiry && new Date() > profile.subscriptionExpiry?.toDate?.());

  const normalizePhone = (p) => {
    const digits = p.replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
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
    setStkStatus("sending");
    setStkMsg("");
    try {
      const res = await fetch(`${MPESA_BACKEND_URL}/api/mpesa/stk-push/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          amount: 100,
          user_email: profile?.email,
          user_uid: profile?.id,
          account_ref: profile?.phone || profile?.email || "QuickDuka",
          description: "QuickDuka Monthly Subscription",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStkStatus("sent");
        setStkMsg("✅ M-Pesa prompt sent to your phone! Enter your PIN to complete payment.");
      } else {
        setStkStatus("error");
        setStkMsg(data.error || "Failed to send M-Pesa prompt. Please try again.");
      }
    } catch {
      setStkStatus("error");
      setStkMsg("Could not reach payment server. Check your connection and try again.");
    }
  };

  const handleCheckPayment = async () => {
    setCheckStatus("checking");
    setCheckMsg("");
    try {
      const res = await fetch(`${MPESA_BACKEND_URL}/api/mpesa/check-payment/?uid=${profile?.id}`);
      const data = await res.json();
      if (res.ok && data.activated) {
        setCheckStatus("ok");
        setCheckMsg("✅ Payment confirmed! Refreshing...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setCheckStatus("pending");
        setCheckMsg("Payment not confirmed yet. If you've paid, please wait a moment and try again.");
      }
    } catch {
      setCheckStatus("error");
      setCheckMsg("Could not verify. Please try again.");
    }
  };

  return (
    <div className="sub-wall">
      <div className="sub-wall-card">
        <img src="/logo-icon.png" alt="QuickDuka" className="sub-wall-logo" />
        <h2 className="sub-wall-title">
          {isExpired ? "Subscription Expired" : "Activate Your Account"}
        </h2>
        <p className="sub-wall-msg">
          {isExpired
            ? "Your monthly subscription has expired. Pay KES 100 to continue."
            : "Welcome to QuickDuka! Pay KES 100 to activate your first month."}
        </p>

        <div className="sub-price-tag">
          <span className="sub-price">KES 100</span>
          <span className="sub-period">/ month</span>
        </div>

        {/* STK Push section */}
        <div className="sub-stk-box">
          <div className="sub-stk-label">📱 Pay via M-Pesa STK Push</div>
          <p className="sub-stk-hint">Enter your M-Pesa number — we'll send a payment prompt directly to your phone.</p>

          <div className="sub-stk-input-row">
            <input
              className="sub-stk-input"
              type="tel"
              placeholder="e.g. 0712 345 678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={stkStatus === "sending" || stkStatus === "sent"}
            />
            <button
              className="btn-primary"
              style={{ minWidth: 120 }}
              onClick={handleSTKPush}
              disabled={stkStatus === "sending" || stkStatus === "sent"}
            >
              {stkStatus === "sending" ? "Sending..." : stkStatus === "sent" ? "Sent ✅" : "Pay Now"}
            </button>
          </div>

          {stkMsg && (
            <div className={`sub-stk-msg ${stkStatus === "error" ? "sub-stk-error" : "sub-stk-success"}`}>
              {stkMsg}
            </div>
          )}
        </div>

        {/* After STK sent, show check button */}
        {stkStatus === "sent" && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
              Once you enter your M-Pesa PIN, click below to verify:
            </p>
            <button
              className="sub-refresh-btn"
              onClick={handleCheckPayment}
              disabled={checkStatus === "checking"}
            >
              {checkStatus === "checking" ? "Checking..." : "✅ I've Entered My PIN — Verify Payment"}
            </button>
            {checkMsg && (
              <div className={`sub-stk-msg ${checkStatus === "ok" ? "sub-stk-success" : "sub-stk-error"}`} style={{ marginTop: 8 }}>
                {checkMsg}
              </div>
            )}
          </div>
        )}

        <div className="sub-divider">— or pay manually —</div>

        {/* Manual fallback */}
        <div className="sub-steps">
          <div className="sub-step">
            <span className="sub-step-num">1</span>
            <div className="sub-step-text">
              <strong>M-Pesa → Lipa na M-Pesa → Buy Goods</strong>
              <div>Till Number: <span className="sub-till">YOUR_TILL_NUMBER</span></div>
            </div>
          </div>
          <div className="sub-step">
            <span className="sub-step-num">2</span>
            <div className="sub-step-text">
              <strong>Amount: KES 100</strong>
              <div>Reference: <em>{profile?.phone || profile?.email}</em></div>
            </div>
          </div>
          <div className="sub-step">
            <span className="sub-step-num">3</span>
            <div className="sub-step-text">
              <strong>WhatsApp your M-Pesa SMS to us</strong>
              <a
                href={`https://wa.me/254700000000?text=QuickDuka payment - ${profile?.email || ""} - ${profile?.businessName || ""}`}
                target="_blank"
                rel="noreferrer"
                className="sub-wa-btn"
              >
                📱 Send on WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="sub-wall-note">
          Account: <strong>{profile?.email}</strong><br />
          Business: <strong>{profile?.businessName || "-"}</strong>
        </div>

        <button className="sub-logout-btn" onClick={() => signOut(auth)}>Sign Out</button>
      </div>
    </div>
  );
}
