import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { api } from "../api";
import { round1, effective } from "../lib/util";
import { MUTED, ACCENT, GREEN, AMBER, RED, SURFACE, SURFACE2, BORDER, CARD_SHADOW, inputStyle, btnGhost, btnPrimary } from "../styles";
import { Th, Td, Field, SectionTitle } from "../components/ui";
import LinesTable from "../components/LinesTable";

export default function ProjectDetail({ projectId, canViewAll, canManageProjects, canManageAllocations, canProposeAllocations, user, svoUsers, pool, periods, overAllocProjects, onBack, onProjectsChanged }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get(`/projects/${projectId}`)
      .then((p) => { setProject(p); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [projectId]);

  const notifyChanged = () => onProjectsChanged();

  // ---- synthesis: demandé vs alloué, computed locally from the lines already loaded ----
  // (kept above any early return so hook order stays stable while `project` is still loading)
  const relevantPeriods = useMemo(() => {
    if (!project) return [];
    const set = new Set();
    project.demandLines.forEach((l) => l.period && set.add(l.period));
    project.allocationLines.forEach((l) => l.period && set.add(l.period));
    return periods.map((p) => p.id).filter((id) => set.has(id));
  }, [project, periods]);

  // Periods where the SVO's requested headcount (per profile) isn't fully covered yet
  // by allocation lines of the matching squad — surfaced as one-click suggestions
  // above the affectation table instead of making the HSV hunt for them in a picker.
  const pendingAllocPeriods = useMemo(() => {
    if (!project) return [];
    const missingByPeriod = new Map();
    for (const dl of project.demandLines) {
      if (effective(dl.count, dl.pct) <= 0) continue;
      const needed = Math.max(1, Math.round(Number(dl.count) || 0));
      const existing = project.allocationLines.filter((al) => {
        if (al.period !== dl.period) return false;
        return pool.find((r) => r.id === al.poolMemberId)?.squad === dl.profile;
      }).length;
      if (existing < needed) {
        if (!missingByPeriod.has(dl.period)) missingByPeriod.set(dl.period, []);
        missingByPeriod.get(dl.period).push(`${dl.profile} ${existing}/${needed}`);
      }
    }
    return periods.filter((p) => missingByPeriod.has(p.id)).map((p) => ({ ...p, missing: missingByPeriod.get(p.id) }));
  }, [project, periods, pool]);

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
  const canEditNameStatus = canManageProjects || isOwner;
  const poolById = Object.fromEntries(pool.map((p) => [p.id, p]));

  const patchProject = async (field, value) => {
    const updated = await api.patch(`/projects/${project.id}`, { [field]: value });
    setProject((prev) => ({ ...prev, ...updated }));
    notifyChanged();
  };

  // ---- demand lines ----
  // Adding a period creates all 3 profiles (Mobile/TPE/Digital) at once — a demand
  // period without all three is normally just because one was deleted, so a repeat
  // call only fills in whichever profiles are still missing for that period.
  const addDemandLine = async (period) => {
    const targetPeriod = period || periods[0]?.id || "";
    const existing = new Set(project.demandLines.filter((l) => l.period === targetPeriod).map((l) => l.profile));
    const allProfiles = ["Mobile", "TPE", "Digital"];
    const missing = allProfiles.filter((p) => !existing.has(p));
    const toCreate = existing.size === 0 ? allProfiles : missing;
    if (toCreate.length === 0) return;
    const created = await Promise.all(toCreate.map((profile) =>
      api.post(`/projects/${project.id}/demand-lines`, { period: targetPeriod, profile, count: 0, pct: null })
    ));
    setProject((prev) => ({ ...prev, demandLines: [...prev.demandLines, ...created] }));
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
  // Pre-fills one line PER HEADCOUNT the SVO actually asked for that week — a demand
  // of "Mobile: 5" seeds 5 Mobile-squad lines, not one. Tops up whatever's still
  // missing per profile (so it's safe to call again on a partially-filled period),
  // spreading across distinct squad members where possible. Falls back to a single
  // blank line once every demanded headcount is already covered, or when there's no
  // demand to go on at all.
  const addAllocationLine = async (period) => {
    const targetPeriod = period || periods[0]?.id || "";
    const seeds = [];
    for (const profile of ["Mobile", "TPE", "Digital"]) {
      const dl = project.demandLines.find((l) => l.period === targetPeriod && l.profile === profile);
      if (!dl || effective(dl.count, dl.pct) <= 0) continue;
      const needed = Math.max(1, Math.round(Number(dl.count) || 0));
      const squadMembers = pool.filter((r) => r.squad === profile);
      if (squadMembers.length === 0) continue;
      const existing = project.allocationLines.filter((al) =>
        al.period === targetPeriod && squadMembers.some((m) => m.id === al.poolMemberId)
      ).length;
      const missing = needed - existing;
      const pctValue = dl.pct === null || dl.pct === undefined || dl.pct === "" ? 1 : Number(dl.pct);
      for (let i = 0; i < missing; i++) {
        seeds.push({ poolMemberId: squadMembers[(existing + i) % squadMembers.length].id, pct: pctValue });
      }
    }

    if (seeds.length > 0) {
      const created = await Promise.all(seeds.map((s) =>
        api.post(`/projects/${project.id}/allocation-lines`, { period: targetPeriod, poolMemberId: s.poolMemberId, pct: s.pct })
      ));
      setProject((prev) => ({ ...prev, allocationLines: [...prev.allocationLines, ...created] }));
      notifyChanged();
      return;
    }

    if (pool.length === 0) return;
    const line = await api.post(`/projects/${project.id}/allocation-lines`, {
      period: targetPeriod, poolMemberId: pool[0].id, pct: 1,
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

  const synthesis = relevantPeriods.map((period) => {
    const row = { period, Mobile: { dem: 0, alloc: 0 }, TPE: { dem: 0, alloc: 0 }, Digital: { dem: 0, alloc: 0 } };
    project.demandLines.filter((l) => l.period === period).forEach((l) => {
      row[l.profile].dem += effective(l.count, l.pct);
    });
    project.allocationLines.filter((l) => l.period === period && l.status === "approved").forEach((l) => {
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
          { key: "period", label: "Période", type: "select", options: periodOptions, optionLabels: periodLabels, width: 100 },
          { key: "profile", label: "Profil", type: "select", options: ["Mobile", "TPE", "Digital"], width: 90 },
          { key: "count", label: "Nombre de personnes", type: "number", width: 90 },
          { key: "pct", label: "Allocation % (vide = 100%)", type: "percent", width: 110 },
        ]}
        addLabel="Ajouter une période"
        onAdd={addDemandLine}
        onPatch={patchDemandLine}
        onRemove={removeDemandLine}
        groupBy="period"
        maxPerGroup={3}
      />

      <SectionTitle style={{ marginTop: 28 }}>
        Affectation des ressources {!canEditAlloc && <span style={{ fontWeight: 400, textTransform: "none", color: MUTED }}>(lecture seule)</span>}
      </SectionTitle>
      {canEditAlloc && pendingAllocPeriods.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
          padding: "10px 12px", marginBottom: 10, borderRadius: 10,
          background: `color-mix(in srgb, ${AMBER} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${AMBER} 40%, transparent)`,
        }}>
          <span style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>Semaines demandées par le SVO, pas encore affectées :</span>
          {pendingAllocPeriods.map((p) => (
            <button key={p.id} onClick={() => addAllocationLine(p.id)} style={{
              background: `color-mix(in srgb, ${AMBER} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${AMBER} 55%, transparent)`, borderRadius: 20,
              color: AMBER, fontSize: 11.5, fontWeight: 600, padding: "4px 10px", cursor: "pointer",
            }}>
              {p.label} <span style={{ fontWeight: 400, opacity: 0.8 }}>({p.missing.join(", ")})</span>
            </button>
          ))}
        </div>
      )}
      <LinesTable
        lines={project.allocationLines}
        editable={canEditAlloc}
        rowEditable={isLineOwnedByMe}
        columns={[
          { key: "period", label: "Période", type: "select", options: periodOptions, optionLabels: periodLabels, width: 100 },
          {
            key: "poolMemberId", label: "Ressource", type: "select", options: pool.map((r) => r.id), optionLabels: pool.map((r) => `${r.name} (${r.squad})`), width: 220,
            // Recap of the resource's OTHER assignments for that same période, so the
            // picker doesn't need to be cross-checked against every other project.
            hint: (line) => {
              if (!line.poolMemberId || !line.period) return null;
              const entries = (overAllocProjects?.[`${line.poolMemberId}:${line.period}`] || []).filter((e) => e.projectId !== project.id);
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
          ...(canManageAllocations || canProposeAllocations
            ? [{ key: "status", label: "Statut", type: "status", onApprove: canManageAllocations ? approveAllocationLine : undefined }]
            : []),
        ]}
        addLabel={canManageAllocations ? "Ajouter une période" : "Proposer une affectation"}
        onAdd={addAllocationLine}
        onPatch={patchAllocationLine}
        onRemove={removeAllocationLine}
        groupBy="period"
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
