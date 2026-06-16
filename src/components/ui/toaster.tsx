"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Exponer globalmente
  useEffect(() => {
    (window as any).__alcheque_toast = addToast;
  }, [addToast]);

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: "var(--accent)",
    error: "var(--red)",
    warning: "var(--amber)",
    info: "var(--text-muted)",
  };

  return (
    <div
      aria-live="polite"
      aria-label="Notificaciones"
      style={{
        position: "fixed",
        bottom: "1.25rem",
        right: "1.25rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.variant];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "0.75rem 1rem",
                boxShadow: "var(--shadow-lg)",
                pointerEvents: "auto",
                minWidth: "260px",
                maxWidth: "380px",
              }}
              role="alert"
            >
              <Icon size={16} style={{ color: colors[toast.variant], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: "0.875rem", color: "var(--text)", lineHeight: 1.4 }}>
                {toast.message}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// Helper para usar desde cualquier parte
export function showToast(message: string, variant: ToastVariant = "info") {
  (window as any).__alcheque_toast?.(message, variant);
}
