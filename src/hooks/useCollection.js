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

    const fetchData = async () => {
      setLoading(true);

      try {
        const q = query(
          collection(db, collectionName),
          where("userId", "==", uid),
          orderBy("createdAt", "desc"),
        );

        const snap = await getDocs(q);

        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      } catch (err) {
        console.error("Firestore fetch error:", err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [collectionName, uid]);

  const addItem = async (data) => {
    await addDoc(collection(db, collectionName), {
      ...data,
      userId: uid,
      createdAt: serverTimestamp(),
    });
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
