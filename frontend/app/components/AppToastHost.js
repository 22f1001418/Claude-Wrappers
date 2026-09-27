"use client";

import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_DURATION = 4500;
const ALLOWED_VARIANTS = new Set(["success", "error", "warning", "info"]);

const normalizeVariant = (variant) => {
  const value = String(variant || "success").toLowerCase();
  return ALLOWED_VARIANTS.has(value) ? value : "success";
};

export default function AppToastHost() {
  const [toasts, setToasts] = useState([]);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    const onToast = (event) => {
      const incoming = event?.detail;
      if (!incoming?.id) return;

      setToasts((prev) => {
        const next = [incoming, ...prev];
        return next.slice(0, 5);
      });

      const lifetime = Math.max(1500, Number(incoming.durationMs) || DEFAULT_DURATION);
      window.setTimeout(() => {
        removeToast(incoming.id);
      }, lifetime);
    };

    window.addEventListener("vyaparai:toast", onToast);
    return () => window.removeEventListener("vyaparai:toast", onToast);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const originalAlert = window.alert;
    window.alert = (message) => {
      const detail = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: "Notice",
        message: String(message || "Action completed"),
        variant: "info",
        durationMs: DEFAULT_DURATION,
      };
      window.dispatchEvent(new CustomEvent("vyaparai:toast", { detail }));
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const rendered = useMemo(() => {
    return toasts.map((toast) => {
      const variant = normalizeVariant(toast.variant);
      const lifetime = Math.max(1500, Number(toast.durationMs) || DEFAULT_DURATION);
      const rootClass = `app-toast app-toast-${variant}`;
      const barClass = `app-toast-progress app-toast-progress-${variant}`;

      return (
        <div className={rootClass} key={toast.id}>
          <div className="app-toast-content">
            <div className="app-toast-title-row">
              <div className="app-toast-title">{toast.title}</div>
              <button
                className="app-toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                X
              </button>
            </div>
            <div className="app-toast-message">{toast.message}</div>
          </div>
          <div className={barClass} style={{ animationDuration: `${lifetime}ms` }} />
        </div>
      );
    });
  }, [toasts]);

  return <div className="app-toast-container">{rendered}</div>;
}
