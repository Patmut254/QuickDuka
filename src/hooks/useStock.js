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

// ── Helpers shared by Sales / Credits / Purchases ────────────────────────────
// Two stock items can share a name and differ only by variant (e.g. Water in
// 0.375 L and 0.5 L bottles). Everything that picks or matches a stock item
// therefore goes by id / full label — never by name alone.
export const stockLabel = (s) =>
  !s ? "" : s.variant ? `${s.name} (${s.variant})` : s.name;

// Match free text (typed description) to a stock item: exact label first,
// then plain name.
export const findStockByLabel = (stock, text) => {
  const q = (text || "").trim().toLowerCase();
  if (!q) return null;
  return (
    stock.find((s) => stockLabel(s).trim().toLowerCase() === q) ||
    stock.find((s) => (s.name || "").trim().toLowerCase() === q) ||
    null
  );
};

// Quantities can be fractional (0.375 L, 0.5 kg…). Round to 3 decimals so
// floating-point dust (0.30000000000000004) never reaches Firestore.
export const roundQty = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
export const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;

// recordStockPurchase — goods coming IN (a purchase, or a manual restock).
// Bumps the remaining quantity up, plus running totals for "purchased" and
// "amount spent" so the stock page can show a full ledger, not just a
// current snapshot.
export async function recordStockPurchase(stockId, qty, value = 0) {
  if (!stockId || !qty) return;
  qty = roundQty(qty);
  // Not awaited: the local cache updates instantly; waiting for the server
  // only slowed every save down (see useCollection SPEED FIX).
  updateDoc(doc(db, "stock", stockId), {
      quantity: increment(qty),
      totalPurchased: increment(qty),
      totalPurchaseValue: increment(value || 0),
  }).catch((err) =>
    console.error("Stock purchase update failed:", err.message),
  );
}

// recordStockSale — goods going OUT (a sale). Bumps the remaining quantity
// down and the running "sold" total up.
export async function recordStockSale(stockId, qty) {
  if (!stockId || !qty) return;
  qty = roundQty(qty);
  // Not awaited: the local cache updates instantly; waiting for the server
  // only slowed every save down (see useCollection SPEED FIX).
  updateDoc(doc(db, "stock", stockId), {
      quantity: increment(-qty),
      totalSold: increment(qty),
  }).catch((err) => console.error("Stock sale update failed:", err.message));
}

// recordStockReturn — goods coming BACK (a cancelled credit / returned sale).
// Reverses recordStockSale: remaining goes up, "sold" goes down.
export async function recordStockReturn(stockId, qty) {
  if (!stockId || !qty) return;
  qty = roundQty(qty);
  // Not awaited: the local cache updates instantly; waiting for the server
  // only slowed every save down (see useCollection SPEED FIX).
  updateDoc(doc(db, "stock", stockId), {
      quantity: increment(qty),
      totalSold: increment(-qty),
  }).catch((err) =>
    console.error("Stock return update failed:", err.message),
  );
}

export function useStock() {
  const [stock, setStock] = useState([]);
  const [uid, setUid] = useState(() => auth.currentUser?.uid ?? null);

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
