export const NAVY = "#0a0e1a";
export const SURFACE = "#111827";
export const SURFACE2 = "#1a2235";
export const BORDER = "#1e2d45";
export const ACCENT = "#3b82f6";
export const ACCENT2 = "#6366f1";
export const GREEN = "#10b981";
export const AMBER = "#f59e0b";
export const RED = "#ef4444";
export const TEXT = "#f1f5f9";
export const MUTED = "#64748b";

export const inputStyle = {
  background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT,
  fontSize: 12.5, padding: "5px 8px", outline: "none",
};
export const btnPrimary = {
  display: "flex", alignItems: "center", gap: 6, background: ACCENT, color: "#fff", border: "none",
  borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
export const btnGhost = {
  display: "flex", alignItems: "center", gap: 6, background: "transparent", color: MUTED,
  border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer",
};
export const iconBtn = {
  background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex",
};
