/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp as serverTimestamp_visit,
} from "firebase/firestore";
import { useUserProfile } from "./hooks/useUserProfile";
import { sendLoginSuccessEmail } from "./emailService";
import { FontAwesomeIcon } from "./components/Icon";
import {
  faChartLine,
  faMoneyBillTrendUp,
  // faCartPlus, // Purchases tab merged into Stock/Purchases
  faReceipt,
  faBox,
  faClockRotateLeft,
  faSliders,
  faSackDollar,
  faRightFromBracket,
  faSun,
  faMoon,
  faEnvelope,
  faQuestionCircle,
  faShieldHalved,
  faHeadset,
  faUser,
  faLock,
  faEye,
  faEyeSlash,
  faCheckCircle,
  faChevronLeft,
  faCircleUser,
  faTriangleExclamation,
  faUsers,
  faCodeBranch,
  faListCheck,
} from "@fortawesome/free-solid-svg-icons";
import { faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import Dashboard from "./components/Dashboard";
import Sales from "./components/Sales";
// Purchases now lives inside the Stock page (Stock/Purchases) — see Stock.jsx
// import Purchases from "./components/Purchases";
import Expenses from "./components/Expenses";
import Reports from "./components/Reports";
import History from "./components/History";
import Credits from "./components/Credits";
import Stock from "./components/Stock";
import Register from "./components/Register";
import ReferrerRegister from "./components/ReferrerRegister";
import SubscriptionWall from "./components/SubscriptionWall";
import AdminPanel, { isAdmin } from "./components/AdminPanel";
import { useSubscription } from "./hooks/useSubscription";
import { PlanBadge } from "./components/FeatureGate";
import ContactPage from "./components/ContactPage";
import FAQPage from "./components/FAQPage";
import { useIsMobile } from "./hooks/useIsMobile";
import PrivacyPage from "./components/PrivacyPage";
import ProfilePage from "./components/ProfilePage";
import Losses from "./components/Losses";
import TodoPage from "./components/TodoPage";
import { useCollection } from "./hooks/useCollection";
import { isDueNow } from "./todos";
import StaffPage from "./components/StaffPage";
import StaffShell from "./components/StaffShell";
import BranchesPage from "./components/BranchesPage";
import ReferrerDashboard from "./components/ReferrerDashboard";
import AIAssistant from "./components/AIAssistant";
import { LangContext, T } from "./LangContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

const db = getFirestore();
const GRACE_DAYS = 2;

function isSubscriptionActive(profile) {
  if (!profile) return false;
  if (isAdmin({ email: profile.email })) return true;

  const status = profile.subscriptionStatus;
  const expiry =
    profile.subscriptionExpiry?.toDate?.() ??
    (profile.subscriptionExpiry instanceof Date
      ? profile.subscriptionExpiry
      : null);

  if (status === "trial") {
    if (!expiry) return true;
    const grace = new Date(expiry.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    return new Date() <= grace;
  }

  if (status === "active") {
    if (!expiry) return true;
    const grace = new Date(expiry.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    return new Date() <= grace;
  }

  return false;
}

async function resolveLoginEmail(input) {
  const trimmed = input.trim();
  if (/^(\+?254|07|011|01)/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    let normalized;
    if (digits.startsWith("254") && digits.length === 12)
      normalized = "+" + digits;
    else if (digits.startsWith("0") && digits.length === 10)
      normalized = "+254" + digits.slice(1);
    else if (
      (digits.startsWith("7") || digits.startsWith("1")) &&
      digits.length === 9
    )
      normalized = "+254" + digits;
    else normalized = "+254" + digits.slice(1);

    const q = query(collection(db, "users"), where("phone", "==", normalized));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data().email;
    return `${normalized.replace("+", "")}@quickduka.com`;
  }
  return trimmed;
}

function OnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#856404",
        color: "#fff",
        padding: "7px 16px",
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
        letterSpacing: ".2px",
      }}
    >
      Offline, your records are saved on this device and will sync when
      internet returns
    </div>
  );
}

