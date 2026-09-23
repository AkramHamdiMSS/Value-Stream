import { Fragment, useEffect, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { SURFACE, SURFACE2, BORDER, TEXT, MUTED, ACCENT, inputStyle, btnGhost } from "../styles";
import { Th, Td } from "./ui";
import { PROFILE_FIELDS } from "../lib/profiles";

const SQUADS = PROFILE_FIELDS.map((p) => ({ key: p.countKey, pctKey: p.pctKey, label: p.profile }));

// One demand line = one Début/Fin spanning four profile rows (Mobile/TPE
// Android/TPE Engage/Digital), each with its own headcount AND its own
// allocation % — Début and Fin are shown once per line (rowSpan) since the
// range applies to all four, but the % doesn't have to match across them.
//
// Keystrokes only update local state — nothing reaches the server until the
// line's own "Enregistrer" button is clicked, which sends every changed
// field on that line in one request, instead of auto-saving on blur.
export default function DemandTable({ lines, periods, editable, onAdd, onSave, onRemove }) {
  const [local, setLocal] = useState(lines);
  useEffect(() => setLocal(lines), [lines]);

  const setLocalValue = (id, key, value) => {
    setLocal((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  };
  const periodLabel = (id) => periods.find((p) => p.id === id)?.label || id || "—";

  const FIELD_KEYS = ["periodStart", "periodEnd", ...SQUADS.map((sq) => sq.key), ...SQUADS.map((sq) => sq.pctKey), "comment"];
  const normalize = (key, v) => {
    if (SQUADS.some((sq) => sq.key === key)) return v === "" || v === undefined || v === null ? 0 : Number(v);
    if (SQUADS.some((sq) => sq.pctKey === key)) return v === "" || v === undefined || v === null ? null : Number(v);
    return v === undefined || v === "" ? null : v;
  };
  const isDirty = (line) => {
    const orig = lines.find((l) => l.id === line.id);
    if (!orig) return false;
    return FIELD_KEYS.some((k) => normalize(k, line[k]) !== normalize(k, orig[k]));
  };
  const saveLine = (line) => {
    const orig = lines.find((l) => l.id === line.id);
    const patch = {};
    for (const k of FIELD_KEYS) {
      const a = normalize(k, line[k]);
      if (a !== normalize(k, orig?.[k])) patch[k] = a;
    }
    if (Object.keys(patch).length > 0) onSave(line.id, patch);
  };

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
          {local.map((line) => {
            const dirty = editable && isDirty(line);
            return (
            <Fragment key={line.id}>
              {SQUADS.map((sq, i) => (
                <tr key={sq.key} style={{ borderTop: i === 0 ? `1px solid ${BORDER}` : "none" }}>
                  {i === 0 && (
                    <>
                      <Td rowSpan={SQUADS.length} style={{ verticalAlign: "top" }}>
                        {editable ? (
                          <select value={line.periodStart ?? ""} onChange={(e) => setLocalValue(line.id, "periodStart", e.target.value)} style={inputStyle}>
                            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                        ) : <span style={{ color: TEXT }}>{periodLabel(line.periodStart)}</span>}
                      </Td>
                      <Td rowSpan={SQUADS.length} style={{ verticalAlign: "top" }}>
                        {editable ? (
                          <select value={line.periodEnd ?? ""} onChange={(e) => setLocalValue(line.id, "periodEnd", e.target.value)} style={inputStyle}>
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
                        style={{ ...inputStyle, width: 80 }} />
                    ) : <span style={{ color: MUTED }}>{line[sq.key] ?? 0}</span>}
                  </Td>
                  <Td>
                    {editable ? (
                      <input type="number" min="0" max="200" placeholder="100"
                        value={line[sq.pctKey] === "" || line[sq.pctKey] === undefined || line[sq.pctKey] === null ? "" : Math.round(Number(line[sq.pctKey]) * 100)}
                        onChange={(e) => setLocalValue(line.id, sq.pctKey, e.target.value === "" ? "" : Number(e.target.value) / 100)}
                        style={{ ...inputStyle, width: 90 }} />
                    ) : <span style={{ color: MUTED }}>{line[sq.pctKey] === null || line[sq.pctKey] === undefined ? "100%" : `${Math.round(Number(line[sq.pctKey]) * 100)}%`}</span>}
                  </Td>
                  {i === 0 && (
                    <Td rowSpan={SQUADS.length} style={{ verticalAlign: "top" }}>
                      {editable ? (
                        <input value={line.comment ?? ""} placeholder="Contexte, urgence…"
                          onChange={(e) => setLocalValue(line.id, "comment", e.target.value)}
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
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => saveLine(line)} disabled={!dirty} style={{
                          ...btnGhost, fontSize: 11.5, padding: "4px 9px",
                          ...(dirty ? { color: ACCENT, borderColor: ACCENT, cursor: "pointer" } : { opacity: 0.4, cursor: "default" }),
                        }}>
                          <Check size={12} /> Valider
                        </button>
                        <button onClick={() => onRemove(line.id)} style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4, display: "flex" }} aria-label="Supprimer la ligne">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </Fragment>
            );
          })}
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
