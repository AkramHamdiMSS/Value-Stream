import { Fragment, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, TEXT, MUTED, inputStyle, btnGhost } from "../styles";
import { Th, Td } from "./ui";

const SQUADS = [
  { key: "mobileCount", label: "Mobile" },
  { key: "tpeCount", label: "TPE" },
  { key: "digitalCount", label: "Digital" },
];

// One demand line = one Début/Fin/Allocation % spanning three squad rows
// (Mobile/TPE/Digital), each with its own headcount — Début, Fin and
// Allocation % are shown once per line (rowSpan 3) since they apply to all
// three squads, rather than repeating the same range three times.
export default function DemandTable({ lines, periods, editable, onAdd, onPatch, onRemove }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };
  const periodLabel = (id) => periods.find((p) => p.id === id)?.label || id || "—";

  const colCount = 5 + (editable ? 1 : 0);

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: SURFACE2 }}>
            <Th>Début</Th><Th>Fin</Th><Th>Profil</Th><Th>Nombre de personnes</Th><Th>Allocation % (vide = 100%)</Th>
            {editable && <Th></Th>}
          </tr>
        </thead>
        <tbody>
          {local.map((line) => (
            <Fragment key={line.id}>
              {SQUADS.map((sq, i) => (
                <tr key={sq.key} style={{ borderTop: i === 0 ? `1px solid ${BORDER}` : "none" }}>
                  {i === 0 && (
                    <>
                      <Td rowSpan={3} style={{ verticalAlign: "top" }}>
                        {editable ? (
                          <select value={line.periodStart ?? ""} onChange={(e) => { setLocalValue(line.id, "periodStart", e.target.value); onPatch(line.id, "periodStart", e.target.value); }} style={inputStyle}>
                            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                        ) : <span style={{ color: TEXT }}>{periodLabel(line.periodStart)}</span>}
                      </Td>
                      <Td rowSpan={3} style={{ verticalAlign: "top" }}>
                        {editable ? (
                          <select value={line.periodEnd ?? ""} onChange={(e) => { setLocalValue(line.id, "periodEnd", e.target.value); onPatch(line.id, "periodEnd", e.target.value); }} style={inputStyle}>
                            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                        ) : <span style={{ color: TEXT }}>{periodLabel(line.periodEnd)}</span>}
                      </Td>
                    </>
                  )}
                  <Td><span style={{ color: TEXT }}>{sq.label}</span></Td>
                  <Td>
                    {editable ? (
                      <input type="number" min="0" value={line[sq.key] ?? 0}
                        onChange={(e) => setLocalValue(line.id, sq.key, e.target.value === "" ? "" : Number(e.target.value))}
                        onBlur={(e) => onPatch(line.id, sq.key, Number(e.target.value) || 0)}
                        style={{ ...inputStyle, width: 80 }} />
                    ) : <span style={{ color: MUTED }}>{line[sq.key] ?? 0}</span>}
                  </Td>
                  {i === 0 && (
                    <Td rowSpan={3} style={{ verticalAlign: "top" }}>
                      {editable ? (
                        <input type="number" min="0" max="200" placeholder="100"
                          value={line.pct === "" || line.pct === undefined || line.pct === null ? "" : Math.round(Number(line.pct) * 100)}
                          onChange={(e) => setLocalValue(line.id, "pct", e.target.value === "" ? "" : Number(e.target.value) / 100)}
                          onBlur={(e) => onPatch(line.id, "pct", e.target.value === "" ? null : Number(e.target.value) / 100)}
                          style={{ ...inputStyle, width: 90 }} />
                      ) : <span style={{ color: MUTED }}>{line.pct === null || line.pct === undefined ? "100%" : `${Math.round(Number(line.pct) * 100)}%`}</span>}
                    </Td>
                  )}
                  {i === 0 && editable && (
                    <Td rowSpan={3} style={{ verticalAlign: "top" }}>
                      <button onClick={() => onRemove(line.id)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex" }} aria-label="Supprimer la ligne">
                        <Trash2 size={14} />
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
            </Fragment>
          ))}
          {local.length === 0 && (
            <tr><td colSpan={colCount} style={{ padding: 16, textAlign: "center", color: MUTED, fontSize: 12.5 }}>Aucune ligne pour l'instant.</td></tr>
          )}
        </tbody>
      </table>
      {editable && (
        <button onClick={() => onAdd()} style={{ ...btnGhost, margin: 10, fontSize: 12.5 }}>
          <Plus size={14} /> Ajouter une ligne
        </button>
      )}
    </div>
  );
}
