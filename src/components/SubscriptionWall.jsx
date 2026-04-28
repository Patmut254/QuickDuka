import { useState } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone, faCheckCircle, faTimesCircle, faRotate,
  faArrowRightFromBracket, faGift, faLock
} from "@fortawesome/free-solid-svg-icons";

// Set your deployed Django backend URL here (e.g. from Vercel/Railway/Render)
const MPESA_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export default function SubscriptionWall({ profile }) {
  const [phone, setPhone] = useState(profile?.phone || "");
  const [stkStatus, setStkStatus] = useState("idle"); // idle | sending | sent | error
  const [stkMsg, setStkMsg] = useState("");
  const [checkStatus, setCheckStatus] = useState("idle");
  const [checkMsg, setCheckMsg] = useState("");

  const trialExpiry = profile?.subscriptionExpiry?.toDate?.() ??
    (profile?.subscriptionExpiry instanceof Date ? profile.subscriptionExpiry : null);

  const isTrialEnded = profile?.subscriptionStatus === "trial" && trialExpiry && new Date() > trialExpiry;
  const isExpired    = profile?.subscriptionStatus === "expired" ||
    (profile?.subscriptionStatus === "active" && trialExpiry && new Date() > trialExpiry);

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
          amount: 100,
          user_email: profile?.email,
          user_uid: profile?.id,
          account_ref: (profile?.phone || profile?.email || "QuickDuka").slice(0, 12),
          description: "QuickDuka Monthly Sub",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStkStatus("sent");
        setStkMsg("M-Pesa prompt sent! Check your phone and enter your PIN.");
      } else {
        setStkStatus("error");
        setStkMsg(data.error || "Failed to send M-Pesa prompt. Please try again.");
      }
    } catch {
      setStkStatus("error");
      setStkMsg("Could not reach payment server. Check your internet and try again.");
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
        setCheckMsg("Payment confirmed! Opening your account...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setCheckStatus("pending");
        setCheckMsg("Payment not confirmed yet. Please wait a moment and try again.");
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
    : `Welcome, ${profile?.ownerName || ""}! Pay KES 100 to activate your account.`;

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

        <div className="sub-price-tag">
          <span className="sub-price">KES 100</span>
          <span className="sub-period">/ month</span>
        </div>

        <div className="sub-stk-box">
          <div className="sub-stk-label">
            <FontAwesomeIcon icon={faPhone} /> Pay via M-Pesa STK Push
          </div>
          <p className="sub-stk-hint">
            Enter your M-Pesa number. You'll receive a pop-up on your phone — enter your PIN to pay.
          </p>

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
              style={{ minWidth: 110, justifyContent: "center" }}
              onClick={handleSTKPush}
              disabled={stkStatus === "sending" || stkStatus === "sent"}
            >
              {stkStatus === "sending" ? "Sending..." : stkStatus === "sent" ? "Sent!" : "Pay Now"}
            </button>
          </div>

          {stkMsg && (
            <div className={`sub-stk-msg ${stkStatus === "error" ? "sub-stk-error" : "sub-stk-success"}`}>
              <FontAwesomeIcon icon={stkStatus === "error" ? faTimesCircle : faCheckCircle} style={{ marginRight: 6 }} />
              {stkMsg}
            </div>
          )}
        </div>

        {stkStatus === "sent" && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, textAlign: "center" }}>
              Entered your PIN? Click below to verify:
            </p>
            <button
              className="sub-refresh-btn"
              onClick={handleCheckPayment}
              disabled={checkStatus === "checking"}
            >
              <FontAwesomeIcon icon={faRotate} style={{ marginRight: 7 }} />
              {checkStatus === "checking" ? "Checking payment..." : "I've Paid — Verify Now"}
            </button>
            {checkMsg && (
              <div className={`sub-stk-msg ${checkStatus === "ok" ? "sub-stk-success" : "sub-stk-error"}`} style={{ marginTop: 10 }}>
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
          <span>Account: <strong>{profile?.phone || profile?.email}</strong></span>
          <span>Business: <strong>{profile?.businessName || "—"}</strong></span>
          <span style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
            📅 KES 100/month billed monthly. Your account locks on expiry — renew anytime.
          </span>
        </div>

        <button className="sub-logout-btn" onClick={() => signOut(auth)}>
          <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ marginRight: 6 }} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
