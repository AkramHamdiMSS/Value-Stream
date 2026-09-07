// Light SaaS-dashboard look (Inntegrate-style reference): light canvas, white
// cards with soft shadows, dark sidebar, purple accent, pill buttons.
export const NAVY = "var(--bg)";
export const SURFACE = "var(--surface)";
export const SURFACE2 = "var(--surface-2)";
export const BORDER = "var(--border)";
export const ACCENT = "var(--accent)";
export const ACCENT2 = "var(--accent-2)";
export const GREEN = "var(--success)";
export const AMBER = "var(--warning)";
export const RED = "var(--danger)";
export const TEXT = "var(--text)";
export const MUTED = "var(--muted)";

export const SIDEBAR_BG = "var(--sidebar-bg)";
export const SIDEBAR_BORDER = "var(--sidebar-border)";
export const SIDEBAR_TEXT = "var(--sidebar-text)";
export const SIDEBAR_MUTED = "var(--sidebar-muted)";
export const SIDEBAR_ACTIVE = "var(--sidebar-active)";

export const CARD_SHADOW = "0 1px 2px rgba(20, 23, 58, 0.04), 0 4px 16px rgba(20, 23, 58, 0.06)";

export const FONT_BODY = "'Funnel Sans', system-ui, -apple-system, sans-serif";
export const FONT_DISPLAY = "'Funnel Display', 'Funnel Sans', system-ui, sans-serif";

export const inputStyle = {
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT,
  fontSize: 12.5, padding: "6px 10px", outline: "none", fontFamily: FONT_BODY,
};
export const btnPrimary = {
  display: "flex", alignItems: "center", gap: 6, background: ACCENT, color: "#ffffff", border: "none",
  borderRadius: 999, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  fontFamily: FONT_BODY, boxShadow: "0 2px 8px rgba(120, 122, 234, 0.35)",
};
export const btnGhost = {
  display: "flex", alignItems: "center", gap: 6, background: SURFACE, color: MUTED,
  border: `1px solid ${BORDER}`, borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
  fontFamily: FONT_BODY,
};
export const iconBtn = {
  background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex",
};

// For controls rendered on the dark sidebar (always dark, unlike the light content area).
export const btnGhostSidebar = {
  display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", color: SIDEBAR_MUTED,
  border: `1px solid ${SIDEBAR_BORDER}`, borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
  fontFamily: FONT_BODY,
};
