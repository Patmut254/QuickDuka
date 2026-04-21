import { useMemo } from "react";
import { useCollection } from "../hooks/useCollection";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";

export default function Dashboard({ setActiveTab }) {
  const { items: sales } = useCollection("sales");
  const { items: purchases } = useCollection("purchases");
  const { items: expenses } = useCollection("expenses");

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const inMonth = (item) => {
    try {
      const d = item.date ? parseISO(item.date) : item.createdAt?.toDate();
      return d && isWithinInterval(d, { start: monthStart, end: monthEnd });
    } catch {
      return false;
    }
  };

  const totalSales = sales
    .filter(inMonth)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const totalPurchases = purchases
    .filter(inMonth)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const totalExpenses = expenses
    .filter(inMonth)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const profit = totalSales - totalPurchases - totalExpenses;

  // Monthly chart data - last 6 months
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = format(d, "MMM yyyy");
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inRange = (item) => {
        try {
          const dt = item.date ? parseISO(item.date) : item.createdAt?.toDate();
          return dt && isWithinInterval(dt, { start, end });
        } catch {
          return false;
        }
      };
      const s = sales
        .filter(inRange)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const p = purchases
        .filter(inRange)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const e = expenses
        .filter(inRange)
        .reduce((a, b) => a + (Number(b.amount) || 0), 0);
      months.push({
        month: label,
        Sales: s,
        Purchases: p,
        Expenses: e,
        Profit: s - p - e,
      });
    }
    return months;
  }, [sales, purchases, expenses]);

  const cards = [
    {
      label: "Sales This Month",
      value: totalSales,
      color: "#22c55e",
      icon: "💰",
    },
    {
      label: "Purchases This Month",
      value: totalPurchases,
      color: "#f97316",
      icon: "🛒",
    },
    {
      label: "Expenses This Month",
      value: totalExpenses,
      color: "#a855f7",
      icon: "📋",
    },
    {
      label: "Net Profit",
      value: profit,
      color: profit >= 0 ? "#22c55e" : "#ef4444",
      icon: profit >= 0 ? "✅" : "⚠️",
    },
  ];

  const recent = [
    ...sales.slice(0, 3).map((s) => ({ ...s, type: "Sale" })),
    ...purchases.slice(0, 2).map((p) => ({ ...p, type: "Purchase" })),
    ...expenses.slice(0, 2).map((e) => ({ ...e, type: "Expense" })),
  ]
    .sort((a, b) => {
      const da = a.date
        ? parseISO(a.date)
        : a.createdAt?.toDate() || new Date(0);
      const db2 = b.date
        ? parseISO(b.date)
        : b.createdAt?.toDate() || new Date(0);
      return db2 - da;
    })
    .slice(0, 6);

  return (
    <div className="dashboard">
      <div className="summary-cards">
        {cards.map((c) => (
          <div
            className="summary-card"
            key={c.label}
            style={{ borderTop: `4px solid ${c.color}` }}
          >
            <div className="card-icon">{c.icon}</div>
            <div className="card-body">
              <div className="card-label">{c.label}</div>
              <div className="card-value" style={{ color: c.color }}>
                KES {c.value.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="chart-section">
        <div className="section-header">
          <h2>6-Month Performance</h2>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                tickFormatter={(v) =>
                  `${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                }
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #333",
                  borderRadius: 8,
                  color: "#fff",
                }}
                formatter={(v) => `KES ${v.toLocaleString()}`}
              />
              <Legend wrapperStyle={{ color: "#ccc" }} />
              <Area
                type="monotone"
                dataKey="Sales"
                stroke="#22c55e"
                fill="url(#gSales)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Expenses"
                stroke="#a855f7"
                fill="url(#gExp)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Profit"
                stroke="#3b82f6"
                fill="url(#gProfit)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="recent-section">
        <div className="section-header">
          <h2>Recent Activity</h2>
          <button className="link-btn" onClick={() => setActiveTab("reports")}>
            View Reports →
          </button>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            No transactions yet. Start by adding sales, purchases or expenses.
          </div>
        ) : (
          <div className="recent-list">
            {recent.map((item, i) => (
              <div className="recent-row" key={i}>
                <div className="recent-icon">
                  {item.type === "Sale"
                    ? "💰"
                    : item.type === "Purchase"
                      ? "🛒"
                      : "📋"}
                </div>
                <div className="recent-info">
                  <div className="recent-desc">
                    {item.description ||
                      item.item ||
                      item.category ||
                      item.type}
                  </div>
                  <div className="recent-meta">
                    {item.type} · {item.date || "-"}
                  </div>
                </div>
                <div
                  className="recent-amount"
                  style={{
                    color: item.type === "Sale" ? "#22c55e" : "#f97316",
                  }}
                >
                  {item.type === "Sale" ? "+" : "-"}KES{" "}
                  {Number(item.amount).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
