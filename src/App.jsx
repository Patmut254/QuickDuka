/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { useUserProfile } from "./hooks/useUserProfile";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine, faMoneyBillTrendUp, faClipboard, faCartPlus, faReceipt,
  faBox, faClockRotateLeft, faSliders, faSackDollar, faRightFromBracket,
  faSun, faMoon, faEnvelope, faPhone, faQuestionCircle, faShieldHalved,
  faHeadset, faBars, faTimes, faUser, faLock, faEye, faEyeSlash
} from "@fortawesome/free-solid-svg-icons";
import { faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import Dashboard from "./components/Dashboard";
import Sales from "./components/Sales";
import Purchases from "./components/Purchases";
import Expenses from "./components/Expenses";
import Reports from "./components/Reports";
import History from "./components/History";
import Credits from "./components/Credits";
import Catalogue from "./components/Catalogue";
import Register from "./components/Register";
import SubscriptionWall from "./components/SubscriptionWall";
import AdminPanel, { isAdmin } from "./components/AdminPanel";
import ContactPage from "./components/ContactPage";
import FAQPage from "./components/FAQPage";
import PrivacyPage from "./components/PrivacyPage";
import "./App.css";

const db = getFirestore();
const GRACE_DAYS = 2;

function isSubscriptionActive(profile) {
  if (!profile) return false;
  if (isAdmin({ email: profile.email })) return true;
  if (profile.subscriptionStatus === "active") {
    const expiry = profile.subscriptionExpiry?.toDate?.();
    if (!expiry) return true;
    const grace = new Date(expiry.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    return new Date() <= grace;
  }
  return false;
}

function AppShell({ user, profile, theme, toggleTheme }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const admin = isAdmin(user);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: faChartLine },
    { id: "sales", label: "Sales", icon: faMoneyBillTrendUp },
    { id: "credits", label: "Credits", icon: faSquareCheck, badge: "Debt", badgeClass: "nav-badge-debt" },
    { id: "purchases", label: "Purchases", icon: faCartPlus },
    { id: "expenses", label: "Expenses", icon: faReceipt },
    { id: "catalogue", label: "Catalogue", icon: faBox },
    { id: "reports", label: "Reports", icon: faSackDollar },
    { id: "history", label: "History", icon: faClockRotateLeft, badge: "Log" },
    ...(admin ? [{ id: "admin", label: "Admin", icon: faSliders, badge: "Admin", badgeStyle: { background: "#fbbf24", color: "#000" } }] : []),
    { id: "contact", label: "Contact", icon: faHeadset },
    { id: "faq", label: "FAQ", icon: faQuestionCircle },
    { id: "privacy", label: "Privacy", icon: faShieldHalved },
  ];

  const expiryDate = profile?.subscriptionExpiry?.toDate?.();
  const daysLeft = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const showExpiryWarning = daysLeft !== null && daysLeft <= 5 && daysLeft > 0;

  const currentTab = tabs.find(t => t.id === activeTab);

  const navClick = (id) => { setActiveTab(id); setSidebarOpen(false); };

  const mainTabs = tabs.filter(t => !["contact", "faq", "privacy"].includes(t.id));
  const infoTabs = tabs.filter(t => ["contact", "faq", "privacy"].includes(t.id));
  const mobileTabs = tabs.filter(t => !["contact", "faq", "privacy", "admin"].includes(t.id));

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/logo-icon.png" alt="QuickDuka" />
          <span className="brand-name">QuickDuka</span>
        </div>
        {profile?.businessName && (
          <div className="sidebar-biz-name">{profile.businessName}</div>
        )}
        <nav className="sidebar-nav">
          {mainTabs.map(t => (
            <button key={t.id} className={"nav-item" + (activeTab === t.id ? " active" : "")} onClick={() => navClick(t.id)}>
              <span className="nav-icon"><FontAwesomeIcon icon={t.icon} /></span>
              <span className="nav-label">{t.label}</span>
              {t.badge && <span className="nav-badge" style={t.badgeStyle || {}}>{t.badge}</span>}
            </button>
          ))}
          <div className="sidebar-divider" />
          <div className="sidebar-section-label">Info</div>
          {infoTabs.map(t => (
            <button key={t.id} className={"nav-item" + (activeTab === t.id ? " active" : "")} onClick={() => navClick(t.id)}>
              <span className="nav-icon"><FontAwesomeIcon icon={t.icon} /></span>
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
        </nav>
        {!admin && expiryDate && (
          <div className="sidebar-sub-info">
            <span className={daysLeft <= 5 ? "sub-expiry-warn" : "sub-expiry-ok"}>
              {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Expires today" : "Expired"}
            </span>
          </div>
        )}
        <button className="logout-btn" onClick={() => signOut(auth)}>
          <FontAwesomeIcon icon={faRightFromBracket} /> Sign Out
        </button>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 99 }} />}

      <div className="mobile-bar">
        {mobileTabs.map(t => (
          <button key={t.id} className={"mobile-tab" + (activeTab === t.id ? " active" : "")} onClick={() => setActiveTab(t.id)}>
            <span className="mobile-tab-icon"><FontAwesomeIcon icon={t.icon} /></span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            <span className="page-title-icon"><FontAwesomeIcon icon={currentTab?.icon || faChartLine} /></span>
            {currentTab?.label}
          </div>
          <div className="top-bar-right">
            {showExpiryWarning && <span className="expiry-warning-badge">Expires in {daysLeft}d</span>}
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle dark/light mode">
              <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} />
            </button>
            <span className="user-badge">{profile?.ownerName || user.email}</span>
            <button className="logout-inline" onClick={() => signOut(auth)}>Sign out</button>
          </div>
        </header>
        <div className="page-body">
          {activeTab === "dashboard" && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === "sales" && <Sales />}
          {activeTab === "credits" && <Credits />}
          {activeTab === "purchases" && <Purchases />}
          {activeTab === "expenses" && <Expenses />}
          {activeTab === "catalogue" && <Catalogue />}
          {activeTab === "reports" && <Reports />}
          {activeTab === "history" && <History />}
          {activeTab === "admin" && admin && <AdminPanel />}
          {activeTab === "contact" && <ContactPage />}
          {activeTab === "faq" && <FAQPage />}
          {activeTab === "privacy" && <PrivacyPage />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [activeView, setActiveView] = useState("login");
  const [loginId, setLoginId] = useState(""); // email or phone
  const [loginPassword, setLoginPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState("idle");
  const [resetMsg, setResetMsg] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("qd-theme") || "light");

  const { profile, loading: profileLoading } = useUserProfile();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("qd-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // Resolve phone → email for login
  const resolveEmail = async (input) => {
    const trimmed = input.trim();
    // If it looks like a phone number
    if (/^\+?254|^07|^01/.test(trimmed)) {
      const digits = trimmed.replace(/\D/g, "");
      const normalized = digits.startsWith("254") ? digits : "254" + digits.slice(1);
      // Look up synthetic email
      const q = query(collection(db, "users"), where("phone", "==", `+${normalized}`));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        return data.email || `${normalized}@quickduka.app`;
      }
      return `${normalized}@quickduka.app`;
    }
    return trimmed;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const email = await resolveEmail(loginId);
      await signInWithEmailAndPassword(auth, email, loginPassword);
    } catch {
      setLoginError("Invalid credentials. Please check your email/phone and password.");
    }
    setLoggingIn(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetStatus === "sending") return;
    setResetStatus("sending");
    setResetMsg("");
    try {
      const email = await resolveEmail(resetEmail);
      await sendPasswordResetEmail(auth, email);
      setResetStatus("sent");
      setResetMsg("Password reset email sent! Check your inbox.");
    } catch (err) {
      setResetStatus("error");
      if (err.code === "auth/user-not-found") setResetMsg("No account found with that email/phone.");
      else if (err.code === "auth/invalid-email") setResetMsg("Please enter a valid email address.");
      else setResetMsg("Failed to send reset email. Please try again.");
    }
  };

  if (user === undefined) {
    return (
      <div className="splash">
        <div className="splash-logo"><img src="/logo-icon.png" alt="QuickDuka" /></div>
        <span className="splash-sub">Loading...</span>
      </div>
    );
  }

  if (!user) {
    if (activeView === "register") return <Register onBack={() => setActiveView("login")} />;
    return (
      <div className="login-page">
        <div className="login-bg-pattern" />
        <div className="login-card">
          <div className="login-header">
            <img src="/logo.png" alt="QuickDuka" className="login-logo-img" />
            <p>Manage your sales. Grow your business.</p>
          </div>
          {!showReset ? (
            <>
              <form onSubmit={handleLogin} className="login-form">
                <div className="field-group">
                  <label>Email or Phone Number</label>
                  <div className="login-input-icon">
                    <span className="fa-icon-prefix"><FontAwesomeIcon icon={faUser} /></span>
                    <input
                      type="text"
                      placeholder="email@example.com or 0712345678"
                      value={loginId}
                      onChange={e => setLoginId(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label>Password</label>
                  <div className="login-input-icon" style={{ position: "relative" }}>
                    <span className="fa-icon-prefix"><FontAwesomeIcon icon={faLock} /></span>
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                      style={{ paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}>
                      <FontAwesomeIcon icon={showPw ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>
                {loginError && <div className="login-error">{loginError}</div>}
                <button type="submit" className="btn-login" disabled={loggingIn}>
                  {loggingIn ? "Signing in..." : "Sign In"}
                </button>
              </form>
              <div className="forgot-pw-wrap">
                <button className="forgot-pw-btn" onClick={() => { setShowReset(true); setResetEmail(loginId); setResetStatus("idle"); setResetMsg(""); }}>
                  Forgot password?
                </button>
              </div>
              <div className="login-divider">New here?</div>
              <button className="btn-register" onClick={() => setActiveView("register")}>
                Create Account — KES 100/month
              </button>
            </>
          ) : (
            <div className="reset-section">
              <h2 className="reset-title">Reset Password</h2>
              <p className="reset-subtitle">Enter your email or phone number and we'll send a reset link.</p>
              {resetStatus !== "sent" ? (
                <form onSubmit={handleResetPassword} className="login-form">
                  <div className="field-group">
                    <label>Email or Phone</label>
                    <input type="text" placeholder="email or 0712345678" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                  </div>
                  {resetMsg && <div className={resetStatus === "error" ? "login-error" : "login-success"}>{resetMsg}</div>}
                  <button type="submit" className="btn-login" disabled={resetStatus === "sending"}>
                    {resetStatus === "sending" ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>
              ) : (
                <div className="reset-sent-box">
                  <div className="reset-sent-icon">✅</div>
                  <p className="reset-sent-msg">{resetMsg}</p>
                </div>
              )}
              <div className="forgot-pw-wrap">
                <button className="forgot-pw-btn" onClick={() => setShowReset(false)}>← Back to Sign In</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="splash">
        <div className="splash-logo"><img src="/logo-icon.png" alt="QuickDuka" /></div>
        <span className="splash-sub">Loading your account...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="splash">
        <div className="splash-logo"><img src="/logo-icon.png" alt="QuickDuka" /></div>
        <span className="splash-sub">Setting up your account...</span>
        <button style={{ marginTop: 24, padding: "8px 20px", background: "transparent", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--muted)", cursor: "pointer" }} onClick={() => signOut(auth)}>Sign out</button>
      </div>
    );
  }

  if (!isAdmin(user) && !isSubscriptionActive(profile)) {
    return <SubscriptionWall profile={profile} />;
  }

  return <AppShell user={user} profile={profile} theme={theme} toggleTheme={toggleTheme} />;
}
