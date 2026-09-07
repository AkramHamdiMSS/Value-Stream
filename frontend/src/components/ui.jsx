import { MUTED, SURFACE, BORDER, TEXT, SURFACE2, inputStyle } from "../styles";

export function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
      background: active ? SURFACE2 : "transparent", border: "none", borderRadius: 8,
      color: active ? TEXT : MUTED, fontSize: 13.5, fontWeight: active ? 600 : 500,
      cursor: "pointer", marginBottom: 2, textAlign: "left",
    }}>
      {icon} {label}
    </button>
  );
}

export function Kpi({ label, value, accent }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || TEXT }}>{value}</div>
    </div>
  );
}

export function Badge({ color, text }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color, background: `${color}22`, border: `1px solid ${color}55` }}>
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
  return <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>{children}</th>;
}
export function Td({ children }) {
  return <td style={{ padding: "6px 12px", verticalAlign: "middle" }}>{children}</td>;
}
