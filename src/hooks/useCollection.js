/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  getDocs,
  where,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export function useCollection(collectionName) {
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

    const q = query(
      collection(db, collectionName),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
    );

    // Real-time listener — updates immediately without any reload
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
    return ref;
  };

  const deleteItem = async (id) => {
    await deleteDoc(doc(db, collectionName, id));
  };

  const updateItem = async (id, newData) => {
    await updateDoc(doc(db, collectionName, id), newData);
  };

  const clearCollection = async () => {
    if (!uid) return;
    const q = query(collection(db, collectionName), where("userId", "==", uid));
    const snap = await getDocs(q);
    const deletes = snap.docs.map((d) =>
      deleteDoc(doc(db, collectionName, d.id)),
    );
    await Promise.all(deletes);
  };

  return {
    items,
    loading,
    addItem,
    deleteItem,
    updateItem,
    clearCollection,
  };
}
