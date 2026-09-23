import { useState } from "react";
import { Plus, Trash2, Calendar, Timer, Download, Pencil, Loader2, CheckCircle2, AlertTriangle, XCircle, CircleDashed } from "lucide-react";
import { api } from "../api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SelectNative } from "../components/ui/select";
import { Sheet, FieldRow } from "../components/ui/sheet";
import { cn } from "../lib/utils";
import { isValidEmail } from "../lib/validate";
import { showToast } from "../lib/toast";

const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");
const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const LEAVE_TYPE_COLORS = {
  "congé validé": "text-success", "congé demandé": "text-warning", "congé refusé": "text-destructive",
  "congé": "text-warning", "maladie": "text-destructive", "formation": "text-primary", "autre": "text-muted-foreground",
};

// The ASCII extractor decorates its log lines with emoji prefixes; turning
// them into a step list (icon + colored text) fits the app better than the
// old green-on-black terminal.
function stripEmoji(line) {
  const parts = Array.from(line);
  let i = 0;
  while (i < parts.length) {
    const cp = parts[i].codePointAt(0);
    const pictographic = cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || cp === 0xfe0f || parts[i] === "‍" || cp === 0x3030 || parts[i] === " ";
    if (!pictographic) break;
    i++;
  }
  return parts.slice(i).join("") || line;
}
function classifyLog(line) {
  if (line.includes("❌")) return "error";
  if (line.includes("✅")) return "ok";
  if (line.includes("⚠️")) return "warn";
  if (line.includes("🎉") || line.includes("📊") || line.includes("🔌")) return "ok";
  return "info";
}
function AsciiTimeline({ logs, running, onClose }) {
  const stepIcon = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle, info: CircleDashed };
  const stepColor = { ok: "text-success", warn: "text-warning", error: "text-destructive", info: "text-muted-foreground" };
  const items = logs.filter((l) => !l.startsWith("🔗") && !l.startsWith("📦 API Response") && !l.startsWith("Éléments interactifs") && !l.startsWith("API entry") && !/^Analyse de:/.test(l));
  return (
    <Card className="mb-4">
      <div className="flex justify-between items-center px-4 py-2.5 border-b bg-muted/40">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          {running ? <Loader2 className="animate-spin text-primary" size={15} /> : <CheckCircle2 className="text-success" size={15} />}
          Import ASCII — {running ? "extraction en cours…" : "terminé"}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer" className="text-muted-foreground h-7 w-7">×</Button>
      </div>
      <CardContent className="p-3.5 max-h-72 overflow-auto">
        {items.length === 0 && <div className="text-muted-foreground text-[12.5px]">Démarrage de la connexion à ASCII…</div>}
        {items.map((log, i) => {
          const kind = classifyLog(log);
          const Icon = stepIcon[kind];
          return (
            <div key={i} className={cn("flex gap-2 items-start py-1", i > 0 && "border-t border-dashed")}>
              <Icon size={14} className={cn("shrink-0 mt-0.5", stepColor[kind])} />
              <span className="text-[12.5px] text-foreground leading-normal">{stripEmoji(log)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function PoolView({ pool, overAllocGrid, periods, onChanged, unavailabilitiesData = {} }) {
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [syncingTempo, setSyncingTempo] = useState(false);
  const [extractingAscii, setExtractingAscii] = useState(false);
  const [asciiLogs, setAsciiLogs] = useState([]);
  const [showAsciiLogs, setShowAsciiLogs] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [panelUnavail, setPanelUnavail] = useState([]);
  const [newUnavailability, setNewUnavailability] = useState({ startDate: "", endDate: "", type: "congé", comment: "" });

  const addPerson = async () => {
    try {
      await api.post("/pool", { name: "Nouvelle personne", squad: "Mobile", sousEquipe: "Mobile", roleTitle: "Développeur" });
      onChanged();
    } catch (e) { setError(e.message); }
  };
  const removePerson = async (id) => {
    try {
      await api.delete(`/pool/${id}`);
      if (selectedMember?.id === id) setSelectedMember(null);
      onChanged();
    } catch (e) { setError(e.message); }
  };
  const patchPerson = async (id, key, value) => {
    if (key === "email" && value.trim() && !isValidEmail(value)) {
      showToast("Adresse email invalide — format attendu : nom@domaine.com", "error");
      return;
    }
    if (key === "capacityPct") {
      const n = Number(String(value).replace("%", "").trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        showToast("Temps de travail invalide — un pourcentage entre 0 et 100.", "error");
        return;
      }
      value = Math.round(n) / 100;
    }
    try {
      await api.patch(`/pool/${id}`, { [key]: value });
      onChanged();
    } catch (e) { setError(e.message); }
  };
  const draftValue = (p, key) => drafts[p.id]?.[key] ?? p[key];
  const setDraft = (id, key, value) => setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));

  const openPanel = async (member) => {
    setSelectedMember(member);
    try {
      const rows = await api.get(`/pool/${member.id}/unavailabilities`);
      setPanelUnavail(rows);
    } catch (e) { setError(e.message); }
  };

  const handleAddUnavailability = async () => {
    if (!newUnavailability.startDate || !newUnavailability.endDate) {
      showToast("Veuillez remplir les dates de début et de fin", "error");
      return;
    }
    try {
      await api.post(`/pool/${selectedMember.id}/unavailabilities`, newUnavailability);
      const rows = await api.get(`/pool/${selectedMember.id}/unavailabilities`);
      setPanelUnavail(rows);
      setNewUnavailability({ startDate: "", endDate: "", type: "congé", comment: "" });
      showToast("Indisponibilité ajoutée", "success");
    } catch (e) { setError(e.message); }
  };
  const handleDeleteUnavailability = async (unavailabilityId) => {
    try {
      await api.delete(`/pool/${selectedMember.id}/unavailabilities/${unavailabilityId}`);
      const rows = await api.get(`/pool/${selectedMember.id}/unavailabilities`);
      setPanelUnavail(rows);
      showToast("Indisponibilité supprimée", "success");
    } catch (e) { setError(e.message); }
  };

  const getUnavailabilitySummary = (memberId) => {
    const list = unavailabilitiesData?.[memberId] || [];
    if (list.length === 0) return null;
    const uniqueTypes = [...new Set(list.map((u) => u.type))];
    return `${list.length} ${uniqueTypes.join(", ")}`;
  };

  const handleSyncTempo = async () => {
    setSyncingTempo(true);
    try {
      const summary = await api.post("/admin/sync-tempo");
      showToast(
        `Synchro Tempo : ${summary.matched} ligne(s) mises à jour` + (summary.unmatchedAccounts ? ` — ${summary.unmatchedAccounts} compte(s) Jira non rattachés` : ""),
        "success"
      );
      onChanged();
    } catch { /* api.js already toasts */ } finally {
      setSyncingTempo(false);
    }
  };

  const handleExtractAscii = async () => {
    if (!confirm("Importer les congés depuis ASCII ?\n\nConnexion avec les identifiants du serveur, extraction du calendrier des collaborateurs, puis mise à jour de la base (les congés refusés ne bloquent rien, les congés demandés avertissent).")) return;
    setExtractingAscii(true);
    setAsciiLogs([]);
    setShowAsciiLogs(true);
    try {
      const response = await api.post("/admin/extract-ascii");
      if (response.logs?.length) setAsciiLogs(response.logs);
      if (response.success) {
        showToast("Extraction ASCII terminée avec succès !", "success");
        onChanged();
      } else {
        showToast(response.error || "Erreur lors de l'extraction ASCII", "error");
      }
    } catch (e) {
      setError(e.message);
      showToast("Erreur lors de l'extraction ASCII", "error");
    } finally {
      setExtractingAscii(false);
    }
  };

  const peakFor = (id) => {
    let max = 0;
    for (const p of periods) max = Math.max(max, overAllocGrid?.[id]?.[p] || 0);
    return max;
  };

  const member = selectedMember ? pool.find((m) => m.id === selectedMember.id) || selectedMember : null;

  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pool de ressources</h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Cliquez sur un nom pour ouvrir sa fiche (indisponibilités, temps de travail…). Le ✏️ passe la ligne en édition.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncTempo} disabled={syncingTempo}>
            {syncingTempo ? <Loader2 className="animate-spin" size={14} /> : <Timer size={14} />} {syncingTempo ? "Synchronisation…" : "Synchroniser Tempo"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExtractAscii} disabled={extractingAscii}>
            {extractingAscii ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} {extractingAscii ? "Extraction…" : "Importer ASCII"}
          </Button>
          <Button size="sm" onClick={addPerson}><Plus size={14} /> Ajouter une personne</Button>
        </div>
      </div>

      {error && <div className="text-destructive text-[12.5px] mb-3">{error}</div>}

      {showAsciiLogs && <AsciiTimeline logs={asciiLogs} running={extractingAscii} onClose={() => setShowAsciiLogs(false)} />}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-hidden rounded-xl">
            <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="bg-muted/50 text-left">
                  {["Nom", "Squad", "Sous-équipe", "Rôle", "Temps", "Pic de charge", "Indisponibilités", ""].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pool.map((p) => {
                  const isEditing = editingId === p.id;
                  const peak = peakFor(p.id);
                  const cap = Number(p.capacityPct ?? 1);
                  const summary = getUnavailabilitySummary(p.id);
                  return (
                    <tr key={p.id} className={cn("border-t hover:bg-muted/30 transition-colors", isEditing && "bg-primary/5", member?.id === p.id && !isEditing && "bg-primary/5")}>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <Input value={draftValue(p, "name")} onChange={(e) => setDraft(p.id, "name", e.target.value)}
                            onBlur={(e) => patchPerson(p.id, "name", e.target.value)} className="h-8" />
                        ) : (
                          <button onClick={() => openPanel(p)} className="cursor-pointer font-semibold text-[13px] text-left hover:underline">
                            {p.name}
                          </button>
                        )}
                      </td>
                      {isEditing ? (
                        <>
                          <td className="px-3 py-2">
                            <SelectNative value={p.squad} onChange={(e) => patchPerson(p.id, "squad", e.target.value)} className="h-8">
                              <option>Mobile</option><option>TPE</option><option>Digital</option>
                            </SelectNative>
                          </td>
                          <td className="px-3 py-2">
                            <Input value={draftValue(p, "sousEquipe")} onChange={(e) => setDraft(p.id, "sousEquipe", e.target.value)}
                              onBlur={(e) => patchPerson(p.id, "sousEquipe", e.target.value)} className="h-8" />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={draftValue(p, "roleTitle")} onChange={(e) => setDraft(p.id, "roleTitle", e.target.value)}
                              onBlur={(e) => patchPerson(p.id, "roleTitle", e.target.value)} className="h-8" />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <Input type="number" min={0} max={100} step={10}
                                value={draftValue(p, "capacityPctInput") ?? Math.round(cap * 100)}
                                onChange={(e) => setDraft(p.id, "capacityPctInput", e.target.value)}
                                onBlur={(e) => patchPerson(p.id, "capacityPct", e.target.value)}
                                className="h-8 w-16 text-right" />
                              <span className="text-muted-foreground text-xs">%</span>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-muted-foreground">{p.squad}</td>
                          <td className="px-3 py-2">{p.sousEquipe}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.roleTitle}</td>
                          <td className="px-3 py-2">
                            <span className={cn("font-semibold", cap < 1 && "text-primary")}>{Math.round(cap * 100)}%</span>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        <span title={`Seuil de sur-allocation : ${Math.round(cap * 100)}% (temps de travail)`}
                          className={cn("font-semibold", peak > cap + 0.001 ? "text-destructive" : peak > 0 ? "text-success" : "text-muted-foreground")}>
                          {Math.round(peak * 100)}%
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {summary ? (
                          <button onClick={() => openPanel(p)} className="cursor-pointer flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground">
                            <Calendar size={14} /> {summary}
                          </button>
                        ) : (
                          <span className="text-success text-xs">Aucune</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-0.5 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => setEditingId(isEditing ? null : p.id)}
                            title={isEditing ? "Terminer" : "Modifier la ligne"} aria-label={isEditing ? "Terminer l'édition" : "Modifier"}>
                            {isEditing ? <CheckCircle2 className="text-primary" /> : <Pencil />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removePerson(p.id)} title="Retirer du pool" aria-label="Retirer"
                            className="text-muted-foreground hover:text-destructive">
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!member} onClose={() => setSelectedMember(null)} width={420}
        title={member?.name}
        description={member ? `${member.roleTitle} · ${member.sousEquipe} · ${member.squad}` : undefined}>
        {member && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Email">
                <Input type="email" value={draftValue(member, "email") ?? member.email ?? ""} placeholder="nom@…"
                  onChange={(e) => setDraft(member.id, "email", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "email", e.target.value)} />
              </FieldRow>
              <FieldRow label="Jira accountId (Tempo)">
                <Input value={draftValue(member, "jiraAccountId") ?? member.jiraAccountId ?? ""}
                  onChange={(e) => setDraft(member.id, "jiraAccountId", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "jiraAccountId", e.target.value)} />
              </FieldRow>
              <FieldRow label="Temps de travail (%)">
                <Input type="number" min={0} max={100} step={10}
                  value={draftValue(member, "capacityPctInput") ?? Math.round(Number(member.capacityPct ?? 1) * 100)}
                  onChange={(e) => setDraft(member.id, "capacityPctInput", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "capacityPct", e.target.value)} />
              </FieldRow>
              <FieldRow label="Pic de charge">
                <span className={cn("font-bold self-center", peakFor(member.id) > Number(member.capacityPct ?? 1) + 0.001 ? "text-destructive" : "text-foreground")}>
                  {Math.round(peakFor(member.id) * 100)}%
                </span>
              </FieldRow>
              <FieldRow label="Arrivée">
                <Input type="date" value={toDateInput(draftValue(member, "startDate") ?? member.startDate)}
                  onChange={(e) => setDraft(member.id, "startDate", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "startDate", e.target.value)} />
              </FieldRow>
              <FieldRow label="Départ">
                <Input type="date" value={toDateInput(draftValue(member, "endDate") ?? member.endDate)}
                  onChange={(e) => setDraft(member.id, "endDate", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "endDate", e.target.value)} />
              </FieldRow>
            </div>

            <div className="border-t pt-4">
              <div className="text-[13px] font-bold mb-2">Indisponibilités</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Input type="date" value={newUnavailability.startDate}
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, startDate: e.target.value })} />
                <Input type="date" value={newUnavailability.endDate}
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, endDate: e.target.value })} />
                <SelectNative value={newUnavailability.type}
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, type: e.target.value })}>
                  <option value="congé">Congé</option>
                  <option value="congé validé">Congé validé</option>
                  <option value="congé demandé">Congé demandé</option>
                  <option value="congé refusé">Congé refusé</option>
                  <option value="maladie">Maladie</option>
                  <option value="formation">Formation</option>
                  <option value="autre">Autre</option>
                </SelectNative>
                <Input type="text" value={newUnavailability.comment} placeholder="Commentaire (optionnel)"
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, comment: e.target.value })} />
              </div>
              <Button size="sm" onClick={handleAddUnavailability} className="mb-3"><Plus /> Ajouter</Button>

              {panelUnavail.length === 0 ? (
                <p className="text-muted-foreground text-[12.5px]">Aucune indisponibilité enregistrée.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {panelUnavail.map((u) => (
                    <div key={u.id} className="bg-muted/40 rounded-lg px-2.5 py-2 flex justify-between items-center">
                      <div>
                        <span className={cn("font-semibold text-[12.5px]", LEAVE_TYPE_COLORS[u.type] || "text-muted-foreground")}>{u.type}</span>
                        <span className="text-xs"> · {fmtDate(u.startDate)} → {fmtDate(u.endDate)}</span>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {u.source === "ascii" ? "ASCII (auto)" : "Manuel"}{u.comment ? ` · ${u.comment}` : ""}
                        </div>
                      </div>
                      {u.source === "manual" && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUnavailability(u.id)} aria-label="Supprimer" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
