import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Check } from "lucide-react";
import { api } from "../api";
import { round1, effective } from "../lib/util";
import { MUTED, ACCENT, GREEN, AMBER, RED, SURFACE, SURFACE2, BORDER, CARD_SHADOW, inputStyle, btnGhost, btnPrimary } from "../styles";
import { Th, Td, Field, SectionTitle, Badge } from "../components/ui";
import LinesTable from "../components/LinesTable";

export default function ProjectDetail({ projectId, canViewAll, canManageProjects, canManageAllocations, canProposeAllocations, user, svoUsers, pool, teamPool, periods, overAllocProjects, onBack, onProjectsChanged }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [releaseDrafts, setReleaseDrafts] = useState({});
  const [releasingId, setReleasingId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/projects/${projectId}`)
      .then((p) => { setProject(p); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [projectId]);

  const notifyChanged = () => onProjectsChanged();

  // Every period id in [startId, endId] inclusive, using the project's own
  // period order — so "S2 -> S5" resolves to however many weeks that spans,
  // instead of forcing one add per week.
  const periodsBetween = (startId, endId) => {
    const ids = periods.map((p) => p.id);
    const i0 = ids.indexOf(startId), i1 = ids.indexOf(endId);
    if (i0 === -1 || i1 === -1) return [startId];
    const [lo, hi] = i0 <= i1 ? [i0, i1] : [i1, i0];
    return ids.slice(lo, hi + 1);
  };

  // ---- synthesis: demandé vs alloué, computed locally from the lines already loaded ----
  // (kept above any early return so hook order stays stable while `project` is still loading)
  const relevantPeriods = useMemo(() => {
    if (!project) return [];
    const set = new Set();
    [...project.demandLines, ...project.allocationLines].forEach((l) => {
      periodsBetween(l.periodStart, l.periodEnd).forEach((p) => set.add(p));
    });
    return periods.map((p) => p.id).filter((id) => set.has(id));
  }, [project, periods]);

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, padding: 40 }}><Loader2 className="animate-spin" size={18} /> Chargement…</div>;
  }
  if (error || !project) {
    return <div style={{ color: RED, padding: 24 }}>{error || "Projet introuvable."}</div>;
  }

  const isOwner = user.id === project.svoUserId;
  const canEditDemand = isOwner && !project.demandSubmitted;
  const canEditAlloc = canManageAllocations || canProposeAllocations;
  const isLineOwnedByMe = (line) => canManageAllocations || (canProposeAllocations && line.status === "pending" && line.createdById === user.id);
  // A propose-only viewer can only pick from their own team, not the whole
  // org pool — falls back to the full pool if the team-scoped list isn't
  // available yet (e.g. still loading).
  const resourceOptions = canManageAllocations || !teamPool?.length ? pool : teamPool;
  const canEditNameStatus = canManageProjects || isOwner;
  const poolById = Object.fromEntries(pool.map((p) => [p.id, p]));

  const patchProject = async (field, value) => {
    const updated = await api.patch(`/projects/${project.id}`, { [field]: value });
    setProject((prev) => ({ ...prev, ...updated }));
    notifyChanged();
  };

  // ---- demand lines ----
  // One row = one span of weeks — the SVO sets the range, profile and
  // headcount directly on the row instead of it being generated per week.
  const addDemandLine = async () => {
    const p = periods[0]?.id || "";
    const line = await api.post(`/projects/${project.id}/demand-lines`, {
      periodStart: p, periodEnd: p, profile: "Mobile", count: 0, pct: null,
    });
    setProject((prev) => ({ ...prev, demandLines: [...prev.demandLines, line] }));
    notifyChanged();
  };
  const patchDemandLine = async (id, key, value) => {
    const payload = { [key]: key === "count" ? Number(value) || 0 : value };
    const updated = await api.patch(`/demand-lines/${id}`, payload);
    setProject((prev) => ({ ...prev, demandLines: prev.demandLines.map((l) => (l.id === id ? updated : l)) }));
    notifyChanged();
  };
  const removeDemandLine = async (id) => {
    await api.delete(`/demand-lines/${id}`);
    setProject((prev) => ({ ...prev, demandLines: prev.demandLines.filter((l) => l.id !== id) }));
    notifyChanged();
  };

  // ---- allocation lines ----
  // One row = one resource for one span of weeks. The resource picker
  // (`resourceOptions`) is already scoped to the actor's own team for a
  // propose-only holder and to the whole pool for a manager, so a fresh row
  // just needs some starting resource — the row is immediately editable.
  const addAllocationLine = async () => {
    if (resourceOptions.length === 0) return;
    const p = periods[0]?.id || "";
    const line = await api.post(`/projects/${project.id}/allocation-lines`, {
      periodStart: p, periodEnd: p, poolMemberId: resourceOptions[0].id, pct: 1,
    });
    setProject((prev) => ({ ...prev, allocationLines: [...prev.allocationLines, line] }));
    notifyChanged();
  };
  const patchAllocationLine = async (id, key, value) => {
    const updated = await api.patch(`/allocation-lines/${id}`, { [key]: value });
    setProject((prev) => ({ ...prev, allocationLines: prev.allocationLines.map((l) => (l.id === id ? updated : l)) }));
    notifyChanged();
  };
  const removeAllocationLine = async (id) => {
    await api.delete(`/allocation-lines/${id}`);
    setProject((prev) => ({ ...prev, allocationLines: prev.allocationLines.filter((l) => l.id !== id) }));
    notifyChanged();
  };
  const approveAllocationLine = async (line) => {
    const updated = await api.post(`/allocation-lines/${line.id}/approve`);
    setProject((prev) => ({ ...prev, allocationLines: prev.allocationLines.map((l) => (l.id === line.id ? { ...l, ...updated } : l)) }));
    notifyChanged();
  };

  // ---- SVO-initiated release: flag an already-approved line for the HSV to
  // free up, instead of the SVO removing it outright — the line stays real
  // (and counted) until confirmed. ----
  const requestRelease = async (id) => {
    const draft = releaseDrafts[id] || {};
    const note = (draft.note || "").trim();
    if (!note) return;
    const body = { note };
    if (draft.partial) body.newPct = draft.newPct / 100;
    const updated = await api.post(`/allocation-lines/${id}/request-release`, body);
    setProject((prev) => ({ ...prev, allocationLines: prev.allocationLines.map((l) => (l.id === id ? { ...l, ...updated } : l)) }));
    setReleasingId(null);
    setReleaseDrafts((d) => ({ ...d, [id]: undefined }));
    notifyChanged();
  };
  const cancelRelease = async (id) => {
    const updated = await api.post(`/allocation-lines/${id}/cancel-release`);
    setProject((prev) => ({ ...prev, allocationLines: prev.allocationLines.map((l) => (l.id === id ? { ...l, ...updated } : l)) }));
    notifyChanged();
  };
  const confirmRelease = async (id) => {
    const result = await api.post(`/allocation-lines/${id}/confirm-release`);
    if (result.deleted) {
      setProject((prev) => ({ ...prev, allocationLines: prev.allocationLines.filter((l) => l.id !== id) }));
    } else {
      setProject((prev) => ({ ...prev, allocationLines: prev.allocationLines.map((l) => (l.id === id ? { ...l, ...result } : l)) }));
    }
    notifyChanged();
  };

  const synthesis = relevantPeriods.map((period) => {
    const row = { period, Mobile: { dem: 0, alloc: 0 }, TPE: { dem: 0, alloc: 0 }, Digital: { dem: 0, alloc: 0 } };
    project.demandLines.filter((l) => l.periodStart <= period && period <= l.periodEnd).forEach((l) => {
      row[l.profile].dem += effective(l.count, l.pct);
    });
    project.allocationLines.filter((l) => l.status === "approved" && l.periodStart <= period && period <= l.periodEnd).forEach((l) => {
      const res = poolById[l.poolMemberId];
      if (res) row[res.squad].alloc += Number(l.pct) || 0;
    });
    return row;
  });

  const resteTotal = { Mobile: 0, TPE: 0, Digital: 0 };
  synthesis.forEach((row) => {
    ["Mobile", "TPE", "Digital"].forEach((sq) => {
      resteTotal[sq] += Math.max(0, row[sq].dem - row[sq].alloc);
    });
  });
  const totalReste = resteTotal.Mobile + resteTotal.TPE + resteTotal.Digital;

  const periodOptions = periods.map((p) => p.id);
  const periodLabels = periods.map((p) => p.label);

  return (
    <div>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: 12 }}>
        <ChevronLeft size={15} /> {canViewAll ? "Tous les projets" : "Mes projets"}
      </button>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Field label="Nom du projet" value={project.name} onChange={(v) => setProject((p) => ({ ...p, name: v }))}
          onBlur={() => patchProject("name", project.name)} width={260} disabled={!canEditNameStatus} />
        <div style={{ width: 200 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>SVO</div>
          <select value={project.svoUserId} onChange={(e) => patchProject("svoUserId", e.target.value)} disabled={!canManageProjects}
            style={{ ...inputStyle, width: "100%", opacity: canManageProjects ? 1 : 0.7 }}>
            {!svoUsers.some((s) => s.id === project.svoUserId) && (
              <option value={project.svoUserId}>{project.svo?.name} (retiré des rôles)</option>
            )}
            {svoUsers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <Field label="Statut" value={project.status} onChange={(v) => setProject((p) => ({ ...p, status: v }))}
          onBlur={() => patchProject("status", project.status)} width={200} disabled={!canEditNameStatus} />
      </div>

      {isOwner && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: project.demandSubmitted ? `color-mix(in srgb, ${GREEN} 12%, transparent)` : `color-mix(in srgb, ${ACCENT} 12%, transparent)`,
          border: `1px solid ${project.demandSubmitted ? GREEN : ACCENT}`,
        }}>
          <span style={{ fontWeight: 600, color: project.demandSubmitted ? GREEN : ACCENT }}>
            {project.demandSubmitted ? "Demande soumise au Head of Value Stream ✓" : "Demande en brouillon — pas encore visible du HSV"}
          </span>
          <button onClick={() => patchProject("demandSubmitted", !project.demandSubmitted)} style={project.demandSubmitted ? btnGhost : btnPrimary}>
            {project.demandSubmitted ? "Rouvrir pour modifier" : "Soumettre la demande"}
          </button>
        </div>
      )}
      {!isOwner && !project.demandSubmitted && (
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, color: MUTED, border: `1px dashed color-mix(in srgb, ${MUTED} 40%, transparent)` }}>
          Le SVO ({project.svo?.name}) n'a pas encore soumis sa demande pour ce projet.
        </div>
      )}

      <div style={{
        padding: "10px 14px", borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 600,
        background: totalReste > 0.001 ? `color-mix(in srgb, ${AMBER} 15%, transparent)` : `color-mix(in srgb, ${GREEN} 15%, transparent)`,
        color: totalReste > 0.001 ? AMBER : GREEN,
        border: `1px solid ${totalReste > 0.001 ? AMBER : GREEN}`,
      }}>
        {totalReste > 0.001
          ? `Reste à affecter : Mobile ${round1(resteTotal.Mobile)} · TPE ${round1(resteTotal.TPE)} · Digital ${round1(resteTotal.Digital)}`
          : "Besoin entièrement couvert ✓"}
      </div>

      <SectionTitle>Besoin exprimé par le SVO {!canEditDemand && <span style={{ fontWeight: 400, textTransform: "none", color: MUTED }}>(lecture seule)</span>}</SectionTitle>
      <LinesTable
        lines={project.demandLines}
        editable={canEditDemand}
        columns={[
          { key: "periodStart", label: "Début", type: "select", options: periodOptions, optionLabels: periodLabels, width: 100 },
          { key: "periodEnd", label: "Fin", type: "select", options: periodOptions, optionLabels: periodLabels, width: 100 },
          { key: "profile", label: "Profil", type: "select", options: ["Mobile", "TPE", "Digital"], width: 90 },
          { key: "count", label: "Nombre de personnes", type: "number", width: 90 },
          { key: "pct", label: "Allocation % (vide = 100%)", type: "percent", width: 110 },
        ]}
        addLabel="Ajouter une ligne"
        onAdd={addDemandLine}
        onPatch={patchDemandLine}
        onRemove={removeDemandLine}
      />

      <SectionTitle style={{ marginTop: 28 }}>
        Affectation des ressources {!canEditAlloc && <span style={{ fontWeight: 400, textTransform: "none", color: MUTED }}>(lecture seule)</span>}
      </SectionTitle>
      <LinesTable
        lines={project.allocationLines}
        editable={canEditAlloc}
        rowEditable={isLineOwnedByMe}
        columns={[
          { key: "periodStart", label: "Début", type: "select", options: periodOptions, optionLabels: periodLabels, width: 100 },
          { key: "periodEnd", label: "Fin", type: "select", options: periodOptions, optionLabels: periodLabels, width: 100 },
          {
            key: "poolMemberId", label: "Ressource", type: "select", options: resourceOptions.map((r) => r.id), optionLabels: resourceOptions.map((r) => `${r.name} (${r.squad})`), width: 220,
            fallbackLabel: (id) => (poolById[id] ? `${poolById[id].name} (${poolById[id].squad})` : null),
            // Recap of the resource's OTHER assignments across the same span of
            // weeks, so the picker doesn't need to be cross-checked against
            // every other project — deduped per project across the range.
            hint: (line) => {
              if (!line.poolMemberId || !line.periodStart || !line.periodEnd) return null;
              const seen = new Map();
              for (const w of periodsBetween(line.periodStart, line.periodEnd)) {
                for (const e of overAllocProjects?.[`${line.poolMemberId}:${w}`] || []) {
                  if (e.projectId !== project.id && !seen.has(e.projectId)) seen.set(e.projectId, e);
                }
              }
              const entries = [...seen.values()];
              if (entries.length === 0) return null;
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {entries.map((e) => (
                    <span key={e.projectId} style={{ fontSize: 10.5, color: MUTED, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "2px 8px" }}>
                      {e.projectName} · {Math.round(e.pct * 100)}%
                    </span>
                  ))}
                </div>
              );
            },
          },
          { key: "pct", label: "Allocation %", type: "percent", width: 100 },
          ...(canManageAllocations || canProposeAllocations ? [{
            key: "status", label: "Statut", width: 130,
            render: (line) => (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {line.status === "pending" ? <Badge color={AMBER} text="En attente" /> : <Badge color={GREEN} text="Confirmée" />}
                {line.status === "pending" && canManageAllocations && (
                  <button onClick={() => approveAllocationLine(line)} title="Valider" style={{ background: "transparent", border: "none", color: GREEN, cursor: "pointer", padding: 2, display: "flex" }}>
                    <Check size={14} />
                  </button>
                )}
              </div>
            ),
          }] : []),
          ...(isOwner || canManageAllocations ? [{
            key: "release", label: "Libération", width: 220,
            render: (line) => {
              // Releasing only makes sense for an already-confirmed line —
              // a pending proposal gets rejected/retracted instead (see Statut).
              if (line.status === "pending") return null;
              if (line.releaseRequested) {
                const partial = line.releaseNewPct !== null && line.releaseNewPct !== undefined;
                return (
                  <div>
                    <Badge color={AMBER} text={partial ? `Libération partielle → ${Math.round(Number(line.releaseNewPct) * 100)}%` : "Libération totale demandée"} />
                    <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>{line.releaseNote}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {canManageAllocations && (
                        <button onClick={() => confirmRelease(line.id)} style={{ ...btnGhost, fontSize: 11, padding: "3px 8px", color: GREEN, borderColor: GREEN }}>
                          Valider
                        </button>
                      )}
                      <button onClick={() => cancelRelease(line.id)} style={{ ...btnGhost, fontSize: 11, padding: "3px 8px" }}>
                        {canManageAllocations ? "Refuser" : "Annuler"}
                      </button>
                    </div>
                  </div>
                );
              }
              if (!isOwner) return null;
              if (releasingId === line.id) {
                const draft = releaseDrafts[line.id] || { note: "", partial: false, newPct: Math.max(0, Math.round(Number(line.pct) * 100) - 50) };
                const currentPct = Math.round(Number(line.pct) * 100);
                const pctInvalid = draft.partial && (draft.newPct <= 0 || draft.newPct >= currentPct);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="radio" checked={!draft.partial} onChange={() => setReleaseDrafts({ ...releaseDrafts, [line.id]: { ...draft, partial: false } })} />
                        Totale
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="radio" checked={draft.partial} onChange={() => setReleaseDrafts({ ...releaseDrafts, [line.id]: { ...draft, partial: true } })} />
                        Partielle
                      </label>
                    </div>
                    {draft.partial && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="number" min="0" max={Math.max(0, currentPct - 1)} value={draft.newPct}
                          onChange={(e) => setReleaseDrafts({ ...releaseDrafts, [line.id]: { ...draft, newPct: Number(e.target.value) } })}
                          style={{ ...inputStyle, width: 60 }} />
                        <span style={{ fontSize: 10.5, color: MUTED }}>% (au lieu de {currentPct}%)</span>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <input value={draft.note} onChange={(e) => setReleaseDrafts({ ...releaseDrafts, [line.id]: { ...draft, note: e.target.value } })}
                        placeholder="Raison / réaffectation prévue" style={{ ...inputStyle, width: 150 }} />
                      <button onClick={() => requestRelease(line.id)} disabled={!draft.note.trim() || pctInvalid}
                        style={{ ...btnPrimary, fontSize: 11, padding: "4px 8px", opacity: !draft.note.trim() || pctInvalid ? 0.5 : 1 }}>
                        OK
                      </button>
                      <button onClick={() => setReleasingId(null)} style={{ ...btnGhost, fontSize: 11, padding: "4px 8px" }}>Annuler</button>
                    </div>
                  </div>
                );
              }
              return (
                <button onClick={() => setReleasingId(line.id)} style={{ ...btnGhost, fontSize: 11.5, padding: "4px 10px" }}>
                  Libérer
                </button>
              );
            },
          }] : []),
        ]}
        addLabel={canManageAllocations ? "Ajouter une affectation" : "Proposer une affectation"}
        onAdd={addAllocationLine}
        onPatch={patchAllocationLine}
        onRemove={removeAllocationLine}
      />

      {relevantPeriods.length > 0 && (
        <>
          <SectionTitle style={{ marginTop: 28 }}>Synthèse : demandé vs alloué</SectionTitle>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 12, boxShadow: CARD_SHADOW }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: SURFACE2 }}>
                  <Th>Période</Th>
                  <Th>Dem. Mobile</Th><Th>All. Mobile</Th><Th>Écart</Th>
                  <Th>Dem. TPE</Th><Th>All. TPE</Th><Th>Écart</Th>
                  <Th>Dem. Digital</Th><Th>All. Digital</Th><Th>Écart</Th>
                </tr>
              </thead>
              <tbody>
                {synthesis.map((row) => (
                  <tr key={row.period} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <Td>{row.period}</Td>
                    {["Mobile", "TPE", "Digital"].map((sq) => {
                      const ecart = round1(row[sq].alloc - row[sq].dem);
                      return (
                        <Fragment key={sq}>
                          <Td>{round1(row[sq].dem)}</Td>
                          <Td>{round1(row[sq].alloc)}</Td>
                          <Td><span style={{ color: ecart < 0 ? RED : GREEN, fontWeight: 600 }}>{ecart}</span></Td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
