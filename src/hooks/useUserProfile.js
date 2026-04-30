import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Keep in sync with AdminPanel.jsx
const ADMIN_EMAIL = "anitapatrick025@gmail.com";

export function useUserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const terminatedRef = useRef(false);
  const creatingRef = useRef(false);

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

      const ref = doc(db, "users", user.uid);

      try {
        // 🔹 STEP 1: Try to get profile
        let snap = await getDoc(ref);

        // 🔹 STEP 2: If profile exists
        if (snap.exists()) {
          if (!terminatedRef.current) {
            setProfile({ id: snap.id, ...snap.data() });
            setLoading(false);
          }
          return;
        }

        // 🔹 STEP 3: Auto-create (only for non-admin)
        if (!creatingRef.current && user.email !== ADMIN_EMAIL) {
          creatingRef.current = true;

          const trialExpiry = new Date();
          trialExpiry.setDate(trialExpiry.getDate() + 30);

          await setDoc(ref, {
            email: user.email || null,
            role: "user",
            subscriptionStatus: "trial",
            subscriptionExpiry: trialExpiry,
            trialStartedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });

          // 🔹 Fetch again after creation
          snap = await getDoc(ref);

          if (snap.exists() && !terminatedRef.current) {
            setProfile({ id: snap.id, ...snap.data() });
            setLoading(false);
            return;
          }
        }

        // 🔹 Still no profile
        if (!terminatedRef.current) {
          setNotFound(true);
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
      ...data,
      role: "user",
      subscriptionStatus: "trial",
      subscriptionExpiry: trialExpiry,
      trialStartedAt: now,
      createdAt: now,
    },
    { merge: true },
  );
}

/** One-shot fetch */
export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
}
