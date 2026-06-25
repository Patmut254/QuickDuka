import { useState, useEffect } from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
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
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { PLANS as PLAN_MAP, PLAN_ORDER } from "../subscription";

const MPESA_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const SUPPORT_WHATSAPP = "254769758819";

const PLANS = PLAN_ORDER.map((id) => ({ ...PLAN_MAP[id] }));

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

  // FIX 1: Wake Render server on mount — prevents cold-start timeout on Pay Now
  const [serverReady, setServerReady] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);

  useEffect(() => {
    if (!MPESA_BACKEND_URL) return;
    setServerWaking(true);
    fetch(`${MPESA_BACKEND_URL}/`, { method: "GET" })
      .then(() => setServerReady(true))
      .catch(() => setServerReady(false)) // server offline — will show clear error
      .finally(() => setServerWaking(false));
  }, []);

  const selectedPlan = PLANS.find((p) => p.id === activePlan) || currentPlan;

  const subscriptionExpiry =
    profile?.subscriptionExpiry?.toDate?.() ??
    (profile?.subscriptionExpiry instanceof Date
      ? profile.subscriptionExpiry
      : null);

  const isTrialEnded =
    profile?.subscriptionStatus === "trial" &&
    subscriptionExpiry &&
    new Date() > subscriptionExpiry;

  const isExpired =
    profile?.subscriptionStatus === "expired" ||
    (profile?.subscriptionStatus === "active" &&
      subscriptionExpiry &&
      new Date() > subscriptionExpiry);

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

    // FIX 2: Show clear message if server is still waking up
    if (serverWaking) {
      setStkStatus("error");
      setStkMsg(
        "Payment server is starting up — please wait a few seconds and try again.",
      );
      return;
    }
    if (!serverReady) {
      setStkStatus("error");
      setStkMsg("Payment server is offline. Please WhatsApp us for help.");
      return;
    }

    setStkStatus("sending");
    setStkMsg("");
    try {
      // FIX 3: Add 30-second timeout so it doesn't hang forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${MPESA_BACKEND_URL}/api/mpesa/stk-push/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          phone: normalized,
          amount: selectedPlan.price,
          user_email: profile?.email,
          user_uid: profile?.id,
          plan: selectedPlan.id,
          account_ref: (profile?.phone || profile?.email || "QuickDuka").slice(
            0,
            12,
          ),
          description: `QuickDuka ${selectedPlan.name} Plan`,
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.success) {
        setStkStatus("sent");
        setStkMsg(
          "✅ M-Pesa prompt sent! Check your phone and enter your PIN.",
        );
      } else {
        setStkStatus("error");
        setStkMsg(
          data.error || "Failed to send M-Pesa prompt. Please try again.",
        );
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setStkStatus("error");
        setStkMsg(
          "Request timed out. The server took too long — please try again.",
        );
      } else {
        setStkStatus("error");
        setStkMsg(
          "Could not reach payment server. Check your internet and try again.",
        );
      }
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
        setCheckStatus("ok");
        setCheckMsg("🎉 Payment confirmed! Opening your account...");

        // FEATURE: Send WhatsApp notification to customer after successful payment
        await sendPaymentNotification(profile, selectedPlan);

        setTimeout(() => window.location.reload(), 1800);
      } else {
        setCheckStatus("pending");
        setCheckMsg("Payment not confirmed yet — wait a moment and try again.");
        setTimeout(() => {
          setCheckStatus("idle");
          setCheckMsg("");
        }, 3500);
      }
    } catch {
      setCheckStatus("error");
      setCheckMsg("Could not verify. Please try again.");
      setTimeout(() => {
        setCheckStatus("idle");
        setCheckMsg("");
      }, 3000);
    }
  };

  // Send WhatsApp notification to customer after payment confirmed
  const sendPaymentNotification = async (profile, plan) => {
    try {
      // Calculate expiry date (30 days from now)
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      const expiryStr = expiry.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const message = encodeURIComponent(
        `✅ *QuickDuka Payment Confirmed!*\n\n` +
          `Hello ${profile?.ownerName || ""},\n\n` +
          `Your *${plan.name} Plan* subscription for *${profile?.businessName || "your business"}* is now active.\n\n` +
          `📅 Valid until: *${expiryStr}*\n` +
          `💰 Amount paid: *KES ${plan.price.toLocaleString()}*\n\n` +
          `You now have full access to QuickDuka. Thank you for subscribing! 🙏\n\n` +
          `_For support, reply to this message._`,
      );

      // Try backend notification endpoint first
      if (MPESA_BACKEND_URL) {
        await fetch(`${MPESA_BACKEND_URL}/api/mpesa/notify/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: profile?.phone,
            owner_name: profile?.ownerName,
            business_name: profile?.businessName,
            plan_name: plan.name,
            plan_price: plan.price,
            expiry_date: expiryStr,
            user_uid: profile?.id,
          }),
        });
      }

      // Fallback: open WhatsApp with pre-filled message to customer
      // (Only if backend notification fails or isn't set up)
      // Uncomment to enable:
      // const customerPhone = normalizePhone(profile?.phone || "");
      // if (customerPhone.length >= 12) {
      //   window.open(`https://wa.me/${customerPhone}?text=${message}`, "_blank");
      // }
    } catch {
      // Notification failure should never block account activation
      console.warn("Payment notification skipped — will retry next session.");
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
      ? "Your subscription has expired. Renew below to continue."
      : `Welcome, ${profile?.ownerName || ""}! Your account is ready — choose a plan to get started.`;

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

        {/* Server wake-up indicator */}
        {serverWaking && (
          <div className="sub-server-waking">
            <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 7 }} />
            Connecting to payment server...
          </div>
        )}
        {!serverWaking && serverReady === false && MPESA_BACKEND_URL && (
          <div className="sub-server-offline">
            ⚠️ Payment server is currently offline. Please WhatsApp us for help.
          </div>
        )}

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
                    setCheckStatus("idle");
                    setCheckMsg("");
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

        {/* M-Pesa payment box */}
        <div className="sub-stk-box">
          <div className="sub-stk-label">
            <FontAwesomeIcon icon={faPhone} /> Pay KES{" "}
            {selectedPlan.price.toLocaleString()} via M-Pesa
          </div>
          <p className="sub-stk-hint">
            Enter your M-Pesa number. You&apos;ll get a pop-up on your phone —
            enter your PIN to pay.
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
              disabled={
                stkStatus === "sending" || stkStatus === "sent" || serverWaking
              }
            >
              {serverWaking ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    style={{ marginRight: 6 }}
                  />
                  Wait...
                </>
              ) : stkStatus === "sending" ? (
                "Sending..."
              ) : stkStatus === "sent" ? (
                "Sent ✓"
              ) : (
                "Pay Now"
              )}
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

        {/* Verify section — shown after STK push */}
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
              Entered your PIN? Click below to verify your payment:
            </p>
            <button
              className="sub-refresh-btn"
              onClick={handleCheckPayment}
              disabled={checkStatus === "checking" || checkStatus === "ok"}
            >
              <FontAwesomeIcon icon={faRotate} style={{ marginRight: 7 }} />
              {checkStatus === "checking"
                ? "Checking payment..."
                : checkStatus === "ok"
                  ? "Confirmed ✓"
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

        {/* WhatsApp support on error */}
        {stkStatus === "error" && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP}?text=QuickDuka subscription help - ${profile?.phone || profile?.email} - ${profile?.businessName || ""}`}
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
