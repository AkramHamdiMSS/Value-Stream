import { useEffect, useState } from "react";
import { Sun, Moon, Loader2 } from "lucide-react";
import { api } from "../api";
import { BrandMark } from "../components/ui";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SelectNative } from "../components/ui/select";

export default function LoginScreen({ onLogin, theme, onToggleTheme }) {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/auth/accounts")
      .then((list) => {
        setAccounts(list);
        const firstSvo = list.find((a) => a.role === "svo");
        setSelected((firstSvo || list[0])?.name || "");
      })
      .catch(() => setError("Impossible de contacter le serveur."));
  }, []);

  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name));

  const submit = async () => {
    if (!selected) { setError("Choisissez un compte."); return; }
    setBusy(true);
    setError("");
    try {
      await onLogin(selected, password);
    } catch (e) {
      setError(e.message || "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center relative">
      {onToggleTheme && (
        <Button variant="outline" size="icon" onClick={onToggleTheme} className="absolute top-5 right-5" aria-label="Changer de thème">
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      )}

      <div className="w-[360px] rounded-xl border bg-card p-7 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1.5">
          <BrandMark size={22} />
          <div className="text-lg font-semibold tracking-tight">Pilotage ressources</div>
        </div>
        <p className="text-xs text-muted-foreground mb-6">MS Solutions — connectez-vous pour accéder à votre espace.</p>

        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="account">Compte</label>
          <SelectNative id="account" value={selected} onChange={(e) => { setSelected(e.target.value); setError(""); }}>
            {sortedAccounts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </SelectNative>
        </div>

        <div className="flex flex-col gap-1.5 mb-5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="password">Mot de passe</label>
          <Input id="password" type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        </div>

        {error && <div className="text-destructive text-xs mb-4">{error}</div>}

        <Button onClick={submit} disabled={busy} className="w-full">
          {busy && <Loader2 className="animate-spin" />} {busy ? "Connexion…" : "Se connecter"}
        </Button>

        <div className="mt-5 border-t pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
          Le Head of Value Stream crée le mot de passe initial de chaque SVO dans l'onglet Rôles.
        </div>
      </div>
    </div>
  );
}
