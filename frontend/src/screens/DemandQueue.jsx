import { Fragment, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../api";
import { SURFACE, SURFACE2, BORDER, MUTED, ACCENT, GREEN, RED, CARD_SHADOW, inputStyle, btnGhost, btnPrimary } from "../styles";
import { Th, Td } from "../components/ui";

export default function DemandQueue({ pool, overAllocGrid, canManageAllocations, onOpenProject, onAllocated, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [openRow, setOpenRow] = useState(null);
  const [pick, setPick] = useState({ poolMemberId: "", pct: 100 });
  const [hideCovered, setHideCovered] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    api.get("/demand-queue").then(setRows).catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  if (!rows) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, padding: 40 }}><Loader2 className="animate-spin" size={18} /> Chargement…</div>;
  }

  const visibleRows = hideCovered ? rows.filter((r) => r.ecart < -0.001) : rows;
  const candidatesFor = (row) => pool.filter((r) => r.squad === row.profile);

  // One "demande" is submitted per project+période, with one line per profile —
  // group them back into a single row so the queue reflects that, instead of
  // showing what looks like 3 unrelated demands for PALM PAY / 2026-W38.
  const groups = [];
  const groupIndexByKey = {};
  for (const row of visibleRows) {
    const gKey = `${row.projectId}:${row.period}`;
    if (!(gKey in groupIndexByKey)) {
      groupIndexByKey[gKey] = groups.length;
      groups.push({ key: gKey, projectId: row.projectId, projectName: row.projectName, svo: row.svo, period: row.period, rows: [] });
    }
    groups[groupIndexByKey[gKey]].rows.push(row);
  }
  groups.sort((a, b) => Math.min(...a.rows.map((r) => r.ecart)) - Math.min(...b.rows.map((r) => r.ecart)));

  const submitAllocation = async (row) => {
    if (!pick.poolMemberId) return;
    await api.post(`/projects/${row.projectId}/allocation-lines`, {
      period: row.period, poolMemberId: pick.poolMemberId, pct: pick.pct / 100,
    });
    setOpenRow(null);
    load();
    onAllocated();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Demandes à affecter</h1>
      </div>
      <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 16px" }}>
        Toutes les demandes soumises par les SVO, tous projets confondus. Choisissez une ressource selon sa
        disponibilité déjà affichée, sans avoir à ouvrir chaque projet.
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTED, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={hideCovered} onChange={(e) => setHideCovered(e.target.checked)} />
        Masquer les besoins déjà entièrement couverts
      </label>

      {error && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: CARD_SHADOW }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: SURFACE2 }}>
              <Th>Projet</Th><Th>SVO</Th><Th>Période</Th><Th>Profil</Th><Th>Demandé</Th><Th>Alloué</Th><Th>Écart</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                {g.rows.map((row, i) => (
                  <Fragment key={row.key}>
                    <tr style={{ borderTop: i === 0 ? `1px solid ${BORDER}` : "none" }}>
                      {i === 0 && (
                        <>
                          <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>
                            <button onClick={() => onOpenProject(g.projectId)} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13, padding: 0 }}>{g.projectName}</button>
                          </Td>
                          <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>{g.svo}</Td>
                          <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>{g.period}</Td>
                        </>
                      )}
                      <Td>{row.profile}</Td>
                      <Td>{row.demanded}</Td>
                      <Td>{row.allocated}</Td>
                      <Td><span style={{ color: row.ecart < -0.001 ? RED : GREEN, fontWeight: 600 }}>{row.ecart}</span></Td>
                      <Td>
                        {canManageAllocations && (
                          <button onClick={() => { setOpenRow(openRow === row.key ? null : row.key); setPick({ poolMemberId: "", pct: 100 }); }} style={btnGhost}>
                            {openRow === row.key ? "Fermer" : "Affecter"}
                          </button>
                        )}
                      </Td>
                    </tr>
                    {canManageAllocations && openRow === row.key && (
                      <tr style={{ background: SURFACE2 }}>
                        <td colSpan={8} style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <select value={pick.poolMemberId} onChange={(e) => setPick({ ...pick, poolMemberId: e.target.value })} style={{ ...inputStyle, width: 320 }}>
                              <option value="">Choisir une ressource {row.profile}…</option>
                              {candidatesFor(row).map((r) => {
                                const load2 = overAllocGrid[r.id]?.[row.period] || 0;
                                return (
                                  <option key={r.id} value={r.id}>
                                    {r.name} — déjà {Math.round(load2 * 100)}% cette semaine-là{load2 > 1.001 ? " ⚠" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            <input type="number" min="0" max="200" value={pick.pct} onChange={(e) => setPick({ ...pick, pct: Number(e.target.value) })}
                              style={{ ...inputStyle, width: 80 }} />
                            <span style={{ fontSize: 12.5, color: MUTED }}>%</span>
                            <button disabled={!pick.poolMemberId} onClick={() => submitAllocation(row)}
                              style={{ ...btnPrimary, opacity: pick.poolMemberId ? 1 : 0.5, cursor: pick.poolMemberId ? "pointer" : "not-allowed" }}>
                              Ajouter l'affectation
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </Fragment>
            ))}
            {visibleRows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: MUTED }}>
                {hideCovered ? "Aucun besoin en attente — tout est couvert." : "Aucune demande soumise pour l'instant."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
