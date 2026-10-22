/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, Trash2, CircleX } from "lucide-react";

export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    // Always create a new object so useEffect fires even for same message
    setToast({ message, type, id: Date.now() });
  };

  return { toast, showToast };
}

export function Toast({ toast }) {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    setShow(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timerRef.current);
  }, [toast, toast?.id]); // ← use optional chaining so null toast doesn't crash

  if (!show || !toast) return null;

  const icons = { success: CircleCheck, delete: Trash2, error: CircleX };
  const ToastIcon = icons[toast.type] || CircleCheck;

  return createPortal(
    <div className={"toast toast-" + (toast.type || "success")}>
      <span className="toast-icon"><ToastIcon size={17} strokeWidth={1.75} aria-hidden="true" /></span>
      <span>{toast.message}</span>
    </div>,
    document.body,
  );
}
