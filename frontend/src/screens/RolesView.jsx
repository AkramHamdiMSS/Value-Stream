import { Fragment, useEffect, useState } from "react";
import { Plus, KeyRound, Trash2, ShieldCheck, ArrowUpCircle } from "lucide-react";
import { api } from "../api";
import { SURFACE, SURFACE2, BORDER, MUTED, GREEN, AMBER, RED, ACCENT, CARD_SHADOW, inputStyle, btnPrimary, btnGhost, iconBtn } from "../styles";
import { PERMISSIONS } from "../lib/permissions";
import { Th, Td, Badge } from "../components/ui";

export default function RolesView({ svoUsers, pool, isHSV, onChanged }) {
  const [newPersonId, setNewPersonId] = useState("");
  const [standaloneName, setStandaloneName] = useState("");
  const [error, setError] = useState("");
  const [pwDrafts, setPwDrafts] = useState({});
  const [names, setNames] = useState({});
  const [openPermsFor, setOpenPermsFor] = useState(null);
  // Optimistic override so rapid successive toggles each build on the latest
  // known value instead of the (possibly stale) svoUsers prop — without this,
  // two clicks fired before the refetch resolves both read the same base
  // permissions and the second PATCH silently clobbers the first.
  const [permsLocal, setPermsLocal] = useState({});
  const effectivePerms = (user) => permsLocal[user.id] ?? user.permissions ?? [];

  const [hsvUsers, setHsvUsers] = useState([]);
  const loadHsv = () => api.get("/users?role=hsv").then(setHsvUsers);
  useEffect(() => { if (isHSV) loadHsv(); }, [isHSV]);

  const availablePool = pool.filter((p) => !svoUsers.some((s) => s.name.toLowerCase() === p.name.toLowerCase()));

  const addSvo = async () => {
    if (!newPersonId) { setError("Choisissez une personne dans la liste avant d'ajouter."); return; }
    try {
      await api.post("/users", { poolMemberId: newPersonId, role: "svo" });
      setNewPersonId("");
      setError("");
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  // For someone who needs an account but isn't a delivery-pool resource (e.g. a
  // department head tracking activity, not doing dev work) — the pool represents
  // squad capacity, so forcing them in there would skew capacity/allocation math.
  const addStandaloneSvo = async () => {
    const name = standaloneName.trim();
    if (!name) { setError("Entrez un nom avant d'ajouter."); return; }
    try {
      await api.post("/users", { name, role: "svo" });
      setStandaloneName("");
      setError("");
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const renameUser = async (id) => {
    const name = (names[id] ?? "").trim();
    if (!name) return;
    try {
      await api.patch(`/users/${id}`, { name });
      onChanged();
      loadHsv();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeSvo = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const promoteToHsv = async (id) => {
    try {
      await api.patch(`/users/${id}/role`, { role: "hsv" });
      onChanged();
      loadHsv();
    } catch (e) {
      setError(e.message);
    }
  };

  const demoteToSvo = async (id) => {
    try {
      await api.patch(`/users/${id}/role`, { role: "svo" });
      onChanged();
      loadHsv();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeHsv = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      loadHsv();
    } catch (e) {
      setError(e.message);
    }
  };

  const setPassword = async (id) => {
    const draft = (pwDrafts[id] || "").trim();
    if (draft.length < 4) return;
    try {
      await api.post(`/users/${id}/set-password`, { password: draft });
      setPwDrafts({ ...pwDrafts, [id]: "" });
      onChanged();
      loadHsv();
    } catch (e) {
      setError(e.message);
    }
  };

  const togglePermission = async (user, key) => {
    const current = effectivePerms(user);
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setPermsLocal((prev) => ({ ...prev, [user.id]: next }));
    try {
      await api.patch(`/users/${user.id}/permissions`, { permissions: next });
      onChanged();
    } catch (e) {
      setError(e.message);
      setPermsLocal((prev) => ({ ...prev, [user.id]: current }));
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Gestion des rôles</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: "0 0 20px", maxWidth: 620 }}>
        Créez ici le mot de passe initial de chaque SVO — chacun pourra ensuite le changer lui-même depuis sa
        propre session ("Mot de passe" dans la sidebar).
        {isHSV && " Le Head of Value Stream peut aussi accorder des permissions supplémentaires à chaque SVO."}
      </p>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 16, boxShadow: CARD_SHADOW }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: SURFACE2 }}>
              <Th>SVO</Th><Th>Projets</Th><Th>Compte</Th><Th>Définir / réinitialiser le mot de passe</Th>
              {isHSV && <Th>Permissions</Th>}
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {svoUsers.map((s) => (
              <Fragment key={s.id}>
                <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td>
                    <input value={names[s.id] ?? s.name} onChange={(e) => setNames({ ...names, [s.id]: e.target.value })}
                      onBlur={() => renameUser(s.id)} style={inputStyle} />
                  </Td>
                  <Td><span style={{ color: MUTED }}>{s.projectCount}</span></Td>
                  <Td>
                    {s.hasPassword ? <Badge color={GREEN} text="Actif" /> : <Badge color={AMBER} text="Sans mot de passe" />}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="text" placeholder="Nouveau mot de passe" value={pwDrafts[s.id] || ""}
                        onChange={(e) => setPwDrafts({ ...pwDrafts, [s.id]: e.target.value })}
                        style={{ ...inputStyle, width: 150 }} />
                      <button onClick={() => setPassword(s.id)} disabled={(pwDrafts[s.id] || "").trim().length < 4}
                        style={{ ...btnGhost, opacity: (pwDrafts[s.id] || "").trim().length < 4 ? 0.4 : 1 }}>
                        <KeyRound size={13} /> Définir
                      </button>
                    </div>
                  </Td>
                  {isHSV && (
                    <Td>
                      <button onClick={() => setOpenPermsFor(openPermsFor === s.id ? null : s.id)}
                        style={{ ...btnGhost, fontSize: 11.5, color: effectivePerms(s).length > 0 ? ACCENT : MUTED }}>
                        <ShieldCheck size={13} /> {effectivePerms(s).length > 0 ? `${effectivePerms(s).length} accordée(s)` : "Aucune"}
                      </button>
                    </Td>
                  )}
                  <Td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {isHSV && (
                        <button onClick={() => promoteToHsv(s.id)} title="Promouvoir en Head of Value Stream"
                          style={iconBtn}>
                          <ArrowUpCircle size={14} />
                        </button>
                      )}
                      <button onClick={() => removeSvo(s.id)} disabled={s.projectCount > 0}
                        title={s.projectCount > 0 ? "Réaffectez d'abord ses projets à un autre SVO" : "Retirer"}
                        style={{ ...iconBtn, opacity: s.projectCount > 0 ? 0.35 : 1, cursor: s.projectCount > 0 ? "not-allowed" : "pointer" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Td>
                </tr>
                {isHSV && openPermsFor === s.id && (
                  <tr style={{ background: SURFACE2 }}>
                    <td colSpan={6} style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Permissions supplémentaires — {s.name}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
                        {PERMISSIONS.map((perm) => (
                          <label key={perm.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                            <input type="checkbox" checked={effectivePerms(s).includes(perm.key)}
                              onChange={() => togglePermission(s, perm.key)} />
                            {perm.label}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {svoUsers.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: MUTED }}>Aucun SVO.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isHSV && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 16, boxShadow: CARD_SHADOW }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: SURFACE2 }}>
                <Th>Head of Value Stream</Th><Th>Compte</Th><Th>Définir / réinitialiser le mot de passe</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {hsvUsers.map((h) => (
                <tr key={h.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td>
                    <input value={names[h.id] ?? h.name} onChange={(e) => setNames({ ...names, [h.id]: e.target.value })}
                      onBlur={() => renameUser(h.id)} style={inputStyle} />
                  </Td>
                  <Td>
                    {h.hasPassword ? <Badge color={GREEN} text="Actif" /> : <Badge color={AMBER} text="Sans mot de passe" />}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="text" placeholder="Nouveau mot de passe" value={pwDrafts[h.id] || ""}
                        onChange={(e) => setPwDrafts({ ...pwDrafts, [h.id]: e.target.value })}
                        style={{ ...inputStyle, width: 150 }} />
                      <button onClick={() => setPassword(h.id)} disabled={(pwDrafts[h.id] || "").trim().length < 4}
                        style={{ ...btnGhost, opacity: (pwDrafts[h.id] || "").trim().length < 4 ? 0.4 : 1 }}>
                        <KeyRound size={13} /> Définir
                      </button>
                    </div>
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => demoteToSvo(h.id)} disabled={hsvUsers.length <= 1}
                        title={hsvUsers.length <= 1 ? "Impossible de rétrograder le dernier compte" : "Rétrograder en SVO"}
                        style={{ ...btnGhost, fontSize: 11.5, opacity: hsvUsers.length <= 1 ? 0.4 : 1 }}>
                        Rétrograder en SVO
                      </button>
                      <button onClick={() => removeHsv(h.id)} disabled={hsvUsers.length <= 1}
                        title={hsvUsers.length <= 1 ? "Impossible de supprimer le dernier compte" : "Supprimer"}
                        style={{ ...iconBtn, opacity: hsvUsers.length <= 1 ? 0.35 : 1, cursor: hsvUsers.length <= 1 ? "not-allowed" : "pointer" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {hsvUsers.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: MUTED }}>Aucun compte Head of Value Stream.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
        Ajouter un SVO depuis le pool
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 420 }}>
        <select value={newPersonId} onChange={(e) => { setNewPersonId(e.target.value); setError(""); }} style={{ ...inputStyle, flex: 1 }}>
          <option value="">Choisir une personne du pool…</option>
          {availablePool.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.squad}, {p.roleTitle}</option>
          ))}
        </select>
        <button onClick={addSvo} style={btnPrimary}><Plus size={15} /> Ajouter</button>
      </div>
      {availablePool.length === 0 && (
        <div style={{ color: MUTED, fontSize: 12.5, marginTop: 6 }}>
          Tout le monde dans le pool est déjà SVO. Ajoutez d'abord une personne dans l'onglet Pool.
        </div>
      )}

      <div style={{ fontSize: 11, color: MUTED, margin: "16px 0 6px", textTransform: "uppercase", fontWeight: 600 }}>
        Ou créer un compte hors pool (ex. un manager sans profil de développement)
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 420 }}>
        <input value={standaloneName} onChange={(e) => { setStandaloneName(e.target.value); setError(""); }}
          placeholder="Ex. Head of Payment Acceptance" style={{ ...inputStyle, flex: 1 }} />
        <button onClick={addStandaloneSvo} style={btnPrimary}><Plus size={15} /> Ajouter</button>
      </div>

      {error && <div style={{ color: RED, fontSize: 12.5, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
