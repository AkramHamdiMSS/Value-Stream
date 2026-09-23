import { Fragment, useEffect, useState } from "react";
import { Loader2, BellRing, Check } from "lucide-react";
import { api } from "../api";
import { showToast } from "../lib/toast";
import { SURFACE, SURFACE2, BORDER, MUTED, ACCENT, GREEN, AMBER, RED, CARD_SHADOW, btnGhost } from "../styles";
import { Th, Td, Badge } from "../components/ui";

const STATUS_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "untreated", label: "Non traitées" },
  { value: "proposed", label: "Team Lead (1ère validation)" },
  { value: "partial", label: "Partiellement couvertes" },
  { value: "validated", label: "Admin (2ème validation)" },
];
const STATUS_BADGE = {
  untreated: { color: AMBER, text: "Non traitée" },
  proposed: { color: ACCENT, text: "Team Lead ✓ (1/2)" },
  partial: { color: AMBER, text: "Partielle" },
  validated: { color: GREEN, text: "Admin ✓✓ (2/2)" },
};

export default function DemandQueue({ canManageAllocations, onOpenProject, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [hideCovered, setHideCovered] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [sendingKey, setSendingKey] = useState(null);
  const [sentKeys, setSentKeys] = useState(() => new Set());

  const load = () => {
    api.get("/demand-queue").then(setRows).catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  const sendReminder = async (row) => {
    setSendingKey(row.key);
    try {
      const { sentTo } = await api.post(`/demand-queue/${encodeURIComponent(row.key)}/remind`);
      setSentKeys((prev) => new Set(prev).add(row.key));
      showToast(
        sentTo > 0
          ? `Rappel envoyé à ${sentTo} Team Lead${sentTo > 1 ? "s" : ""} (${row.profile}).`
          : `Aucun Team Lead configuré pour ${row.profile} — rappel non envoyé.`,
        sentTo > 0 ? "success" : "error"
      );
    } catch {
      // api.js already toasts the error.
    } finally {
      setSendingKey(null);
    }
  };

  if (!rows) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, padding: 40 }}><Loader2 className="animate-spin" size={18} /> Chargement…</div>;
  }

  const visibleRows = rows
    .filter((r) => !hideCovered || r.ecart < -0.001)
    .filter((r) => statusFilter === "all" || r.status === statusFilter);
  const rangeLabel = (row) => (row.periodStart === row.periodEnd ? row.periodStart : `${row.periodStart} → ${row.periodEnd}`);

  // One "demande" is submitted per project+période, with one line per profile —
  // group them back into a single row so the queue reflects that, instead of
  // showing what looks like 3 unrelated demands for PALM PAY / 2026-W38.
  const groups = [];
  const groupIndexByKey = {};
  for (const row of visibleRows) {
    const gKey = `${row.projectId}:${row.periodStart}:${row.periodEnd}`;
    if (!(gKey in groupIndexByKey)) {
      groupIndexByKey[gKey] = groups.length;
      groups.push({ key: gKey, projectId: row.projectId, projectName: row.projectName, svo: row.svo, periodLabel: rangeLabel(row), rows: [] });
    }
    groups[groupIndexByKey[gKey]].rows.push(row);
  }
  groups.sort((a, b) => Math.min(...a.rows.map((r) => r.ecart)) - Math.min(...b.rows.map((r) => r.ecart)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{canManageAllocations ? "Demandes à affecter" : "Demandes de mon équipe"}</h1>
      </div>
      <p style={{ color: MUTED, fontSize: 13, margin: "4px 0 16px" }}>
        {canManageAllocations
          ? "Toutes les demandes soumises par les SVO, tous projets confondus. Choisissez une ressource selon sa disponibilité déjà affichée, sans avoir à ouvrir chaque projet."
          : "Demandes soumises pour votre profil, tous projets confondus. Vos propositions seront à valider par le Head of Value Stream."}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)} style={{
            ...btnGhost, fontSize: 11.5, padding: "5px 10px",
            ...(statusFilter === f.value ? { background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, color: ACCENT, borderColor: ACCENT } : {}),
          }}>
            {f.label}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTED, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={hideCovered} onChange={(e) => setHideCovered(e.target.checked)} />
        Masquer les besoins déjà entièrement couverts
      </label>

      {error && <div style={{ color: RED, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", boxShadow: CARD_SHADOW }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: SURFACE2 }}>
              <Th>Projet</Th><Th>SVO</Th><Th>Période</Th><Th>Profil</Th><Th>Demandé</Th><Th>Alloué</Th><Th>Écart</Th><Th>Couverture</Th><Th>Statut</Th>
              {canManageAllocations && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                {g.rows.map((row, i) => {
                  const sent = sentKeys.has(row.key);
                  const sending = sendingKey === row.key;
                  return (
                    <tr key={row.key} style={{ borderTop: i === 0 ? `1px solid ${BORDER}` : "none" }}>
                      {i === 0 && (
                        <>
                          <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>
                            <button onClick={() => onOpenProject(g.projectId)} style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 13, padding: 0 }}>{g.projectName}</button>
                          </Td>
                          <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>{g.svo}</Td>
                          <Td rowSpan={g.rows.length} style={{ verticalAlign: "top" }}>{g.periodLabel}</Td>
                        </>
                      )}
                      <Td>{row.profile}</Td>
                      <Td>{row.demanded}</Td>
                      <Td>{row.allocated}</Td>
                      <Td><span style={{ color: row.ecart < -0.001 ? RED : GREEN, fontWeight: 600 }}>{row.ecart}</span></Td>
                      <Td title={`${row.coveredWeeks}/${row.weeks} semaine(s) entièrement couverte(s)`}>
                        <span style={{ color: row.couverture >= 100 ? GREEN : row.couverture > 0 ? AMBER : MUTED, fontWeight: 600 }}>{row.couverture}%</span>
                        <span style={{ color: MUTED, fontSize: 11.5 }}> · {row.coveredWeeks}/{row.weeks} sem.</span>
                      </Td>
                      <Td><Badge color={STATUS_BADGE[row.status]?.color || MUTED} text={STATUS_BADGE[row.status]?.text || row.status} /></Td>
                      {canManageAllocations && (
                        <Td>
                          {row.status === "untreated" && (
                            sent ? (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, color: GREEN, fontSize: 12, fontWeight: 600 }}>
                                <Check size={13} /> Envoyé
                              </span>
                            ) : (
                              <button onClick={() => sendReminder(row)} disabled={sending} style={{
                                ...btnGhost, fontSize: 11.5, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5,
                                opacity: sending ? 0.6 : 1, cursor: sending ? "not-allowed" : "pointer",
                              }}>
                                {sending ? <Loader2 className="animate-spin" size={13} /> : <BellRing size={13} />} Rappel
                              </button>
                            )
                          )}
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {visibleRows.length === 0 && (
              <tr><td colSpan={canManageAllocations ? 9 : 8} style={{ padding: 24, textAlign: "center", color: MUTED }}>
                {hideCovered ? "Aucun besoin en attente — tout est couvert." : "Aucune demande soumise pour l'instant."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
