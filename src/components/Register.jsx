import { useState } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { createUserProfile } from "../hooks/useUserProfile";

const db = getFirestore();

export default function Register() {
  const [step, setStep] = useState(0);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const normalizePhone = (p) => {
    const d = p.replace(/\D/g, "");
    if (d.startsWith("07") && d.length === 10) return "+254" + d.slice(1);
    return p;
  };

  const normPhone = normalizePhone(phone);
  const hasEmail = email.trim().length > 0;

  // STEP 1 → validate credentials
  const handleCredNext = async (e) => {
    e.preventDefault();
    setError("");

    if (!hasEmail) return setError("Email is required.");
    if (password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", email.trim()),
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        return setError("Email already registered.");
      }
    } catch {}

    setStep(1); // move to business step
  };

  // STEP 2 → create account
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError("");

    if (!businessName) return setError("Business name required.");
    if (!ownerName) return setError("Owner name required.");

    setSaving(true);

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      try {
        await createUserProfile(cred.user.uid, {
          email: email.trim(),
          phone: normPhone || null,
          businessName,
          ownerName,
        });
      } catch (err) {
        await cred.user.delete(); // rollback
        throw err;
      }

      setStep(2); // success
    } catch (err) {
      console.error(err);
      setSaving(false);
      setError("Registration failed. Try again.");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto" }}>
      <h2>Create Account</h2>

      {/* STEP 0 */}
      {step === 0 && (
        <form onSubmit={handleCredNext}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && <p style={{ color: "red" }}>{error}</p>}

          <button type="submit">Continue</button>
        </form>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <form onSubmit={handleCreateAccount}>
          <input
            placeholder="Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />

          <input
            placeholder="Owner Name"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />

          {error && <p style={{ color: "red" }}>{error}</p>}

          <button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Account"}
          </button>
        </form>
      )}

      {/* SUCCESS */}
      {step === 2 && <h3>✅ Account Created!</h3>}
    </div>
  );
}
