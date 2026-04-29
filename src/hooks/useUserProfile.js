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
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let unsubFirestore = null;
    let timeoutId = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Cleanup previous listeners
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

      console.log("👤 Auth user detected:", user.uid);

      setLoading(true);
      setNotFound(false);

      const ref = doc(db, "users", user.uid);

      // Wait longer to avoid race condition
      timeoutId = setTimeout(() => {
        console.warn("⚠️ Profile not found after waiting");
        setLoading(false);
        setNotFound(true);
      }, 12000);

      unsubFirestore = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            console.log("✅ Profile loaded:", snap.data());

            clearTimeout(timeoutId);

            setProfile({ id: snap.id, ...snap.data() });
            setNotFound(false);
            setLoading(false);
          } else {
            console.log("⏳ Profile doc not yet created...");
            setProfile(null);
          }
        },
        (err) => {
          console.error("❌ Profile listener error:", err.message);
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

// 🔥 CREATE USER PROFILE (FIXED + SAFE)
export async function createUserProfile(uid, data) {
  try {
    console.log("🔥 Creating Firestore profile for UID:", uid);

    const ref = doc(db, "users", uid);

    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 30);

    await setDoc(
      ref,
      {
        ...data,
        role: "user",
        subscriptionStatus: "trial",
        subscriptionExpiry: trialExpiry,
        trialStartedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    console.log("✅ Firestore profile created successfully");
  } catch (err) {
    console.error("❌ Firestore profile creation FAILED:", err);
    throw err; // VERY IMPORTANT
  }
}

// 🔍 GET USER PROFILE (unchanged, but safe)
export async function getUserProfile(uid) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }

    return null;
  } catch (err) {
    console.error("❌ getUserProfile failed:", err);
    return null;
  }
}
