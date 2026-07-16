/* eslint-disable react-hooks/set-state-in-effect */
// useStock — real-time listener for the current user's stock/stock items.
// Used by Sales, Credits, Purchases, and Expenses to auto-populate dropdowns.
import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// adjustStockQuantity — bumps a stock item's quantity up or down.
// Used by Sales (decrement on sale) and Purchases (increment on purchase)
// so the stock page behaves like a running bookkeeping ledger of what's
// left, instead of a static price list.
export async function adjustStockQuantity(stockId, delta) {
  if (!stockId || !delta) return;
  try {
    await updateDoc(doc(db, "stock", stockId), {
      quantity: increment(delta),
    });
  } catch (err) {
    console.error("Stock quantity update failed:", err.message);
  }
}

export function useStock() {
  const [stock, setStock] = useState([]);
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) {
      setStock([]);
      return;
    }

    const q = query(
      collection(db, "stock"),
      where("userId", "==", uid),
      orderBy("name", "asc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setStock(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Stock listener error:", err.message);
      },
    );

    return unsub;
  }, [uid]);

  return stock; // array of { id, name, price, unit, notes }
}
