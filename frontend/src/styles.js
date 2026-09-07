// Theme lifted from the Banxy/MS Solutions report: light or dark canvas
// (toggled via [data-theme] — see index.css and lib/theme.js), glass-like
// cards with soft shadows over an ambient gradient, dark sidebar, teal
// secondary accent, purple accent, pill buttons, Inter + Funnel Display.
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

export const CARD_SHADOW = "var(--card-shadow)";
export const GLOW = "var(--glow)";

export const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif";
export const FONT_DISPLAY = "'Funnel Display', 'Inter', system-ui, sans-serif";

export const inputStyle = {
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT,
  fontSize: 12.5, padding: "6px 10px", outline: "none", fontFamily: FONT_BODY,
};
export const btnPrimary = {
  display: "flex", alignItems: "center", gap: 6, background: ACCENT, color: "#ffffff", border: "none",
  borderRadius: 999, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  fontFamily: FONT_BODY, boxShadow: `0 4px 16px ${GLOW}`,
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

// Square theme toggle, per the report's .theme-toggle.
export const themeToggleBtn = {
  background: "transparent", border: `1px solid ${BORDER}`, color: TEXT,
  width: 36, height: 36, borderRadius: 10, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
export const themeToggleBtnSidebar = {
  background: "rgba(255,255,255,0.06)", border: `1px solid ${SIDEBAR_BORDER}`, color: SIDEBAR_TEXT,
  width: 32, height: 32, borderRadius: 10, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
