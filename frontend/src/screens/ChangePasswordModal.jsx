import { useState } from "react";
import { api } from "../api";
import { SURFACE, BORDER, TEXT, MUTED, FONT_BODY, inputStyle, btnPrimary, btnGhost } from "../styles";

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ width: 320, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, color: TEXT, fontFamily: FONT_BODY }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Mot de passe — {user.name}</div>
        {done ? (
          <>
            <p style={{ color: "#6ee7b7", fontSize: 13, margin: "12px 0 16px" }}>Mot de passe mis à jour.</p>
            <button onClick={onClose} style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>Fermer</button>
          </>
        ) : (
          <>
            <p style={{ color: MUTED, fontSize: 12, margin: "4px 0 16px" }}>
              {hasPassword ? "Changez votre mot de passe." : "Aucun mot de passe défini — créez-en un."}
            </p>
            {hasPassword && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Mot de passe actuel</div>
                <input type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setError(""); }} style={{ ...inputStyle, width: "100%" }} />
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Nouveau mot de passe</div>
              <input type="password" value={next} onChange={(e) => { setNext(e.target.value); setError(""); }} style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Confirmer</div>
              <input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} style={{ ...inputStyle, width: "100%" }} />
            </div>
            {error && <div style={{ color: "#fca5a5", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Annuler</button>
              <button onClick={submit} disabled={busy} style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: busy ? 0.6 : 1 }}>Valider</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
