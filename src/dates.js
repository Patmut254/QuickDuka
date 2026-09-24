// Date helpers for entry forms. All dates are plain "YYYY-MM-DD" strings in
// the device's LOCAL timezone (toISOString() would give the UTC date, which is
// "yesterday" in Nairobi between midnight and 3am).
const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const localToday = () => fmt(new Date());

export const localYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fmt(d);
};

// How many days before today a "YYYY-MM-DD" date is (0 = today, negative = future)
export const daysOld = (dateStr) => {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((todayMidnight - then) / 86400000);
};

// Should an entry with this date change the CURRENT stock quantity?
// Recent entries (last 7 days) do by default; older ones — e.g. April sales
// being caught up months later — usually happened before the stock count was
// set up, so they don't, unless the user ticks the box. `choice` is the user's
// explicit tick (true/false) or null when they haven't touched it.
export const stockUpdateWanted = (dateStr, choice) =>
  choice ?? daysOld(dateStr) <= 7;

// "12 Apr 2026"
export const prettyDate = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
