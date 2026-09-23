import { useState } from "react";
import { api } from "../api";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ChangePasswordModal({ user, hasPassword, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!next || next.length < 4) { setError("Le nouveau mot de passe doit faire au moins 4 caractères."); return; }
    if (next !== confirm) { setError("La confirmation ne correspond pas."); return; }
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open title={`Mot de passe — ${user.name}`} onClose={onClose}>
      {done ? (
        <>
          <p className="flex items-center gap-2 text-success text-[13px] my-3"><CheckCircle2 size={15} /> Mot de passe mis à jour.</p>
          <Button onClick={onClose} className="w-full">Fermer</Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-xs mb-4">
            {hasPassword ? "Changez votre mot de passe." : "Aucun mot de passe défini — créez-en un."}
          </p>
          <div className="flex flex-col gap-3 mb-4">
            {hasPassword && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Mot de passe actuel</label>
                <Input type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setError(""); }} />
              </div>
            )}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Nouveau mot de passe</label>
              <Input type="password" value={next} onChange={(e) => { setNext(e.target.value); setError(""); }} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Confirmer</label>
              <Input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
            </div>
          </div>
          {error && <div className="text-destructive text-[12.5px] mb-3">{error}</div>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={submit} disabled={busy} className="flex-1">
              {busy && <Loader2 className="animate-spin" />} Valider
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
