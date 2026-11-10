import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Package, PencilLine, Check } from "lucide-react";

// One combined "item selection" field:
//   1. the chosen item shows at the top
//   2. a search box to narrow a long list
//   3. a scrolling list of stock items (scrollbar on the left side)
// Typing a name that isn't in stock offers "Use <name>", which is saved as a
// manual entry and tagged "Not in stock". Set allowCustom={false} to force
// every entry to come from stock.
export default function ItemPicker({
  id,
  label,
  required = false,
  options, // [{ value, label, hint, disabled }]
  selectedValue, // stock id/name currently chosen ("" if none)
  text, // current item text on the form
  onPick, // (value) => void   value "" clears
  onCustom, // (text) => void
  allowCustom = true,
  t = {},
  customTag,
  listOnType = false, // true: list stays hidden until the user types
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [thumb, setThumb] = useState({ top: 0, height: 100, show: false });

  const measure = () => {
    const el = listRef.current;
    if (!el) return;
    const ratio = el.clientHeight / el.scrollHeight;
    const next = {
      show: ratio < 1,
      height: Math.round(Math.max(ratio * 100, 12) * 10) / 10,
      top: Math.round((el.scrollTop / el.scrollHeight) * 1000) / 10,
    };
    setThumb((prev) =>
      prev.show === next.show && prev.height === next.height && prev.top === next.top
        ? prev
        : next,
    );
  };

  const selected =
    options.find((o) => String(o.value) === String(selectedValue)) ||
    (text
      ? options.find((o) => o.label.toLowerCase() === text.trim().toLowerCase())
      : undefined);
  const isCustom = !selected && !!(text && text.trim());
  const hasItem = !!selected || isCustom;
  const showChooser = !hasItem || editing;
  const notInStock = customTag || t.notInStock || "Not in stock";

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? options.filter((o) => `${o.label} ${o.hint || ""}`.toLowerCase().includes(q))
        : options,
    [options, q],
  );
  const exact = options.some((o) => o.label.toLowerCase() === q);
  const offerCustom = allowCustom && q && !exact;
  const rows = [
    ...(offerCustom ? [{ custom: true, value: "__custom__", label: query.trim() }] : []),
    ...filtered,
  ];

  useEffect(() => {
    measure();
  });

  useEffect(() => {
    const el = listRef.current?.children?.[active];
    el?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const finish = () => {
    setQuery("");
    setEditing(false);
    setActive(0);
  };

  const choose = (row) => {
    if (!row || row.disabled) return;
    if (row.custom) onCustom(row.label);
    else onPick(row.value);
    finish();
  };

  const clear = () => {
    onPick("");
    setQuery("");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (rows[active]) {
        e.preventDefault();
        choose(rows[active]);
      }
    } else if (e.key === "Escape" && hasItem) {
      finish();
    }
  };

  return (
    <div
      className={
        "field-group full-width item-picker" +
        (listOnType && !q ? " list-hidden" : "")
      }
    >
      {label && (
        <label htmlFor={id}>
          {label}
          {required ? " *" : ""}
        </label>
      )}

      {/* 1. The chosen item shows here */}
      <div className={"item-picker-chosen" + (hasItem ? " has-item" : "")}>
        {hasItem ? (
          <>
            <span className={"item-picker-chosen-icon" + (isCustom ? " is-custom" : "")}>
              {isCustom ? (
                <PencilLine size={18} strokeWidth={1.75} />
              ) : (
                <Package size={18} strokeWidth={1.75} />
              )}
            </span>
            <span className="item-picker-chosen-text">
              <span className="item-picker-chosen-name">
                {selected ? selected.label : text}
              </span>
              <span className="item-picker-chosen-meta">
                {isCustom ? (
                  <span className="item-picker-tag tag-out">{notInStock}</span>
                ) : (
                  <>
                    <span className="item-picker-tag tag-in">
                      {t.fromStock || "From stock"}
                    </span>
                    {selected.hint && <span>{selected.hint}</span>}
                  </>
                )}
              </span>
            </span>
            {!editing && (
              <button
                type="button"
                className="item-picker-change"
                onClick={() => {
                  setEditing(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
              >
                {t.change || "Change"}
              </button>
            )}
            <button
              type="button"
              className="item-picker-x"
              onClick={clear}
              aria-label={t.clear || "Clear"}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <span className="item-picker-empty">
            {t.noItemChosen || "No item chosen yet. Search or pick from the list below."}
          </span>
        )}
      </div>

      {showChooser && (
        <>
          {/* 2. Type here to narrow a long list */}
          <div className="search-bar item-picker-search">
            <input
              id={id}
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder={
                allowCustom
                  ? t.searchOrType || "Search stock or type a new item"
                  : t.searchItems || "Search items"
              }
              value={query}
              required={required && !hasItem}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
            {query && (
              <button
                type="button"
                className="search-bar-clear"
                aria-label={t.clear || "Clear"}
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            )}
            <span className="search-bar-btn" aria-hidden="true">
              <Search size={18} strokeWidth={1.75} />
            </span>
          </div>

          {/* 3. Scrolling list, scrollbar on the left */}
          <div className="item-picker-list-wrap">
            <div
              className={"item-picker-track" + (thumb.show ? "" : " is-hidden")}
              aria-hidden="true"
            >
              <span
                className="item-picker-thumb"
                style={{ top: `${thumb.top}%`, height: `${thumb.height}%` }}
              />
            </div>
            <ul
              className="item-picker-list"
              role="listbox"
              ref={listRef}
              onScroll={measure}
            >
              {rows.length === 0 ? (
                <li className="item-picker-none">
                  {allowCustom
                    ? t.typeToAdd || "No stock items yet. Type the item name above."
                    : t.noItemsSearch || "No matching items"}
                </li>
              ) : (
                rows.map((r, i) => (
                  <li
                    key={r.value}
                    role="option"
                    aria-selected={String(r.value) === String(selectedValue)}
                    aria-disabled={r.disabled || undefined}
                    className={
                      "item-picker-row" +
                      (i === active ? " is-active" : "") +
                      (r.disabled ? " is-disabled" : "") +
                      (r.custom ? " is-custom" : "")
                    }
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(r);
                    }}
                  >
                    <span className="item-picker-row-main">
                      <span className="item-picker-row-name">
                        {r.custom ? `${t.use || "Use"} "${r.label}"` : r.label}
                      </span>
                      <span className="item-picker-row-hint">
                        {r.custom ? (t.typedManually || "Typed manually") : r.hint}
                      </span>
                    </span>
                    {r.custom ? (
                      <span className="item-picker-tag tag-out">{notInStock}</span>
                    ) : String(r.value) === String(selectedValue) ? (
                      <Check size={16} strokeWidth={2} className="item-picker-check" />
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
