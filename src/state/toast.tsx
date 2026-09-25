"use client";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ToastTone = "default" | "success" | "ai" | "danger";
type Toast = { id: number; msg: string; tone: ToastTone };

const ToastCtx = createContext<(msg: string, tone?: ToastTone) => void>(() => {});

const DOT: Record<ToastTone, string> = {
  default: "#16B364",
  success: "#16B364",
  ai: "#AF52DE",
  danger: "#E81E17",
};

let _id = 0;

/**
 * App-wide toast feedback. `useToast()` returns `toast(message, tone?)`.
 * Makes mock action buttons (Send, Accept, Export, …) visibly do something.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, tone: ToastTone = "default") => {
    const id = ++_id;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 100, alignItems: "flex-end", pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, background: "#020617", color: "#fff", borderRadius: 11, padding: "11px 15px", fontSize: 13, fontWeight: 600, boxShadow: "0 12px 32px rgba(15,23,41,.28)", animation: "scIn .2s ease", maxWidth: 420 }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: DOT[t.tone], flex: "none" }} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
