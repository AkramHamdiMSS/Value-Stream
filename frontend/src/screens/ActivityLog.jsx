import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../api";
import { SURFACE, SURFACE2, BORDER, MUTED, ACCENT, TEXT, RED, CARD_SHADOW, inputStyle } from "../styles";
import { Th, Td } from "../components/ui";

function formatWhen(iso) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityLog({ svoUsers, onOpenProject }) {
  const [logs, setLogs] = useState(null);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLogs(null);
    api.get(`/activity${userId ? `?userId=${userId}` : ""}`).then(setLogs).catch((e) => setError(e.message));
  }, [userId]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Activité</h1>
          <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 0" }}>
            Historique des actions des SVO et du Head of Value Stream — créations, demandes, affectations.
          </p>
        </div>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
          <option value="">Tous les comptes</option>
          {svoUsers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {error && <div style={{ color: RED, fontSize: 12.5, margin: "12px 0" }}>{error}</div>}

      {!logs ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, padding: 40 }}>
          <Loader2 className="animate-spin" size={18} /> Chargement…
        </div>
      ) : (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: CARD_SHADOW, marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: SURFACE2 }}>
                <Th>Quand</Th><Th>Qui</Th><Th>Action</Th><Th>Projet</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Td><span style={{ color: MUTED }}>{formatWhen(log.createdAt)}</span></Td>
                  <Td><span style={{ fontWeight: 600, color: TEXT }}>{log.userName}</span></Td>
                  <Td>{log.action}</Td>
                  <Td>
                    {log.projectId ? (
                      <button onClick={() => onOpenProject(log.projectId)} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13, padding: 0 }}>
                        {log.projectName}
                      </button>
                    ) : (
                      <span style={{ color: MUTED }}>—</span>
                    )}
                  </Td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: MUTED }}>Aucune activité pour l'instant.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
