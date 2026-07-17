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

// recordStockPurchase — goods coming IN (a purchase, or a manual restock).
// Bumps the remaining quantity up, plus running totals for "purchased" and
// "amount spent" so the stock page can show a full ledger, not just a
// current snapshot.
export async function recordStockPurchase(stockId, qty, value = 0) {
  if (!stockId || !qty) return;
  try {
    await updateDoc(doc(db, "stock", stockId), {
      quantity: increment(qty),
      totalPurchased: increment(qty),
      totalPurchaseValue: increment(value || 0),
    });
  } catch (err) {
    console.error("Stock purchase update failed:", err.message);
  }
}

// recordStockSale — goods going OUT (a sale). Bumps the remaining quantity
// down and the running "sold" total up.
export async function recordStockSale(stockId, qty) {
  if (!stockId || !qty) return;
  try {
    await updateDoc(doc(db, "stock", stockId), {
      quantity: increment(-qty),
      totalSold: increment(qty),
    });
  } catch (err) {
    console.error("Stock sale update failed:", err.message);
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
