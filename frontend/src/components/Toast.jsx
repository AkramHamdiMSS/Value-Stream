import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { subscribeToast } from "../lib/toast";
import { SURFACE, BORDER, TEXT, RED, GREEN, CARD_SHADOW, FONT_BODY } from "../styles";

// Mounted once in App.jsx — every screen (and api.js, for every failed
// request platform-wide) raises alerts through showToast() without needing
// this component threaded through props.
export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => subscribeToast((toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 7000);
  }), []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed", top: 16, right: 16, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8,
      maxWidth: 360, fontFamily: FONT_BODY,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: SURFACE, border: `1px solid ${t.type === "error" ? RED : GREEN}`, borderRadius: 10,
          padding: "10px 12px", boxShadow: CARD_SHADOW, display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13,
        }}>
          {t.type === "error"
            ? <AlertTriangle size={16} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
            : <CheckCircle2 size={16} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span style={{ color: TEXT, flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Fermer"
            style={{ background: "none", border: "none", cursor: "pointer", color: TEXT, padding: 0, display: "flex", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
