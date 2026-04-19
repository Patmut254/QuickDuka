import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

// logAudit is best-effort - it must NEVER block or break the main operation
async function logAudit({
  action,
  collectionName,
  recordId,
  before,
  after,
  description,
}) {
  try {
    // Strip Firestore Timestamps and non-serialisable values before storing
    const clean = (obj) => {
      if (!obj) return null;
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === "object" && typeof v.toDate === "function")
          continue; // skip Timestamps
        if (v && typeof v === "object" && v.seconds !== undefined) continue; // skip raw Timestamp shape
        out[k] = v;
      }
      return out;
    };
    await addDoc(collection(db, "auditLog"), {
      action,
      collectionName,
      recordId: recordId || "",
      before: clean(before),
      after: clean(after),
      description: description || "",
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    // Audit log failure must never crash the app
    console.warn("Audit log failed (non-critical):", e.message);
  }
}

export function useCollection(collectionName) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, collectionName),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Firestore listener error:", err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [collectionName]);

  const addItem = async (data) => {
    // Do the real write first - audit log is secondary
    const ref = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
    });
    await logAudit({
      action: "CREATE",
      collectionName,
      recordId: ref.id,
      after: data,
      description: `Added ${collectionName.slice(0, -1)}: ${data.description || data.item || data.category || "-"} · KES ${data.amount}`,
    });
  };

  const deleteItem = async (id, itemData) => {
    // Log first so we capture before-state, then delete
    await logAudit({
      action: "DELETE",
      collectionName,
      recordId: id,
      before: itemData || null,
      description: `Deleted ${collectionName.slice(0, -1)}: ${itemData?.description || itemData?.item || itemData?.category || id} · KES ${itemData?.amount || "?"}`,
    });
    await deleteDoc(doc(db, collectionName, id));
  };

  const updateItem = async (id, newData, oldData) => {
    // Do the real update first
    await updateDoc(doc(db, collectionName, id), newData);
    await logAudit({
      action: "UPDATE",
      collectionName,
      recordId: id,
      before: oldData || null,
      after: newData,
      description: `Updated ${collectionName.slice(0, -1)}: ${newData.description || newData.item || newData.category || id}`,
    });
  };

  const restoreItem = async (logEntry) => {
    const data = logEntry.before;
    if (!data) return;
    // Remove any Firestore-incompatible fields from the old snapshot
    const { id: _id, createdAt: _c, restoredFrom: _r, ...cleanData } = data;
    const ref = await addDoc(collection(db, logEntry.collectionName), {
      ...cleanData,
      createdAt: serverTimestamp(),
      restoredFrom: logEntry.recordId,
    });
    await logAudit({
      action: "RESTORE",
      collectionName: logEntry.collectionName,
      recordId: ref.id,
      after: cleanData,
      description: `Restored: ${cleanData.description || cleanData.item || cleanData.category || logEntry.recordId}`,
    });
  };

  return { items, loading, addItem, deleteItem, updateItem, restoreItem };
}
