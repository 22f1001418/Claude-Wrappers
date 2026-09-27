const ALLOWED_TOAST_VARIANTS = new Set(["success", "error", "warning", "info"]);

function normalizeVariant(variant) {
  const value = String(variant || "success").toLowerCase();
  return ALLOWED_TOAST_VARIANTS.has(value) ? value : "success";
}

export function emitAppToast({ title, message, variant = "success", durationMs = 4500 }) {
  if (typeof window === "undefined") return;

  const detail = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: title || "Notice",
    message: message || "Action completed",
    variant: normalizeVariant(variant),
    durationMs: Math.max(1500, Number(durationMs) || 4500),
  };

  window.dispatchEvent(new CustomEvent("vyaparai:toast", { detail }));
}

export function emitSuccessToast(message, title = "Success") {
  emitAppToast({ title, message, variant: "success" });
}

export function emitErrorToast(message, title = "Error") {
  emitAppToast({ title, message, variant: "error", durationMs: 5200 });
}

export function emitWarningToast(message, title = "Warning") {
  emitAppToast({ title, message, variant: "warning", durationMs: 5000 });
}

export function emitInfoToast(message, title = "Info") {
  emitAppToast({ title, message, variant: "info" });
}
