import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { subscribeToast } from "../lib/toast";
import { cn } from "../lib/utils";

// Mounted once in App.jsx — every screen (and api.js, for every failed
// request platform-wide) raises alerts through showToast() without needing
// this component threaded through props.
const TONES = {
  error: { icon: AlertTriangle, text: "text-destructive", border: "border-destructive/40" },
  warning: { icon: AlertTriangle, text: "text-warning", border: "border-warning/40" },
  success: { icon: CheckCircle2, text: "text-success", border: "border-success/40" },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => subscribeToast((toast) => {
    setToasts((prev) => [...prev, toast]);
    // Warnings carry the precise reason (which week, which %): linger longer.
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), toast.type === "warning" ? 12000 : 7000);
  }), []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const tone = TONES[t.type] || TONES.success;
        const Icon = tone.icon;
        return (
          <div key={t.id} className={cn("rounded-lg border bg-card p-3 shadow-md flex items-start gap-2.5 text-[13px]", tone.border)}>
            <Icon size={16} className={cn("shrink-0 mt-0.5", tone.text)} />
            <span className="text-foreground flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Fermer" className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
