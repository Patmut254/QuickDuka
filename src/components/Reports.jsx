// /* eslint-disable react-hooks/preserve-manual-memoization */
import { useState, useMemo } from "react";
import { useCollection } from "../hooks/useCollection";
import { useLang } from "../LangContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend as PieLegend,
  LineChart,
  Line,
} from "recharts";

import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  subDays,
} from "date-fns";
const COLORS = [
  "#29573f",
  "#a0623f",
  "#8c6e52",
  "#4f6f7d",
  "#ec4899",
  "#14b8a6",
];

export default function Reports({ ownerUid }) {
  const { t } = useLang();

  const { items: sales } = useCollection(
    "sales",
    ownerUid ? { ownerUid } : undefined,
  );
  const { items: purchases } = useCollection(
    "purchases",
    ownerUid ? { ownerUid } : undefined,
  );
  const { items: expenses } = useCollection(
    "expenses",
    ownerUid ? { ownerUid } : undefined,
  );
  const { items: losses } = useCollection(
    "losses",
    ownerUid ? { ownerUid } : undefined,
  );

  // ── Period state ─────────────────────────────────────────────────────
  const [period, setPeriod] = useState("weekly"); // "daily" | "monthly" | "yearly"
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM"),
  );
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear()),
  );

  // ── Month selector options (last 12 months) ──────────────────────────
  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy"),
      });
    }
    return opts;
  }, []);

  // ── Year selector options (last 5 years) ─────────────────────────────
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(now - i));
  }, []);

  // ── Date range based on selected period ──────────────────────────────
  const rangeFilter = useMemo(() => {
    if (period === "daily") {
      try {
        const d = parseISO(selectedDate);
        return { start: startOfDay(d), end: endOfDay(d) };
      } catch {
        return null;
      }
    } else if (period === "weekly") {
      const now = new Date();

      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    } else if (period === "yearly") {
      const y = parseInt(selectedYear, 10);
      return {
        start: new Date(y, 0, 1, 0, 0, 0),
        end: new Date(y, 11, 31, 23, 59, 59),
      };
    } else {
      // monthly
      const [y, m] = selectedMonth.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    }
  }, [period, selectedDate, selectedMonth, selectedYear]);

  const inRange = useMemo(() => {
    return (item) => {
      if (!rangeFilter) return false;

      try {
        const dt = item.date ? parseISO(item.date) : item.createdAt?.toDate?.();

        return dt && isWithinInterval(dt, rangeFilter);
      } catch {
        return false;
      }
    };
  }, [rangeFilter]);

  // ── Summary totals ────────────────────────────────────────────────────
  const ms = sales
    .filter(inRange)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const mp = purchases
    .filter(inRange)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const me = expenses
    .filter(inRange)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const ml = losses
    .filter(inRange)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const mProfit = ms - mp - me - ml;
  const margin = ms > 0 ? ((mProfit / ms) * 100).toFixed(1) : 0;

  // ── Period label for headings ─────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (period === "daily") return selectedDate;
    if (period === "weekly") return "This Week";
    if (period === "yearly") return selectedYear;
    return (
      monthOptions.find((o) => o.value === selectedMonth)?.label ||
      selectedMonth
    );
  }, [period, selectedDate, selectedYear, monthOptions, selectedMonth]);

  // ── Expense breakdown by category ─────────────────────────────────────
  const expenseByCat = useMemo(() => {
    const map = {};
    expenses.filter(inRange).forEach((e) => {
      const cat = e.category || "Other";
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses, inRange]);

  // ── Sales breakdown by payment method (cash / M-Pesa / Airtel / card) ──
  const paymentByMethod = useMemo(() => {
    const map = {};
    sales.filter(inRange).forEach((s) => {
      const method = s.paymentMethod || "cash";
      map[method] = (map[method] || 0) + Number(s.amount || 0);
    });
    return Object.entries(map).map(([method, value]) => ({
      name: t.paymentMethods?.[method] || method,
      value,
    }));
  }, [sales, inRange, t]);

  // ── Chart data: daily → last 14 days, monthly → 6 months, yearly → 12 months ──
  const barData = useMemo(() => {
    const now = new Date();

    if (period === "daily") {
      // Last 14 days
      return Array.from({ length: 14 }, (_, i) => {
        const d = subDays(now, 13 - i);
        const label = format(d, "dd MMM");
        const start = startOfDay(d);
        const end = endOfDay(d);
        const inR = (item) => {
          try {
            const dt = item.date
              ? parseISO(item.date)
              : item.createdAt?.toDate?.();
            return dt && isWithinInterval(dt, { start, end });
          } catch {
            return false;
          }
        };
        const s = sales
          .filter(inR)
          .reduce((a, b) => a + (Number(b.amount) || 0), 0);
        const p = purchases
          .filter(inR)
          .reduce((a, b) => a + (Number(b.amount) || 0), 0);
        const e = expenses
          .filter(inR)
          .reduce((a, b) => a + (Number(b.amount) || 0), 0);
        const l = losses
          .filter(inR)
          .reduce((a, b) => a + (Number(b.amount) || 0), 0);
        return {
          month: label,
          [t.sales || "Sales"]: s,
          [t.purchases || "Purchases"]: p,
          [t.expenses || "Expenses"]: e,
          [t.losses || "Losses"]: l,
          [t.netProfitLabel || "Net Profit"]: s - p - e - l,
        };
      });
    } else if (period === "weekly") {
    // Current week (Mon → Sun)
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, 6 - i);

      const label = format(d, "EEE");

      const start = startOfDay(d);
      const end = endOfDay(d);

      const inR = (item) => {
        try {
          const dt = item.date
            ? parseISO(item.date)
            : item.createdAt?.toDate?.();

          return dt && isWithinInterval(dt, { start, end });
        } catch {
          return false;
        }
      };

      const s = sales
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);

      const p = purchases
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);

      const e = expenses
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);

      const l = losses
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);

      return {
        month: label,
        [t.sales || "Sales"]: s,
        [t.purchases || "Purchases"]: p,
        [t.expenses || "Expenses"]: e,
        [t.losses || "Losses"]: l,
        [t.netProfitLabel || "Net Profit"]: s - p - e - l,
      };
    });
  } else if (period === "yearly") {
    // 12 months of selected year
    const y = parseInt(selectedYear, 10);
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(y, i, 1);
      const label = format(d, "MMM");
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inR = (item) => {
        try {
          const dt = item.date
            ? parseISO(item.date)
            : item.createdAt?.toDate?.();
          return dt && isWithinInterval(dt, { start, end });
        } catch {
          return false;
        }
      };
      const s = sales
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const p = purchases
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const e = expenses
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const l = losses
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      return {
        month: label,
        [t.sales || "Sales"]: s,
        [t.purchases || "Purchases"]: p,
        [t.expenses || "Expenses"]: e,
        [t.losses || "Losses"]: l,
        [t.netProfitLabel || "Net Profit"]: s - p - e - l,
      };
    });
  } else {
    // 6 months ending at selected month
    const [sy, sm] = selectedMonth.split("-").map(Number);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(sy, sm - 1 - (5 - i), 1);
      const label = format(d, "MMM");
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inR = (item) => {
        try {
          const dt = item.date
            ? parseISO(item.date)
            : item.createdAt?.toDate?.();
          return dt && isWithinInterval(dt, { start, end });
        } catch {
          return false;
        }
      };
      const s = sales
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const p = purchases
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const e = expenses
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const l = losses
        .filter(inR)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      return {
        month: label,
        [t.sales || "Sales"]: s,
        [t.purchases || "Purchases"]: p,
        [t.expenses || "Expenses"]: e,
        [t.losses || "Losses"]: l,
        [t.netProfitLabel || "Net Profit"]: s - p - e - l,
      };
    });
  }
}, [period, selectedMonth, selectedYear, sales, purchases, expenses, losses, t]);

