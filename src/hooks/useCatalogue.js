/* eslint-disable react-hooks/set-state-in-effect */
// useCatalogue — real-time listener for the current user's stock/catalogue items.
// Used by Sales, Credits, Purchases, and Expenses to auto-populate dropdowns.
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState([]);
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) { setCatalogue([]); return; }

    const q = query(
      collection(db, "stock"),
      where("userId", "==", uid),
      orderBy("name", "asc"),
    );

    const unsub = onSnapshot(q, (snap) => {
      setCatalogue(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Catalogue listener error:", err.message);
    });

    return unsub;
  }, [uid]);

  return catalogue; // array of { id, name, price, unit, notes }
}
