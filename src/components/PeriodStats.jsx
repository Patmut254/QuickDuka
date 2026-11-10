// Small "Today" and "This month" boxes for a page header, so the space
// beside the main total box is put to use.
import { localToday } from "../dates";

export default function PeriodStats({ items, t, amountKey = "amount" }) {
  const today = localToday();
  const month = today.slice(0, 7);
  const sum = (pred) =>
    items
      .filter((i) => pred(String(i.date || "")))
      .reduce((a, i) => a + (Number(i[amountKey]) || 0), 0);
  return (
    <>
      <div className="module-stat module-stat-sub">
        <span className="stat-label">{t.todayLabel || "Today"}</span>
        <span className="stat-value">KES {sum((d) => d === today).toLocaleString()}</span>
      </div>
      <div className="module-stat module-stat-sub">
        <span className="stat-label">{t.thisMonthLabel || "This month"}</span>
        <span className="stat-value">
          KES {sum((d) => d.startsWith(month)).toLocaleString()}
        </span>
      </div>
    </>
  );
}
