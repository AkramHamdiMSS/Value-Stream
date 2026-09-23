import { Fragment, useEffect, useState } from "react";
import { Plus, KeyRound, Trash2, ShieldCheck, ArrowUpCircle } from "lucide-react";
import { api } from "../api";
import { PERMISSIONS } from "../lib/permissions";
import { isValidEmail } from "../lib/validate";
import { showToast } from "../lib/toast";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SelectNative } from "../components/ui/select";
import { Badge2 } from "../components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/table";
import { cn } from "../lib/utils";

export default function RolesView({ svoUsers, pool, isHSV, onChanged }) {
  const [newPersonId, setNewPersonId] = useState("");
  const [standaloneName, setStandaloneName] = useState("");
  const [error, setError] = useState("");
  const [pwDrafts, setPwDrafts] = useState({});
  const [names, setNames] = useState({});
  const [emails, setEmails] = useState({});
  const [openPermsFor, setOpenPermsFor] = useState(null);
  // Optimistic override so rapid successive toggles each build on the latest
  // known value instead of the (possibly stale) svoUsers prop.
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
    } catch (e) { setError(e.message); }
  };

  const addStandaloneSvo = async () => {
    const name = standaloneName.trim();
    if (!name) { setError("Entrez un nom avant d'ajouter."); return; }
    try {
      await api.post("/users", { name, role: "svo" });
      setStandaloneName("");
      setError("");
      onChanged();
    } catch (e) { setError(e.message); }
  };

  const renameUser = async (id) => {
    const name = (names[id] ?? "").trim();
    if (!name) return;
    try { await api.patch(`/users/${id}`, { name }); onChanged(); loadHsv(); } catch (e) { setError(e.message); }
  };
  const saveEmail = async (id) => {
    const email = (emails[id] ?? "").trim();
    if (email && !isValidEmail(email)) {
      showToast("Adresse email invalide — format attendu : nom@domaine.com", "error");
      return;
    }
    try { await api.patch(`/users/${id}`, { email }); onChanged(); loadHsv(); } catch (e) { setError(e.message); }
  };
  const removeSvo = async (id) => {
    try { await api.delete(`/users/${id}`); onChanged(); } catch (e) { setError(e.message); }
  };
  const promoteToHsv = async (id) => {
    try { await api.patch(`/users/${id}/role`, { role: "hsv" }); onChanged(); loadHsv(); } catch (e) { setError(e.message); }
  };
  const demoteToSvo = async (id) => {
    try { await api.patch(`/users/${id}/role`, { role: "svo" }); onChanged(); loadHsv(); } catch (e) { setError(e.message); }
  };
  const removeHsv = async (id) => {
    try { await api.delete(`/users/${id}`); loadHsv(); } catch (e) { setError(e.message); }
  };
  const setPassword = async (id) => {
    const draft = (pwDrafts[id] || "").trim();
    if (draft.length < 4) return;
    try {
      await api.post(`/users/${id}/set-password`, { password: draft });
      setPwDrafts({ ...pwDrafts, [id]: "" });
      onChanged(); loadHsv();
    } catch (e) { setError(e.message); }
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

  const PasswordRow = ({ s }) => (
    <div className="flex gap-1.5">
      <Input type="text" placeholder="Nouveau mot de passe" value={pwDrafts[s.id] || ""}
        onChange={(e) => setPwDrafts({ ...pwDrafts, [s.id]: e.target.value })} className="h-8 w-40" />
      <Button variant="outline" size="sm" onClick={() => setPassword(s.id)} disabled={(pwDrafts[s.id] || "").trim().length < 4}>
        <KeyRound /> Définir
      </Button>
    </div>
  );
  const NameCell = ({ u }) => (
    <Input value={names[u.id] ?? u.name} onChange={(e) => setNames({ ...names, [u.id]: e.target.value })}
      onBlur={() => renameUser(u.id)} className="h-8 w-44" />
  );
  const EmailCell = ({ u }) => (
    <Input type="email" placeholder="email@…" value={emails[u.id] ?? u.email ?? ""}
      onChange={(e) => setEmails({ ...emails, [u.id]: e.target.value })} onBlur={() => saveEmail(u.id)} className="h-8 w-52" />
  );
  const AccountBadge = ({ has }) => has ? <Badge2 variant="success">Actif</Badge2> : <Badge2 variant="warning">Sans mot de passe</Badge2>;

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight mb-1">Gestion des rôles</h1>
      <p className="text-muted-foreground text-[13px] mb-5 max-w-xl">
        Créez ici le mot de passe initial de chaque SVO — chacun pourra ensuite le changer lui-même depuis sa
        propre session. {isHSV && "Le Head of Value Stream peut aussi accorder des permissions supplémentaires à chaque SVO."}
      </p>

      <Card className="mb-4">
        <CardContent className="p-0">
          <Table>
            <THead>
              <tr>
                <TH>SVO</TH><TH>Email</TH><TH>Projets</TH><TH>Compte</TH><TH>Définir / réinitialiser le mot de passe</TH>
                {isHSV && <TH>Permissions</TH>}
                <TH></TH>
              </tr>
            </THead>
            <TBody>
              {svoUsers.map((s) => (
                <Fragment key={s.id}>
                  <TR>
                    <TD><NameCell u={s} /></TD>
                    <TD><EmailCell u={s} /></TD>
                    <TD className="text-muted-foreground">{s.projectCount}</TD>
                    <TD><AccountBadge has={s.hasPassword} /></TD>
                    <TD><PasswordRow s={s} /></TD>
                    {isHSV && (
                      <TD>
                        <Button variant="outline" size="sm" onClick={() => setOpenPermsFor(openPermsFor === s.id ? null : s.id)}
                          className={cn(effectivePerms(s).length > 0 ? "text-primary border-primary/40" : "text-muted-foreground")}>
                          <ShieldCheck /> {effectivePerms(s).length > 0 ? `${effectivePerms(s).length} accordée(s)` : "Aucune"}
                        </Button>
                      </TD>
                    )}
                    <TD>
                      <div className="flex gap-1 justify-end">
                        {isHSV && (
                          <Button variant="ghost" size="icon" onClick={() => promoteToHsv(s.id)} title="Promouvoir en Head of Value Stream">
                            <ArrowUpCircle />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => removeSvo(s.id)} disabled={s.projectCount > 0}
                          title={s.projectCount > 0 ? "Réaffectez d'abord ses projets à un autre SVO" : "Retirer"} className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                  {isHSV && openPermsFor === s.id && (
                    <tr className="bg-muted/40">
                      <td colSpan={7} className="px-4 py-3.5">
                        <div className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                          Permissions supplémentaires — {s.name}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 gap-x-5">
                          {PERMISSIONS.map((perm) => (
                            <label key={perm.key} className="flex items-center gap-2 text-[12.5px] cursor-pointer">
                              <input type="checkbox" checked={effectivePerms(s).includes(perm.key)} onChange={() => togglePermission(s, perm.key)} />
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
                <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Aucun SVO.</td></tr>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {isHSV && (
        <Card className="mb-5">
          <CardContent className="p-0">
            <Table>
              <THead>
                <tr>
                  <TH>Head of Value Stream</TH><TH>Email</TH><TH>Compte</TH><TH>Définir / réinitialiser le mot de passe</TH><TH></TH>
                </tr>
              </THead>
              <TBody>
                {hsvUsers.map((h) => (
                  <TR key={h.id}>
                    <TD><NameCell u={h} /></TD>
                    <TD><EmailCell u={h} /></TD>
                    <TD><AccountBadge has={h.hasPassword} /></TD>
                    <TD><PasswordRow s={h} /></TD>
                    <TD>
                      <div className="flex gap-1.5 justify-end">
                        <Button variant="outline" size="sm" onClick={() => demoteToSvo(h.id)} disabled={hsvUsers.length <= 1}
                          title={hsvUsers.length <= 1 ? "Impossible de rétrograder le dernier compte" : undefined}>
                          Rétrograder en SVO
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeHsv(h.id)} disabled={hsvUsers.length <= 1}
                          title={hsvUsers.length <= 1 ? "Impossible de supprimer le dernier compte" : "Supprimer"}
                          className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
                {hsvUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Aucun compte Head of Value Stream.</td></tr>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ajouter un SVO depuis le pool</div>
          <div className="flex gap-2 items-center max-w-lg">
            <SelectNative value={newPersonId} onChange={(e) => { setNewPersonId(e.target.value); setError(""); }} className="flex-1">
              <option value="">Choisir une personne du pool…</option>
              {availablePool.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.squad}, {p.roleTitle}</option>
              ))}
            </SelectNative>
            <Button size="sm" onClick={addSvo}><Plus /> Ajouter</Button>
          </div>
          {availablePool.length === 0 && (
            <div className="text-muted-foreground text-[12.5px] mt-1.5">
              Tout le monde dans le pool est déjà SVO. Ajoutez d'abord une personne dans l'onglet Pool.
            </div>
          )}

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2 border-t pt-4">
            Ou créer un compte hors pool (ex. un manager sans profil de développement)
          </div>
          <div className="flex gap-2 items-center max-w-lg">
            <Input value={standaloneName} onChange={(e) => { setStandaloneName(e.target.value); setError(""); }}
              placeholder="Ex. Head of Payment Acceptance" className="flex-1" />
            <Button size="sm" onClick={addStandaloneSvo}><Plus /> Ajouter</Button>
          </div>
          {error && <div className="text-destructive text-[12.5px] mt-2">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
