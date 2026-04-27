import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
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
  getDocs,
  where,
} from "firebase/firestore";

async function logAudit({
  action,
  collectionName,
  recordId,
  before,
  after,
  description,
  userId,
}) {
  try {
    const clean = (obj) => {
      if (!obj) return null;
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === "object" && typeof v.toDate === "function")
          continue;
        if (v && typeof v === "object" && v.seconds !== undefined) continue;
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
      userId: userId || auth.currentUser?.uid || "",
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn("Audit log failed (non-critical):", e.message);
  }
}

export function useCollection(collectionName) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, collectionName),
      where("userId", "==", uid),
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
  }, [collectionName, uid]);

  const addItem = async (data) => {
    const ref = await addDoc(collection(db, collectionName), {
      ...data,
      userId: uid,
      createdAt: serverTimestamp(),
    });
    await logAudit({
      action: "CREATE",
      collectionName,
      recordId: ref.id,
      after: data,
      description: `Added ${collectionName.slice(0, -1)}: ${data.description || data.item || data.name || data.category || "-"} · KES ${data.amount || ""}`,
      userId: uid,
    });
  };

  const deleteItem = async (id, itemData) => {
    await logAudit({
      action: "DELETE",
      collectionName,
      recordId: id,
      before: itemData || null,
      description: `Deleted ${collectionName.slice(0, -1)}: ${itemData?.description || itemData?.item || itemData?.name || itemData?.category || id} · KES ${itemData?.amount || "?"}`,
      userId: uid,
    });
    await deleteDoc(doc(db, collectionName, id));
  };

  // ✅ Silent delete — no audit log. Used for deleting auditLog entries themselves
  const silentDelete = async (id) => {
    await deleteDoc(doc(db, collectionName, id));
  };

  const updateItem = async (id, newData, oldData) => {
    await updateDoc(doc(db, collectionName, id), newData);
    await logAudit({
      action: "UPDATE",
      collectionName,
      recordId: id,
      before: oldData || null,
      after: newData,
      description: `Updated ${collectionName.slice(0, -1)}: ${newData.description || newData.item || newData.name || newData.category || id}`,
      userId: uid,
    });
  };

  const restoreItem = async (logEntry) => {
    const data = logEntry.before;
    if (!data) return;
    const { id: _id, createdAt: _c, restoredFrom: _r, ...cleanData } = data;
    const ref = await addDoc(collection(db, logEntry.collectionName), {
      ...cleanData,
      userId: uid,
      createdAt: serverTimestamp(),
      restoredFrom: logEntry.recordId,
    });
    await logAudit({
      action: "RESTORE",
      collectionName: logEntry.collectionName,
      recordId: ref.id,
      after: cleanData,
      description: `Restored: ${cleanData.description || cleanData.item || cleanData.name || cleanData.category || logEntry.recordId}`,
      userId: uid,
    });
  };

  const clearCollection = async (targetCollection) => {
    if (!uid) return;
    const q = query(collection(db, targetCollection), where("userId", "==", uid));
    const snap = await getDocs(q);
    const deletes = snap.docs.map((d) =>
      deleteDoc(doc(db, targetCollection, d.id)),
    );
    await Promise.all(deletes);
  };

  return {
    items,
    loading,
    addItem,
    deleteItem,
    silentDelete,
    updateItem,
    restoreItem,
    clearCollection,
  };
}
