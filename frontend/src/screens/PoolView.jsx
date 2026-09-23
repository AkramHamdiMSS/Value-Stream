import { useState } from "react";
import { Plus, Trash2, Calendar, X, Timer, Download, Terminal } from "lucide-react";
import { api } from "../api";
import { SURFACE, SURFACE2, BORDER, MUTED, GREEN, RED, CARD_SHADOW, inputStyle, btnPrimary, btnGhost, iconBtn } from "../styles";
import { Th, Td } from "../components/ui";
import { isValidEmail } from "../lib/validate";
import { showToast } from "../lib/toast";


// Date stored as ISO timestamp (or already a "YYYY-MM-DD" draft) → value for
// an <input type="date">; empty when unset.
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");

export default function PoolView({ pool, overAllocGrid, periods, onChanged, unavailabilitiesData = {} }) {
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [syncingTempo, setSyncingTempo] = useState(false);
  const [extractingAscii, setExtractingAscii] = useState(false);
  const [asciiLogs, setAsciiLogs] = useState([]);
  const [showAsciiLogs, setShowAsciiLogs] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState(false);
  const [newUnavailability, setNewUnavailability] = useState({
    startDate: "",
    endDate: "",
    type: "congé",
    comment: ""
  });

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
    if (key === "email" && value.trim() && !isValidEmail(value)) {
      showToast("Adresse email invalide — format attendu : nom@domaine.com", "error");
      return;
    }
    // Contract time comes from a "80" style input → 0.8 for the API.
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
    } catch (e) {
      setError(e.message);
    }
  };
  const draftValue = (p, key) => drafts[p.id]?.[key] ?? p[key];
  const setDraft = (id, key, value) => setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));

  const handleOpenUnavailability = async (member) => {
    setSelectedMember(member);
    try {
      const rows = await api.get(`/pool/${member.id}/unavailabilities`);
      setUnavailabilities(rows);
      setShowUnavailabilityModal(true);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddUnavailability = async () => {
    if (!newUnavailability.startDate || !newUnavailability.endDate) {
      showToast("Veuillez remplir les dates de début et de fin", "error");
      return;
    }
    try {
      await api.post(`/pool/${selectedMember.id}/unavailabilities`, newUnavailability);
      const rows = await api.get(`/pool/${selectedMember.id}/unavailabilities`);
      setUnavailabilities(rows);
      setNewUnavailability({ startDate: "", endDate: "", type: "congé", comment: "" });
      showToast("Indisponibilité ajoutée", "success");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteUnavailability = async (unavailabilityId) => {
    try {
      await api.delete(`/pool/${selectedMember.id}/unavailabilities/${unavailabilityId}`);
      const rows = await api.get(`/pool/${selectedMember.id}/unavailabilities`);
      setUnavailabilities(rows);
      showToast("Indisponibilité supprimée", "success");
    } catch (e) {
      setError(e.message);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getUnavailabilitySummary = (memberId) => {
    const memberUnavailabilities = unavailabilitiesData?.[memberId] || [];
    if (memberUnavailabilities.length === 0) return null;
    
    const count = memberUnavailabilities.length;
    const types = memberUnavailabilities.map(u => u.type);
    const uniqueTypes = [...new Set(types)];
    
    return `${count} ${uniqueTypes.join(', ')}`;
  };

  const handleSyncTempo = async () => {
    setSyncingTempo(true);
    try {
      const summary = await api.post("/admin/sync-tempo");
      showToast(
        `Synchro Tempo : ${summary.matched} ligne(s) mises à jour` +
        (summary.unmatchedAccounts
          ? ` — ${summary.unmatchedAccounts} compte(s) Jira non rattachés`
          : ""),
        "success"
      );
      onChanged();
    } catch {
      // api.js already toasts the error message.
    } finally {
      setSyncingTempo(false);
    }
  };

  const handleExtractAscii = async () => {
    console.log('🔘 Bouton Importer ASCII cliqué');
    
    if (!confirm("⚠️ Voulez-vous vraiment importer les congés depuis ASCII ?\n\nCela va :\n- Se connecter à ASCII avec vos identifiants\n- Extraire les congés du calendrier\n- Mettre à jour la base de données\n\nCliquez sur OK pour continuer.")) {
      console.log('❌ Utilisateur a annulé');
      return;
    }
    
    console.log('✅ Utilisateur a confirmé');
    setExtractingAscii(true);
    setAsciiLogs([]);
    setShowAsciiLogs(true);
    
    try {
      console.log('🌐 Appel POST /admin/extract-ascii');
      const response = await api.post("/admin/extract-ascii");
      console.log('📨 Réponse reçue:', response);
      
      if (response.success) {
        // Afficher les logs capturés
        if (response.logs && response.logs.length > 0) {
          setAsciiLogs(response.logs);
        } else {
          setAsciiLogs(['Extraction terminée (pas de logs capturés)']);
        }
        
        showToast("Extraction ASCII terminée avec succès !", "success");
        onChanged();
      } else {
        if (response.logs && response.logs.length > 0) {
          setAsciiLogs(response.logs);
        }
        showToast(response.error || "Erreur lors de l'extraction ASCII", "error");
      }
    } catch (e) {
      console.error('❌ Erreur dans handleExtractAscii:', e);
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pool de ressources</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 0" }}>
            Ajouter une personne ici la rend aussitôt disponible dans les listes déroulantes d'affectation.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSyncTempo} disabled={syncingTempo} style={{ ...btnGhost, opacity: syncingTempo ? 0.6 : 1 }}>
            <Timer size={15} /> {syncingTempo ? "Synchronisation..." : "Synchroniser Tempo"}
          </button>
          <button onClick={handleExtractAscii} disabled={extractingAscii} style={{ ...btnGhost, opacity: extractingAscii ? 0.6 : 1 }}>
            <Download size={15} /> {extractingAscii ? "Extraction..." : "Importer ASCII"}
          </button>
          <button onClick={addPerson} style={btnPrimary}><Plus size={15} /> Ajouter une personne</button>
        </div>
      </div>

      {error && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

      {showAsciiLogs && (
        <div style={{ 
          background: '#1e1e1e', 
          color: '#00ff00', 
          fontFamily: 'monospace', 
          fontSize: 12, 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 16,
          maxHeight: 300,
          overflow: 'auto',
          border: `1px solid ${BORDER}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={16} />
              <span style={{ fontWeight: 600 }}>Extraction ASCII - Logs en temps réel</span>
            </div>
            <button 
              onClick={() => setShowAsciiLogs(false)}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#fff', 
                cursor: 'pointer',
                fontSize: 18
              }}
            >
              ×
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {asciiLogs.length === 0 && extractingAscii && (
              <div style={{ color: '#888' }}>⏳ Démarrage de l'extraction...</div>
            )}
            {asciiLogs.map((log, index) => (
              <div key={index} style={{ 
                color: log.includes('❌') ? '#ff6b6b' : 
                       log.includes('✅') ? '#51cf66' : 
                       log.includes('⚠️') ? '#ffd43b' : '#00ff00',
                whiteSpace: 'pre-wrap'
              }}>
                {log}
              </div>
            ))}
            {extractingAscii && (
              <div style={{ color: '#888', marginTop: 8 }}>
                ▶ Extraction en cours...
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: CARD_SHADOW }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: SURFACE2 }}>
              <Th>Nom</Th><Th>Email</Th><Th>Jira Account ID</Th><Th>Squad</Th><Th>Sous-équipe</Th><Th>Rôle</Th>
              <Th title="Temps de travail contractuel : 100 = plein temps, 50 = mi-temps. Réduit la capacité et le seuil de sur-allocation.">Temps</Th>
              <Th title="Avant cette date, la personne n'apporte aucune capacité.">Arrivée</Th>
              <Th title="Après cette date, la personne n'apporte plus aucune capacité.">Départ</Th>
              <Th>Indisponibilités</Th><Th>Pic de charge</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {pool.map((p) => {
              const peak = peakFor(p.id);
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td><input value={draftValue(p, "name")} onChange={(e) => setDraft(p.id, "name", e.target.value)}
                    onBlur={(e) => patchPerson(p.id, "name", e.target.value)} style={inputStyle} /></Td>
                  <Td><input type="email" placeholder="email@…" value={draftValue(p, "email") ?? ""} onChange={(e) => setDraft(p.id, "email", e.target.value)}
                    onBlur={(e) => patchPerson(p.id, "email", e.target.value)} style={inputStyle} /></Td>
                  <Td><input placeholder="accountId Atlassian" value={draftValue(p, "jiraAccountId") ?? ""} onChange={(e) => setDraft(p.id, "jiraAccountId", e.target.value)}
                    onBlur={(e) => patchPerson(p.id, "jiraAccountId", e.target.value)} style={{ ...inputStyle, width: 140 }} /></Td>
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
                        value={draftValue(p, "capacityPctInput") ?? Math.round(Number(p.capacityPct ?? 1) * 100)}
                        onChange={(e) => setDraft(p.id, "capacityPctInput", e.target.value)}
                        onBlur={(e) => patchPerson(p.id, "capacityPct", e.target.value)}
                        style={{ ...inputStyle, width: 56, textAlign: "right" }} />
                      <span style={{ color: MUTED, fontSize: 12 }}>%</span>
                    </div>
                  </Td>
                  <Td><input type="date" value={toDateInput(draftValue(p, "startDate"))}
                    onChange={(e) => setDraft(p.id, "startDate", e.target.value)}
                    onBlur={(e) => patchPerson(p.id, "startDate", e.target.value)} style={{ ...inputStyle, width: 130 }} /></Td>
                  <Td><input type="date" value={toDateInput(draftValue(p, "endDate"))}
                    onChange={(e) => setDraft(p.id, "endDate", e.target.value)}
                    onBlur={(e) => patchPerson(p.id, "endDate", e.target.value)} style={{ ...inputStyle, width: 130 }} /></Td>
                  <Td>
                    <button 
                      onClick={() => handleOpenUnavailability(p)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 4,
                        color: getUnavailabilitySummary(p.id) ? MUTED : GREEN,
                        fontSize: 12
                      }}
                    >
                      <Calendar size={14} />
                      {getUnavailabilitySummary(p.id) || 'Gérer'}
                    </button>
                  </Td>
                  <Td>
                    <span title={`Seuil de sur-allocation : ${Math.round(Number(p.capacityPct ?? 1) * 100)}% (temps de travail)`}
                      style={{ color: peak > Number(p.capacityPct ?? 1) + 0.001 ? RED : peak > 0 ? GREEN : MUTED, fontWeight: 600 }}>
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

      {showUnavailabilityModal && selectedMember && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: SURFACE,
            borderRadius: 16,
            padding: 24,
            maxWidth: 600,
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: CARD_SHADOW
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Indisponibilités - {selectedMember.name}
              </h2>
              <button onClick={() => setShowUnavailabilityModal(false)} style={iconBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Ajouter une indisponibilité</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Date de début</label>
                  <input
                    type="date"
                    value={newUnavailability.startDate}
                    onChange={(e) => setNewUnavailability({ ...newUnavailability, startDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Date de fin</label>
                  <input
                    type="date"
                    value={newUnavailability.endDate}
                    onChange={(e) => setNewUnavailability({ ...newUnavailability, endDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Type</label>
                <select
                  value={newUnavailability.type}
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, type: e.target.value })}
                  style={inputStyle}
                >
                  <option value="congé">Congé</option>
                  <option value="congé validé">Congé validé</option>
                  <option value="congé refusé">Congé refusé</option>
                  <option value="congé demandé">Congé demandé</option>
                  <option value="maladie">Maladie</option>
                  <option value="formation">Formation</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Commentaire (optionnel)</label>
                <input
                  type="text"
                  value={newUnavailability.comment}
                  onChange={(e) => setNewUnavailability({ ...newUnavailability, comment: e.target.value })}
                  placeholder="Détails..."
                  style={inputStyle}
                />
              </div>
              <button onClick={handleAddUnavailability} style={btnPrimary}>
                Ajouter
              </button>
            </div>

            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Indisponibilités existantes</h3>
              {unavailabilities.length === 0 ? (
                <p style={{ color: MUTED, fontSize: 13 }}>Aucune indisponibilité</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {unavailabilities.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        background: SURFACE2,
                        padding: 12,
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {u.type} - {formatDate(u.startDate)} au {formatDate(u.endDate)}
                        </div>
                        {u.comment && (
                          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{u.comment}</div>
                        )}
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          Source: {u.source === 'ascii' ? 'ASCII (auto)' : 'Manuel'}
                        </div>
                      </div>
                      {u.source === 'manual' && (
                        <button
                          onClick={() => handleDeleteUnavailability(u.id)}
                          style={iconBtn}
                          aria-label="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
