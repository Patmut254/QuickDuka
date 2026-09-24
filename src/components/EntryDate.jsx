import { useLang } from "../LangContext";
import { localToday, localYesterday, daysOld, prettyDate } from "../dates";

// Date picker for entry forms: the native calendar (tap the field), plus
// Today / Yesterday shortcuts and a clear "not today" banner so a back-dated
// entry can't be mistaken for a normal one. Future dates are blocked unless
// `allowFuture` is set.
export default function EntryDate({
  id,
  label,
  value,
  onChange,
  min,
  allowFuture = false,
  required = true,
}) {
  const { t } = useLang();
  const today = localToday();
  const isPast = value && value < today;

  const chip = (text, date) => (
    <button
      type="button"
      onClick={() => onChange(date)}
      style={{
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 999,
        cursor: "pointer",
        fontFamily: "inherit",
        border: "1px solid var(--border2, var(--border))",
        background: value === date ? "var(--green, #22c55e)" : "var(--bg2)",
        color: value === date ? "#fff" : "var(--text)",
      }}
    >
      {text}
    </button>
  );

  return (
    <div className="field-group">
      <label htmlFor={id}>
        {label || t.date}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        name={id}
        type="date"
        autoComplete="off"
        value={value}
        min={min}
        max={allowFuture ? undefined : today}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        {chip(t.todayLabel, today)}
        {chip(t.yesterdayLabel, localYesterday())}
      </div>
      {isPast && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "#b45309",
            background: "#f59e0b18",
            border: "1px solid #f59e0b",
            borderRadius: 6,
            padding: "4px 8px",
          }}
        >
          📅 {t.recordingFor} {prettyDate(value)} — {t.notToday}
        </div>
      )}
    </div>
  );
}

// Shown under a back-dated entry that would change stock. Old entries default
// to NOT touching today's stock count (see stockUpdateWanted in dates.js).
export function StockUpdateToggle({ date, checked, onChange }) {
  const { t } = useLang();
  if (daysOld(date) <= 0) return null;
  return (
    <div
      className="field-group full-width"
      style={{
        fontSize: 13,
        padding: "8px 10px",
        border: "1px dashed var(--border2, var(--border))",
        borderRadius: 8,
      }}
    >
      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {t.updateStockLabel}
      </label>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
        {t.updateStockHint}
      </div>
    </div>
  );
}
