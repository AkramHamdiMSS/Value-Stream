// Theme lifted from the TeamPulse (hr-dashboard-kit) reference: flat mint-white
// canvas, white cards with a subtle border (no heavy shadow/glass), teal primary
// accent, rounded-lg/xl radii, Nunito Sans throughout. Toggled via [data-theme]
// on <html> — see index.css and lib/theme.js.
export const NAVY = "var(--bg)";
export const SURFACE = "var(--surface)";
export const SURFACE2 = "var(--surface-2)";
export const BORDER = "var(--border)";
export const ACCENT = "var(--accent)";
export const ACCENT2 = "var(--accent-2)";
export const ACCENT_TINT = "var(--accent-tint)";
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

export const FONT_BODY = "'Nunito Sans', ui-sans-serif, system-ui, -apple-system, sans-serif";
export const FONT_DISPLAY = FONT_BODY;

export const CARD_RADIUS = 14;
export const CONTROL_RADIUS = 10;

export const inputStyle = {
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: CONTROL_RADIUS, color: TEXT,
  fontSize: 12.5, padding: "6px 10px", outline: "none", fontFamily: FONT_BODY,
};
export const btnPrimary = {
  display: "flex", alignItems: "center", gap: 6, background: ACCENT, color: "#ffffff", border: "none",
  borderRadius: CONTROL_RADIUS, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  fontFamily: FONT_BODY,
};
export const btnGhost = {
  display: "flex", alignItems: "center", gap: 6, background: SURFACE, color: MUTED,
  border: `1px solid ${BORDER}`, borderRadius: CONTROL_RADIUS, padding: "8px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
  fontFamily: FONT_BODY,
};
export const iconBtn = {
  background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex",
};

// For controls rendered on the sidebar.
export const btnGhostSidebar = {
  display: "flex", alignItems: "center", gap: 6, background: SURFACE, color: SIDEBAR_MUTED,
  border: `1px solid ${SIDEBAR_BORDER}`, borderRadius: CONTROL_RADIUS, padding: "8px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
  fontFamily: FONT_BODY,
};

export const themeToggleBtn = {
  background: "transparent", border: `1px solid ${BORDER}`, color: TEXT,
  width: 36, height: 36, borderRadius: CONTROL_RADIUS, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
export const themeToggleBtnSidebar = {
  background: SURFACE, border: `1px solid ${SIDEBAR_BORDER}`, color: SIDEBAR_TEXT,
  width: 32, height: 32, borderRadius: CONTROL_RADIUS, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
