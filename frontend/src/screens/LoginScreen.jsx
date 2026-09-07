import { useEffect, useState } from "react";
import { api } from "../api";
import { NAVY, SURFACE, BORDER, TEXT, MUTED, FONT_BODY, FONT_DISPLAY, inputStyle, btnPrimary } from "../styles";
import { BrandMark } from "../components/ui";

export default function LoginScreen({ onLogin }) {
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

  const svoAccounts = accounts.filter((a) => a.role === "svo");
  const hsvAccounts = accounts.filter((a) => a.role === "hsv");

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
    <div style={{ background: NAVY, color: TEXT, fontFamily: FONT_BODY, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 340, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <BrandMark size={20} />
          <div style={{ fontSize: 17, fontWeight: 600, fontFamily: FONT_DISPLAY }}>Pilotage ressources</div>
        </div>
        <p style={{ color: MUTED, fontSize: 12.5, margin: "0 0 20px" }}>MS Solutions — connectez-vous pour accéder à votre espace.</p>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Compte</div>
          <select value={selected} onChange={(e) => { setSelected(e.target.value); setError(""); }} style={{ ...inputStyle, width: "100%" }}>
            <optgroup label="SVO">
              {svoAccounts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </optgroup>
            <optgroup label="Value Stream">
              {hsvAccounts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </optgroup>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Mot de passe</div>
          <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            style={{ ...inputStyle, width: "100%" }} />
        </div>

        {error && <div style={{ color: "#fca5a5", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

        <button onClick={submit} disabled={busy} style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${BORDER}`, fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
          Le Head of Value Stream crée le mot de passe initial de chaque SVO dans l'onglet Rôles.
        </div>
      </div>
    </div>
  );
}
