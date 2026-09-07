import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, TEXT, MUTED, inputStyle, btnGhost } from "../styles";
import { Th, Td } from "./ui";

// Locally-buffered editable table: keystrokes update local state instantly, and
// commit to the server on blur (text/number/percent) or immediately on select change.
export default function LinesTable({ lines, columns, addLabel, editable = true, onAdd, onPatch, onRemove }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };

  const displayLabel = (col, line) => {
    if (col.type !== "select") return line[col.key] === "" || line[col.key] === undefined || line[col.key] === null ? "—" : line[col.key];
    const idx = col.options.indexOf(line[col.key]);
    if (idx === -1) return "—";
    return col.optionLabels ? col.optionLabels[idx] : col.options[idx];
  };

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
          {local.map((line) => (
            <tr key={line.id} style={{ borderTop: `1px solid ${BORDER}` }}>
              {columns.map((c) => (
                <Td key={c.key}>
                  {!editable ? (
                    <span style={{ color: c.type === "select" ? TEXT : MUTED }}>
                      {c.type === "percent"
                        ? (line[c.key] === "" || line[c.key] === undefined || line[c.key] === null ? "100%" : `${Math.round(Number(line[c.key]) * 100)}%`)
                        : displayLabel(c, line)}
                    </span>
                  ) : c.type === "select" ? (
                    <select value={line[c.key] ?? ""} onChange={(e) => {
                      setLocalValue(line.id, c.key, e.target.value);
                      onPatch(line.id, c.key, e.target.value);
                    }} style={{ ...inputStyle, width: c.width }}>
                      <option value="">—</option>
                      {c.options.map((opt, i) => (
                        <option key={opt} value={opt}>{c.optionLabels ? c.optionLabels[i] : opt}</option>
                      ))}
                    </select>
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
                  )}
                </Td>
              ))}
              {editable && (
                <Td>
                  <button onClick={() => onRemove(line.id)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex" }} aria-label="Supprimer la ligne">
                    <Trash2 size={14} />
                  </button>
                </Td>
              )}
            </tr>
          ))}
          {local.length === 0 && (
            <tr><td colSpan={columns.length + 1} style={{ padding: 16, textAlign: "center", color: MUTED, fontSize: 12.5 }}>Aucune ligne pour l'instant.</td></tr>
          )}
        </tbody>
      </table>
      {editable && (
        <button onClick={onAdd} style={{ ...btnGhost, margin: 10, fontSize: 12.5 }}>
          <Plus size={14} /> {addLabel}
        </button>
      )}
    </div>
  );
}
