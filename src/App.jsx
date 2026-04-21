import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import Dashboard from "./components/Dashboard";
import Sales from "./components/Sales";
import Purchases from "./components/Purchases";
import Expenses from "./components/Expenses";
import Reports from "./components/Reports";
import History from "./components/History";
import Credits from "./components/Credits";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState("idle");
  const [resetMsg, setResetMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch {
      setLoginError("Invalid email or password. Please try again.");
    }
    setLoggingIn(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetStatus === "sending") return;
    setResetStatus("sending");
    setResetMsg("");
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetStatus("sent");
      setResetMsg("Password reset email sent! Check your inbox.");
    } catch (err) {
      setResetStatus("error");
      if (err.code === "auth/user-not-found") {
        setResetMsg("No account found with that email address.");
      } else if (err.code === "auth/invalid-email") {
        setResetMsg("Please enter a valid email address.");
      } else {
        setResetMsg("Failed to send reset email. Please try again.");
      }
    }
  };

  if (loading) return (
    <div className="splash">
      <div className="splash-logo"><span>📊</span><span>MySalesPro</span></div>
    </div>
  );

  if (!user) return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📊</div>
          <h1>MySalesPro</h1>
          <p>Your sales command centre</p>
        </div>

        {!showReset ? (
          <>
            <form onSubmit={handleLogin} className="login-form">
              <div className="field-group">
                <label>Email</label>
                <input type="email" placeholder="you@company.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
              </div>
              <div className="field-group">
                <label>Password</label>
                <input type="password" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
              </div>
              {loginError && <div className="login-error">{loginError}</div>}
              <button type="submit" className="btn-login" disabled={loggingIn}>{loggingIn ? "Signing in..." : "Sign In →"}</button>
            </form>
            <div className="forgot-pw-wrap">
              <button className="forgot-pw-btn" onClick={() => { setShowReset(true); setResetEmail(loginEmail); setResetStatus("idle"); setResetMsg(""); }}>
                Forgot password?
              </button>
            </div>
          </>
        ) : (
          <div className="reset-section">
            <h2 className="reset-title">Reset Password</h2>
            <p className="reset-subtitle">Enter your email and we will send you a reset link.</p>
            {resetStatus !== "sent" ? (
              <form onSubmit={handleResetPassword} className="login-form">
                <div className="field-group">
                  <label>Email</label>
                  <input type="email" placeholder="you@company.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required />
                </div>
                {resetMsg && (
                  <div className={resetStatus === "error" ? "login-error" : "login-success"}>{resetMsg}</div>
                )}
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
              <button className="forgot-pw-btn" onClick={() => setShowReset(false)}>Back to Sign In</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "sales", label: "Sales", icon: "💰" },
    { id: "credits", label: "Credits", icon: "📒" },
    { id: "purchases", label: "Purchases", icon: "🛒" },
    { id: "expenses", label: "Expenses", icon: "📋" },
    { id: "reports", label: "Reports", icon: "📈" },
    { id: "history", label: "History", icon: "🕓" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">📊</span>
          <span className="brand-name">MySalesPro</span>
        </div>
        <nav className="sidebar-nav">
          {tabs.map(t => (
            <button key={t.id} className={"nav-item" + (activeTab === t.id ? " active" : "")} onClick={() => setActiveTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
              {t.id === "history" && <span className="nav-badge">Log</span>}
              {t.id === "credits" && <span className="nav-badge nav-badge-debt">Debt</span>}
            </button>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => signOut(auth)}>Logout</button>
      </aside>

      <div className="mobile-bar">
        {tabs.map(t => (
          <button key={t.id} className={"mobile-tab" + (activeTab === t.id ? " active" : "")} onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">{tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}</div>
          <div className="top-bar-right">
            <span className="user-badge">{user.email}</span>
            <button className="logout-inline" onClick={() => signOut(auth)}>Sign out</button>
          </div>
        </header>
        <div className="page-body">
          {activeTab === "dashboard" && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === "sales" && <Sales />}
          {activeTab === "credits" && <Credits />}
          {activeTab === "purchases" && <Purchases />}
          {activeTab === "expenses" && <Expenses />}
          {activeTab === "reports" && <Reports />}
          {activeTab === "history" && <History />}
        </div>
      </main>
    </div>
  );
}
