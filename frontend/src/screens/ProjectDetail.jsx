import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { api } from "../api";
import { round1, effective } from "../lib/util";
import { MUTED, ACCENT, GREEN, AMBER, inputStyle, btnGhost, btnPrimary } from "../styles";
import { Th, Td, Field, SectionTitle } from "../components/ui";
import LinesTable from "../components/LinesTable";

export default function ProjectDetail({ projectId, isHSV, user, svoUsers, pool, periods, onBack, onProjectsChanged }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllDemandPeriods, setShowAllDemandPeriods] = useState(false);
  const [showAllAllocPeriods, setShowAllAllocPeriods] = useState(false);

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

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, padding: 40 }}><Loader2 className="animate-spin" size={18} /> Chargement…</div>;
  }
  if (error || !project) {
    return <div style={{ color: "#fca5a5", padding: 24 }}>{error || "Projet introuvable."}</div>;
  }

  const isMySvo = !isHSV && user.id === project.svoUserId;
  const canEditDemand = isMySvo && !project.demandSubmitted;
  const canEditAlloc = isHSV;
  const poolById = Object.fromEntries(pool.map((p) => [p.id, p]));

  const patchProject = async (field, value) => {
    const updated = await api.patch(`/projects/${project.id}`, { [field]: value });
    setProject((prev) => ({ ...prev, ...updated }));
    notifyChanged();
  };

  // ---- demand lines ----
  const addDemandLine = async (period) => {
    const line = await api.post(`/projects/${project.id}/demand-lines`, {
      period: period || periods[0]?.id || "", profile: "Mobile", count: 0, pct: null,
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
  const addAllocationLine = async (period) => {
    if (pool.length === 0) return;
    const line = await api.post(`/projects/${project.id}/allocation-lines`, {
      period: period || periods[0]?.id || "", poolMemberId: pool[0].id, pct: 1,
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

  const synthesis = relevantPeriods.map((period) => {
    const row = { period, Mobile: { dem: 0, alloc: 0 }, TPE: { dem: 0, alloc: 0 }, Digital: { dem: 0, alloc: 0 } };
    project.demandLines.filter((l) => l.period === period).forEach((l) => {
      row[l.profile].dem += effective(l.count, l.pct);
    });
    project.allocationLines.filter((l) => l.period === period).forEach((l) => {
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
        <ChevronLeft size={15} /> {isHSV ? "Tous les projets" : "Mes projets"}
      </button>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Field label="Nom du projet" value={project.name} onChange={(v) => setProject((p) => ({ ...p, name: v }))}
          onBlur={() => patchProject("name", project.name)} width={260} disabled={!(isHSV || isMySvo)} />
        <div style={{ width: 200 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>SVO</div>
          <select value={project.svoUserId} onChange={(e) => patchProject("svoUserId", e.target.value)} disabled={!isHSV}
            style={{ ...inputStyle, width: "100%", opacity: isHSV ? 1 : 0.7 }}>
            {!svoUsers.some((s) => s.id === project.svoUserId) && (
              <option value={project.svoUserId}>{project.svo?.name} (retiré des rôles)</option>
            )}
            {svoUsers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <Field label="Statut" value={project.status} onChange={(v) => setProject((p) => ({ ...p, status: v }))}
          onBlur={() => patchProject("status", project.status)} width={200} disabled={!(isHSV || isMySvo)} />
      </div>

      {!isHSV && isMySvo && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: project.demandSubmitted ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)",
          border: `1px solid ${project.demandSubmitted ? GREEN : ACCENT}`,
        }}>
          <span style={{ fontWeight: 600, color: project.demandSubmitted ? "#6ee7b7" : "#93c5fd" }}>
            {project.demandSubmitted ? "Demande soumise au Head of Value Stream ✓" : "Demande en brouillon — pas encore visible du HSV"}
          </span>
          <button onClick={() => patchProject("demandSubmitted", !project.demandSubmitted)} style={project.demandSubmitted ? btnGhost : btnPrimary}>
            {project.demandSubmitted ? "Rouvrir pour modifier" : "Soumettre la demande"}
          </button>
        </div>
      )}
      {isHSV && !project.demandSubmitted && (
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, color: MUTED, border: `1px dashed ${MUTED}55` }}>
          Le SVO ({project.svo?.name}) n'a pas encore soumis sa demande pour ce projet.
        </div>
      )}

      <div style={{
        padding: "10px 14px", borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 600,
        background: totalReste > 0.001 ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
        color: totalReste > 0.001 ? "#fbbf24" : "#6ee7b7",
        border: `1px solid ${totalReste > 0.001 ? AMBER : GREEN}`,
      }}>
        {totalReste > 0.001
          ? `Reste à affecter : Mobile ${round1(resteTotal.Mobile)} · TPE ${round1(resteTotal.TPE)} · Digital ${round1(resteTotal.Digital)}`
          : "Besoin entièrement couvert ✓"}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <SectionTitle style={{ marginBottom: 0 }}>Besoin exprimé par le SVO {!canEditDemand && <span style={{ fontWeight: 400, textTransform: "none", color: MUTED }}>(lecture seule)</span>}</SectionTitle>
        {canEditDemand && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <input type="checkbox" checked={showAllDemandPeriods} onChange={(e) => setShowAllDemandPeriods(e.target.checked)} />
            Afficher les 52 semaines de l'année
          </label>
        )}
      </div>
      <LinesTable
        lines={project.demandLines}
        editable={canEditDemand}
        columns={[
          { key: "period", label: "Période", type: "select", options: periodOptions, optionLabels: periodLabels, width: 100 },
          { key: "profile", label: "Profil", type: "select", options: ["Mobile", "TPE", "Digital"], width: 90 },
          { key: "count", label: "Nombre de personnes", type: "number", width: 90 },
          { key: "pct", label: "Allocation % (vide = 100%)", type: "percent", width: 110 },
        ]}
        addLabel="Ajouter une ligne de besoin"
        onAdd={addDemandLine}
        onPatch={patchDemandLine}
        onRemove={removeDemandLine}
        groupBy="period"
        expandAllGroups={showAllDemandPeriods}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 10 }}>
        <SectionTitle style={{ marginBottom: 0 }}>
          Affectation des ressources (Head of Value Stream) {!canEditAlloc && <span style={{ fontWeight: 400, textTransform: "none", color: MUTED }}>(lecture seule)</span>}
        </SectionTitle>
        {canEditAlloc && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <input type="checkbox" checked={showAllAllocPeriods} onChange={(e) => setShowAllAllocPeriods(e.target.checked)} />
            Afficher les 52 semaines de l'année
          </label>
        )}
      </div>
      <LinesTable
        lines={project.allocationLines}
        editable={canEditAlloc}
        columns={[
          { key: "period", label: "Période", type: "select", options: periodOptions, optionLabels: periodLabels, width: 100 },
          { key: "poolMemberId", label: "Ressource", type: "select", options: pool.map((r) => r.id), optionLabels: pool.map((r) => `${r.name} (${r.squad})`), width: 220 },
          { key: "pct", label: "Allocation %", type: "percent", width: 100 },
        ]}
        addLabel="Ajouter une affectation"
        onAdd={addAllocationLine}
        onPatch={patchAllocationLine}
        onRemove={removeAllocationLine}
        groupBy="period"
        expandAllGroups={showAllAllocPeriods}
      />

      {relevantPeriods.length > 0 && (
        <>
          <SectionTitle style={{ marginTop: 28 }}>Synthèse : demandé vs alloué</SectionTitle>
          <div style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#1a2235" }}>
                  <Th>Période</Th>
                  <Th>Dem. Mobile</Th><Th>All. Mobile</Th><Th>Écart</Th>
                  <Th>Dem. TPE</Th><Th>All. TPE</Th><Th>Écart</Th>
                  <Th>Dem. Digital</Th><Th>All. Digital</Th><Th>Écart</Th>
                </tr>
              </thead>
              <tbody>
                {synthesis.map((row) => (
                  <tr key={row.period} style={{ borderTop: "1px solid #1e2d45" }}>
                    <Td>{row.period}</Td>
                    {["Mobile", "TPE", "Digital"].map((sq) => {
                      const ecart = round1(row[sq].alloc - row[sq].dem);
                      return (
                        <>
                          <Td key={sq + "-dem"}>{round1(row[sq].dem)}</Td>
                          <Td key={sq + "-alloc"}>{round1(row[sq].alloc)}</Td>
                          <Td key={sq + "-ecart"}><span style={{ color: ecart < 0 ? "#fca5a5" : "#6ee7b7", fontWeight: 600 }}>{ecart}</span></Td>
                        </>
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
