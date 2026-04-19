import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function AlertDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, danger = false }) {
  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="alert-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="alert-box">
        <div className="alert-icon">
          {danger ? "⚠️" : "ℹ️"}
        </div>
        <div className="alert-title">{title}</div>
        <div className="alert-message">{message}</div>
        <div className="alert-actions">
          <button className="btn-cancel-sm" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
