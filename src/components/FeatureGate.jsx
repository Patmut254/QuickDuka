/**
 * FeatureGate — wraps content that should only be visible/usable on certain plans.
 *
 * Usage:
 *   <FeatureGate feature="multipleUsers" sub={sub}>
 *     <AddStaffButton />
 *   </FeatureGate>
 *
 *   // With custom locked UI:
 *   <FeatureGate feature="multipleBranches" sub={sub} lockedLabel="Add Branch">
 *     <AddBranchForm />
 *   </FeatureGate>
 *
 * Props:
 *   feature      string   — limits key from subscription.js
 *   sub          object   — result of useSubscription(profile, isAdmin)
 *   children     node     — content to show when allowed
 *   lockedLabel  string?  — optional label for the locked button (default: feature)
 *   inline       bool?    — if true, renders a small inline locked badge instead of a full block
 */
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faArrowUp } from "@fortawesome/free-solid-svg-icons";

export default function FeatureGate({
  feature,
  sub,
  children,
  lockedLabel,
  inline = false,
  forceAllow = false,
}) {
  const [showTip, setShowTip] = useState(false);

  if (forceAllow || sub.can(feature)) {
    return children;
  }

  const message = sub.upgradeMsg(feature);
  const upgradePlan = sub.upgradePlan;

  // ── Inline locked badge (for table cells, small UI areas) ─────────────────
  if (inline) {
    return (
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 20,
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--muted)",
            cursor: "help",
          }}
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
          onClick={() => setShowTip((v) => !v)}
        >
          <FontAwesomeIcon icon={faLock} style={{ fontSize: 9 }} />
          {lockedLabel || "Locked"}
        </span>
        {showTip && (
          <span
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: 0,
              zIndex: 999,
              background: "var(--text)",
              color: "var(--bg)",
              padding: "7px 10px",
              borderRadius: 8,
              fontSize: 11,
              whiteSpace: "nowrap",
              maxWidth: 240,
              whiteSpace: "normal",
              lineHeight: 1.4,
              boxShadow: "0 4px 12px rgba(0,0,0,.2)",
            }}
          >
            {message}
          </span>
        )}
      </span>
    );
  }

  // ── Full locked block ──────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "20px 16px",
        borderRadius: 12,
        border: "1.5px dashed var(--border)",
        background: "var(--bg2)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted)",
          fontSize: 16,
        }}
      >
        <FontAwesomeIcon icon={faLock} />
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>
          {lockedLabel ? `${lockedLabel} — Upgrade Required` : "Feature Locked"}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, maxWidth: 280 }}>
          {message}
        </div>
      </div>

      {upgradePlan && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 20,
            background: upgradePlan.color + "15",
            border: `1.5px solid ${upgradePlan.color}40`,
            fontSize: 12,
            fontWeight: 700,
            color: upgradePlan.color,
          }}
        >
          <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 10 }} />
          Upgrade to {upgradePlan.name} — KES {upgradePlan.price.toLocaleString()}/mo
        </div>
      )}
    </div>
  );
}

/**
 * PlanBadge — small colored badge showing the current plan name.
 * Usage: <PlanBadge plan="growth" />
 */
export function PlanBadge({ plan }) {
  const colors = {
    starter: "#1a7a3c",
    growth: "#0369a1",
    business: "#7c3aed",
  };
  const names = { starter: "Starter", growth: "Growth", business: "Business" };
  const color = colors[plan] || colors.starter;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 20,
        background: color + "18",
        border: `1.5px solid ${color}40`,
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.2,
        textTransform: "capitalize",
      }}
    >
      {names[plan] || plan}
    </span>
  );
}
