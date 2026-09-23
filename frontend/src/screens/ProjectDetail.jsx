import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Check } from "lucide-react";
import { api } from "../api";
import { round1, effective } from "../lib/util";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SelectNative } from "../components/ui/select";
import { Badge2 } from "../components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/table";
import { cn } from "../lib/utils";
import LinesTable from "../components/LinesTable";
import DemandTable from "../components/DemandTable";
import { PROFILES, PROFILE_FIELDS } from "../lib/profiles";

export default function ProjectDetail({ projectId, canViewAll, canManageProjects, canManageAllocations, canProposeAllocations, user, svoUsers, pool, teamPool, periods, overAllocProjects, unavailableMembers, onBack, onProjectsChanged }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [releaseDrafts, setReleaseDrafts] = useState({});
  const [releasingId, setReleasingId] = useState(null);
  // Last-saved snapshot of the top fields, so typing in Nom/Statut/SVO only
  // updates the draft shown on screen — nothing reaches the server until
  // "Enregistrer" is clicked, which sends every changed field at once.
  const [savedTop, setSavedTop] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/projects/${projectId}`)
      .then((p) => { setProject(p); setSavedTop({ name: p.name, status: p.status, svoUserId: p.svoUserId, ...Object.fromEntries(PROFILE_FIELDS.map(({ jiraKeyField }) => [jiraKeyField, p[jiraKeyField]])) }); setError(""); })
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
    return <div className="flex items-center gap-2 text-muted-foreground p-10"><Loader2 className="animate-spin" size={18} /> Chargement…</div>;
  }
  if (error || !project) {
    return <div className="text-destructive p-6">{error || "Projet introuvable."}</div>;
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

  const topDirty = !!savedTop && (
    project.name !== savedTop.name || project.status !== savedTop.status ||
    project.svoUserId !== savedTop.svoUserId ||
    PROFILE_FIELDS.some(({ jiraKeyField }) => (project[jiraKeyField] || "") !== (savedTop[jiraKeyField] || ""))
  );
  const saveTopFields = async () => {
    if (!topDirty) return;
    const patch = {};
    if (project.name !== savedTop.name) patch.name = project.name;
    if (project.status !== savedTop.status) patch.status = project.status;
    if (project.svoUserId !== savedTop.svoUserId) patch.svoUserId = project.svoUserId;
    for (const { jiraKeyField } of PROFILE_FIELDS) {
      if ((project[jiraKeyField] || "") !== (savedTop[jiraKeyField] || "")) patch[jiraKeyField] = project[jiraKeyField] || null;
    }
    const updated = await api.patch(`/projects/${project.id}`, patch);
    setProject((prev) => ({ ...prev, ...updated }));
    setSavedTop({ name: updated.name, status: updated.status, svoUserId: updated.svoUserId, ...Object.fromEntries(PROFILE_FIELDS.map(({ jiraKeyField }) => [jiraKeyField, updated[jiraKeyField]])) });
    notifyChanged();
  };

  // periods[0] is the oldest past week now that the list reaches into
  // history — the "current" flag (set by the backend) marks the real one.
  const currentPeriodId = periods.find((p) => p.current)?.id || periods[0]?.id || "";

  // ---- demand lines ----
  // One row = one span of weeks, with a headcount per profile (Mobile/TPE
  // Android/TPE Engage/Digital) right on that same row — no more picking
  // which profiles apply, they're just columns.
  const addDemandLine = async () => {
    const p = currentPeriodId;
    const blank = Object.fromEntries(PROFILE_FIELDS.flatMap((f) => [[f.countKey, 0], [f.pctKey, null]]));
    const line = await api.post(`/projects/${project.id}/demand-lines`, { periodStart: p, periodEnd: p, ...blank });
    setProject((prev) => ({ ...prev, demandLines: [...prev.demandLines, line] }));
    notifyChanged();
  };
  const saveDemandLine = async (id, patch) => {
    const updated = await api.patch(`/demand-lines/${id}`, patch);
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
  // propose-only holder and to the whole pool for a manager.
  //
  // Pre-fills one line per still-missing headcount the SVO actually asked
  // for — a demand of "Mobile: 3" seeds 3 Mobile lines on the SVO's own
  // period range, not one line pinned to today's week — so the Team Lead
  // only has to pick WHO for each slot, not retype the dates from scratch.
  // A propose-only Team Lead's resourceOptions only cover their own
  // sous-équipe, so this naturally only seeds their own profile's gaps.
  // Tops up whatever's still short on repeat clicks (existing pending
  // proposals count as already covering a slot); falls back to a single
  // blank line once everything demanded is already covered.
  const addAllocationLine = async () => {
    if (resourceOptions.length === 0) return;

    const seeds = [];
    for (const dl of project.demandLines) {
      for (const { profile, countKey, pctKey } of PROFILE_FIELDS) {
        const needed = Math.max(0, Math.round(Number(dl[countKey]) || 0));
        if (needed <= 0) continue;
        const candidates = resourceOptions.filter((r) => r.sousEquipe === profile);
        if (candidates.length === 0) continue;
        const existing = project.allocationLines.filter((al) =>
          al.periodStart === dl.periodStart && al.periodEnd === dl.periodEnd && poolById[al.poolMemberId]?.sousEquipe === profile
        ).length;
        const pctValue = dl[pctKey] === null || dl[pctKey] === undefined || dl[pctKey] === "" ? 1 : Number(dl[pctKey]);
        for (let i = existing; i < needed; i++) {
          seeds.push({ periodStart: dl.periodStart, periodEnd: dl.periodEnd, poolMemberId: candidates[i % candidates.length].id, pct: pctValue });
        }
      }
    }

    if (seeds.length > 0) {
      // allSettled, not all — a resource on leave gets rejected (409) by
      // the server for that one seed; the rest should still land instead
      // of the whole batch vanishing because of one conflict.
      const results = await Promise.allSettled(seeds.map((s) => api.post(`/projects/${project.id}/allocation-lines`, s)));
      const created = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      if (created.length > 0) {
        setProject((prev) => ({ ...prev, allocationLines: [...prev.allocationLines, ...created] }));
        notifyChanged();
      }
      return;
    }

    const p = currentPeriodId;
    const line = await api.post(`/projects/${project.id}/allocation-lines`, {
      periodStart: p, periodEnd: p, poolMemberId: resourceOptions[0].id, pct: 1,
    });
    setProject((prev) => ({ ...prev, allocationLines: [...prev.allocationLines, line] }));
    notifyChanged();
  };
  const saveAllocationLine = async (id, patch) => {
    const updated = await api.patch(`/allocation-lines/${id}`, patch);
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
    const row = { period, ...Object.fromEntries(PROFILES.map((p) => [p, { dem: 0, alloc: 0 }])) };
    project.demandLines.filter((l) => l.periodStart <= period && period <= l.periodEnd).forEach((l) => {
      for (const { profile, countKey, pctKey } of PROFILE_FIELDS) {
        row[profile].dem += effective(l[countKey], l[pctKey]);
      }
    });
    project.allocationLines.filter((l) => l.status === "approved" && l.periodStart <= period && period <= l.periodEnd).forEach((l) => {
      const res = poolById[l.poolMemberId];
      if (res && res.sousEquipe in row) row[res.sousEquipe].alloc += Number(l.pct) || 0;
    });
    return row;
  });

  const resteTotal = Object.fromEntries(PROFILES.map((p) => [p, 0]));
  synthesis.forEach((row) => {
    PROFILES.forEach((p) => {
      resteTotal[p] += Math.max(0, row[p].dem - row[p].alloc);
    });
  });
  const totalReste = Object.values(resteTotal).reduce((a, b) => a + b, 0);

  const periodOptions = periods.map((p) => p.id);
  const periodLabels = periods.map((p) => p.label);

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2 text-muted-foreground">
        <ChevronLeft /> {canViewAll ? "Tous les projets" : "Mes projets"}
      </Button>

      <Card className="mb-4">
        <CardContent className="p-4 flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1.5 w-64">
            <span className="text-xs font-medium text-muted-foreground">Nom du projet</span>
            <Input value={project.name} onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))} disabled={!canEditNameStatus} />
          </div>
          <div className="flex flex-col gap-1.5 w-48">
            <span className="text-xs font-medium text-muted-foreground">SVO</span>
            <SelectNative value={project.svoUserId} onChange={(e) => setProject((p) => ({ ...p, svoUserId: e.target.value }))} disabled={!canManageProjects}>
              {!svoUsers.some((s) => s.id === project.svoUserId) && (
                <option value={project.svoUserId}>{project.svo?.name} (retiré des rôles)</option>
              )}
              {svoUsers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectNative>
          </div>
          <div className="flex flex-col gap-1.5 w-48">
            <span className="text-xs font-medium text-muted-foreground">Statut</span>
            <Input value={project.status} onChange={(e) => setProject((p) => ({ ...p, status: e.target.value }))} disabled={!canEditNameStatus} />
          </div>
          {PROFILE_FIELDS.map(({ profile, jiraKeyField }) => (
            <div key={jiraKeyField} className="flex flex-col gap-1.5 w-28">
              <span className="text-xs font-medium text-muted-foreground">Jira {profile}</span>
              <Input value={project[jiraKeyField] || ""} onChange={(e) => setProject((p) => ({ ...p, [jiraKeyField]: e.target.value }))} disabled={!canEditNameStatus} />
            </div>
          ))}
          {(canEditNameStatus || canManageProjects) && (
            <Button onClick={saveTopFields} disabled={!topDirty} size="sm">
              <Check /> Enregistrer
            </Button>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <div className={cn("flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg mb-4 text-[13px] border",
          project.demandSubmitted ? "bg-success/10 border-success/40 text-success" : "bg-primary/10 border-primary/40 text-primary")}>
          <span className="font-semibold">
            {project.demandSubmitted ? "Demande soumise au Head of Value Stream ✓" : "Demande en brouillon — pas encore visible du HSV"}
          </span>
          <Button size="sm" variant={project.demandSubmitted ? "outline" : "default"} onClick={() => patchProject("demandSubmitted", !project.demandSubmitted)}>
            {project.demandSubmitted ? "Rouvrir pour modifier" : "Soumettre la demande"}
          </Button>
        </div>
      )}
      {!isOwner && !project.demandSubmitted && (
        <div className="px-3.5 py-2.5 rounded-lg mb-4 text-[13px] text-muted-foreground border border-dashed">
          Le SVO ({project.svo?.name}) n'a pas encore soumis sa demande pour ce projet.
        </div>
      )}

      <div className={cn("px-3.5 py-2.5 rounded-lg mb-5 text-[13px] font-semibold border",
        totalReste > 0.001 ? "bg-warning/10 text-warning border-warning/40" : "bg-success/10 text-success border-success/40")}>
        {totalReste > 0.001
          ? `Reste à affecter : ${PROFILES.map((p) => `${p} ${round1(resteTotal[p])}`).join(" · ")}`
          : "Besoin entièrement couvert ✓"}
      </div>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">Besoin exprimé par le SVO {!canEditDemand && <span className="font-normal normal-case">(lecture seule)</span>}</h2>
      <DemandTable
        lines={project.demandLines}
        periods={periods}
        editable={canEditDemand}
        onAdd={addDemandLine}
        onSave={saveDemandLine}
        onRemove={removeDemandLine}
      />

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5 mt-7">
        Affectation des ressources {!canEditAlloc && <span className="font-normal normal-case">(lecture seule)</span>}
      </h2>
      <LinesTable
        lines={project.allocationLines}
        editable={canEditAlloc}
        rowEditable={isLineOwnedByMe}
        columns={[
          { key: "periodStart", label: "Début", type: "select", options: periodOptions, optionLabels: periodLabels, width: 130 },
          { key: "periodEnd", label: "Fin", type: "select", options: periodOptions, optionLabels: periodLabels, width: 130 },
          {
            key: "poolMemberId", label: "Ressource", type: "select", options: resourceOptions.map((r) => r.id), optionLabels: resourceOptions.map((r) => `${r.name} (${r.sousEquipe})`), width: 260, grow: true,
            // Sous-équipe, not squad — "TPE" alone doesn't say whether this
            // person is Android or Engage, which is exactly what demand is
            // now split on, so the plain squad label invites mismatches.
            fallbackLabel: (id) => (poolById[id] ? `${poolById[id].name} (${poolById[id].sousEquipe})` : null),
            // Recap of the resource's OTHER assignments across the same span of
            // weeks, so the picker doesn't need to be cross-checked against
            // every other project — deduped per project across the range.
            hint: (line) => {
              if (!line.poolMemberId || !line.periodStart || !line.periodEnd) return null;
              const seen = new Map();
              // A leave spanning several weeks shows up once per week here —
              // dedupe back to the underlying record so it's shown once,
              // with its actual days, not just a week count.
              const leaves = new Map();
              for (const w of periodsBetween(line.periodStart, line.periodEnd)) {
                for (const e of overAllocProjects?.[`${line.poolMemberId}:${w}`] || []) {
                  if (e.projectId !== project.id && !seen.has(e.projectId)) seen.set(e.projectId, e);
                }
                for (const u of unavailableMembers?.[line.poolMemberId]?.[w] || []) {
                  const key = `${u.type}|${u.startDate}|${u.endDate}`;
                  if (!leaves.has(key)) leaves.set(key, u);
                }
              }
              const entries = [...seen.values()];
              const leaveList = [...leaves.values()];
              if (entries.length === 0 && leaveList.length === 0) return null;
              const fmtDay = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
              return (
                <div className="flex flex-wrap gap-1 mt-1">
                  {leaveList.map((u, i) => (
                    <Badge2 key={i} variant="destructive" className="mr-1 mb-1">⚠ {u.type} ({fmtDay(u.startDate)} → {fmtDay(u.endDate)})</Badge2>
                  ))}
                  {entries.map((e) => (
                    <Badge2 key={e.projectId} variant="secondary" className="mr-1 mb-1">{e.projectName} · {Math.round(e.pct * 100)}%</Badge2>
                  ))}
                </div>
              );
            },
          },
          // Alternate candidate for this same slot, in case the primary
          // resource falls through — restricted to the same sous-équipe as
          // whichever resource is currently picked on this row, so the
          // dropdown always narrows itself to real substitutes.
          {
            key: "backupPoolMemberId", label: "Backup (optionnel)", type: "select", group: "secondary",
            options: (line) => resourceOptions.filter((r) => r.sousEquipe === poolById[line.poolMemberId]?.sousEquipe && r.id !== line.poolMemberId).map((r) => r.id),
            optionLabels: (line) => resourceOptions.filter((r) => r.sousEquipe === poolById[line.poolMemberId]?.sousEquipe && r.id !== line.poolMemberId).map((r) => r.name),
            fallbackLabel: (id) => (poolById[id] ? poolById[id].name : null),
          },
          { key: "pct", label: "Allocation %", type: "percent", width: 110 },
          ...(canManageAllocations || canProposeAllocations ? [{
            key: "status", label: "Statut", width: 140,
            render: (line) => (
              <div className="flex items-center gap-1.5">
                {line.status === "pending" ? <Badge2 variant="warning">En attente</Badge2> : <Badge2 variant="success">Confirmée</Badge2>}
                {line.status === "pending" && canManageAllocations && (
                  <Button variant="ghost" size="icon" onClick={() => approveAllocationLine(line)} title="Valider" className="h-8 w-8 text-success">
                    <Check />
                  </Button>
                )}
              </div>
            ),
          }] : []),
          // Whoever proposes/assigns the line can explain their pick here —
          // but only THEY can edit it afterward, not whoever else can touch
          // the row (e.g. the admin approving it) — otherwise a validator
          // could silently rewrite the Team Lead's own rationale.
          // Second field row: more room to actually type/read a sentence,
          // instead of squeezed between five other columns.
          { key: "comment", label: "Commentaire", type: "text", width: 240, group: "secondary", editable: (line) => line.createdById === user.id },
          // Belongs to whoever validates, not whoever proposed — only an
          // admin can ever write it, regardless of who else can touch the row.
          ...(canManageAllocations || canProposeAllocations ? [{
            key: "validationComment", label: "Commentaire validation", width: 240, group: "secondary",
            editable: () => canManageAllocations,
          }] : []),
          ...(isOwner || canManageAllocations ? [{
            key: "release", label: "Libération", width: 220, group: "full",
            render: (line) => {
              // Releasing only makes sense for an already-confirmed line —
              // a pending proposal gets rejected/retracted instead (see Statut).
              if (line.status === "pending") return null;
              if (line.releaseRequested) {
                const partial = line.releaseNewPct !== null && line.releaseNewPct !== undefined;
                return (
                  <div>
                    <Badge2 variant="warning">{partial ? `Libération partielle → ${Math.round(Number(line.releaseNewPct) * 100)}%` : "Libération totale demandée"}</Badge2>
                    <div className="text-[10.5px] text-muted-foreground mt-1">{line.releaseNote}</div>
                    <div className="flex gap-1.5 mt-1.5">
                      {canManageAllocations && (
                        <Button variant="outline" size="sm" onClick={() => confirmRelease(line.id)} className="text-success border-success/50">
                          Valider
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => cancelRelease(line.id)}>
                        {canManageAllocations ? "Refuser" : "Annuler"}
                      </Button>
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
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2.5 text-[11px]">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={!draft.partial} onChange={() => setReleaseDrafts({ ...releaseDrafts, [line.id]: { ...draft, partial: false } })} />
                        Totale
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={draft.partial} onChange={() => setReleaseDrafts({ ...releaseDrafts, [line.id]: { ...draft, partial: true } })} />
                        Partielle
                      </label>
                    </div>
                    {draft.partial && (
                      <div className="flex gap-1.5 items-center">
                        <Input type="number" min="0" max={Math.max(0, currentPct - 1)} value={draft.newPct}
                          onChange={(e) => setReleaseDrafts({ ...releaseDrafts, [line.id]: { ...draft, newPct: Number(e.target.value) } })}
                          className="h-8 w-20" />
                        <span className="text-[10.5px] text-muted-foreground">% (au lieu de {currentPct}%)</span>
                      </div>
                    )}
                    <div className="flex gap-1.5 items-center flex-wrap">
                      <Input value={draft.note} onChange={(e) => setReleaseDrafts({ ...releaseDrafts, [line.id]: { ...draft, note: e.target.value } })}
                        placeholder="Raison / réaffectation prévue" className="h-8 w-48" />
                      <Button size="sm" onClick={() => requestRelease(line.id)} disabled={!draft.note.trim() || pctInvalid}>
                        OK
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setReleasingId(null)}>Annuler</Button>
                    </div>
                  </div>
                );
              }
              return (
                <Button variant="outline" size="sm" onClick={() => setReleasingId(line.id)}>
                  Libérer
                </Button>
              );
            },
          }] : []),
        ]}
        addLabel={canManageAllocations ? "Ajouter une affectation" : "Proposer une affectation"}
        onAdd={addAllocationLine}
        onSave={saveAllocationLine}
        onRemove={removeAllocationLine}
      />

      {relevantPeriods.length > 0 && (
        <>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5 mt-7">Synthèse : demandé vs alloué (par semaine)</h2>
          <Card className="mb-3">
            <CardContent className="p-0">
              <Table>
                <THead>
                  <tr>
                    <TH>Période</TH>
                    {PROFILES.map((p) => (
                      <Fragment key={p}>
                        <TH>Dem. {p}</TH><TH>All. {p}</TH><TH>Écart</TH>
                      </Fragment>
                    ))}
                  </tr>
                </THead>
                <TBody>
                  {synthesis.map((row) => (
                    <TR key={row.period}>
                      <TD>{row.period}</TD>
                      {PROFILES.map((sq) => {
                        const ecart = round1(row[sq].alloc - row[sq].dem);
                        return (
                          <Fragment key={sq}>
                            <TD className="text-muted-foreground">{round1(row[sq].dem)}</TD>
                            <TD>{round1(row[sq].alloc)}</TD>
                            <TD><span className={cn("font-semibold", ecart < 0 ? "text-destructive" : "text-success")}>{ecart}</span></TD>
                          </Fragment>
                        );
                      })}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
