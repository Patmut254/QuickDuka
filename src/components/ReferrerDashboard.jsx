/* eslint-disable no-undef */
/**
 * ReferrerDashboard — shown to logged-in referrers so they can:
 * 1. See their referrals (which users they brought in)
 * 2. See every payment they've received (with date + amount)
 * 3. Know the status of each customer (active / inactive / not paying)
 *
 * The referrer is matched by name in the `users` collection field `referrer`.
 * Payment history lives in `referrers/{referrerId}/payments` subcollection.
 */
import { useLang } from "../LangContext";
import { useState, useEffect } from "react";
// import { useLang } from "../LangContext";
import { db } from "../firebase";
// import { useLang } from "../LangContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  // getDocs,
} from "firebase/firestore";
// import { useLang } from "../LangContext";
import { FontAwesomeIcon } from "./Icon";
// import { useLang } from "../LangContext";
import {
  faHandshake,
  faMoneyBillWave,
  faUsers,
  faCheckCircle,
  faExclamationTriangle,
  faUserSlash,
  faChartBar,
  faCalendar,
  faPhone,
} from "@fortawesome/free-solid-svg-icons";

function statusBadge(user) {
  const now = new Date();
  const expiry = user.subscriptionExpiry?.toDate?.() ?? null;
  const status = user.subscriptionStatus;

  if (status === "active" && expiry && expiry >= now) {
    return { label: t.statusPaying, color: "#22c55e", icon: faCheckCircle };
  }
  if (status === "trial") {
    return { label: t.statusTrial, color: "#f59e0b", icon: faCheckCircle };
  }
  if (!expiry || expiry < now) {
    return { label: t.statusNotPaying, color: "#ef4444", icon: faExclamationTriangle };
  }
  return { label: t.statusUnknown, color: "var(--muted)", icon: faExclamationTriangle };
}

