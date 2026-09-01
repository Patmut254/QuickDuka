/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react";
import { db, auth, rtdb } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref as dbRef, set as dbSet } from "firebase/database";

// Keep in sync with AdminPanel.jsx
const ADMIN_EMAIL = "anitapatrick025@gmail.com";

// ── Registration guard ──────────────────────────────────────────────
// createUserWithEmailAndPassword() auto-signs the new user in the
// instant it succeeds — which fires onAuthStateChanged in every mounted
// useUserProfile() BEFORE Register.jsx's createUserProfile() write has
// finished. Without this guard, that window would trigger self-heal
// (creating a blank throwaway profile) or, in the old code, an
// immediate sign-out — racing against the real profile write.
//
// Register.jsx calls beginRegistration() right before creating the
// Auth account, and endRegistration() in a `finally` once the real
// profile write has settled (success or failure). While the flag is
// set, useUserProfile() skips profile resolution entirely. When it
// clears, every mounted hook instance re-resolves against whatever the
// current user now is, picking up the freshly-written profile.
let registrationInFlight = false;
const registrationListeners = new Set();

export function beginRegistration() {
  registrationInFlight = true;
}

export function endRegistration() {
  registrationInFlight = false;
  registrationListeners.forEach((fn) => fn());
}

export function useUserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const terminatedRef = useRef(false);

  useEffect(() => {
    terminatedRef.current = false;

    const resolveProfile = async (user) => {
      if (!user) {
        if (!terminatedRef.current) {
          setProfile(null);
          setLoading(false);
          setNotFound(false);
        }
        return;
      }

      if (registrationInFlight) {
        // A signup is actively writing the real profile right now —
        // don't self-heal or sign out out from under it. We'll be
        // re-invoked via the registrationListeners callback once
        // endRegistration() fires.
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
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // No profile doc = orphaned Auth account (registration was
          // interrupted after step 1, or a Firestore write failed).
          // Instead of locking them out and telling them to re-register,
          // self-heal: build a minimal profile from what Firebase Auth
          // already knows about them, write it, and let them straight in.
          try {
            const healedProfile = await selfHealProfile(user);
            if (!terminatedRef.current) {
              setProfile(healedProfile);
              setLoading(false);
            }
          } catch (healErr) {
            console.error("Profile self-heal failed:", healErr);
            // Couldn't create a profile (e.g. rules rejected it) — fall
            // back to signing out rather than leaving them in limbo.
            await signOut(auth);
            if (!terminatedRef.current) {
              setProfile(null);
              setNotFound(true);
              setLoading(false);
            }
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

        // Best-effort: keep the RTDB mirror in sync on every login too,
        // not just on creation/self-heal. Cheap safety net for the
        // "already had a Firestore profile before RTDB mirroring
        // existed" case, and for anything that ever falls out of sync.
        try {
          const converted = {};
          for (const [key, val] of Object.entries(data)) {
            converted[key] =
              val && typeof val.toDate === "function"
                ? val.toDate().toISOString()
                : val;
          }
          await dbSet(dbRef(rtdb, `users/${user.uid}`), converted);
        } catch (mirrorErr) {
          console.warn("RTDB mirror-on-login failed:", mirrorErr.message);
        }
      } catch (err) {
        console.error("Profile fetch failed:", err);
        if (!terminatedRef.current) {
          setNotFound(true);
          setLoading(false);
        }
      }
    };

    const unsubAuth = onAuthStateChanged(auth, resolveProfile);

    // Re-resolve once a pending registration finishes, using whichever
    // user is currently signed in at that point.
    const onRegistrationEnd = () => resolveProfile(auth.currentUser);
    registrationListeners.add(onRegistrationEnd);

    return () => {
      terminatedRef.current = true;
      unsubAuth();
      registrationListeners.delete(onRegistrationEnd);
    };
  }, []);

  return { profile, loading, notFound };
}

/**
 * Builds and saves a minimal Firestore (+ RTDB) profile for an Auth account
 * that has no profile doc — e.g. registration was interrupted after the
 * Auth account was created but before the Firestore write completed.
 * Called from useUserProfile() the moment such an account logs in, so
 * the person never has to be told to re-register.
 * Uses `deleted == false` and `role == "user"` so it satisfies the
 * Firestore "create own profile" rule the same way Register.jsx does.
 */
async function selfHealProfile(user) {
  const ref = doc(db, "users", user.uid);

  const trialExpiry = new Date();
  trialExpiry.setDate(trialExpiry.getDate() + 30);
  const now = new Date();

  const profileData = {
    businessName: null,
    ownerName: user.displayName || null,
    phone: user.phoneNumber || null,
    email: user.email || null,
    realEmail: user.email || null,
    county: null,
    subcounty: null,
    referrer: null,

    role: "user",
    subscriptionStatus: "trial",
    subscriptionPlan: "starter",
    subscriptionExpiry: trialExpiry,
    trialStartedAt: now,
    createdAt: now,

    deleted: false,
    selfHealed: true, // flag so admin can spot auto-recovered accounts
  };

  await setDoc(ref, profileData, { merge: false });

  try {
    await dbSet(dbRef(rtdb, `users/${user.uid}`), {
      ...profileData,
      subscriptionExpiry: trialExpiry.toISOString(),
      trialStartedAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
  } catch (rtdbErr) {
    console.warn("RTDB profile mirror failed (self-heal):", rtdbErr.message);
  }

  return { id: user.uid, ...profileData };
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

  const profileData = {
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
  };

  await setDoc(ref, profileData, { merge: false }); // full write — no partial merging on new accounts

  // Mirror the same profile into Realtime Database under users/{uid}.
  // Best-effort: if this fails, the Firestore write (the source of truth
  // the rest of the app reads from) has already succeeded, so we don't
  // want to block or fail registration over it — just log it.
  try {
    await dbSet(dbRef(rtdb, `users/${uid}`), {
      ...profileData,
      subscriptionExpiry: trialExpiry.toISOString(),
      trialStartedAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
  } catch (rtdbErr) {
    console.warn("RTDB profile mirror failed:", rtdbErr.message);
  }
}

/** One-shot fetch — used by admin and staff checks */
export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
}
