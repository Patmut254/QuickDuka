import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export function useUserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // null = still waiting, true = doc confirmed missing after timeout
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let unsubFirestore = null;
    let timeoutId = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!user) {
        setProfile(null);
        setNotFound(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotFound(false);

      const ref = doc(db, "users", user.uid);

      // If no profile doc arrives within 8 seconds, mark as notFound
      timeoutId = setTimeout(() => {
        setLoading(false);
        setNotFound(true);
      }, 12000);

      unsubFirestore = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            clearTimeout(timeoutId);
            setProfile({ id: snap.id, ...snap.data() });
            setNotFound(false);
            setLoading(false);
          } else {
            // Doc doesn't exist yet — keep waiting for the timeout
            setProfile(null);
          }
        },
        (err) => {
          console.error("Profile listener error:", err.message);
          clearTimeout(timeoutId);
          setLoading(false);
          setNotFound(true);
        },
      );
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return { profile, loading, notFound };
}

export async function createUserProfile(uid, data) {
  const ref = doc(db, "users", uid);

  // Grant a 30-day free trial from today
  const trialExpiry = new Date();
  trialExpiry.setDate(trialExpiry.getDate() + 30);

  await setDoc(
    ref,
    {
      ...data,
      role: "user",
      subscriptionStatus: "trial",
      subscriptionExpiry: trialExpiry,   // trial ends after 30 days
      trialStartedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
}
