import { Fragment, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, TEXT, MUTED, inputStyle, btnGhost } from "../styles";
import { Th, Td } from "./ui";
import { PROFILE_FIELDS } from "../lib/profiles";

const SQUADS = PROFILE_FIELDS.map((p) => ({ key: p.countKey, pctKey: p.pctKey, label: p.profile }));

// One demand line = one Début/Fin spanning four profile rows (Mobile/TPE
// Android/TPE Engage/Digital), each with its own headcount AND its own
// allocation % — Début and Fin are shown once per line (rowSpan) since the
// range applies to all four, but the % doesn't have to match across them.
export default function DemandTable({ lines, periods, editable, onAdd, onPatch, onRemove }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };
  const periodLabel = (id) => periods.find((p) => p.id === id)?.label || id || "—";

  const colCount = 6 + (editable ? 1 : 0);

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: SURFACE2 }}>
            <Th>Début</Th><Th>Fin</Th><Th>Profil</Th><Th>Nombre de personnes</Th><Th>Allocation % (vide = 100%)</Th><Th>Commentaire</Th>
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
                      <Td rowSpan={SQUADS.length} style={{ verticalAlign: "top" }}>
                        {editable ? (
                          <select value={line.periodStart ?? ""} onChange={(e) => { setLocalValue(line.id, "periodStart", e.target.value); onPatch(line.id, "periodStart", e.target.value); }} style={inputStyle}>
                            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                        ) : <span style={{ color: TEXT }}>{periodLabel(line.periodStart)}</span>}
                      </Td>
                      <Td rowSpan={SQUADS.length} style={{ verticalAlign: "top" }}>
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
                  <Td>
                    {editable ? (
                      <input type="number" min="0" max="200" placeholder="100"
                        value={line[sq.pctKey] === "" || line[sq.pctKey] === undefined || line[sq.pctKey] === null ? "" : Math.round(Number(line[sq.pctKey]) * 100)}
                        onChange={(e) => setLocalValue(line.id, sq.pctKey, e.target.value === "" ? "" : Number(e.target.value) / 100)}
                        onBlur={(e) => onPatch(line.id, sq.pctKey, e.target.value === "" ? null : Number(e.target.value) / 100)}
                        style={{ ...inputStyle, width: 90 }} />
                    ) : <span style={{ color: MUTED }}>{line[sq.pctKey] === null || line[sq.pctKey] === undefined ? "100%" : `${Math.round(Number(line[sq.pctKey]) * 100)}%`}</span>}
                  </Td>
                  {i === 0 && (
                    <Td rowSpan={SQUADS.length} style={{ verticalAlign: "top" }}>
                      {editable ? (
                        <input value={line.comment ?? ""} placeholder="Contexte, urgence…"
                          onChange={(e) => setLocalValue(line.id, "comment", e.target.value)}
                          onBlur={(e) => onPatch(line.id, "comment", e.target.value || null)}
                          style={{ ...inputStyle, width: 200 }} />
                      ) : (
                        <span style={{ color: line.comment ? TEXT : MUTED, fontStyle: line.comment ? "normal" : "italic" }}>
                          {line.comment || "Aucun commentaire."}
                        </span>
                      )}
                    </Td>
                  )}
                  {i === 0 && editable && (
                    <Td rowSpan={SQUADS.length} style={{ verticalAlign: "top" }}>
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
