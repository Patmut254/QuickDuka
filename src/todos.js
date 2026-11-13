// To-do list helpers: repeating tasks and tasks suggested from shop data.
import { localToday } from "./dates";

export const REPEATS = ["none", "daily", "weekly", "monthly"];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Next due date for a repeating task (from its current due date, never in the past)
export function nextDue(dueDate, repeat) {
  const today = localToday();
  let d = new Date(`${dueDate || today}T00:00:00`);
  const step = () => {
    if (repeat === "daily") d.setDate(d.getDate() + 1);
    else if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  };
  step();
  while (toISO(d) < today) step();
  return toISO(d);
}

// "overdue" | "today" | "upcoming" | "nodate" | "done"
export function bucketOf(task, today = localToday()) {
  if (task.done) return "done";
  if (!task.dueDate) return "nodate";
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  return "upcoming";
}

export const isDueNow = (task, today = localToday()) => {
  const b = bucketOf(task, today);
  return b === "overdue" || b === "today";
};

const LOW_STOCK = 3; // items at or below this count are suggested for restock

// Tasks the app suggests from the shop's own records. Each has a stable `key`
// so a suggestion can be hidden or recognised once it's on the list.
export function suggestTasks({ stock = [], credits = [], purchases = [] }, t) {
  const today = localToday();
  const soon = (() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 3);
    return toISO(d);
  })();
  const out = [];

  for (const s of stock) {
    const q = Number(s.quantity);
    if (s.quantity == null || Number.isNaN(q) || q > LOW_STOCK) continue;
    const name = s.variant ? `${s.name} (${s.variant})` : s.name;
    out.push({
      key: `stock:${s.id}:${q}`,
      kind: "stock",
      title:
        q <= 0
          ? `${t.todoRestock || "Restock"} ${name} (${t.todoOutOfStock || "out of stock"})`
          : `${t.todoRestock || "Restock"} ${name} (${q} ${t.todoLeft || "left"})`,
      dueDate: today,
    });
  }

  for (const c of credits) {
    if (c.status !== "outstanding" || !c.dueDate || c.dueDate > today) continue;
    const owed = (Number(c.totalAmount) || 0) - (Number(c.paidAmount) || 0);
    if (owed <= 0) continue;
    out.push({
      key: `credit:${c.id}:${c.dueDate}`,
      kind: "credit",
      title: `${t.todoFollowUp || "Follow up"} ${c.customer || ""}: KES ${owed.toLocaleString()} ${t.todoOverdue || "overdue"}`,
      dueDate: today,
      notes: c.phone ? `${t.phone || "Phone"}: ${c.phone}` : "",
    });
  }

  for (const p of purchases) {
    if (p.paidAmount == null) continue;
    const bal = (Number(p.amount) || 0) - (Number(p.paidAmount) || 0);
    if (bal <= 0 || !p.dueDate || p.dueDate > soon) continue;
    out.push({
      key: `supplier:${p.id}:${p.dueDate}`,
      kind: "supplier",
      title: `${t.todoPaySupplier || "Pay"} ${p.supplier || t.supplier || "supplier"}: KES ${bal.toLocaleString()} (${p.item || ""})`,
      dueDate: p.dueDate < today ? today : p.dueDate,
    });
  }
  return out;
}
