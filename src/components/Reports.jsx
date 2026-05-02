import { useState, useMemo } from "react";
import { useCollection } from "../hooks/useCollection";
import { useLang } from "../LangContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, Legend as PieLegend
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const COLORS = ["#22c55e", "#f97316", "#a855f7", "#3b82f6", "#ec4899", "#14b8a6"];

export default function Reports() {
  const { t } = useLang();
  const { items: sales } = useCollection("sales");
  const { items: purchases } = useCollection("purchases");
  const { items: expenses } = useCollection("expenses");
  const { items: losses } = useCollection("losses");

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  // Build month selector options last 12 months
  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({ value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") });
    }
    return opts;
  }, []);

  const rangeFilter = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }, [selectedMonth]);

  const inRange = (item) => {
    try {
      const dt = item.date ? parseISO(item.date) : item.createdAt?.toDate();
      return dt && isWithinInterval(dt, rangeFilter);
    } catch { return false; }
  };

  const ms = sales.filter(inRange).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const mp = purchases.filter(inRange).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const me = expenses.filter(inRange).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const ml = losses.filter(inRange).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const mProfit = ms - mp - me - ml;
  const margin = ms > 0 ? ((mProfit / ms) * 100).toFixed(1) : 0;

  // Expense breakdown by category
  const expenseByCat = useMemo(() => {
    const map = {};
    expenses.filter(inRange).forEach(e => {
      const cat = e.category || "Other";
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses, rangeFilter]);

  // 6-month bar chart
  const barData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = format(d, "MMM");
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inR = (item) => {
        try {
          const dt = item.date ? parseISO(item.date) : item.createdAt?.toDate();
          return dt && isWithinInterval(dt, { start, end });
        } catch { return false; }
      };
      const s = sales.filter(inR).reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const p = purchases.filter(inR).reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const e = expenses.filter(inR).reduce((a, b) => a + (Number(b.amount) || 0), 0);
      const l = losses.filter(inR).reduce((a, b) => a + (Number(b.amount) || 0), 0);
      months.push({ month: label, "Mauzo/Sales": s, "Manunuzi/Purchases": p, "Gharama/Expenses": e, "Hasara/Losses": l, "Faida/Profit": s - p - e - l });
    }
    return months;
  }, [sales, purchases, expenses]);

  return (
    <div className="reports-page">
      <div className="reports-controls">
        <label>{t.month}</label>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="month-select">
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="report-summary-cards">
        {[
          { label: "Mauzo / Sales",    value: ms,     color: "#22c55e" },
          { label: "Manunuzi / Purchases", value: mp,     color: "#f97316" },
          { label: "Gharama / Expenses",  value: me,     color: "#a855f7" },
          { label: "Hasara / Losses",    value: ml,     color: "#ef4444" },
          { label: t.netProfitLabel,value: mProfit, color: mProfit >= 0 ? "#22c55e" : "#ef4444" },
          { label: t.netProfitLabel + " %", value: `${margin}%`, color: mProfit >= 0 ? "#3b82f6" : "#ef4444", raw: true },
        ].map(c => (
          <div className="report-card" key={c.label} style={{ borderLeft: `3px solid ${c.color}` }}>
            <div className="rc-label">{c.label}</div>
            <div className="rc-value" style={{ color: c.color }}>
              {c.raw ? c.value : `KES ${c.value.toLocaleString()}`}
            </div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>{t.monthlyComparison}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", color: "#fff" }} formatter={v => `KES ${v.toLocaleString()}`} />
              <Legend wrapperStyle={{ color: "#ccc" }} />
              <Bar dataKey="Mauzo/Sales"          fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Manunuzi/Purchases"    fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Gharama/Expenses"      fill="#a855f7" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Hasara/Losses"         fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>{t.expenseBreakdown} — {monthOptions.find(o => o.value === selectedMonth)?.label}</h3>
          {expenseByCat.length === 0 ? (
            <div className="empty-state">{t.noExpensesMonth}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie data={expenseByCat} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={75} label={false} labelLine={false}>
                  {expenseByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", color: "#fff" }} formatter={v => `KES ${v.toLocaleString()}`} />
                <PieLegend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="profit-indicator">
        <div className={`profit-badge ${mProfit >= 0 ? "profit" : "loss"}`}>
          {mProfit >= 0 ? "✅ " + t.profitable : "⚠️ " + t.loss} - {monthOptions.find(o => o.value === selectedMonth)?.label}
          <span> · {mProfit >= 0 ? t.netProfit : t.netLoss}: KES {Math.abs(mProfit).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
