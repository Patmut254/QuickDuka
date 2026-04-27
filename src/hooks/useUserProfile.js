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

    // Listen to auth state — fires immediately and on every login/logout
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Clean up any previous Firestore listener
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // User is logged in — subscribe to their profile doc
      const ref = doc(db, "users", user.uid);
      unsubFirestore = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() });
          } else {
            // Profile doc doesn't exist yet (mid-registration race)
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
  await setDoc(
    ref,
    {
      ...data,
      role: "user",
      subscriptionStatus: "trial",
      subscriptionExpiry: null,
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
