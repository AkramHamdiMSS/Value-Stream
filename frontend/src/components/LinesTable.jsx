import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TEXT, MUTED, SURFACE, SURFACE2, BORDER, inputStyle, btnGhost } from "../styles";
import { Th, Td } from "./ui";

// Locally-buffered editable table: keystrokes update local state instantly, and
// commit to the server on blur (text/number/percent) or immediately on select change.
// `editable` gates whether adding new lines is offered at all; `rowEditable(line)`
// (optional, defaults to `editable`) governs whether a SPECIFIC existing row can be
// edited/deleted — e.g. a Team Lead who can only touch their own pending proposals,
// not lines someone else already approved.
export default function LinesTable({ lines, columns, addLabel, editable = true, rowEditable, onAdd, onPatch, onRemove }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);

  const isLineEditable = (line) => (rowEditable ? rowEditable(line) : editable);

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };

  const displayLabel = (col, line) => {
    if (col.type !== "select") return line[col.key] === "" || line[col.key] === undefined || line[col.key] === null ? "—" : line[col.key];
    const idx = col.options.indexOf(line[col.key]);
    if (idx === -1) {
      // `options` may be a restricted pick-list (e.g. a Team Lead's own
      // team) — fall back to an unrestricted lookup so a read-only row for
      // someone outside that list still shows its real label, not "—".
      return col.fallbackLabel ? (col.fallbackLabel(line[col.key]) ?? "—") : "—";
    }
    return col.optionLabels ? col.optionLabels[idx] : col.options[idx];
  };

  const colCount = columns.length + (editable ? 1 : 0);

  const renderCell = (c, line, lineEditable) => (
    c.render ? (
      c.render(line)
    ) : !lineEditable ? (
      <div>
        <span style={{ color: c.type === "select" ? TEXT : MUTED }}>
          {c.type === "percent"
            ? (line[c.key] === "" || line[c.key] === undefined || line[c.key] === null ? "100%" : `${Math.round(Number(line[c.key]) * 100)}%`)
            : displayLabel(c, line)}
        </span>
        {c.type === "select" && c.hint && c.hint(line)}
      </div>
    ) : c.type === "select" ? (
      <div>
        <select value={line[c.key] ?? ""} onChange={(e) => {
          setLocalValue(line.id, c.key, e.target.value);
          onPatch(line.id, c.key, e.target.value);
        }} style={{ ...inputStyle, width: c.width }}>
          <option value="">—</option>
          {c.options.map((opt, i) => (
            <option key={opt} value={opt}>{c.optionLabels ? c.optionLabels[i] : opt}</option>
          ))}
        </select>
        {c.hint && c.hint(line)}
      </div>
    ) : c.type === "percent" ? (
      <input type="number" min="0" max="200" placeholder="100"
        value={line[c.key] === "" || line[c.key] === undefined || line[c.key] === null ? "" : Math.round(Number(line[c.key]) * 100)}
        onChange={(e) => setLocalValue(line.id, c.key, e.target.value === "" ? "" : Number(e.target.value) / 100)}
        onBlur={(e) => onPatch(line.id, c.key, e.target.value === "" ? null : Number(e.target.value) / 100)}
        style={{ ...inputStyle, width: c.width }} />
    ) : (
      <input type={c.type === "number" ? "number" : "text"} value={line[c.key] ?? ""}
        onChange={(e) => setLocalValue(line.id, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)}
        onBlur={(e) => onPatch(line.id, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)}
        style={{ ...inputStyle, width: c.width }} />
    )
  );

  const renderDeleteCell = (line) => (
    <Td>
      {isLineEditable(line) && (
        <button onClick={() => onRemove(line.id)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex" }} aria-label="Supprimer la ligne">
          <Trash2 size={14} />
        </button>
      )}
    </Td>
  );

  const renderRow = (line) => (
    <tr key={line.id} style={{ borderTop: `1px solid ${BORDER}` }}>
      {columns.map((c) => <Td key={c.key}>{renderCell(c, line, isLineEditable(line))}</Td>)}
      {editable && renderDeleteCell(line)}
    </tr>
  );

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: SURFACE2 }}>
            {columns.map((c) => <Th key={c.key}>{c.label}</Th>)}
            {editable && <Th></Th>}
          </tr>
        </thead>
        <tbody>
          {local.map(renderRow)}
          {local.length === 0 && (
            <tr><td colSpan={colCount} style={{ padding: 16, textAlign: "center", color: MUTED, fontSize: 12.5 }}>Aucune ligne pour l'instant.</td></tr>
          )}
        </tbody>
      </table>
      {editable && (
        <button onClick={() => onAdd()} style={{ ...btnGhost, margin: 10, fontSize: 12.5 }}>
          <Plus size={14} /> {addLabel}
        </button>
      )}
    </div>
  );
}
