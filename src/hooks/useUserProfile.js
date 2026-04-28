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

  useEffect(() => {
    let unsubFirestore = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const ref = doc(db, "users", user.uid);
      unsubFirestore = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() });
          } else {
            setProfile(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error("Profile listener error:", err.message);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  return { profile, loading };
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
