// Supplier balances: what the shop still owes for stock it bought on credit.
// Shared by Purchases (table / pay modal), Stock (restock) and Dashboard
// (reminders).
//
// `amount` on a purchase is always the FULL cost. `paidAmount` only exists on
// purchases bought on credit; a record without it — every purchase made
// before this feature — counts as paid in full (zero balance).
import { roundMoney } from "./hooks/useStock";

export const paidOf = (p) =>
  p.paidAmount != null && p.paidAmount !== ""
    ? Number(p.paidAmount)
    : Number(p.amount || 0);

export const balanceOf = (p) =>
  Math.max(0, roundMoney(Number(p.amount || 0) - paidOf(p)));

// YYYY-MM-DD in the device's LOCAL timezone (toISOString would give the UTC
// date, which is "yesterday" for Nairobi between midnight and 3am).
const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const localToday = () => fmt(new Date());

// "overdue" | "soon" (due within `soonDays`, incl. today) | "later" | null
// (null = nothing owed, or no repayment date was promised)
export const dueStatus = (p, soonDays = 3) => {
  if (balanceOf(p) <= 0 || !p.dueDate) return null;
  if (p.dueDate < localToday()) return "overdue";
  const limit = new Date();
  limit.setDate(limit.getDate() + soonDays);
  return p.dueDate <= fmt(limit) ? "soon" : "later";
};
