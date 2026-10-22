import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

// Type-to-search replacement for a plain <select>.
// options: [{ value, label, hint?, disabled? }]
// onChange receives a select-like event: { target: { value } }, so existing
// handleStockSelect(e) handlers keep working unchanged.
export default function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Search items",
  emptyText = "No matching items",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint || ""}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.children?.[active];
    el?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const pick = (opt) => {
    if (!opt || opt.disabled) return;
    onChange({ target: { value: opt.value } });
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange({ target: { value: "" } });
    setQuery("");
    inputRef.current?.focus();
    setOpen(true);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        pick(filtered[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div className="search-select" ref={wrapRef}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : selected ? selected.label : ""}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {selected && !open && (
        <button
          type="button"
          className="search-select-clear"
          onClick={clear}
          aria-label="Clear"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      )}
      <span className="search-select-btn" aria-hidden="true">
        <Search size={18} strokeWidth={1.75} />
      </span>
      {open && (
        <ul className="search-select-list" role="listbox" ref={listRef}>
          {filtered.length === 0 ? (
            <li className="search-select-empty">{emptyText}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={String(o.value) === String(value)}
                aria-disabled={o.disabled || undefined}
                className={
                  "search-select-option" +
                  (i === active ? " is-active" : "") +
                  (o.disabled ? " is-disabled" : "") +
                  (String(o.value) === String(value) ? " is-selected" : "")
                }
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
              >
                <span className="search-select-label">{o.label}</span>
                {o.hint && <span className="search-select-hint">{o.hint}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
