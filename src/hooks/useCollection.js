/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  getDocs,
  where,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Audit logger
// Writes a record to the "auditLog" collection so History.jsx can display it.
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
      action, // "CREATE" | "UPDATE" | "DELETE" | "RESTORE"
      before,
      after,
      description,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Never let audit failures crash the main operation
    console.warn("Audit log write failed:", err.message);
  }
}

export function useCollection(
  collectionName,
  { ownerUid: overrideOwnerUid } = {},
) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);

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

    // ownerUid mode: owner queries all records tagged with their uid as ownerUid
    // (captures their own entries + all staff entries for their business)
    // Normal mode: query by userId (staff querying their own entries)
    const queryUid = overrideOwnerUid || uid;
    const queryField = overrideOwnerUid ? "ownerUid" : "userId";
    const q = query(
      collection(db, collectionName),
      where(queryField, "==", queryUid),
    );

    // Real-time listener — updates immediately without any reload
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Sort newest-first by createdAt (Firestore Timestamp or missing)
        docs.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setItems(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore listener error:", err.message);
        setLoading(false);
      },
    );

    return unsub;
    // ✅ FIX 1: Added overrideOwnerUid to the dependency array so the query
    // re-runs correctly when switching between owner and staff context.
    // Previously missing, causing the hook to use stale query field/value
    // and making owner-mode data appear invisible after re-renders.
  }, [collectionName, uid, overrideOwnerUid]);

  // addItem
  // ownerUid is stamped on every record so the business owner can query
  // all entries across their account + all their staff accounts.
  // For owner accounts: ownerUid === userId.
  // For staff accounts: ownerUid = the owner they belong to, userId = their own uid.
  const addItem = async (data, extraMeta = {}) => {
    const ref = await addDoc(collection(db, collectionName), {
      ...data,
      userId: uid,
      ownerUid: extraMeta.ownerUid || uid,
      staffName: extraMeta.staffName || null,
      branchId: extraMeta.branchId || null,
      branchName: extraMeta.branchName || null,
      createdAt: serverTimestamp(),
    });

    await logAction(uid, collectionName, "CREATE", {
      after: data,
      description: data.description || data.item || data.category || "",
    });

    return ref;
  };

  // deleteItem
  // EntryTable calls onDelete(id, item) — we accept both params.
  const deleteItem = async (id, itemData) => {
    // Capture the item data before deleting so History can restore it
    const before = itemData || items.find((i) => i.id === id) || null;

    await deleteDoc(doc(db, collectionName, id));

    await logAction(uid, collectionName, "DELETE", {
      before,
      description:
        before?.description || before?.item || before?.category || "",
    });
  };

  // updateItem
  // EntryTable calls onUpdate(id, newData, oldData) — we accept the third param.
  const updateItem = async (id, newData, oldData) => {
    await updateDoc(doc(db, collectionName, id), newData);

    await logAction(uid, collectionName, "UPDATE", {
      before: oldData || null,
      after: newData,
      description:
        newData.description || newData.item || newData.category || "",
    });
  };

  // clearCollection
  // Deletes all user's docs in a collection WITHOUT writing audit entries.
  // Used by History to wipe the auditLog itself.
  // ✅ FIX 2: Now respects ownerUid mode so it queries by the correct field,
  // matching the same records that are visible in the UI. Previously always
  // queried by userId which would miss staff entries in owner-mode context.
  const clearCollection = async (overrideName) => {
    const target = overrideName || collectionName;
    if (!uid) return;
    const queryField = overrideOwnerUid ? "ownerUid" : "userId";
    const queryUid = overrideOwnerUid || uid;
    const q = query(collection(db, target), where(queryField, "==", queryUid));
    const snap = await getDocs(q);
    const deletes = snap.docs.map((d) => deleteDoc(doc(db, target, d.id)));
    await Promise.all(deletes);
  };

  // silentDelete
  // Deletes a single doc WITHOUT writing an audit log entry.
  // Used by History.jsx to remove individual log entries.
  const silentDelete = async (id) => {
    await deleteDoc(doc(db, collectionName, id));
  };

  // restoreItem
  // Re-adds a previously deleted item back into its original collection.
  // Called by History.jsx when the user clicks "Restore" on a DELETE log entry.
  const restoreItem = async (logEntry) => {
    if (!logEntry?.before || !logEntry?.collectionName) {
      throw new Error("Cannot restore: missing data in log entry");
    }

    const {
      id: _id,
      createdAt: _c,
      userId: _u,
      ...cleanData
    } = logEntry.before;

    const ref = await addDoc(collection(db, logEntry.collectionName), {
      ...cleanData,
      userId: uid,
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
