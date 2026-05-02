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
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useUserProfile } from "./hooks/useUserProfile";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine,
  faMoneyBillTrendUp,
  faCartPlus,
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
} from "@fortawesome/free-solid-svg-icons";
import { faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import Dashboard from "./components/Dashboard";
import Sales from "./components/Sales";
import Purchases from "./components/Purchases";
import Expenses from "./components/Expenses";
import Reports from "./components/Reports";
import History from "./components/History";
import Credits from "./components/Credits";
import Stock from "./components/Stock";
import Register from "./components/Register";
import ReferrerRegister from "./components/ReferrerRegister";
import SubscriptionWall from "./components/SubscriptionWall";
import AdminPanel, { isAdmin } from "./components/AdminPanel";
import ContactPage from "./components/ContactPage";
import FAQPage from "./components/FAQPage";
import PrivacyPage from "./components/PrivacyPage";
import ProfilePage from "./components/ProfilePage";
import Losses from "./components/Losses";
import ReferrerDashboard from "./components/ReferrerDashboard";
import { LangContext, T } from "./LangContext";
import "./App.css";

const db = getFirestore();
const GRACE_DAYS = 2;

// Subscription gate
// Admin emails bypass this entirely (handled separately).
// trial  → active for 30 days from signup + grace
// active → active until expiry + grace
// anything else (expired/pending/undefined) → wall
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
    if (!expiry) return true; // no expiry set = unlimited trial (shouldn't happen)
    const grace = new Date(expiry.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    return new Date() <= grace;
  }

  if (status === "active") {
    if (!expiry) return true; // lifetime / admin-created without expiry
    const grace = new Date(expiry.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    return new Date() <= grace;
  }

  return false;
}

// Phone / email → Firebase Auth email
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
    return `${normalized.replace("+", "")}@quickduka.app`;
  }
  return trimmed;
}

// Online / Offline Banner
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
      ⚡ Offline — your records are saved on this device and will sync when
      internet returns
    </div>
  );
}

// Footer
function AppFooter({ offset }) {
  return (
    <div className={`app-footer${offset ? " app-footer-offset" : ""}`}>
      © 2026 QuickDuka. All rights reserved.
    </div>
  );
}