function AppFooter({ offset }) {
  return (
    <div className={`app-footer${offset ? " app-footer-offset" : ""}`}>
      © 2026 QuickDuka. All rights reserved.
    </div>
  );
}

function AppShell({ user, profile, theme, toggleTheme }) {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem("qd-active-tab");
    // "purchases" no longer has its own tab — it lives under Stock/Purchases.
    if (saved === "purchases") return "stock";
    return saved || "dashboard";
  });

  // ── Prefill state — AI assistant populates this when user asks to record ──
  // { sales: {...}, expenses: {...}, losses: {...}, credits: {...} }
  const [prefillData, setPrefillData] = useState({});

  // ── Per-client "hide on phone" pages ───────────────────────────────────────
  // Set by the admin on the user's profile (Admin panel → user → Phone view),
  // stored as profile.mobileHiddenTabs = ["reports", "history", …]. Those tabs
  // stay fully available on a computer and are only removed on phone-sized
  // screens. Accounts without the field see every page everywhere.
  const isMobile = useIsMobile();
  const mobileHidden = Array.isArray(profile?.mobileHiddenTabs)
    ? profile.mobileHiddenTabs
    : [];
  const isHiddenOnThisDevice = (id) => isMobile && mobileHidden.includes(id);

  const handleTabChange = (tab) => {
    if (isHiddenOnThisDevice(tab)) return;
    sessionStorage.setItem("qd-active-tab", tab);
    setActiveTab(tab);
  };

  // Called by AIAssistant when user asks to record something.
  // Switches to the right tab and stores the prefill data.
  const handleAIPrefill = (module, data) => {
    handleTabChange(module);
    setPrefillData((prev) => ({ ...prev, [module]: data }));
  };

  // Each form calls this once it has consumed the prefill data, so it
  // doesn't re-populate if the user navigates away and back.
  const clearPrefill = (module) => {
    setPrefillData((prev) => {
      const next = { ...prev };
      delete next[module];
      return next;
    });
  };

  // If a page is hidden on this device (e.g. restored from an old session, or
  // the phone was rotated into a narrow window), fall back to the first page
  // that is still visible.
  useEffect(() => {
    const hidden = Array.isArray(profile?.mobileHiddenTabs)
      ? profile.mobileHiddenTabs
      : [];
    if (isMobile && hidden.includes(activeTab)) {
      // land on the first page that isn't hidden (Dashboard, unless that is
      // hidden too — then Sales, and so on)
      const landing =
        [
          "dashboard",
          "sales",
          "credits",
          "expenses",
          "losses",
          "stock",
          "reports",
          "history",
        ].find((id) => !hidden.includes(id)) || "sales";
      sessionStorage.setItem("qd-active-tab", landing);
      setActiveTab(landing);
    }
  }, [isMobile, activeTab, profile?.mobileHiddenTabs]);

  useEffect(() => {
    if (!user?.uid || !activeTab) return;
    addDoc(collection(db, "pageVisits"), {
      uid: user.uid,
      page: activeTab,
      plan: profile?.subscriptionPlan || "starter",
      ts: serverTimestamp_visit(),
    }).catch(() => {});
  }, [activeTab, user?.uid, profile?.subscriptionPlan]);

  const [lang, setLang] = useState(
    () => localStorage.getItem("qd-lang") || "en",
  );

  const admin = isAdmin(user);
  const isReferrer = profile?.role === "referrer";
  const t = T[lang];

  const sub = useSubscription(profile, admin);

  // To-Do badge: tasks due today or overdue
  const { items: todoItems } = useCollection("todos");
  const todosDue = todoItems.filter((x) => isDueNow(x)).length;

  const toggleLang = () => {
    const next = lang === "en" ? "sw" : "en";
    setLang(next);
    localStorage.setItem("qd-lang", next);
  };

  const tabs = [
    { id: "dashboard", label: t.dashboard, icon: faChartLine },
    ...(admin
      ? [
          {
            id: "admin",
            label: t.admin,
            icon: faSliders,
            badgeStyle: { background: "#f59e0b", color: "#000" },
          },
        ]
      : []),
    ...(isReferrer
      ? [
          {
            id: "referrer-dashboard",
            label: t.referrerDash,
            icon: faUser,
            badgeStyle: { background: "#22c55e", color: "#fff" },
          },
        ]
      : []),
    ...(["growth", "business"].includes(sub.plan)
      ? [{ id: "team", label: t.team || "Team", icon: faUsers }]
      : []),
    ...(sub.plan === "business"
      ? [
          {
            id: "branches",
            label: t.branches || "Branches",
            icon: faCodeBranch,
          },
        ]
      : []),
    { id: "sales", label: t.sales, icon: faMoneyBillTrendUp },
    {
      id: "credits",
      label: t.credits,
      icon: faSquareCheck,
      badge: t.debt,
      badgeClass: "nav-badge-debt",
    },
    // Purchases is merged into the Stock page (Stock/Purchases), so it no longer
    // gets its own sidebar / bottom-nav entry.
    // { id: "purchases", label: t.purchases, icon: faCartPlus },
    { id: "expenses", label: t.expenses, icon: faReceipt },
    { id: "losses", label: t.losses, icon: faTriangleExclamation },
    { id: "stock", label: t.stockPurchases || "Stock/Purchases", icon: faBox },
    { id: "reports", label: t.reports, icon: faSackDollar },
    // To-Do sits near the end, just before History
    {
      id: "todo",
      label: t.todo || "To-Do",
      icon: faListCheck,
      ...(todosDue > 0 ? { badge: String(todosDue), badgeClass: "nav-badge-todo" } : {}),
    },
    { id: "history", label: t.history, icon: faClockRotateLeft },
    // Profile sits at the end of the main menu
    { id: "profile", label: t.profile, icon: faCircleUser },
    { id: "contact", label: t.contact, icon: faHeadset },
    { id: "faq", label: t.faq, icon: faQuestionCircle },
    { id: "privacy", label: t.privacy, icon: faShieldHalved },
  ];

  const mainTabs = tabs.filter(
    (t) => !["contact", "faq", "privacy"].includes(t.id),
  );
  const infoTabs = tabs.filter((t) =>
    ["contact", "faq", "privacy"].includes(t.id),
  );
  // Phone bottom nav: everything except the pages this client has chosen to
  // hide on phones (none, by default).
  const mobileTabs = tabs.filter((t) => !mobileHidden.includes(t.id));
  const currentTab = tabs.find((t) => t.id === activeTab);

  const expiryDate = profile?.subscriptionExpiry?.toDate?.();
  const daysLeft = expiryDate
    ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const showExpWarn = daysLeft !== null && daysLeft <= 5 && daysLeft > 0;

  return (
    <LangContext.Provider value={{ lang, t }}>
      <div className="app-shell">
        <OnlineStatus />
        <AppFooter offset={true} />

        {/* Sidebar (desktop) */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img src="/logo-icon.png" alt="QuickDuka" />
            <span className="brand-name">QuickDuka</span>
          </div>

          {profile?.businessName && (
            <div className="sidebar-biz-name">{profile.businessName}</div>
          )}

          {!admin && (
            <div
              style={{
                padding: "0 16px 10px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <PlanBadge plan={sub.plan} />
              {sub.status === "trial" && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    fontStyle: "italic",
                  }}
                >
                  Trial
                </span>
              )}
            </div>
          )}

          <nav className="sidebar-nav">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                className={"nav-item" + (activeTab === tab.id ? " active" : "")}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="nav-icon">
                  <FontAwesomeIcon icon={tab.icon} />
                </span>
                <span className="nav-label">{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`nav-badge ${tab.badgeClass || ""}`}
                    style={tab.badgeStyle}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}

            <div className="sidebar-divider" />
            <div className="sidebar-section-label">{t.info}</div>

            {infoTabs.map((tab) => (
              <button
                key={tab.id}
                className={"nav-item" + (activeTab === tab.id ? " active" : "")}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="nav-icon">
                  <FontAwesomeIcon icon={tab.icon} />
                </span>
                <span className="nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          {!admin && expiryDate && (
            <div className="sidebar-sub-info">
              <span
                className={daysLeft <= 5 ? "sub-expiry-warn" : "sub-expiry-ok"}
              >
                {daysLeft > 0
                  ? t.expiresIn(daysLeft)
                  : daysLeft === 0
                    ? t.expiresToday
                    : t.expired}
              </span>
            </div>
          )}

          <button
            className="sidebar-lang-toggle"
            onClick={toggleLang}
            title="Switch language / Badilisha lugha"
          >
            {lang === "en" ? "Swahili" : "English"}
          </button>

          <button className="logout-btn" onClick={() => signOut(auth)}>
            <FontAwesomeIcon icon={faRightFromBracket} /> {t.signOut}
          </button>
        </aside>

        {/* Mobile bottom nav */}
        <div className="mobile-bar">
          {mobileTabs.map((tab) => (
            <button
              key={tab.id}
              className={"mobile-tab" + (activeTab === tab.id ? " active" : "")}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="mobile-tab-icon">
                <FontAwesomeIcon icon={tab.icon} />
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="main-content">
          <header className="top-bar">
            <div className="page-title">
              <span className="page-title-icon">
                <FontAwesomeIcon icon={currentTab?.icon || faChartLine} />
              </span>
              {currentTab?.label}
            </div>
            <div className="top-bar-right">
              {showExpWarn && (
                <span className="expiry-warning-badge">
                  {t.expiresIn(daysLeft)}
                </span>
              )}
              <button
                className="lang-toggle-btn"
                onClick={toggleLang}
                title="Switch language"
              >
                {lang === "en" ? "SW" : "EN"}
              </button>
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                title="Toggle light/dark mode"
              >
                <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} />
              </button>
              <button
                className="user-badge user-badge-btn"
                onClick={() => handleTabChange("profile")}
                title={t.profile}
              >
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt=""
                    className="user-badge-photo"
                  />
                ) : (
                  <FontAwesomeIcon
                    icon={faCircleUser}
                    className="user-badge-icon-mobile"
                  />
                )}
                <span className="user-badge-name">
                  {profile?.ownerName || profile?.businessName || user.email}
                </span>
              </button>
              <button className="logout-inline" onClick={() => signOut(auth)}>
                {t.signOut}
              </button>
            </div>
          </header>

          <div className="page-body">
            <ErrorBoundary>
              {activeTab === "dashboard" && (
                <Dashboard
                  setActiveTab={handleTabChange}
                  sub={sub}
                  ownerUid={user.uid}
                  hideReportsLink={isHiddenOnThisDevice("reports")}
                />
              )}
              {activeTab === "todo" && <TodoPage ownerUid={user.uid} />}
              {activeTab === "sales" && (
                <Sales
                  ownerUid={user.uid}
                  sub={sub}
                  prefillData={prefillData.sales}
                  onPrefillConsumed={() => clearPrefill("sales")}
                />
              )}
              {activeTab === "credits" && (
                <Credits
                  ownerUid={user.uid}
                  prefillData={prefillData.credits}
                  onPrefillConsumed={() => clearPrefill("credits")}
                />
              )}
              {/* {activeTab === "purchases" && <Purchases ownerUid={user.uid} />} */}
              {activeTab === "expenses" && (
                <Expenses
                  ownerUid={user.uid}
                  prefillData={prefillData.expenses}
                  onPrefillConsumed={() => clearPrefill("expenses")}
                />
              )}
              {activeTab === "losses" && (
                <Losses
                  ownerUid={user.uid}
                  prefillData={prefillData.losses}
                  onPrefillConsumed={() => clearPrefill("losses")}
                />
              )}
              {activeTab === "team" && (
                <StaffPage sub={sub} profile={profile} />
              )}
              {activeTab === "branches" && <BranchesPage sub={sub} />}
              {activeTab === "stock" && <Stock sub={sub} ownerUid={user.uid} />}
              {activeTab === "reports" && <Reports ownerUid={user.uid} />}
              {activeTab === "history" && <History />}
              {activeTab === "profile" && (
                <ProfilePage user={user} profile={profile} />
              )}
              {activeTab === "admin" && admin && <AdminPanel />}
              {activeTab === "referrer-dashboard" && isReferrer && (
                <ReferrerDashboard
                  referrerName={
                    profile?.referrerName ||
                    profile?.ownerName ||
                    profile?.businessName
                  }
                  referrerId={profile?.referrerId}
                />
              )}
              {activeTab === "contact" && <ContactPage />}
              {activeTab === "faq" && <FAQPage />}
              {activeTab === "privacy" && <PrivacyPage />}
            </ErrorBoundary>
          </div>
        </main>

        {/* ── AI Assistant — floating bubble, visible on all pages ── */}
        <AIAssistant ownerUid={user.uid} onPrefill={handleAIPrefill} />
      </div>
    </LangContext.Provider>
  );
}

