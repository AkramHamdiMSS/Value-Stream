import { useState } from "react";
import { Plus, Trash2, Calendar, X, Timer, Download, Pencil, Loader2, CheckCircle2, AlertTriangle, XCircle, CircleDashed } from "lucide-react";
import { api } from "../api";
import { SURFACE, SURFACE2, BORDER, MUTED, TEXT, ACCENT, GREEN, AMBER, RED, CARD_SHADOW, FONT_BODY, inputStyle, btnPrimary, btnGhost, iconBtn } from "../styles";
import { Th, Td } from "../components/ui";
import { isValidEmail } from "../lib/validate";
import { showToast } from "../lib/toast";

// Date stored as ISO timestamp (or already a "YYYY-MM-DD" draft) → value for
// an <input type="date">; empty when unset.
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");
const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const LEAVE_TYPE_BADGES = {
  "congé validé": GREEN, "congé demandé": AMBER, "congé refusé": RED,
  "congé": AMBER, "maladie": RED, "formation": ACCENT, "autre": MUTED,
};

// The ASCII extractor emits log lines with emoji prefixes — turn them into
// a step list that matches the app's visual language instead of a terminal.
function stripEmoji(line) {
  // Walk code points instead of a regexp class — surrogate pairs and the
  // VS16 variation selector break JS character ranges reliably.
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
  const stepColor = { ok: GREEN, warn: AMBER, error: RED, info: MUTED };
  const items = logs.filter((l) => !l.startsWith("🔗") && !l.startsWith("📦 API Response") && !l.startsWith("Éléments interactifs") && !l.startsWith("API entry") && !/^Analyse de:/.test(l));
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 16, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
          {running ? <Loader2 className="animate-spin" size={15} color={ACCENT} /> : <CheckCircle2 size={15} color={GREEN} />}
          Import ASCII — {running ? "extraction en cours…" : "terminé"}
        </div>
        <button onClick={onClose} style={{ ...iconBtn, color: MUTED }}><X size={16} /></button>
      </div>
      <div style={{ padding: "10px 14px", maxHeight: 280, overflow: "auto" }}>
        {items.length === 0 && <div style={{ color: MUTED, fontSize: 12.5 }}>Démarrage de la connexion à ASCII…</div>}
        {items.map((log, i) => {
          const kind = classifyLog(log);
          const Icon = stepIcon[kind];
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", borderTop: i === 0 ? "none" : `1px dashed ${BORDER}` }}>
              <Icon size={14} color={stepColor[kind]} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: TEXT, lineHeight: 1.4 }}>{stripEmoji(log)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {children}
    </div>
  );
}

export default function PoolView({ pool, overAllocGrid, periods, onChanged, unavailabilitiesData = {} }) {
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);     // row in explicit edit mode
  const [drafts, setDrafts] = useState({});
  const [syncingTempo, setSyncingTempo] = useState(false);
  const [extractingAscii, setExtractingAscii] = useState(false);
  const [asciiLogs, setAsciiLogs] = useState([]);
  const [showAsciiLogs, setShowAsciiLogs] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null); // side panel
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
  const closePanel = () => setSelectedMember(null);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pool de ressources</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 0" }}>
            Cliquez sur un nom pour ouvrir sa fiche (indisponibilités, temps de travail…). Le ✏️ passe la ligne en édition.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSyncTempo} disabled={syncingTempo} style={{ ...btnGhost, opacity: syncingTempo ? 0.6 : 1 }}>
            <Timer size={15} /> {syncingTempo ? "Synchronisation…" : "Synchroniser Tempo"}
          </button>
          <button onClick={handleExtractAscii} disabled={extractingAscii} style={{ ...btnGhost, opacity: extractingAscii ? 0.6 : 1 }}>
            <Download size={15} /> {extractingAscii ? "Extraction…" : "Importer ASCII"}
          </button>
          <button onClick={addPerson} style={btnPrimary}><Plus size={15} /> Ajouter une personne</button>
        </div>
      </div>

      {error && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

      {showAsciiLogs && (
        <AsciiTimeline logs={asciiLogs} running={extractingAscii} onClose={() => setShowAsciiLogs(false)} />
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: CARD_SHADOW, flex: 1, minWidth: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: SURFACE2 }}>
                <Th>Nom</Th><Th>Squad</Th><Th>Sous-équipe</Th><Th>Rôle</Th>
                <Th>Temps</Th><Th>Pic de charge</Th><Th>Indisponibilités</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {pool.map((p) => {
                const isEditing = editingId === p.id;
                const peak = peakFor(p.id);
                const cap = Number(p.capacityPct ?? 1);
                const summary = getUnavailabilitySummary(p.id);
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}`, background: isEditing ? `color-mix(in srgb, ${ACCENT} 5%, transparent)` : member?.id === p.id ? `color-mix(in srgb, ${ACCENT} 7%, transparent)` : undefined }}>
                    <Td>
                      {isEditing ? (
                        <input value={draftValue(p, "name")} onChange={(e) => setDraft(p.id, "name", e.target.value)}
                          onBlur={(e) => patchPerson(p.id, "name", e.target.value)} style={inputStyle} />
                      ) : (
                        <button onClick={() => openPanel(p)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: TEXT, fontWeight: 600, fontSize: 13, fontFamily: FONT_BODY, textAlign: "left" }}>
                          {p.name}
                        </button>
                      )}
                    </Td>
                    {isEditing ? (
                      <>
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
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <input type="number" min={0} max={100} step={10}
                              value={draftValue(p, "capacityPctInput") ?? Math.round(cap * 100)}
                              onChange={(e) => setDraft(p.id, "capacityPctInput", e.target.value)}
                              onBlur={(e) => patchPerson(p.id, "capacityPct", e.target.value)}
                              style={{ ...inputStyle, width: 56, textAlign: "right" }} />
                            <span style={{ color: MUTED, fontSize: 12 }}>%</span>
                          </div>
                        </Td>
                      </>
                    ) : (
                      <>
                        <Td><span style={{ color: MUTED }}>{p.squad}</span></Td>
                        <Td>{p.sousEquipe}</Td>
                        <Td><span style={{ color: MUTED }}>{p.roleTitle}</span></Td>
                        <Td>
                          <span style={{ fontWeight: 600, color: cap < 1 ? ACCENT : MUTED }}>{Math.round(cap * 100)}%</span>
                        </Td>
                      </>
                    )}
                    <Td>
                      <span title={`Seuil de sur-allocation : ${Math.round(cap * 100)}% (temps de travail)`}
                        style={{ color: peak > cap + 0.001 ? RED : peak > 0 ? GREEN : MUTED, fontWeight: 600 }}>
                        {Math.round(peak * 100)}%
                      </span>
                    </Td>
                    <Td>
                      {summary ? (
                        <button onClick={() => openPanel(p)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: MUTED, fontSize: 12 }}>
                          <Calendar size={14} /> {summary}
                        </button>
                      ) : (
                        <span style={{ color: GREEN, fontSize: 12 }}>Aucune</span>
                      )}
                    </Td>
                    <Td>
                      <div style={{ display: "flex", gap: 2 }}>
                        <button onClick={() => setEditingId(isEditing ? null : p.id)} style={{ ...iconBtn, color: isEditing ? ACCENT : MUTED }} aria-label={isEditing ? "Terminer l'édition" : "Modifier"} title={isEditing ? "Terminer" : "Modifier la ligne"}>
                          {isEditing ? <CheckCircle2 size={14} /> : <Pencil size={14} />}
                        </button>
                        <button onClick={() => removePerson(p.id)} style={iconBtn} aria-label="Retirer" title="Retirer du pool"><Trash2 size={14} /></button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Fiche ressource — side panel */}
        {member && (
          <div style={{ width: 340, flexShrink: 0, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: CARD_SHADOW, padding: 16, position: "sticky", top: 76, maxHeight: "calc(100vh - 96px)", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{member.name}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{member.roleTitle} · {member.sousEquipe} · {member.squad}</div>
              </div>
              <button onClick={closePanel} style={iconBtn} aria-label="Fermer"><X size={16} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <Field label="Email">
                <input type="email" value={draftValue(member, "email") ?? member.email ?? ""} placeholder="nom@…"
                  onChange={(e) => setDraft(member.id, "email", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "email", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
              </Field>
              <Field label="Jira accountId">
                <input value={draftValue(member, "jiraAccountId") ?? member.jiraAccountId ?? ""} placeholder="Tempo"
                  onChange={(e) => setDraft(member.id, "jiraAccountId", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "jiraAccountId", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
              </Field>
              <Field label="Temps de travail (%)">
                <input type="number" min={0} max={100} step={10}
                  value={draftValue(member, "capacityPctInput") ?? Math.round(Number(member.capacityPct ?? 1) * 100)}
                  onChange={(e) => setDraft(member.id, "capacityPctInput", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "capacityPct", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
              </Field>
              <Field label="Pic de charge">
                <span style={{ fontWeight: 700, color: peakFor(member.id) > Number(member.capacityPct ?? 1) + 0.001 ? RED : TEXT }}>
                  {Math.round(peakFor(member.id) * 100)}%
                </span>
              </Field>
              <Field label="Arrivée">
                <input type="date" value={toDateInput(draftValue(member, "startDate") ?? member.startDate)}
                  onChange={(e) => setDraft(member.id, "startDate", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "startDate", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
              </Field>
              <Field label="Départ">
                <input type="date" value={toDateInput(draftValue(member, "endDate") ?? member.endDate)}
                  onChange={(e) => setDraft(member.id, "endDate", e.target.value)}
                  onBlur={(e) => patchPerson(member.id, "endDate", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
              </Field>
            </div>

            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Indisponibilités</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input type="date" value={newUnavailability.startDate}
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, startDate: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
                <input type="date" value={newUnavailability.endDate}
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, endDate: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
                <select value={newUnavailability.type}
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, type: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                  <option value="congé">Congé</option>
                  <option value="congé validé">Congé validé</option>
                  <option value="congé demandé">Congé demandé</option>
                  <option value="congé refusé">Congé refusé</option>
                  <option value="maladie">Maladie</option>
                  <option value="formation">Formation</option>
                  <option value="autre">Autre</option>
                </select>
                <input type="text" value={newUnavailability.comment} placeholder="Commentaire (optionnel)"
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, comment: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
              </div>
              <button onClick={handleAddUnavailability} style={{ ...btnPrimary, marginBottom: 12 }}><Plus size={13} /> Ajouter</button>

              {panelUnavail.length === 0 ? (
                <p style={{ color: MUTED, fontSize: 12.5 }}>Aucune indisponibilité enregistrée.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {panelUnavail.map((u) => (
                    <div key={u.id} style={{ background: SURFACE2, padding: "8px 10px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 12.5, color: LEAVE_TYPE_BADGES[u.type] || MUTED }}>{u.type}</span>
                        <span style={{ fontSize: 12, color: TEXT }}> · {fmtDate(u.startDate)} → {fmtDate(u.endDate)}</span>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          {u.source === "ascii" ? "ASCII (auto)" : "Manuel"}{u.comment ? ` · ${u.comment}` : ""}
                        </div>
                      </div>
                      {u.source === "manual" && (
                        <button onClick={() => handleDeleteUnavailability(u.id)} style={iconBtn} aria-label="Supprimer"><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
