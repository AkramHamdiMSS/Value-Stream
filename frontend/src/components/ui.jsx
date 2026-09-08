import {
  MUTED, SURFACE, BORDER, TEXT, ACCENT, ACCENT_TINT, FONT_DISPLAY, inputStyle,
  SIDEBAR_TEXT, SIDEBAR_MUTED, SIDEBAR_ACTIVE, CARD_SHADOW, CONTROL_RADIUS,
} from "../styles";

// MS Solutions' actual header mark (mssolutions-group.com), redrawn from its
// site SVG so the color follows our theme's accent instead of a fixed hex.
export function BrandMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 41 40" fill="none" role="img" aria-label="MS Solutions">
      <path d="M40.013 5.77826L39.4414 17.72H37.3164V11.948L28.065 2.69652L22.293 2.69652V0.571612L34.2347 0L40.013 5.77826Z" fill={ACCENT} />
      <path d="M5.77826 0L17.72 0.571613V2.69652H11.948L2.69652 11.948V17.72H0.571613L0 5.77826L5.77826 0Z" fill={ACCENT} />
      <path d="M0 34.2347L0.571612 22.293H2.69652L2.69652 28.065L11.948 37.3165H17.72L17.72 39.4414L5.77826 40.013L0 34.2347Z" fill={ACCENT} />
      <path d="M34.2347 40.013L22.293 39.4414V37.3165H28.065L37.3165 28.065V22.293H39.4414L40.013 34.2347L34.2347 40.013Z" fill={ACCENT} />
      <path d="M21.2399 13.7188C22.6767 15.6345 24.3786 17.3362 26.2943 18.7729V21.2401C24.3786 22.6769 22.6767 24.3786 21.2399 26.2943H18.7729C17.3362 24.3786 15.6344 22.6769 13.7188 21.2401V18.7729C15.6344 17.3362 17.3362 15.6344 18.7729 13.7188H21.2399Z" fill={ACCENT} />
    </svg>
  );
}

// Sidebar chrome is always dark regardless of the (light) content palette, so
// these two use the dedicated SIDEBAR_* tokens rather than TEXT/MUTED.
export function BrandHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 4px" }}>
      <BrandMark />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT_DISPLAY, color: SIDEBAR_TEXT, letterSpacing: "0.01em" }}>MS Solutions</div>
        <div style={{ fontSize: 10, color: SIDEBAR_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pilotage ressources</div>
      </div>
    </div>
  );
}

export function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
      background: active ? SIDEBAR_ACTIVE : "transparent", border: "none", borderRadius: CONTROL_RADIUS,
      color: active ? ACCENT : SIDEBAR_MUTED, fontSize: 13.5, fontWeight: active ? 600 : 500,
      cursor: "pointer", marginBottom: 2, textAlign: "left",
    }}>
      {icon} {label}
    </button>
  );
}

// Icon-badge + big number + label, per the reference's KPI cards (icon in a
// tinted rounded-square badge, value bold, label muted below).
export function Kpi({ label, value, accent, icon }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, flex: 1, minWidth: 140, boxShadow: CARD_SHADOW }}>
      {icon && (
        <div style={{
          width: 36, height: 36, borderRadius: CONTROL_RADIUS, background: ACCENT_TINT,
          color: accent || ACCENT, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
        }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || TEXT, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function Badge({ color, text }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color,
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
    }}>
      {text}
    </span>
  );
}

export function SectionTitle({ children, style }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 10, ...style }}>{children}</div>;
}

export function Field({ label, value, onChange, onBlur, width, disabled }) {
  return (
    <div style={{ width }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} disabled={disabled}
        style={{ ...inputStyle, width: "100%", opacity: disabled ? 0.7 : 1 }} />
    </div>
  );
}

export function Th({ children }) {
  return <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 12.5, color: MUTED, fontWeight: 600 }}>{children}</th>;
}
export function Td({ children, style, ...rest }) {
  return <td style={{ padding: "6px 12px", verticalAlign: "middle", ...style }} {...rest}>{children}</td>;
}