export default function ReferrerDashboard({ referrerName, referrerId }) {
  const { t } = useLang();
  const [referrals, setReferrals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Load referred users
  useEffect(() => {
    if (!referrerName) return;
    const q = query(
      collection(db, "users"),
      where("referrer", "==", referrerName),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReferrals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingReferrals(false);
    }, () => setLoadingReferrals(false));
    return unsub;
  }, [referrerName]);

  // Load payments from referrers/{id}/payments subcollection
  useEffect(() => {
    if (!referrerId) return;
    const q = query(
      collection(db, "referrers", referrerId, "payments"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingPayments(false);
    }, () => setLoadingPayments(false));
    return unsub;
  }, [referrerId]);

  // Load referrer info
  useEffect(() => {
    if (!referrerId) return;
    const unsub = onSnapshot(
      collection(db, "referrers"),
      (snap) => {
        const found = snap.docs.find((d) => d.id === referrerId);
        if (found) setReferrerInfo({ id: found.id, ...found.data() });
      },
    );
    return unsub;
  }, [referrerId]);

  const totalEarned = referrerInfo?.totalPaid ?? payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const activeCount = referrals.filter((u) => {
    const expiry = u.subscriptionExpiry?.toDate?.() ?? null;
    return (u.subscriptionStatus === "active" || u.subscriptionStatus === "trial") && (!expiry || expiry >= new Date());
  }).length;
  const inactiveCount = referrals.length - activeCount;

  const tabs = [
    { id: "overview", label: t.overview, icon: faChartBar },
    { id: "referrals", label: `${t.referrals} (${referrals.length})`, icon: faUsers },
    { id: "payments", label: `${t.payments} (${payments.length})`, icon: faMoneyBillWave },
  ];

  const formatDate = (val) => {
    if (!val) return "";
    const d = val?.toDate?.() ?? (val instanceof Date ? val : new Date(val));
    return isNaN(d) ? "" : d.toLocaleDateString("sw-KE", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="module-page">
      {/* Header */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "20px 22px",
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--accent)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={faHandshake} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>
            {referrerInfo?.name ?? referrerName ?? "Referrer"}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {t.referrerDashTitle}
          </div>
          {referrerInfo?.mpesaPhone && (
            <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 3 }}>
              <FontAwesomeIcon icon={faPhone} style={{ marginRight: 4 }} />
              M-Pesa: {referrerInfo.mpesaPhone}
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
        marginBottom: 20,
      }}>
        {[
          { label: t.totalPaid, value: `KES ${Number(totalEarned).toLocaleString()}`, color: "#22c55e", icon: faMoneyBillWave },
          { label: t.totalReferrals, value: referrals.length, color: "var(--accent)", icon: faUsers },
          { label: t.active, value: activeCount, color: "#22c55e", icon: faCheckCircle },
          { label: t.inactive, value: inactiveCount, color: "#ef4444", icon: faUserSlash },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
          }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>
              <FontAwesomeIcon icon={icon} style={{ fontSize: 14, marginRight: 6, opacity: 0.7 }} />
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        borderBottom: "1px solid var(--border)",
        paddingBottom: 4,
        overflowX: "auto",
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "none",
              background: activeTab === tab.id ? "var(--accent)" : "transparent",
              color: activeTab === tab.id ? "#fff" : "var(--muted)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FontAwesomeIcon icon={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div>
          <div style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "18px 20px",
            marginBottom: 14,
          }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              {t.howPaymentsWork}
            </h3>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
              <div><strong>Mwezi 1:</strong> Bure kwa kila mteja / Month 1: Free for every customer</div>
              <div><strong>Mwezi 2:</strong> KES 50 kwa kila mteja anayenunua / Month 2: KES 50 per paying customer</div>
              <div><strong>Miezi 3 hadi 7:</strong> KES 20/mwezi kwa kila mteja / Months 3 to 7: KES 20/month per customer</div>
              <div><strong>Upeo kwa mteja 1:</strong> KES 150 kwa miezi 6 / Max per customer: KES 150 over 6 months</div>
            </div>
          </div>

          {/* Recent payments */}
          {payments.length > 0 && (
            <div style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "18px 20px",
            }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                <FontAwesomeIcon icon={faMoneyBillWave} style={{ marginRight: 8, color: "#22c55e" }} />
                Malipo ya Hivi Karibuni / Recent Payments
              </h3>
              {payments.slice(0, 3).map((p) => (
                <div key={p.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 15 }}>
                      KES {Number(p.amount).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {formatDate(p.createdAt)}
                      {p.note ? `: ${p.note}` : ""}
                    </div>
                  </div>
                  <div style={{
                    background: "#22c55e20",
                    color: "#22c55e",
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    Imelipwa
                  </div>
                </div>
              ))}
            </div>
          )}

          {payments.length === 0 && !loadingPayments && (
            <div style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "24px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
            }}>
              Hakuna malipo bado. / No payments recorded yet.<br />
              <span style={{ fontSize: 12 }}>Malipo yataonekana hapa mara yatakapofanywa na msimamizi. / Payments will appear here once processed by admin.</span>
            </div>
          )}
        </div>
      )}

      {/* Referrals tab */}
      {activeTab === "referrals" && (
        <div>
          {loadingReferrals ? (
            <div style={{ color: "var(--muted)", padding: 20, textAlign: "center" }}>{t.loading}</div>
          ) : referrals.length === 0 ? (
            <div style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "28px",
              textAlign: "center",
              color: "var(--muted)",
            }}>
              {t.noReferralsYet}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {referrals.map((u) => {
                const badge = statusBadge(u);
                const joined = u.createdAt?.toDate?.() ?? null;
                return (
                  <div key={u.id} style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                        {u.businessName || u.ownerName || ""}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {u.phone && <><FontAwesomeIcon icon={faPhone} style={{ marginRight: 4 }} />{u.phone} · </>}
                        <FontAwesomeIcon icon={faCalendar} style={{ marginRight: 4 }} />
                        {t.joined}: {joined ? formatDate(joined) : ""}
                      </div>
                    </div>
                    <div style={{
                      background: `${badge.color}20`,
                      color: badge.color,
                      borderRadius: 8,
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>
                      {badge.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {inactiveCount > 0 && (
            <div style={{
              marginTop: 16,
              background: "#ef444410",
              border: "1px solid #ef444430",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              color: "#ef4444",
            }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: 6 }} />
              {t.inactiveWarning(inactiveCount)} </div>
          )}
        </div>
      )}

      {/* Payments tab */}
      {activeTab === "payments" && (
        <div>
          <div style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
              {t.totalAllTime}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>
              KES {Number(totalEarned).toLocaleString()}
            </div>
          </div>

          {loadingPayments ? (
            <div style={{ color: "var(--muted)", padding: 20, textAlign: "center" }}>{t.loading}</div>
          ) : payments.length === 0 ? (
            <div style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "28px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
            }}>
              Hakuna malipo bado. / No payments recorded yet.<br />
              <span style={{ fontSize: 12 }}>Msimamizi ataweka rekodi ya malipo yako hapa. / Admin will record your payments here.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {payments.map((p, i) => (
                <div key={p.id} style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "14px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 16 }}>
                      KES {Number(p.amount).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      <FontAwesomeIcon icon={faCalendar} style={{ marginRight: 4 }} />
                      {formatDate(p.createdAt)}
                      {p.note ? `: ${p.note}` : ""}
                    </div>
                  </div>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 3,
                  }}>
                    <div style={{
                      background: "#22c55e20",
                      color: "#22c55e",
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}>
                      {t.paid}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>#{i + 1}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
