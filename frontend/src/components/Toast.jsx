/**
 * Toast.jsx - Simple notification toasts for success/error feedback
 */
import React, { useEffect } from "react";

export function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${toast.type}`}>
      <span style={{ fontSize: 18 }}>{toast.type === "success" ? "✅" : "❌"}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontSize: 16,
          opacity: 0.7,
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Custom hook for toast management ────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = React.useState([]);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