// Root App
export default function App() {
  const [user, setUser] = useState(undefined);
  const [view, setView] = useState("login");
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [resetInput, setResetInput] = useState("");
  const [resetStatus, setResetStatus] = useState("idle");
  const [resetMsg, setResetMsg] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  const [theme, setTheme] = useState(
    () => localStorage.getItem("qd-theme") || "light",
  );

  const {
    profile,
    loading: profileLoading,
    notFound: profileNotFound,
  } = useUserProfile();

  const isAdminRoute = window.location.hash === "#/admin";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("qd-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginErr("");
    try {
      const email = await resolveLoginEmail(loginId);
      await signInWithEmailAndPassword(auth, email, loginPw);
      // Fire-and-forget: never let a notification delay/block the login
      // that already succeeded. sendLoginSuccessEmail swallows its own
      // errors internally.
      sendLoginSuccessEmail({ toEmail: email, toName: loginId });
    } catch {
      setLoginErr("Incorrect email/phone or password. Please try again.");
    }
    setLoggingIn(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetStatus === "sending") return;
    setResetStatus("sending");
    setResetMsg("");
    try {
      const input = resetInput.trim();
      let emailToReset = input;

      if (/^\+?254|^07|^01/.test(input)) {
        const digits = input.replace(/\D/g, "");
        const normalized =
          "+" + (digits.startsWith("254") ? digits : "254" + digits.slice(1));
        const q = query(
          collection(db, "users"),
          where("phone", "==", normalized),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          emailToReset = data.realEmail || data.email;
        } else {
          setResetStatus("error");
          setResetMsg("No account found with that phone number.");
          return;
        }
      }

      if (
        !emailToReset ||
        !emailToReset.includes("@") ||
        emailToReset.endsWith("@quickduka.com")
      ) {
        setResetStatus("error");
        setResetMsg(
          "This account has no email address. Please contact support.",
        );
        return;
      }

      await sendPasswordResetEmail(auth, emailToReset);
      setResetEmail(emailToReset);
      setResetStatus("sent");
    } catch (err) {
      setResetStatus("error");
      const msgs = {
        "auth/user-not-found": "No account found with that email.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/too-many-requests":
          "Too many attempts. Please wait a few minutes.",
      };
      setResetMsg(
        msgs[err.code] || "Failed to send reset email. Please try again.",
      );
    }
  };

  if (user === undefined) {
    return (
      <div className="splash">
        <img src="/logo-icon.png" alt="QuickDuka" />
        <span className="splash-sub">Loading...</span>
      </div>
    );
  }

  if (isAdminRoute) {
    if (!user) {
      return (
        <>
          <div className="login-page">
            <div className="login-dots login-dots-tl" />
            <div className="login-blob" />
            <div className="login-card">
              <div className="login-header">
                <img
                  src="/logo.png"
                  alt="QuickDuka"
                  className="login-logo-img"
                />
                <p
                  style={{
                    color: "var(--accent)",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Admin Access
                </p>
              </div>
              <form onSubmit={handleLogin} className="login-form" noValidate>
                <div className="field-group">
                  <label htmlFor="admin-email">Admin Email</label>
                  <div className="input-icon-wrap">
                    <input
                      id="admin-email"
                      name="admin-email"
                      type="email"
                      placeholder="admin@email.com"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label htmlFor="admin-password">Password</label>
                  <div className="input-icon-wrap">
                    <input
                      id="admin-password"
                      name="admin-password"
                      type={showPw ? "text" : "password"}
                      placeholder="Admin password"
                      value={loginPw}
                      onChange={(e) => setLoginPw(e.target.value)}
                      autoComplete="current-password"
                      required
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
                {loginErr && <div className="login-error">{loginErr}</div>}
                <div className="login-form-actions">
                  <button
                    type="submit"
                    className="btn-login"
                    disabled={loggingIn}
                  >
                    {loggingIn ? "Signing in..." : "Sign In to Admin"}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <AppFooter />
        </>
      );
    }

    if (!isAdmin(user)) {
      return (
        <div className="splash">
          <img src="/logo-icon.png" alt="QuickDuka" />
          <span className="splash-sub" style={{ color: "var(--red)" }}>
            Access denied. Not an admin account.
          </span>
          <button
            style={{
              marginTop: 20,
              padding: "8px 20px",
              background: "transparent",
              border: "1px solid var(--border2)",
              borderRadius: 8,
              color: "var(--muted)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </div>
      );
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          padding: "24px 16px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/logo-icon.png"
                alt="QuickDuka"
                style={{ height: 36 }}
              />
              <span
                style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}
              >
                QuickDuka Admin
              </span>
            </div>
            <button
              onClick={() => {
                signOut(auth);
                window.location.hash = "#/admin";
              }}
              style={{
                background: "none",
                border: "1px solid var(--border2)",
                borderRadius: 8,
                padding: "7px 16px",
                color: "var(--muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
              }}
            >
              <FontAwesomeIcon icon={faRightFromBracket} /> Sign out
            </button>
          </div>
          <AdminPanel />
        </div>
      </div>
    );
  }

  if (!user) {
    if (view === "register") {
      return (
        <>
          <Register onBack={() => setView("login")} />
          <AppFooter />
        </>
      );
    }

    if (view === "referrer") {
      return <ReferrerRegister onBack={() => setView("login")} />;
    }

    return (
      <>
        <div className="login-page">
          <div className="login-dots login-dots-tl" />
          <div className="login-dots login-dots-br" />
          <div className="login-blob" />

          <div className="login-card">
            <div className="login-header">
              <img src="/logo.png" alt="QuickDuka" className="login-logo-img" />
              <p>Manage your sales. Grow your business.</p>
            </div>

            {view === "login" && (
              <>
                <form onSubmit={handleLogin} className="login-form" noValidate>
                  <div className="field-group">
                    <label htmlFor="login-id">Email or Phone Number</label>
                    <div className="input-icon-wrap">
                      <div className="input-icon-box">
                        <FontAwesomeIcon icon={faUser} />
                      </div>
                      <input
                        id="login-id"
                        name="login-id"
                        type="text"
                        placeholder="email@example.com or 0712 345 678"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>
                  <div className="field-group">
                    <label htmlFor="login-password">Password</label>
                    <div className="input-icon-wrap">
                      <div className="input-icon-box">
                        <FontAwesomeIcon icon={faLock} />
                      </div>
                      <input
                        id="login-password"
                        name="login-password"
                        type={showPw ? "text" : "password"}
                        placeholder="Your password"
                        value={loginPw}
                        onChange={(e) => setLoginPw(e.target.value)}
                        autoComplete="current-password"
                        required
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
                  {loginErr && <div className="login-error">{loginErr}</div>}
                  <div className="login-form-actions">
                    <button
                      type="submit"
                      className="btn-login"
                      disabled={loggingIn}
                    >
                      {loggingIn ? "Signing in..." : "Sign In"}
                    </button>
                  </div>
                </form>

                <div className="forgot-pw-wrap">
                  <button
                    className="forgot-pw-btn"
                    onClick={() => {
                      setView("reset");
                      setResetInput(loginId);
                      setResetStatus("idle");
                      setResetMsg("");
                    }}
                  >
                    Forgot your password?
                  </button>
                </div>

                <div className="login-divider">
                  New to QuickDuka?
                  <b> Start Free 1-Month Trial</b>
                </div>
                <button
                  className="btn-register"
                  border="var(--accent)"
                  onClick={() => setView("register")}
                >
                  Create a new account
                </button>

                <div className="login-divider" style={{ marginTop: 14 }}>
                  Earn by referring businesses?
                </div>
                <button
                  className="btn-register"
                  style={{
                    background: "transparent",
                    border: "var(--accent)",
                    color: "var(--accent)",
                  }}
                  onClick={() => setView("referrer")}
                >
                  Register as a Referrer
                </button>
              </>
            )}

            {view === "reset" && (
              <div>
                <button className="reset-back" onClick={() => setView("login")}>
                  <FontAwesomeIcon icon={faChevronLeft} /> Back to Sign In
                </button>
                {resetStatus !== "sent" ? (
                  <>
                    <h2 className="reset-title">Reset Password</h2>
                    <p className="reset-subtitle">
                      Enter your email or registered phone. We will send a reset
                      link to your email.
                    </p>
                    <form
                      onSubmit={handleResetPassword}
                      className="login-form"
                      noValidate
                    >
                      <div className="field-group">
                        <label htmlFor="reset-input">Email or Phone</label>
                        <div className="input-icon-wrap">
                          <div className="input-icon-box">
                            <FontAwesomeIcon icon={faEnvelope} />
                          </div>
                          <input
                            id="reset-input"
                            name="reset-input"
                            type="text"
                            autoComplete="username"
                            placeholder="email@example.com or 0712 345 678"
                            value={resetInput}
                            onChange={(e) => setResetInput(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      {resetMsg && (
                        <div
                          className={
                            resetStatus === "error"
                              ? "login-error"
                              : "login-success"
                          }
                        >
                          {resetMsg}
                        </div>
                      )}
                      <button
                        type="submit"
                        className="btn-login"
                        disabled={resetStatus === "sending"}
                      >
                        {resetStatus === "sending"
                          ? "Sending..."
                          : "Send Reset Link"}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="reset-sent">
                    <div className="reset-sent-icon">
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <p
                      style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}
                    >
                      Check your inbox.
                    </p>
                    <p className="reset-sent-msg">
                      A reset link was sent to{" "}
                      <span className="reset-sent-email">{resetEmail}</span>.
                      Check your spam folder if you don't see it.
                    </p>
                    <button
                      className="forgot-pw-btn"
                      style={{ marginTop: 20, display: "block" }}
                      onClick={() => setView("login")}
                    >
                      Back to Sign In
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <AppFooter />
      </>
    );
  }

  if (isAdmin(user)) {
    return (
      <AppShell
        user={user}
        profile={profile || { email: user.email }}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  if (profileLoading) {
    return (
      <div className="splash">
        <img src="/logo-icon.png" alt="QuickDuka" />
        <span className="splash-sub">Loading your account...</span>
      </div>
    );
  }

  if (!profile) {
    if (profileNotFound) {
      return (
        <div className="splash">
          <img src="/logo-icon.png" alt="QuickDuka" />
          <span
            className="splash-sub"
            style={{ color: "var(--red)", marginBottom: 8 }}
          >
            Account setup incomplete.
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--muted)",
              maxWidth: 280,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Your profile could not be created. Please sign out and try
            registering again, or contact support.
          </span>
          <button
            style={{
              marginTop: 24,
              padding: "8px 20px",
              background: "transparent",
              border: "1px solid var(--border2)",
              borderRadius: 8,
              color: "var(--muted)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </div>
      );
    }
    return (
      <div className="splash">
        <img src="/logo-icon.png" alt="QuickDuka" />
        <span className="splash-sub">Setting up your workspace...</span>
        <button
          style={{
            marginTop: 24,
            padding: "8px 20px",
            background: "transparent",
            border: "1px solid var(--border2)",
            borderRadius: 8,
            color: "var(--muted)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onClick={() => signOut(auth)}
        >
          Sign out
        </button>
      </div>
    );
  }

  if (profile?.role === "staff") {
    return <StaffShell user={user} profile={profile} />;
  }

  if (!isSubscriptionActive(profile)) {
    return (
      <>
        <SubscriptionWall profile={profile} />
        <AppFooter />
      </>
    );
  }

  return (
    <AppShell
      user={user}
      profile={profile}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}
