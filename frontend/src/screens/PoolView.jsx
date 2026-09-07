import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { SURFACE, SURFACE2, BORDER, MUTED, inputStyle, btnPrimary, iconBtn } from "../styles";
import { Th, Td } from "../components/ui";

export default function PoolView({ pool, overAllocGrid, periods, onChanged }) {
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});

  const addPerson = async () => {
    try {
      await api.post("/pool", { name: "Nouvelle personne", squad: "Mobile", sousEquipe: "Mobile", roleTitle: "Développeur" });
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const removePerson = async (id) => {
    try {
      await api.delete(`/pool/${id}`);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const patchPerson = async (id, key, value) => {
    try {
      await api.patch(`/pool/${id}`, { [key]: value });
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const draftValue = (p, key) => drafts[p.id]?.[key] ?? p[key];
  const setDraft = (id, key, value) => setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));

  const peakFor = (id) => {
    let max = 0;
    for (const p of periods) max = Math.max(max, overAllocGrid?.[id]?.[p] || 0);
    return max;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pool de ressources</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 0" }}>
            Ajouter une personne ici la rend aussitôt disponible dans les listes déroulantes d'affectation.
          </p>
        </div>
        <button onClick={addPerson} style={btnPrimary}><Plus size={15} /> Ajouter une personne</button>
      </div>

      {error && <div style={{ color: "#fca5a5", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: SURFACE2 }}>
              <Th>Nom</Th><Th>Squad</Th><Th>Sous-équipe</Th><Th>Rôle</Th><Th>Pic de charge</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {pool.map((p) => {
              const peak = peakFor(p.id);
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td><input value={draftValue(p, "name")} onChange={(e) => setDraft(p.id, "name", e.target.value)}
                    onBlur={(e) => patchPerson(p.id, "name", e.target.value)} style={inputStyle} /></Td>
                  <Td>
                    <select value={p.squad} onChange={(e) => patchPerson(p.id, "squad", e.target.value)} style={inputStyle}>
                      <option>Mobile</option><option>TPE</option><option>Digital</option>
                    </select>
                  </Td>
                  <Td><input value={draftValue(p, "sousEquipe")} onChange={(e) => setDraft(p.id, "sousEquipe", e.target.value)}
                    onBlur={(e) => patchPerson(p.id, "sousEquipe", e.target.value)} style={inputStyle} /></Td>
                  <Td><input value={draftValue(p, "roleTitle")} onChange={(e) => setDraft(p.id, "roleTitle", e.target.value)}
                    onBlur={(e) => patchPerson(p.id, "roleTitle", e.target.value)} style={inputStyle} /></Td>
                  <Td>
                    <span style={{ color: peak > 1.001 ? "#fca5a5" : peak > 0 ? "#6ee7b7" : MUTED, fontWeight: 600 }}>
                      {Math.round(peak * 100)}%
                    </span>
                  </Td>
                  <Td>
                    <button onClick={() => removePerson(p.id)} style={iconBtn} aria-label="Retirer"><Trash2 size={14} /></button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
