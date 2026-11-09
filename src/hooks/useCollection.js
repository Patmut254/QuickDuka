/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
  getDocs,
  where,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Audit logger
async function logAction(
  uid,
  collectionName,
  action,
  { before = null, after = null, description = "" } = {},
) {
  try {
    await addDoc(collection(db, "auditLog"), {
      userId: uid,
      collectionName,
      action,
      before,
      after,
      description,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Audit log write failed:", err.message);
  }
}

export function useCollection(
  collectionName,
  // ── FIX: destructure with a default so callers passing `undefined`
  //    don't cause a new object reference every render.
  options = {},
) {
  const { ownerUid: overrideOwnerUid } = options;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // Start from the already-known user (if auth has restored) so the
  // listener attaches on the first render instead of waiting a tick.
  const [uid, setUid] = useState(() => auth.currentUser?.uid ?? null);

  // ── FIX: stabilise overrideOwnerUid in a ref so the Firestore
  //    useEffect's dep array never changes SIZE — only value.
  //    Without this, callers that pass `ownerUid ? {ownerUid} : undefined`
  //    produce a new object on every render, which can cause React to
  //    complain "the order and size of this array must remain constant".
  const overrideOwnerUidRef = useRef(overrideOwnerUid);
  useEffect(() => {
    overrideOwnerUidRef.current = overrideOwnerUid;
  }, [overrideOwnerUid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // ✅ FIX: Run TWO parallel queries and merge results.
    //
    // Query A — the primary query:
    //   • Owner mode (overrideOwnerUid set): ownerUid == ownerUid
    //   • Staff mode (no override):          userId   == uid
    //
    // Query B — the legacy fallback:
    //   • Always queries userId == uid
    //   This catches records written before the ownerUid stamping fix
    //   was deployed. Those records have no ownerUid field so they never
    //   match Query A, making them invisible on the dashboard.
    //   Merging by document id deduplicates any overlap.

    // Read the stable ref value (not the raw prop) inside the effect
    const currentOverride = overrideOwnerUidRef.current;

    const queryUid = currentOverride || uid;
    const queryField = currentOverride ? "ownerUid" : "userId";

    const qPrimary = query(
      collection(db, collectionName),
      where(queryField, "==", queryUid),
    );

    // Legacy fallback: records stamped with userId but missing ownerUid
    const qLegacy = currentOverride
      ? query(collection(db, collectionName), where("userId", "==", uid))
      : null;

    // Merge helper — deduplicates by document id and sorts newest-first
    const merge = (snapA, snapB) => {
      const map = new Map();
      snapA.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
      if (snapB) {
        snapB.docs.forEach((d) => {
          if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data() });
        });
      }
      const docs = Array.from(map.values());
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      return docs;
    };

    // Track latest snapshot from each listener so we can re-merge on any update
    let snapA = null;
    let snapB = null;
    let unsub1 = () => {};
    let unsub2 = () => {};
    let active = true;

    unsub1 = onSnapshot(
      qPrimary,
      (snap) => {
        if (!active) return;
        snapA = snap;
        setItems(merge(snapA, snapB));
        setLoading(false);
      },
      (err) => {
        console.error("Firestore listener error (primary):", err.message);
        if (active) setLoading(false);
      },
    );

    if (qLegacy) {
      unsub2 = onSnapshot(
        qLegacy,
        (snap) => {
          if (!active) return;
          snapB = snap;
          if (snapA !== null) {
            setItems(merge(snapA, snapB));
          }
        },
        (err) => {
          // Legacy query failing is non-fatal — primary results still show
          console.warn(
            "Firestore listener error (legacy fallback):",
            err.message,
          );
        },
      );
    }

    return () => {
      active = false;
      unsub1();
      unsub2();
    };
    // ── FIX: dep array is now always exactly [collectionName, uid] —
    //    constant size. overrideOwnerUid changes are handled via the ref.
  }, [collectionName, uid]);
   

  // ── SPEED FIX: optimistic writes ─────────────────────────────────────────
  // Firestore applies a write to the local cache instantly (the onSnapshot
  // listener above fires straight away), but the promise from addDoc /
  // updateDoc only resolves after the SERVER confirms. Awaiting that made
  // every "Save" wait a full network round-trip — several, when a save also
  // wrote a purchase/audit entry — which is the delay users noticed when
  // adding products. Now we queue the write, return immediately, and only
  // log if the server later rejects it. `ref.committed` is the server-ack
  // promise for the rare caller that truly needs it.
  const background = (promise, what) => {
    promise.catch((err) =>
      console.error(`Firestore ${what} on ${collectionName} failed:`, err.message),
    );
    return promise;
  };

  const addItem = async (data, extraMeta = {}) => {
    // ownerUid priority: extraMeta > hook's overrideOwnerUid > current user's uid
    const resolvedOwnerUid =
      extraMeta.ownerUid || overrideOwnerUidRef.current || uid;

    const ref = doc(collection(db, collectionName)); // id is generated locally
    ref.committed = background(
      setDoc(ref, {
        ...data,
        userId: uid,
        ownerUid: resolvedOwnerUid,
        staffName: extraMeta.staffName || null,
        branchId: extraMeta.branchId || null,
        branchName: extraMeta.branchName || null,
        createdAt: serverTimestamp(),
      }),
      "create",
    );

    // Audit log never blocks the UI
    logAction(uid, collectionName, "CREATE", {
      after: data,
      description: data.description || data.item || data.category || "",
    });

    return ref;
  };

  const deleteItem = async (id, itemData) => {
    const before = itemData || items.find((i) => i.id === id) || null;
    background(deleteDoc(doc(db, collectionName, id)), "delete");
    logAction(uid, collectionName, "DELETE", {
      before,
      description:
        before?.description || before?.item || before?.category || "",
    });
  };

  const updateItem = async (id, newData, oldData) => {
    background(updateDoc(doc(db, collectionName, id), newData), "update");
    logAction(uid, collectionName, "UPDATE", {
      before: oldData || null,
      after: newData,
      description:
        newData.description || newData.item || newData.category || "",
    });
  };

  const clearCollection = async (overrideName) => {
    const target = overrideName || collectionName;
    if (!uid) return;
    const currentOverride = overrideOwnerUidRef.current;
    const queryField = currentOverride ? "ownerUid" : "userId";
    const queryUid = currentOverride || uid;
    const q = query(collection(db, target), where(queryField, "==", queryUid));
    const snap = await getDocs(q);
    const deletes = snap.docs.map((d) => deleteDoc(doc(db, target, d.id)));
    await Promise.all(deletes);
  };

  const silentDelete = async (id) => {
    await deleteDoc(doc(db, collectionName, id));
  };

  const restoreItem = async (logEntry) => {
    if (!logEntry?.before || !logEntry?.collectionName) {
      throw new Error("Cannot restore: missing data in log entry");
    }

    const {
      id: _id,
      createdAt: _c,
      userId: _u,
      ownerUid: _o,
      ...cleanData
    } = logEntry.before;

    const resolvedOwnerUid = overrideOwnerUidRef.current || uid;

    const ref = await addDoc(collection(db, logEntry.collectionName), {
      ...cleanData,
      userId: uid,
      ownerUid: resolvedOwnerUid,
      createdAt: serverTimestamp(),
    });

    await logAction(uid, logEntry.collectionName, "RESTORE", {
      after: cleanData,
      description:
        cleanData.description || cleanData.item || cleanData.category || "",
    });

    return ref;
  };

  return {
    items,
    loading,
    addItem,
    deleteItem,
    updateItem,
    clearCollection,
    silentDelete,
    restoreItem,
  };
}
