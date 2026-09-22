"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { ToastMessage } from "../lib/types";

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (message: string, type?: "success" | "error" | "info", description?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success", description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastMessage = { id, type, message, description };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 3800);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              toast.type === "success"
                ? "bg-white/95 border-emerald-200 text-[#37352f]"
                : toast.type === "error"
                ? "bg-white/95 border-rose-200 text-[#37352f]"
                : "bg-white/95 border-blue-200 text-[#37352f]"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" && <CheckCircle2 size={16} className="text-emerald-600" />}
              {toast.type === "error" && <AlertCircle size={16} className="text-rose-600" />}
              {toast.type === "info" && <Info size={16} className="text-[#2383e2]" />}
            </div>
            <div className="flex-1 text-xs">
              <div className="font-semibold text-[#37352f]">{toast.message}</div>
              {toast.description && (
                <div className="text-[11px] text-[#787774] mt-0.5 leading-normal">{toast.description}</div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#9b9a97] hover:text-[#37352f] p-0.5 rounded transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
