import { useRef } from "react";
import { Search, X } from "lucide-react";

// Pill-shaped search bar: rounded input on the left, a divided search
// button segment on the right. Filtering is live as you type; the button
// just puts the cursor in the box.
export default function SearchBar({
  id,
  value,
  onChange,
  placeholder = "Search",
  label,
  className = "",
}) {
  const inputRef = useRef(null);
  return (
    <div className={"search-bar" + (className ? " " + className : "")}>
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <input
        id={id}
        name={id}
        ref={inputRef}
        type="search"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-bar-clear"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      )}
      <button
        type="button"
        className="search-bar-btn"
        aria-label={label || placeholder}
        onClick={() => inputRef.current?.focus()}
      >
        <Search size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}
