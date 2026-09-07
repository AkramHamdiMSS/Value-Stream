// MS Solutions brand palette (mssolutions-group.com): deep indigo/navy ground,
// a single purple accent, Funnel Display/Sans typefaces.
export const NAVY = "#0c144e";
export const SURFACE = "#141c5e";
export const SURFACE2 = "#1c2570";
export const BORDER = "rgba(135, 136, 255, 0.24)";
export const ACCENT = "#8788ff";
export const ACCENT2 = "#a5a6ff";
export const GREEN = "#10b981";
export const AMBER = "#f59e0b";
export const RED = "#ef4444";
export const TEXT = "#f7f7fb";
export const MUTED = "#9496c4";

export const FONT_BODY = "'Funnel Sans', system-ui, -apple-system, sans-serif";
export const FONT_DISPLAY = "'Funnel Display', 'Funnel Sans', system-ui, sans-serif";

export const inputStyle = {
  background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT,
  fontSize: 12.5, padding: "5px 8px", outline: "none", fontFamily: FONT_BODY,
};
export const btnPrimary = {
  display: "flex", alignItems: "center", gap: 6, background: ACCENT, color: "#0c144e", border: "none",
  borderRadius: 6, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  fontFamily: FONT_BODY, textTransform: "uppercase", letterSpacing: "0.02em",
};
export const btnGhost = {
  display: "flex", alignItems: "center", gap: 6, background: "transparent", color: MUTED,
  border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 12px", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
  fontFamily: FONT_BODY, textTransform: "uppercase", letterSpacing: "0.02em",
};
export const iconBtn = {
  background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex",
};