// Translations
// App Shell
function AppShell({ user, profile, theme, toggleTheme }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [lang, setLang] = useState(
    () => localStorage.getItem("qd-lang") || "en",
  );

  // isAdmin checks the Firebase Auth user email — reliable, doesn't need Firestore
  const admin = isAdmin(user);
  const isReferrer = profile?.role === "referrer";
  const t = T[lang];

  const toggleLang = () => {
    const next = lang === "en" ? "sw" : "en";
    setLang(next);
    localStorage.setItem("qd-lang", next);
  };

  const tabs = [
    { id: "dashboard", label: t.dashboard, icon: faChartLine },
    // Admin tab: shown when Firebase Auth email matches ADMIN_EMAIL
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
    // Referrer dashboard tab
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
    { id: "profile", label: t.profile, icon: faCircleUser },
    { id: "sales", label: t.sales, icon: faMoneyBillTrendUp },
    {
      id: "credits",
      label: t.credits,
      icon: faSquareCheck,
      badge: t.debt,
      badgeClass: "nav-badge-debt",
    },
    { id: "purchases", label: t.purchases, icon: faCartPlus },
    { id: "expenses", label: t.expenses, icon: faReceipt },
    { id: "losses", label: t.losses, icon: faTriangleExclamation },
    { id: "stock", label: t.stock, icon: faBox },
    { id: "reports", label: t.reports, icon: faSackDollar },
    { id: "history", label: t.history, icon: faClockRotateLeft },
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
  const mobileTabs = tabs.filter(
    (t) => !["contact", "faq", "privacy"].includes(t.id),
  );
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
          {/* Brand */}
          <div className="sidebar-brand">
            <img src="/logo-icon.png" alt="QuickDuka" />
            <span className="brand-name">QuickDuka</span>
          </div>

          {/* Business name */}
          {profile?.businessName && (
            <div className="sidebar-biz-name">{profile.businessName}</div>
          )}

          {/* Nav — scrollable, fills available space */}
          <nav className="sidebar-nav">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                className={"nav-item" + (activeTab === tab.id ? " active" : "")}
                onClick={() => setActiveTab(tab.id)}
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
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="nav-icon">
                  <FontAwesomeIcon icon={tab.icon} />
                </span>
                <span className="nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Subscription expiry chip — always visible above footer buttons */}
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

          {/* Language toggle — always visible */}
          <button
            className="sidebar-lang-toggle"
            onClick={toggleLang}
            title="Switch language / Badilisha lugha"
          >
            {lang === "en" ? "🇰🇪 Swahili" : "🇬🇧 English"}
          </button>

          {/* Sign out — always visible, never clipped */}
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
              onClick={() => setActiveTab(tab.id)}
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
                  Expires in {daysLeft}d
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
                onClick={() => setActiveTab("profile")}
                title="Go to Profile"
              >
                {profile?.ownerName || profile?.businessName || user.email}
              </button>
              <button className="logout-inline" onClick={() => signOut(auth)}>
                Sign out
              </button>
            </div>
          </header>

          <div className="page-body">
            {activeTab === "dashboard" && (
              <Dashboard setActiveTab={setActiveTab} />
            )}
            {activeTab === "sales" && <Sales />}
            {activeTab === "credits" && <Credits />}
            {activeTab === "purchases" && <Purchases />}
            {activeTab === "expenses" && <Expenses />}
            {activeTab === "losses" && <Losses />}
            {activeTab === "stock" && <Stock />}
            {activeTab === "reports" && <Reports />}
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
          </div>
        </main>
      </div>
    </LangContext.Provider>
  );
}

// Root App
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [view, setView] = useState("login"); // "login" | "register" | "reset" | "referrer"
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [resetInput, setResetInput] = useState("");
  const [resetStatus, setResetStatus] = useState("idle"); // idle|sending|sent|error
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

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginErr("");
    try {
      const email = await resolveLoginEmail(loginId);
      await signInWithEmailAndPassword(auth, email, loginPw);
    } catch {
      setLoginErr("Incorrect email/phone or password. Please try again.");
    }
    setLoggingIn(false);
  };

  // Password reset
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
        emailToReset.endsWith("@quickduka.app")
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

  // Splash — Firebase still checking auth
  if (user === undefined) {
    return (
      <div className="splash">
        <img src="/logo-icon.png" alt="QuickDuka" />
        <span className="splash-sub">Loading...</span>
      </div>
    );
  }

  // Admin route: yoursite.com/#/admin
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
                  🔐 Admin Access
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

    // Admin logged in on #/admin — full panel, no subscription check needed
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

  // Not logged in (regular app)
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
                  New to QuickDuka? (Start Free 1-Month Trial)
                </div>
                <button
                  className="btn-register"
                  onClick={() => setView("register")}
                >
                  Create Account
                </button>

                <div className="login-divider" style={{ marginTop: 14 }}>
                  Earn by referring businesses?
                </div>
                <button
                  className="btn-register"
                  style={{
                    background: "transparent",
                    border: "1.5px solid var(--accent)",
                    color: "var(--accent)",
                  }}
                  onClick={() => setView("referrer")}
                >
                  🤝 Register as a Referrer
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

  // Admin bypasses all profile / subscription checks
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

  // Profile loading
  if (profileLoading) {
    return (
      <div className="splash">
        <img src="/logo-icon.png" alt="QuickDuka" />
        <span className="splash-sub">Loading your account...</span>
      </div>
    );
  }

  // Profile not found after timeout
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
    // Still waiting for Firestore doc to appear
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

  // Subscription gate — no bypass for regular users
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
