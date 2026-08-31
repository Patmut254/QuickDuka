/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

// Keep in sync with AdminPanel.jsx
const ADMIN_EMAIL = "anitapatrick025@gmail.com";

// Set to true right before createUserWithEmailAndPassword during signup,
// and cleared once the Firestore profile doc has actually been written.
// createUserWithEmailAndPassword auto-signs-in the new user before the
// caller gets a chance to write their Firestore profile, which races
// against this hook's own profile check below. While this flag is true,
// useUserProfile will keep retrying instead of signing the user out just
// because the profile doc isn't there yet.
let registrationInProgress = false;
export function beginRegistration() {
  registrationInProgress = true;
}
export function endRegistration() {
  registrationInProgress = false;
}

const PROFILE_RETRY_ATTEMPTS = 5;
const PROFILE_RETRY_DELAY_MS = 400;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useUserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const terminatedRef = useRef(false);

  useEffect(() => {
    terminatedRef.current = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!terminatedRef.current) {
          setProfile(null);
          setLoading(false);
          setNotFound(false);
        }
        return;
      }

      if (!terminatedRef.current) {
        setLoading(true);
        setNotFound(false);
      }

      // ADMIN: bypass profile check entirely
      if (user.email === ADMIN_EMAIL) {
        if (!terminatedRef.current) {
          setProfile({ id: user.uid, email: user.email, role: "admin" });
          setLoading(false);
        }
        return;
      }

      // REGULAR USER: must have a Firestore profile
      const ref = doc(db, "users", user.uid);

      try {
        let snap = await getDoc(ref);

        // Profile doc not there yet — this is expected right after signup,
        // since the auth account exists (triggering this listener) before
        // Register.jsx's Firestore write has resolved. Retry for a bit
        // instead of immediately concluding the account is invalid.
        let attempts = 0;
        const maxAttempts = registrationInProgress
          ? PROFILE_RETRY_ATTEMPTS * 3
          : PROFILE_RETRY_ATTEMPTS;
        while (
          !snap.exists() &&
          attempts < maxAttempts &&
          !terminatedRef.current
        ) {
          await wait(PROFILE_RETRY_DELAY_MS);
          snap = await getDoc(ref);
          attempts += 1;
        }

        if (terminatedRef.current) return;

        if (!snap.exists()) {
          // Still no profile after retrying = actually deleted or never
          // finished registration. Sign them out so they land back on login.
          await signOut(auth);
          if (!terminatedRef.current) {
            setProfile(null);
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        const data = snap.data();

        // DELETED flag: admin marked this account as removed
        if (data.deleted === true) {
          await signOut(auth);
          if (!terminatedRef.current) {
            setProfile(null);
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        // All good: set the profile
        if (!terminatedRef.current) {
          setProfile({ id: snap.id, ...data });
          setLoading(false);
        }
      } catch (err) {
        console.error("Profile fetch failed:", err);
        if (!terminatedRef.current) {
          setNotFound(true);
          setLoading(false);
        }
      }
    });

    return () => {
      terminatedRef.current = true;
      unsubAuth();
    };
  }, []);

  return { profile, loading, notFound };
}

/**
 * Called explicitly from Register.jsx after Firebase Auth account creation.
 * Saves ALL registration fields: businessName, ownerName, phone, county, etc.
 */
export async function createUserProfile(uid, data) {
  const ref = doc(db, "users", uid);

  const trialExpiry = new Date();
  trialExpiry.setDate(trialExpiry.getDate() + 30);

  // Use a real Date (not serverTimestamp) for createdAt so admin orderBy works immediately
  const now = new Date();

  await setDoc(
    ref,
    {
      // Registration fields — passed in from Register.jsx
      businessName: data.businessName || null,
      ownerName: data.ownerName || null,
      phone: data.phone || null,
      email: data.email || null,
      realEmail: data.realEmail || data.email || null,
      county: data.county || null,
      subcounty: data.subcounty || null,
      referrer: data.referrer || null,

      // Subscription
      role: "user",
      subscriptionStatus: "trial",
      subscriptionPlan: data.subscriptionPlan || "starter",
      subscriptionExpiry: trialExpiry,
      trialStartedAt: now,
      createdAt: now,

      // Safety flag — never deleted at creation
      deleted: false,
    },
    { merge: false }, // full write — no partial merging on new accounts
  );
}

/** One-shot fetch — used by admin and staff checks */
export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
}
