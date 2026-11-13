// To-Do — a simple business task list: the shop's own tasks (with optional
// due date, time and repeat) plus tasks suggested from its records
// (low stock, overdue customer credits, supplier payments due).
import { useState } from "react";
import { Check, Repeat, Trash2, Lightbulb, X, Clock } from "lucide-react";
import { useCollection } from "../hooks/useCollection";
import { useStock } from "../hooks/useStock";
import { useLang } from "../LangContext";
import { localToday } from "../dates";
import { REPEATS, nextDue, bucketOf, suggestTasks } from "../todos";
import { Toast, useToast } from "./Toast";

const HIDDEN_KEY = "qd-todo-hidden-suggestions";
const readHidden = () => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
  } catch {
    return [];
  }
};

export default function TodoPage({ ownerUid }) {
  const t = useLang();
  const opts = ownerUid ? { ownerUid } : undefined;
  const { items: todos, loading, addItem, updateItem, deleteItem } =
    useCollection("todos", opts);
  const stock = useStock();
  const { items: credits } = useCollection("credits", opts);
  const { items: purchases } = useCollection("purchases", opts);

  const today = localToday();
  const empty = { title: "", dueDate: today, dueTime: "", repeat: "none", notes: "" };
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [hidden, setHidden] = useState(readHidden);
  const { toast, showToast } = useToast();

  const repeatLabel = {
    none: t.todoRepeatNone || "Does not repeat",
    daily: t.todoDaily || "Every day",
    weekly: t.todoWeekly || "Every week",
    monthly: t.todoMonthly || "Every month",
  };

  // ── Suggestions not yet on the list and not hidden ──
  const onList = new Set(todos.map((x) => x.suggestionKey).filter(Boolean));
  const suggestions = suggestTasks({ stock, credits, purchases }, t).filter(
    (s) => !onList.has(s.key) && !hidden.includes(s.key),
  );

  const hideSuggestion = (key) => {
    const next = [...hidden, key].slice(-200);
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* private mode: hiding just won't persist */
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast(t.todoNeedTitle || "Write what needs doing.", "error");
      return;
    }
    try {
      await addItem({
        title: form.title.trim(),
        dueDate: form.dueDate || "",
        dueTime: form.dueTime || "",
        repeat: form.repeat,
        notes: form.notes.trim(),
        done: false,
      });
      showToast(t.saved || "Saved");
      setForm(empty);
      setShowForm(false);
    } catch {
      showToast(t.failedSave || "Could not save", "error");
    }
  };

  const addSuggestion = async (s) => {
    try {
      await addItem({
        title: s.title,
        dueDate: s.dueDate,
        dueTime: "",
        repeat: "none",
        notes: s.notes || "",
        done: false,
        suggestionKey: s.key,
      });
      showToast(t.todoAdded || "Added to your list");
    } catch {
      showToast(t.failedSave || "Could not save", "error");
    }
  };

  // Ticking a repeating task moves it to its next date instead of closing it.
  const complete = (task) => {
    if (task.repeat && task.repeat !== "none") {
      updateItem(task.id, { dueDate: nextDue(task.dueDate, task.repeat), lastDoneAt: today }, task);
      showToast(`${t.todoNextOn || "Done. Next on"} ${nextDue(task.dueDate, task.repeat)}`);
    } else {
      updateItem(task.id, { done: true, doneAt: today }, task);
    }
  };
  const reopen = (task) => updateItem(task.id, { done: false, doneAt: "" }, task);

  const groups = (() => {
    const g = { overdue: [], today: [], upcoming: [], nodate: [], done: [] };
    for (const x of todos) g[bucketOf(x, today)].push(x);
    const byDue = (a, b) =>
      `${a.dueDate || "9999"} ${a.dueTime || "99"}`.localeCompare(
        `${b.dueDate || "9999"} ${b.dueTime || "99"}`,
      );
    g.overdue.sort(byDue);
    g.today.sort(byDue);
    g.upcoming.sort(byDue);
    g.done.sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
    return g;
  })();

  const renderRow = (task) => (
    <li key={task.id} className={"todo-row" + (task.done ? " is-done" : "")}>
      <button
        type="button"
        className="todo-check"
        aria-label={task.done ? t.todoReopen || "Mark not done" : t.todoMarkDone || "Mark done"}
        onClick={() => (task.done ? reopen(task) : complete(task))}
      >
        {task.done && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="todo-main">
        <span className="todo-title">{task.title}</span>
        <span className="todo-meta">
          {task.dueDate && (
            <span className={bucketOf(task, today) === "overdue" ? "todo-late" : ""}>
              {task.dueDate === today ? t.todayLabel || "Today" : task.dueDate}
            </span>
          )}
          {task.dueTime && (
            <span>
              <Clock size={11} /> {task.dueTime}
            </span>
          )}
          {task.repeat && task.repeat !== "none" && (
            <span>
              <Repeat size={11} /> {repeatLabel[task.repeat]}
            </span>
          )}
          {task.notes && <span className="todo-notes">{task.notes}</span>}
        </span>
      </div>
      <button
        type="button"
        className="todo-delete"
        aria-label={t.delete || "Delete"}
        onClick={() => deleteItem(task.id, task)}
      >
        <Trash2 size={15} />
      </button>
    </li>
  );

  const renderSection = (title, list, tone) =>
    list.length > 0 && (
      <div className="todo-section">
        <h4 className={"todo-section-title" + (tone ? ` ${tone}` : "")}>
          {title} <span>{list.length}</span>
        </h4>
        <ul className="todo-list">
          {list.map(renderRow)}
        </ul>
      </div>
    );

  const dueCount = groups.overdue.length + groups.today.length;

  return (
    <div className="module-page">
      <Toast toast={toast} />

      <div className="module-header">
        <div className="module-stat">
          <span className="stat-label">{t.todoDueToday || "Due today"}</span>
          <span className="stat-value">{dueCount}</span>
        </div>
        <div className="module-stat module-stat-sub">
          <span className="stat-label">{t.todoOverdueLabel || "Overdue"}</span>
          <span className="stat-value">{groups.overdue.length}</span>
        </div>
        <div className="module-stat module-stat-sub">
          <span className="stat-label">{t.todoUpcoming || "Upcoming"}</span>
          <span className="stat-value">{groups.upcoming.length}</span>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? t.cancel : `+ ${t.todoNew || "New Task"}`}
        </button>
      </div>

      {showForm && (
        <form className="entry-form" onSubmit={save}>
          <h3>{t.todoNew || "New Task"}</h3>
          <div className="form-grid">
            <div className="field-group full-width">
              <label htmlFor="todo-title">{t.todoWhat || "What needs doing?"} *</label>
              <input
                id="todo-title"
                autoComplete="off"
                placeholder={t.todoWhatPh || "e.g. Call supplier about sugar"}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="todo-date">{t.todoDueDate || "Due date"}</label>
              <input
                id="todo-date"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="todo-time">{t.todoTime || "Time (optional)"}</label>
              <input
                id="todo-time"
                type="time"
                value={form.dueTime}
                onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="todo-repeat">{t.todoRepeat || "Repeat"}</label>
              <select
                id="todo-repeat"
                value={form.repeat}
                onChange={(e) => setForm({ ...form, repeat: e.target.value })}
              >
                {REPEATS.map((r) => (
                  <option key={r} value={r}>
                    {repeatLabel[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="todo-notes">{t.notes || "Notes"}</label>
              <input
                id="todo-notes"
                autoComplete="off"
                placeholder="..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">
            {t.todoSave || "Save Task"}
          </button>
        </form>
      )}

      {suggestions.length > 0 && (
        <div className="info-card todo-suggest">
          <h4 className="todo-section-title">
            <Lightbulb size={14} /> {t.todoSuggested || "Suggested from your shop"}
          </h4>
          <ul className="todo-list">
            {suggestions.slice(0, 8).map((s) => (
              <li key={s.key} className="todo-row">
                <div className="todo-main">
                  <span className="todo-title">{s.title}</span>
                  {s.notes && <span className="todo-meta">{s.notes}</span>}
                </div>
                <button type="button" className="btn-secondary todo-add" onClick={() => addSuggestion(s)}>
                  + {t.todoAddToList || "Add"}
                </button>
                <button
                  type="button"
                  className="todo-delete"
                  aria-label={t.todoHide || "Hide"}
                  onClick={() => hideSuggestion(s.key)}
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="info-card todo-card">
        {loading ? (
          <p className="todo-empty">{t.loading || "Loading..."}</p>
        ) : todos.length === 0 ? (
          <p className="todo-empty">
            {t.todoEmpty || "No tasks yet. Tap + New Task to add one, or add a suggestion above."}
          </p>
        ) : (
          <>
            {renderSection(t.todoOverdueLabel || "Overdue", groups.overdue, "late")}
            {renderSection(t.todayLabel || "Today", groups.today)}
            {renderSection(t.todoUpcoming || "Upcoming", groups.upcoming)}
            {renderSection(t.todoNoDate || "No date", groups.nodate)}
            {groups.done.length > 0 && (
              <button type="button" className="batch-add" onClick={() => setShowDone(!showDone)}>
                {showDone ? t.todoHideDone || "Hide done" : `${t.todoShowDone || "Show done"} (${groups.done.length})`}
              </button>
            )}
            {showDone && renderSection(t.todoDone || "Done", groups.done.slice(0, 30))}
          </>
        )}
      </div>
    </div>
  );
}