// ── Top items by sales ────────────────────────────────────────────────
const topItems = useMemo(() => {
  const map = {};
  sales.filter(inRange).forEach((s) => {
    const key = s.item || s.description || "Unknown";
    map[key] = (map[key] || 0) + Number(s.amount || 0);
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));
}, [sales, inRange]);

// ── Sales by location/branch — "which branch sold better" ──────────────
// Only sales tagged with a branchName (owner picked one in the Sales
// form, or a staff member logged in under a branch) show up here.
const salesByLocation = useMemo(() => {
  const map = {};
  sales.filter(inRange).forEach((s) => {
    if (!s.branchName) return;
    if (!map[s.branchName]) map[s.branchName] = { revenue: 0, count: 0 };
    map[s.branchName].revenue += Number(s.amount || 0);
    map[s.branchName].count += 1;
  });
  return Object.entries(map)
    .map(([name, v]) => ({ name, value: v.revenue, count: v.count }))
    .sort((a, b) => b.value - a.value);
}, [sales, inRange]);
const bestLocation = salesByLocation[0] || null;

// ── CSV Download ──────────────────────────────────────────────────────
const downloadCSV = () => {
  const rows = [
    ["Type", "Date", "Description / Item", "Category", "Quantity", "Payment Method", "Amount (KES)"],
    ...sales
      .filter(inRange)
      .map((s) => [
        "Sale",
        s.date || "",
        s.description || s.item || "",
        s.branchName || "",
        s.quantity ?? "",
        s.paymentMethod || "cash",
        s.amount || 0,
      ]),
    ...purchases
      .filter(inRange)
      .map((p) => [
        "Purchase",
        p.date || "",
        p.item || p.description || "",
        p.category || "",
        p.quantity ?? "",
        "",
        p.amount || 0,
      ]),
    ...expenses
      .filter(inRange)
      .map((e) => [
        "Expense",
        e.date || "",
        e.description || "",
        e.category || "",
        "",
        "",
        e.amount || 0,
      ]),
    ...losses
      .filter(inRange)
      .map((l) => [
        "Loss",
        l.date || "",
        l.item || l.description || "",
        l.category || "",
        "",
        "",
        l.amount || 0,
      ]),
    [],
    ["SUMMARY"],
    ["Total Sales", "", "", "", "", "", ms],
    ["Total Purchases", "", "", "", "", "", mp],
    ["Total Expenses", "", "", "", "", "", me],
    ["Total Losses", "", "", "", "", "", ml],
    ["Net Profit", "", "", "", "", "", mProfit],
    ["Profit Margin", "", "", "", "", "", `${margin}%`],
  ];

  const escape = (v) => {
    const str = String(v ?? "");
    return str.includes(",") || str.includes('"')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quickduka-report-${period}-${periodLabel.replace(/\s+/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── Filtered transaction list ─────────────────────────────────────────
const allTransactions = useMemo(() => {
  const all = [
    ...sales.filter(inRange).map((s) => ({ ...s, _type: "sale" })),
    ...purchases.filter(inRange).map((p) => ({ ...p, _type: "purchase" })),
    ...expenses.filter(inRange).map((e) => ({ ...e, _type: "expense" })),
    ...losses.filter(inRange).map((l) => ({ ...l, _type: "loss" })),
  ];
  return all.sort((a, b) => {
    const da = a.date
      ? parseISO(a.date)
      : a.createdAt?.toDate?.() || new Date(0);
    const db2 = b.date
      ? parseISO(b.date)
      : b.createdAt?.toDate?.() || new Date(0);
    return db2 - da;
  });
}, [sales, purchases, expenses, losses, inRange]);

const typeColor = {
  sale: "#29573f",
  purchase: "#a0623f",
  expense: "#8c6e52",
  loss: "#a33a2a",
};
const typeLabel = {
  sale: t.sales || "Sale",
  purchase: t.purchases || "Purchase",
  expense: t.expenses || "Expense",
  loss: t.losses || "Loss",
};

return (
  <div className="reports-page">
    <div className="reports-body">
    {/* ── Controls bar ── */}
    <div className="reports-controls" style={{ flexWrap: "wrap", gap: 10 }}>
      {/* Period toggle */}
      <div style={{ display: "flex", gap: 6 }}>
        {["daily", "weekly", "monthly", "yearly"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: "6px 14px",
              borderRadius: 0,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background:
                period === p ? "var(--accent, #29573f)" : "var(--bg2, #1a1a2e)",
              color: period === p ? "#fff" : "var(--muted, #9ca3af)",
              transition: "all 0.15s",
            }}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Date selector */}
      {period === "daily" && (
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="month-select"
          style={{ minWidth: 160 }}
        />
      )}
      {period === "monthly" && (
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="month-select"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {period === "yearly" && (
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="month-select"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}

      {/* Download CSV */}
      <button
        onClick={downloadCSV}
        style={{
          padding: "6px 16px",
          borderRadius: 0,
          border: "1px solid var(--border, #333)",
          background: "var(--bg2, #1a1a2e)",
          color: "var(--text, #fff)",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        Download File (CSV)
      </button>
    </div>

    {/* ── Period heading ── */}
    <div
      style={{
        margin: "4px 0 12px",
        fontSize: 13,
        color: "var(--muted, #9ca3af)",
      }}
    >
      Showing:{" "}
      <strong style={{ color: "var(--text, #fff)" }}>{periodLabel}</strong>
    </div>

    {/* ── Summary cards ── */}
    <div className="report-summary-cards">
      {[
        {
          label: t.totalSales || "Total Sales",
          value: ms,
          color: "#29573f",
        },
        {
          label: t.totalPurchases || "Total Purchases",
          value: mp,
          color: "#a0623f",
        },
        {
          label: t.totalExpenses || "Total Expenses",
          value: me,
          color: "#8c6e52",
        },
        {
          label: t.totalLosses || "Total Losses",
          value: ml,
          color: "#a33a2a",
        },
        {
          label: t.netProfitLabel || "Net Profit",
          value: mProfit,
          color: mProfit >= 0 ? "#29573f" : "#a33a2a",
        },
        {
          label: (t.netProfitLabel || "Net Profit") + " %",
          value: `${margin}%`,
          color: mProfit >= 0 ? "#4f6f7d" : "#a33a2a",
          raw: true,
        },
      ].map((c) => (
        <div
          className="report-card tinted"
          key={c.label}
          style={{ "--tint": c.color }}
        >
          <div className="rc-label">{c.label}</div>
          <div className="rc-value" style={{ color: c.color }}>
            {c.raw ? c.value : `KES ${Number(c.value).toLocaleString()}`}
          </div>
        </div>
      ))}
    </div>

    {/* ── Charts ── */}
    <div className="charts-grid">
      {/* Bar / Line chart */}
      <div className="chart-card">
        <h3>
          {period === "daily"
            ? "Last 14 Days"
            : period === "weekly"
              ? "Weekly Performance"
              : period === "yearly"
                ? `${selectedYear}, Monthly Breakdown`
                : t.monthlyComparison || "Monthly Comparison (6 months)"}
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          {period === "daily" ? (
            <LineChart
              data={barData}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                interval={1}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                }
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #333",
                  color: "#fff",
                }}
                formatter={(v) => `KES ${Number(v).toLocaleString()}`}
              />
              <Legend wrapperStyle={{ color: "#ccc", fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey={t.sales || "Sales"}
                stroke="#29573f"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey={t.purchases || "Purchases"}
                stroke="#a0623f"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey={t.expenses || "Expenses"}
                stroke="#8c6e52"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey={t.netProfitLabel || "Net Profit"}
                stroke="#4f6f7d"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : (
            <BarChart
              data={barData}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                }
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #333",
                  color: "#fff",
                }}
                formatter={(v) => `KES ${Number(v).toLocaleString()}`}
              />
              <Legend wrapperStyle={{ color: "#ccc" }} />
              <Bar
                dataKey={t.sales || "Sales"}
                fill="#29573f"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey={t.purchases || "Purchases"}
                fill="#a0623f"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey={t.expenses || "Expenses"}
                fill="#8c6e52"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey={t.losses || "Losses"}
                fill="#a33a2a"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Expense pie chart */}
      <div className="chart-card">
        <h3>
          {t.expenseBreakdown || "Expense Breakdown"}: {periodLabel}
        </h3>
        {expenseByCat.length === 0 ? (
          <div className="empty-state">
            {t.noExpensesMonth || "No expenses for this period."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={expenseByCat}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={75}
                label={false}
                labelLine={false}
              >
                {expenseByCat.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #333",
                  color: "#fff",
                }}
                formatter={(v) => `KES ${Number(v).toLocaleString()}`}
              />
              <PieLegend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Payment method breakdown */}
      <div className="chart-card">
        <h3>
          {t.paymentBreakdown || "Payments by Method"}: {periodLabel}
        </h3>
        {paymentByMethod.length === 0 ? (
          <div className="empty-state">No sales recorded for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={paymentByMethod}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={75}
                label={false}
                labelLine={false}
              >
                {paymentByMethod.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #333",
                  color: "#fff",
                }}
                formatter={(v) => `KES ${Number(v).toLocaleString()}`}
              />
              <PieLegend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top selling items */}
      <div className="chart-card">
        <h3>Top Selling Items: {periodLabel}</h3>
        {topItems.length === 0 ? (
          <div className="empty-state">No sales recorded for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              layout="vertical"
              data={topItems}
              margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                type="number"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #333",
                  color: "#fff",
                }}
                formatter={(v) => `KES ${Number(v).toLocaleString()}`}
              />
              <Bar dataKey="value" fill="#4f6f7d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sales by location/branch — "which place sold better" */}
      {salesByLocation.length > 0 && (
        <div className="chart-card">
          <h3>Sales by Location: {periodLabel}</h3>
          {bestLocation && salesByLocation.length > 1 && (
            <div
              style={{
                fontSize: 13,
                marginBottom: 10,
                padding: "6px 10px",
                borderRadius: 0,
                background: "#29573f15",
                color: "#29573f",
                fontWeight: 600,
              }}
            >
              Best performing: {bestLocation.name}: KES{" "}
              {bestLocation.value.toLocaleString()}
            </div>
          )}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              layout="vertical"
              data={salesByLocation}
              margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                type="number"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #333",
                  color: "#fff",
                }}
                formatter={(v, n, p) => [
                  `KES ${Number(v).toLocaleString()} (${p.payload.count} sale${p.payload.count === 1 ? "" : "s"})`,
                  "Revenue",
                ]}
              />
              <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>

    {/* ── Profit badge ── */}
    <div className="profit-indicator">
      <div className={`profit-badge ${mProfit >= 0 ? "profit" : "loss"}`}>
        {mProfit >= 0
          ? (t.profitable || "PROFITABLE")
          : (t.loss || "LOSS")}{" "}
({periodLabel})
        <span>
          {" "}
          ·{" "}
          {mProfit >= 0 ? t.netProfit || "Net Profit" : t.netLoss || "Net Loss"}
          : KES {Math.abs(mProfit).toLocaleString()}
        </span>
      </div>
    </div>

    {/* ── Transaction list ── */}
    <div className="chart-card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>All Transactions: {periodLabel}</h3>
        <span style={{ fontSize: 12, color: "var(--muted, #9ca3af)" }}>
          {allTransactions.length} record
          {allTransactions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {allTransactions.length === 0 ? (
        <div className="empty-state">No transactions for this period.</div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border, #2a2a3a)",
                  color: "var(--muted, #9ca3af)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "6px 8px" }}>Type</th>
                <th style={{ padding: "6px 8px" }}>Date</th>
                <th style={{ padding: "6px 8px" }}>Description</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Qty</th>
                <th style={{ padding: "6px 8px" }}>{t.paymentMethod || "Method"}</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>
                  Amount (KES)
                </th>
              </tr>
            </thead>
            <tbody>
              {allTransactions.map((item, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--border, #1e1e30)",
                  }}
                >
                  <td style={{ padding: "7px 8px" }}>
                    <span
                      style={{
                        background: typeColor[item._type] + "22",
                        color: typeColor[item._type],
                        borderRadius: 0,
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {typeLabel[item._type]}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      color: "var(--muted, #9ca3af)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.date || ""}
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      color: "var(--text, #fff)",
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.description || item.item || item.category || ""}
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      textAlign: "right",
                      color: "var(--muted, #9ca3af)",
                    }}
                  >
                    {item.quantity != null && item.quantity !== ""
                      ? Number(item.quantity).toLocaleString()
                      : ""}
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      color: "var(--muted, #9ca3af)",
                      textTransform: "capitalize",
                    }}
                  >
                    {item._type === "sale"
                      ? t.paymentMethods?.[item.paymentMethod] ||
                        item.paymentMethod ||
                        ""
                      : ""}
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      textAlign: "right",
                      fontWeight: 600,
                      color: item._type === "sale" ? "#29573f" : "#a0623f",
                    }}
                  >
                    {item._type === "sale" ? "+" : "-"}
                    {Number(item.amount || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
</div>
);
}
